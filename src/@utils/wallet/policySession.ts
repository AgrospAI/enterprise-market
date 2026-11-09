import type { Signer } from 'ethers'
import { Asset } from 'src/@types/Asset'
import {
  isPolicyServerRedirectMessage,
  requestCredentialPresentation
} from './policyServer'
import { extractURLSearchParams } from './ssiWallet'

/**
 * Opens a policy-server session for an asset that asks for no verifiable
 * credentials, as the "success" branch of CheckCredentials does. It costs one
 * wallet signature and no SSI wallet. Assets that do ask for credentials need
 * the CheckCredentials flow instead.
 */
export async function openPolicySession(
  asset: Asset,
  serviceId: string,
  consumerAddress: string,
  signer: Signer
): Promise<string> {
  const { openid4vc } = await requestCredentialPresentation(
    asset,
    consumerAddress,
    serviceId,
    signer
  )
  if (
    isPolicyServerRedirectMessage(openid4vc) &&
    openid4vc.redirectUri.includes('success')
  ) {
    const { id } = extractURLSearchParams(openid4vc.redirectUri)
    if (id) return id
  }
  throw new Error(
    `${
      asset.credentialSubject?.metadata?.name ?? asset.id
    } asks for verifiable credentials`
  )
}
