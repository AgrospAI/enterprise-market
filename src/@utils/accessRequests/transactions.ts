import { RegistryConfig } from './config'
import { getOrCreateProvider } from '@utils/wallet'

function key(config: RegistryConfig, id: string) {
  return `access-request-activation:${config.chainId}:${config.address}:${id}`
}
export function submittedActivation(
  config: RegistryConfig,
  id: string
): string | undefined {
  try {
    const value = sessionStorage.getItem(key(config, id))
    return /^0x[\da-fA-F]{64}$/.test(value || '') ? value : undefined
  } catch {
    return undefined
  }
}
export function rememberActivation(
  config: RegistryConfig,
  id: string,
  hash: string
) {
  try {
    sessionStorage.setItem(key(config, id), hash)
  } catch {
    /* Receipt remains available through the explorer. */
  }
}
export async function reconcileActivation(
  config: RegistryConfig,
  id: string,
  indexedBlock?: number
): Promise<void> {
  const hash = submittedActivation(config, id)
  if (!hash) return
  const receipt = await getOrCreateProvider(
    config.chainId
  ).getTransactionReceipt(hash)
  if (!receipt)
    throw new Error(
      'Activation is pending or not visible on the read RPC. Check its transaction and retry verification.'
    )
  if (receipt.status === 0) return
  if (!indexedBlock || indexedBlock < receipt.blockNumber)
    throw new Error(
      'Updating asset permissions. Wait for metadata indexing before sending another activation.'
    )
}
