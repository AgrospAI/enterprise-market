import type { NextApiRequest, NextApiResponse } from 'next'
import { getAddress, isHex, verifyMessage } from 'viem'
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import {
  buildClearNonceCookie,
  buildSessionCookie,
  getIssuedNonce,
  getSiweConfig,
  isTrustedOrigin,
  methodNotAllowed,
  SiweConfig
} from './_session'

const MAX_MESSAGE_LENGTH = 2048

/**
 * Nonces already presented, until their cookie expires. They are kept per
 * process: with several replicas a captured message and cookie could be replayed
 * on another one until the nonce expires (5 minutes at most).
 */
const usedNonces = new Map<string, number>()

function consumeNonce(nonce: string, expiresAt: number): boolean {
  const now = Date.now()
  usedNonces.forEach((expiry, key) => {
    if (expiry <= now) usedNonces.delete(key)
  })
  if (usedNonces.has(nonce)) return false
  usedNonces.set(nonce, expiresAt)
  return true
}

/** Whether the message binds the signature to this market, chain and nonce. */
function isValidMessage(
  message: ReturnType<typeof parseSiweMessage>,
  nonce: string,
  config: SiweConfig
): boolean {
  if (message.version !== '1' || message.chainId !== config.chainId) {
    return false
  }
  try {
    if (new URL(message.uri ?? '').origin !== config.origin) return false
  } catch {
    return false
  }
  return validateSiweMessage({
    message,
    domain: config.domain,
    nonce,
    scheme: config.scheme
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  res.setHeader('Cache-Control', 'no-store')

  const config = getSiweConfig()
  if (!config) return res.status(404).json({ error: 'Not found' })
  if (!isTrustedOrigin(req, config)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const issued = await getIssuedNonce(req, config)
  if (!issued) {
    return res.status(401).json({ error: 'Missing or expired nonce' })
  }
  // A nonce is spent by any attempt, valid or not; the client asks for a new one.
  res.setHeader('Set-Cookie', buildClearNonceCookie())
  if (!consumeNonce(issued.nonce, issued.expiresAt)) {
    return res.status(401).json({ error: 'Nonce already used' })
  }

  const { message, signature } = req.body ?? {}
  if (
    typeof message !== 'string' ||
    message.length > MAX_MESSAGE_LENGTH ||
    typeof signature !== 'string' ||
    !isHex(signature)
  ) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const parsed = parseSiweMessage(message)
    if (!isValidMessage(parsed, issued.nonce, config)) {
      return res.status(401).json({ error: 'Invalid message' })
    }
    const address = getAddress(parsed.address)
    // Recovers the signer of an externally owned account. Contract wallets
    // (ERC-1271) would need an RPC call and are not supported.
    const isValid = await verifyMessage({ address, message, signature })
    if (!isValid) return res.status(401).json({ error: 'Invalid signature' })

    res.setHeader('Set-Cookie', [
      buildClearNonceCookie(),
      await buildSessionCookie(address, config)
    ])
    return res.status(200).json({ address, chainId: config.chainId })
  } catch {
    return res.status(401).json({ error: 'Invalid signature' })
  }
}
