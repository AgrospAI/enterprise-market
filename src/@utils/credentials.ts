import {
  Credential,
  CredentialAddressBased,
  CredentialPolicyBased
} from 'src/@types/ddo/Credentials'

interface AssetCredentials {
  credentialSubject?: {
    credentials?: Credential
    services?: { credentials?: Credential }[]
  }
}

interface ServiceCredentials {
  credentials?: Credential
}

export const SSI_POLICY_UNSUPPORTED_MESSAGE =
  'The asset has SSI policies defined and cannot be consumed through this marketplace.'

export const SSI_NODE_UNSUPPORTED_MESSAGE =
  'The asset is encrypted on a node that performs SSI validation and cannot be consumed through this marketplace.'

export function isCredentialAddressBased(
  credential: CredentialAddressBased | CredentialPolicyBased
): credential is CredentialAddressBased {
  return (
    (credential as CredentialAddressBased)?.type !== undefined &&
    (credential as CredentialAddressBased)?.type === 'address'
  )
}

export function isCredentialPolicyBased(
  credential: CredentialAddressBased | CredentialPolicyBased
): credential is CredentialPolicyBased {
  return (
    (credential as CredentialPolicyBased)?.type !== undefined &&
    (credential as CredentialPolicyBased)?.type === 'SSIpolicy'
  )
}

/** Replace editable rules; retain policies hidden by a wallet-only deployment. */
export function mergeEditedCredentials(
  original: Credential | undefined,
  updated: Credential,
  policiesEditable: boolean
): Credential {
  const policies = policiesEditable ? updated : original
  return {
    ...original,
    ...updated,
    match_allow: original?.match_allow ?? updated.match_allow,
    match_deny: original?.match_deny ?? updated.match_deny,
    allow: [
      ...(updated.allow || []).filter(isCredentialAddressBased),
      ...(policies?.allow || []).filter(
        (rule) => !isCredentialAddressBased(rule)
      )
    ],
    deny: updated.deny || []
  }
}

/**
 * Addresses held by an address-based credential, read from both stored shapes:
 * bare strings and `{ address }` objects. The original case is kept, callers
 * decide how to compare. Values that are neither shape are skipped.
 */
export function credentialAddressValues(
  credential: CredentialAddressBased | CredentialPolicyBased | undefined
): string[] {
  const values = (credential as { values?: unknown } | undefined)?.values
  if (!Array.isArray(values)) return []

  return values.flatMap((value) => {
    if (typeof value === 'string') return [value]
    const address = (value as { address?: unknown })?.address
    return typeof address === 'string' ? [address] : []
  })
}

export function requiresSsi(credentials?: Credential): boolean {
  if (!credentials || !Array.isArray(credentials.allow)) return false

  for (const entry of credentials.allow) {
    if (isCredentialPolicyBased(entry)) {
      const values = Array.isArray(entry.values) ? entry.values : []
      for (const value of values) {
        const hasRequestCredentials = Array.isArray(value.request_credentials)
          ? value.request_credentials.length > 0
          : false
        const hasVcPolicies = Array.isArray(value.vc_policies)
          ? value.vc_policies.length > 0
          : false
        const hasVpPolicies = Array.isArray(value.vp_policies)
          ? value.vp_policies.length > 0
          : false

        if (hasRequestCredentials || hasVcPolicies || hasVpPolicies) {
          return true
        }
      }
    }
  }

  return false
}

export function hasSsiPolicy(credentials?: Credential): boolean {
  return Boolean(
    credentials?.allow?.some((credential) => credential.type === 'SSIpolicy')
  )
}

export function assetHasSsiPolicy(
  asset?: AssetCredentials,
  selectedService?: ServiceCredentials
): boolean {
  return Boolean(
    hasSsiPolicy(asset?.credentialSubject?.credentials) ||
      hasSsiPolicy(selectedService?.credentials)
  )
}

export function isSsiPolicyConsumptionDisabled(
  asset: AssetCredentials,
  ssiEnabled: boolean,
  selectedService?: ServiceCredentials
): boolean {
  return !ssiEnabled && assetHasSsiPolicy(asset, selectedService)
}

export function isPolicyServerConsumptionDisabled(
  ssiEnabled: boolean,
  isPSConfigured: boolean
): boolean {
  return !ssiEnabled && isPSConfigured
}

export function requiresPolicyServerCredentialCheck(
  ssiEnabled: boolean,
  isPSConfigured: boolean
): boolean {
  return ssiEnabled && isPSConfigured
}
