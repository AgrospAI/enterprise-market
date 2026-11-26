import { Nft } from '@oceanprotocol/lib'
import {
  Signer,
  TransactionResponse,
  TransactionReceipt,
  TransactionRequest,
  isError,
  toBeHex
} from 'ethers'
import { Asset } from 'src/@types/Asset'
import {
  signAssetAndUploadToIpfs,
  stringifyCredentialPolicies
} from '@components/Publish/_utils'
import { encryptAsset } from 'app.config.cjs'

const writes = new Set<string>()

/** Only serializable DDO fields; never mutate a cached/context asset. */
export function cloneDdo(asset: Asset): Asset {
  const copy = JSON.parse(JSON.stringify(asset))
  delete copy.accessDetails
  delete copy.views
  delete copy.offchain
  delete copy.indexedMetadata
  delete copy.credentialSubject.stats
  delete copy.credentialSubject.datatokens
  delete copy.credentialSubject.event
  return copy
}

export async function waitForReceipt(
  tx: TransactionResponse
): Promise<TransactionReceipt> {
  let receipt: TransactionReceipt
  try {
    receipt = await tx.wait(1, 180_000)
  } catch (error) {
    if (!isError(error, 'TRANSACTION_REPLACED') || error.cancelled) throw error
    ;({ receipt } = error)
  }
  if (!receipt || receipt.status !== 1)
    throw new Error(
      'Transaction did not succeed. Reconcile its receipt before retrying.'
    )
  return receipt
}

export interface MetadataUpdate {
  state: number
  decryptorUrl: string
  decryptorAddress: string
  flags: string
  data: string
  metadataHash: string
}

type SsiContext = Parameters<typeof signAssetAndUploadToIpfs>[4]

/** The SDK setMetadata method already waits. Its Tx variant exposes submission for recovery. */
export async function persistDdo({
  asset,
  signer,
  ssiWalletContext,
  serviceId,
  state,
  onSubmitted,
  beforeSigning,
  buildTransaction
}: {
  asset: Asset
  signer: Signer
  ssiWalletContext: SsiContext
  serviceId: string
  state?: number
  onSubmitted?: (hash: string) => void
  beforeSigning?: () => Promise<void>
  buildTransaction?: (metadata: MetadataUpdate) => Promise<TransactionRequest>
}): Promise<TransactionReceipt> {
  if (!signer?.provider) throw new Error('Connect a signing wallet.')
  const { chainId } = asset.credentialSubject
  if (Number((await signer.provider.getNetwork()).chainId) !== chainId)
    throw new Error('Switch the wallet to the asset network.')
  const key = `${chainId}:${asset.credentialSubject.nftAddress.toLowerCase()}`
  if (writes.has(key))
    throw new Error('Another metadata update is in progress for this asset.')
  writes.add(key)
  try {
    const copy = cloneDdo(asset)
    const service = copy.credentialSubject.services.find(
      (s) => s.id === serviceId
    )
    if (!service?.serviceEndpoint)
      throw new Error('The selected service is unavailable.')
    stringifyCredentialPolicies(copy.credentialSubject.credentials)
    copy.credentialSubject.services.forEach((s) =>
      stringifyCredentialPolicies(s.credentials)
    )
    await beforeSigning?.()
    const upload = await signAssetAndUploadToIpfs(
      copy,
      signer,
      encryptAsset,
      service.serviceEndpoint,
      ssiWalletContext
    )
    if (!upload?.metadataIPFS || !upload.metadataIPFSHash)
      throw new Error('Metadata upload failed.')
    // Recheck after the potentially slow wallet, encryption and IPFS operations.
    await beforeSigning?.()
    const metadata: MetadataUpdate = {
      state: state ?? asset.indexedMetadata?.nft?.state ?? 0,
      decryptorUrl: service.serviceEndpoint,
      decryptorAddress: '',
      flags: toBeHex(upload.flags),
      data: upload.metadataIPFS,
      metadataHash: upload.metadataIPFSHash
    }
    const transaction = buildTransaction
      ? await buildTransaction(metadata)
      : await new Nft(signer, chainId).setMetadataTx(
          copy.credentialSubject.nftAddress,
          await signer.getAddress(),
          metadata.state,
          metadata.decryptorUrl,
          metadata.decryptorAddress,
          metadata.flags,
          metadata.data,
          metadata.metadataHash
        )
    const tx = await signer.sendTransaction(transaction)
    onSubmitted?.(tx.hash)
    const receipt = await waitForReceipt(tx)
    if (receipt.hash !== tx.hash) onSubmitted?.(receipt.hash)
    return receipt
  } finally {
    writes.delete(key)
  }
}
