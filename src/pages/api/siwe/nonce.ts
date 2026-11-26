import type { NextApiRequest, NextApiResponse } from 'next'
import { generateSiweNonce } from 'viem/siwe'
import { buildNonceCookie, getSiweConfig, methodNotAllowed } from './_session'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')

  res.setHeader('Cache-Control', 'no-store')

  const config = getSiweConfig()
  if (!config) return res.status(404).json({ error: 'Not found' })

  const nonce = generateSiweNonce()
  res.setHeader('Set-Cookie', await buildNonceCookie(nonce, config))
  return res.status(200).json({ nonce })
}
