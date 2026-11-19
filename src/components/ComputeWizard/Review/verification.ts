import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
import { requiresSsi } from '@utils/credentials'
import { isAddressWhitelisted } from '@utils/ddo'

export function getVerificationStatus(
  asset: Asset,
  service: Service,
  accountId: string | undefined,
  ssiEnabled: boolean,
  sessionId?: string
): 'verified' | 'unverified' | 'failed' {
  if (!service || !isAddressWhitelisted(asset, accountId, service)) {
    return 'failed'
  }

  const needsSsi =
    requiresSsi(asset.credentialSubject?.credentials) ||
    requiresSsi(service.credentials)
  if (!needsSsi) return 'verified'
  if (!ssiEnabled) return 'failed'
  return sessionId ? 'verified' : 'unverified'
}
