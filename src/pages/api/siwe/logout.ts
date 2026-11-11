import type { NextApiRequest, NextApiResponse } from 'next'
import {
  buildClearSessionCookie,
  getSiweConfig,
  isTrustedOrigin,
  methodNotAllowed
} from './_session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  res.setHeader('Cache-Control', 'no-store')

  const config = getSiweConfig()
  if (!config) return res.status(404).json({ error: 'Not found' })
  if (!isTrustedOrigin(req, config)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  res.setHeader('Set-Cookie', buildClearSessionCookie())
  return res.status(200).json({ address: null, chainId: config.chainId })
}
