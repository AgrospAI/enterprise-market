import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify, SignJWT } from 'jose'
import { getAddress, isAddress } from 'viem'

export const SIWE_SESSION_COOKIE = 'siwe_session'
export const SIWE_NONCE_COOKIE = 'siwe_nonce'
export const SIWE_SESSION_MAX_AGE = 8 * 60 * 60
export const SIWE_NONCE_MAX_AGE = 5 * 60

const JWT_ISSUER = 'agrospai-market'
const SESSION_AUDIENCE = 'siwe-session'
const NONCE_AUDIENCE = 'siwe-nonce'
const MIN_SECRET_BYTES = 32

export interface SiweConfig {
  secret: Uint8Array
  /** Origin of the market, from the environment: the Host header is not trusted. */
  origin: string
  domain: string
  scheme: string
  chainId: number
}

/** The SIWE configuration, or undefined when it is missing or invalid. */
export function getSiweConfig(): SiweConfig | undefined {
  const secret = new TextEncoder().encode(process.env.SIWE_SESSION_SECRET ?? '')
  const chainId = Number(process.env.SIWE_CHAIN_ID)
  if (secret.length < MIN_SECRET_BYTES) return undefined
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return undefined

  try {
    const url = new URL(process.env.SIWE_ORIGIN ?? '')
    return {
      secret,
      origin: url.origin,
      domain: url.host,
      scheme: url.protocol.replace(':', ''),
      chainId
    }
  } catch {
    return undefined
  }
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax; Path=/`
}

function signToken(
  claims: Record<string, unknown>,
  subject: string,
  audience: string,
  maxAge: number,
  secret: Uint8Array
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuer(JWT_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret)
}

async function verifyToken(
  token: string | undefined,
  audience: string,
  secret: Uint8Array
) {
  if (!token) return undefined
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience
    })
    return payload
  } catch {
    return undefined
  }
}

export async function buildNonceCookie(
  nonce: string,
  config: SiweConfig
): Promise<string> {
  const token = await signToken(
    {},
    nonce,
    NONCE_AUDIENCE,
    SIWE_NONCE_MAX_AGE,
    config.secret
  )
  return serializeCookie(SIWE_NONCE_COOKIE, token, SIWE_NONCE_MAX_AGE)
}

export function buildClearNonceCookie(): string {
  return serializeCookie(SIWE_NONCE_COOKIE, '', 0)
}

/** The nonce this browser was issued, if its cookie is genuine and not expired. */
export async function getIssuedNonce(
  req: NextApiRequest,
  config: SiweConfig
): Promise<{ nonce: string; expiresAt: number } | undefined> {
  const payload = await verifyToken(
    req.cookies[SIWE_NONCE_COOKIE],
    NONCE_AUDIENCE,
    config.secret
  )
  if (!payload?.sub || !payload.exp) return undefined
  return { nonce: payload.sub, expiresAt: payload.exp * 1000 }
}

export async function buildSessionCookie(
  address: string,
  config: SiweConfig
): Promise<string> {
  const token = await signToken(
    { chainId: config.chainId },
    address,
    SESSION_AUDIENCE,
    SIWE_SESSION_MAX_AGE,
    config.secret
  )
  return serializeCookie(SIWE_SESSION_COOKIE, token, SIWE_SESSION_MAX_AGE)
}

export function buildClearSessionCookie(): string {
  return serializeCookie(SIWE_SESSION_COOKIE, '', 0)
}

/**
 * The checksummed address of the signed-in wallet, or `undefined` when there is
 * no trustworthy session. Failures are "no session" rather than exceptions, as
 * in `auth/_session.ts`. This is the only source of the user's address: it is
 * never read from a request body.
 */
export async function getVerifiedSiweAddress(
  req: NextApiRequest,
  config: SiweConfig | undefined = getSiweConfig()
): Promise<string | undefined> {
  if (!config) return undefined
  const payload = await verifyToken(
    req.cookies[SIWE_SESSION_COOKIE],
    SESSION_AUDIENCE,
    config.secret
  )
  if (!payload?.sub || !isAddress(payload.sub)) return undefined
  return getAddress(payload.sub)
}

/**
 * SameSite=Lax already keeps the cookies out of cross-site POSTs. This also
 * refuses them when the Origin is not the market, including a missing one:
 * browsers always send it on POST.
 */
export function isTrustedOrigin(
  req: NextApiRequest,
  config: SiweConfig
): boolean {
  return req.headers.origin === config.origin
}

export function methodNotAllowed(res: NextApiResponse, allow: string) {
  res.setHeader('Allow', [allow])
  return res.status(405).json({ error: 'Method not allowed' })
}
