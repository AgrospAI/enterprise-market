/**
 * @jest-environment node
 */
import { Wallet } from 'ethers'
import type { NextApiRequest, NextApiResponse } from 'next'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import logout from '../../pages/api/siwe/logout'
import nonceRoute from '../../pages/api/siwe/nonce'
import sessionRoute from '../../pages/api/siwe/session'
import verify from '../../pages/api/siwe/verify'
import { getVerifiedSiweAddress } from '../../pages/api/siwe/_session'

const ORIGIN = 'https://market.example'
const CHAIN_ID = 11155420

const ENV = {
  SIWE_SESSION_SECRET: 'x'.repeat(32),
  SIWE_ORIGIN: ORIGIN,
  SIWE_CHAIN_ID: String(CHAIN_ID),
  MCP_URL: 'http://mcp.test/mcp',
  MCP_AUTH_TOKEN: 'token-token-token',
  CHAT_LLM_BASE_URL: 'http://llm.test/api',
  CHAT_LLM_API_KEY: 'llm-key',
  CHAT_LLM_MODEL: 'model'
}

function request(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { origin: ORIGIN },
    cookies: {},
    body: {},
    ...overrides
  } as unknown as NextApiRequest
}

function response() {
  const result = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string | string[]>
  }
  const res = {
    setHeader(name: string, value: string | string[]) {
      result.headers[name.toLowerCase()] = value
      return res
    },
    status(code: number) {
      result.statusCode = code
      return res
    },
    json(body: unknown) {
      result.body = body
      return res
    }
  }
  return { res: res as unknown as NextApiResponse, result }
}

function setCookies(result: ReturnType<typeof response>['result']): string[] {
  return [result.headers['set-cookie'] ?? []].flat()
}

/** The value of a cookie in Set-Cookie headers, as a browser would send it. */
function cookieValue(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`))
  return decodeURIComponent(cookie?.split(';')[0].slice(name.length + 1) ?? '')
}

async function issueNonce() {
  const { res, result } = response()
  await nonceRoute(request({ method: 'GET' }), res)
  return {
    nonce: result.body.nonce as string,
    cookie: cookieValue(setCookies(result), 'siwe_nonce')
  }
}

const account = privateKeyToAccount(generatePrivateKey())

function buildMessage(
  nonce: string,
  overrides: Partial<Parameters<typeof createSiweMessage>[0]> = {}
) {
  return createSiweMessage({
    address: account.address,
    chainId: CHAIN_ID,
    domain: 'market.example',
    nonce,
    scheme: 'https',
    uri: ORIGIN,
    version: '1',
    ...overrides
  })
}

async function postVerify(
  nonceCookie: string | undefined,
  body: unknown,
  headers: Record<string, string> = { origin: ORIGIN }
) {
  const { res, result } = response()
  await verify(
    request({
      headers,
      body,
      cookies: nonceCookie ? { siwe_nonce: nonceCookie } : {}
    }),
    res
  )
  return result
}

async function signIn() {
  const { nonce, cookie } = await issueNonce()
  const message = buildMessage(nonce)
  const signature = await account.signMessage({ message })
  return {
    message,
    signature,
    nonceCookie: cookie,
    result: await postVerify(cookie, { message, signature })
  }
}

describe('SIWE routes', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('issues a nonce in an HttpOnly, Secure, Lax cookie', async () => {
    const { res, result } = response()
    await nonceRoute(request({ method: 'GET' }), res)

    expect(result.statusCode).toBe(200)
    expect(result.body.nonce).toMatch(/^[a-zA-Z0-9]{8,}$/)
    const [cookie] = setCookies(result)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Max-Age=300')
  })

  it('creates a session whose address is the verified signer', async () => {
    const { result } = await signIn()

    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({
      address: account.address,
      chainId: CHAIN_ID
    })
    const cookies = setCookies(result)
    const session = cookies.find((c) => c.startsWith('siwe_session='))
    expect(session).toContain('HttpOnly')
    expect(session).toContain('Secure')
    expect(session).toContain('SameSite=Lax')

    await expect(
      getVerifiedSiweAddress(
        request({
          cookies: { siwe_session: cookieValue(cookies, 'siwe_session') }
        })
      )
    ).resolves.toBe(account.address)
  })

  it('accepts a signature made with ethers, as the browser does', async () => {
    const wallet = Wallet.createRandom()
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce, {
      address: wallet.address as `0x${string}`
    })
    const signature = await wallet.signMessage(message)

    const result = await postVerify(cookie, { message, signature })
    expect(result.statusCode).toBe(200)
    expect(result.body.address).toBe(wallet.address)
  })

  it('refuses a nonce that was already used', async () => {
    const { message, signature, nonceCookie, result } = await signIn()
    expect(result.statusCode).toBe(200)

    const replay = await postVerify(nonceCookie, { message, signature })
    expect(replay.statusCode).toBe(401)
    expect(replay.body.error).toBe('Nonce already used')
  })

  it('spends the nonce on a failed attempt too', async () => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce)
    const failed = await postVerify(cookie, { message, signature: '0x1234' })
    expect(failed.statusCode).toBe(401)

    const signature = await account.signMessage({ message })
    const retry = await postVerify(cookie, { message, signature })
    expect(retry.statusCode).toBe(401)
    expect(retry.body.error).toBe('Nonce already used')
  })

  it('refuses an expired nonce', async () => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce)
    const signature = await account.signMessage({ message })

    jest.useFakeTimers({ advanceTimers: true })
    jest.setSystemTime(Date.now() + 6 * 60 * 1000)
    const result = await postVerify(cookie, { message, signature })

    expect(result.statusCode).toBe(401)
    expect(result.body.error).toBe('Missing or expired nonce')
  })

  it('refuses a request without a nonce cookie', async () => {
    const result = await postVerify(undefined, {
      message: 'x',
      signature: '0x00'
    })
    expect(result.statusCode).toBe(401)
  })

  it.each([
    ['another domain', { domain: 'evil.example' }],
    ['another chain', { chainId: 1 }],
    ['another uri', { uri: 'https://evil.example' }],
    ['another scheme', { scheme: 'http' }],
    ['another nonce', { nonce: 'differentnonce123' }]
  ])('refuses a message for %s', async (_name, overrides) => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce, overrides)
    const signature = await account.signMessage({ message })

    const result = await postVerify(cookie, { message, signature })
    expect(result.statusCode).toBe(401)
    expect(setCookies(result).join()).not.toContain('siwe_session=ey')
  })

  it('refuses an expired message', async () => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce, {
      issuedAt: new Date(Date.now() - 120_000),
      expirationTime: new Date(Date.now() - 60_000)
    })
    const signature = await account.signMessage({ message })

    const result = await postVerify(cookie, { message, signature })
    expect(result.statusCode).toBe(401)
  })

  it('refuses a signature made by another wallet', async () => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce)
    const other = privateKeyToAccount(generatePrivateKey())
    const signature = await other.signMessage({ message })

    const result = await postVerify(cookie, { message, signature })
    expect(result.statusCode).toBe(401)
    expect(result.body.error).toBe('Invalid signature')
  })

  it.each([
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['no origin', {}]
  ])('refuses a sign-in from %s', async (_name, headers) => {
    const { nonce, cookie } = await issueNonce()
    const message = buildMessage(nonce)
    const signature = await account.signMessage({ message })

    const result = await postVerify(
      cookie,
      { message, signature },
      headers as Record<string, string>
    )
    expect(result.statusCode).toBe(403)
  })

  it('does not accept a tampered session cookie', async () => {
    const { result } = await signIn()
    const token = cookieValue(setCookies(result), 'siwe_session')
    const [header, payload, signature] = token.split('.')
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString())
    forged.sub = privateKeyToAccount(generatePrivateKey()).address
    const tampered = [
      header,
      Buffer.from(JSON.stringify(forged)).toString('base64url'),
      signature
    ].join('.')

    await expect(
      getVerifiedSiweAddress(request({ cookies: { siwe_session: tampered } }))
    ).resolves.toBeUndefined()
  })

  it('does not accept a nonce cookie as a session', async () => {
    const { cookie } = await issueNonce()
    await expect(
      getVerifiedSiweAddress(request({ cookies: { siwe_session: cookie } }))
    ).resolves.toBeUndefined()
  })

  it('does not accept a session signed with another secret', async () => {
    const { result } = await signIn()
    const token = cookieValue(setCookies(result), 'siwe_session')
    process.env.SIWE_SESSION_SECRET = 'y'.repeat(32)

    await expect(
      getVerifiedSiweAddress(request({ cookies: { siwe_session: token } }))
    ).resolves.toBeUndefined()
  })

  it('reports the session', async () => {
    const { result } = await signIn()
    const token = cookieValue(setCookies(result), 'siwe_session')

    const signedIn = response()
    await sessionRoute(
      request({ method: 'GET', cookies: { siwe_session: token } }),
      signedIn.res
    )
    expect(signedIn.result.body).toEqual({
      address: account.address,
      chainId: CHAIN_ID
    })

    const signedOut = response()
    await sessionRoute(request({ method: 'GET' }), signedOut.res)
    expect(signedOut.result.statusCode).toBe(200)
    expect(signedOut.result.body.address).toBeNull()
  })

  it('answers 404 when the chat is not configured', async () => {
    delete process.env.CHAT_LLM_API_KEY
    const { res, result } = response()
    await sessionRoute(request({ method: 'GET' }), res)
    expect(result.statusCode).toBe(404)
  })

  it('answers 404 with a secret that is too short', async () => {
    process.env.SIWE_SESSION_SECRET = 'short'
    const { res, result } = response()
    await nonceRoute(request({ method: 'GET' }), res)
    expect(result.statusCode).toBe(404)
  })

  it('clears the session on logout', () => {
    const { res, result } = response()
    logout(request(), res)

    expect(result.statusCode).toBe(200)
    expect(setCookies(result)[0]).toMatch(/^siwe_session=; Max-Age=0/)
  })

  it('refuses logout from a foreign origin', () => {
    const { res, result } = response()
    logout(request({ headers: { origin: 'https://evil.example' } }), res)
    expect(result.statusCode).toBe(403)
  })

  it('only accepts the declared method', async () => {
    const { res, result } = response()
    await verify(request({ method: 'GET' }), res)
    expect(result.statusCode).toBe(405)
    expect(result.headers.allow).toEqual(['POST'])
  })
})
