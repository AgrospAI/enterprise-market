import { i18n } from '../../i18n/index'
import { Wallet } from 'ethers'
import { getAddress } from 'viem'

export type DecryptResult =
  | { success: true; privateKey: string }
  | { success: false; error: string }

/**
 * Decrypt an encrypted JSON wallet (keystore v3) and return the private key.
 * Uses ethers v6 `Wallet.fromEncryptedJson` — viem does not support this.
 *
 * Returns a result object instead of throwing to avoid triggering the
 * Next.js dev error overlay for expected failures (wrong password).
 */
export async function decryptJsonWallet(
  json: string,
  password: string,
  onProgress?: (percent: number) => void
): Promise<DecryptResult> {
  try {
    const wallet = await Wallet.fromEncryptedJson(
      json,
      password,
      onProgress ? (percent) => onProgress(percent) : undefined
    )
    return { success: true, privateKey: wallet.privateKey }
  } catch (error: any) {
    const message =
      error?.shortMessage || error?.message || i18n._('Decryption failed')
    return { success: false, error: message }
  }
}

/**
 * Validate that a string looks like a valid encrypted JSON wallet
 * (keystore v3 format) without attempting decryption.
 */
export function isValidEncryptedWalletJson(content: string): boolean {
  try {
    const json = JSON.parse(content)
    return !!(
      json?.address &&
      json?.id &&
      json?.version &&
      (json?.crypto || json?.Crypto)
    )
  } catch {
    return false
  }
}

/**
 * Extract the address from an encrypted JSON wallet without decrypting.
 * Returns a checksummed address or null if extraction fails.
 */
export function getAddressFromJsonWallet(json: string): string | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed?.address) return null
    // The address in keystore files is lowercased without 0x prefix
    const raw = parsed.address.startsWith('0x')
      ? parsed.address
      : `0x${parsed.address}`
    return getAddress(raw)
  } catch {
    return null
  }
}
