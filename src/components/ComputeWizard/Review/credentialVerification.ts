import { requiresSsi } from '@utils/credentials'
import { isAddressWhitelisted } from '@utils/ddo'
import type { Asset } from 'src/@types/Asset'
import type { Service } from 'src/@types/ddo/Service'

export type CredentialVerificationOutcome = 'ssi' | 'verified' | 'failed'

export function requiresSsiVerification(
  asset?: Asset,
  service?: Service
): boolean {
  return Boolean(
    requiresSsi(asset?.credentialSubject?.credentials) ||
      requiresSsi(service?.credentials)
  )
}

interface ResolveCredentialVerificationParams {
  asset: Asset
  service?: Service
  accountId?: string
  ssiEnabled: boolean
}

/**
 * Decides how a compute asset's credentials must be validated.
 *
 * SSI policies need the SSI wallet, so they can only be validated when SSI is
 * enabled. Everything else (address-based allow/deny lists, or no credentials
 * at all) is validated directly against the connected Web3 account, which also
 * keeps the flow working when SSI is disabled.
 */
export function resolveCredentialVerification({
  asset,
  service,
  accountId,
  ssiEnabled
}: ResolveCredentialVerificationParams): CredentialVerificationOutcome {
  if (requiresSsiVerification(asset, service)) {
    return ssiEnabled ? 'ssi' : 'failed'
  }

  if (!accountId) return 'failed'

  return isAddressWhitelisted(asset, accountId, service) ? 'verified' : 'failed'
}
