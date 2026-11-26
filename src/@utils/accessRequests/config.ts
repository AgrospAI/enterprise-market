import { getAddress, ZeroAddress } from 'ethers'
import { getRuntimeConfig } from '@utils/runtimeConfig'

export interface RegistryConfig {
  chainId: number
  address: string
  deploymentBlock: number
}

export function parseRegistryConfig(
  raw: string | undefined,
  chainId: number
): RegistryConfig | undefined {
  if (chainId !== 11155420) return undefined
  const map: unknown = JSON.parse(raw || '{}')
  if (!map || typeof map !== 'object' || Array.isArray(map))
    throw new Error('Invalid access request configuration.')
  const item = map[String(chainId)]
  if (!item) return undefined
  if (
    typeof item.address !== 'string' ||
    !Number.isSafeInteger(item.deploymentBlock) ||
    item.deploymentBlock < 0
  ) {
    throw new Error('Invalid registry address or deployment block.')
  }
  const address = getAddress(item.address)
  if (address === ZeroAddress || address !== item.address)
    throw new Error('Registry address must be checksummed and nonzero.')
  return { chainId, address, deploymentBlock: item.deploymentBlock }
}

export function registryConfiguration(chainId: number): {
  config?: RegistryConfig
  error?: string
} {
  try {
    return {
      config: parseRegistryConfig(
        getRuntimeConfig().NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS,
        chainId
      )
    }
  } catch {
    return {
      error: 'Access requests are unavailable: invalid registry configuration.'
    }
  }
}
