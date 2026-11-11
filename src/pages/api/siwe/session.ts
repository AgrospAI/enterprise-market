import type { NextApiRequest, NextApiResponse } from 'next'
import type { SiweSessionResponse } from 'src/@types/Chat'
import { getChatConfig } from '../chat/_config'
import {
  getSiweConfig,
  getVerifiedSiweAddress,
  methodNotAllowed
} from './_session'

/**
 * The session cookie is HttpOnly, so this is how the browser learns who is
 * signed in. It answers 404 when the chat is not configured, which is what keeps
 * the panel hidden.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SiweSessionResponse | { error: string }>
) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')

  res.setHeader('Cache-Control', 'no-store')

  const config = getSiweConfig()
  if (!config || !getChatConfig()) {
    return res.status(404).json({ error: 'Not found' })
  }

  const address = await getVerifiedSiweAddress(req, config)
  return res.status(200).json({
    address: address ?? null,
    chainId: config.chainId
  })
}
