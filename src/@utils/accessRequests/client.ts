import { Contract, Signer, ZeroAddress, getAddress } from 'ethers'
import { getOrCreateProvider } from '@utils/wallet'
import { AccessRequest } from 'src/@types/AccessRequest'
import { RegistryConfig } from './config'
import { accessRequestsAbi } from './abi'
import { waitForReceipt } from '@utils/metadataPersistence'

export const nftAbi = [
  'function ownerOf(uint256) view returns (address)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function getMetaData() view returns (string,string,uint8,bool)',
  'function getPermissions(address) view returns (bool manager,bool deployERC20,bool updateMetadata,bool store)',
  'function addToMetadataList(address)'
]

export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

export async function registry(config: RegistryConfig) {
  const provider = getOrCreateProvider(config.chainId)
  if (Number((await provider.getNetwork()).chainId) !== config.chainId)
    throw new Error('Registry RPC is on the wrong chain.')
  if ((await provider.getCode(config.address)) === '0x')
    throw new Error('No registry deployed at the configured address.')
  const contract = new Contract(config.address, accessRequestsAbi, provider)
  let version: bigint
  try {
    version = await contract.VERSION()
  } catch {
    throw new Error(
      'Could not verify the service request contract. Check your connection and try again.'
    )
  }
  if (version !== 6n)
    throw new Error(
      'Configure a version 6 service request contract with wallet inboxes.'
    )
  return contract
}

export async function nftOwner(
  chainId: number,
  address: string
): Promise<string> {
  const provider = getOrCreateProvider(chainId)
  if (
    Number((await provider.getNetwork()).chainId) !== chainId ||
    (await provider.getCode(address)) === '0x'
  )
    throw new Error('Unknown NFT or network.')
  const nft = new Contract(getAddress(address), nftAbi, provider)
  if (!(await nft.supportsInterface('0x80ac58cd')))
    throw new Error('Unsupported NFT interface.')
  const owner = await nft.ownerOf(1)
  if (owner === ZeroAddress) throw new Error('NFT has no owner.')
  return owner
}

export function decodeRequest(r): AccessRequest {
  return {
    id: BigInt(r.id),
    requester: r.requester,
    receiver: r.receiver,
    datasetNft: r.datasetNft,
    datasetServiceId: r.datasetServiceId,
    createdAt: BigInt(r.createdAt),
    expiresAt: BigInt(r.expiresAt),
    decidedAt: BigInt(r.decidedAt),
    status: Number(r.status),
    message: r.message,
    decidedBy: r.decidedBy
  }
}

export async function readRequest(
  config: RegistryConfig,
  id: string
): Promise<AccessRequest> {
  const contract = await registry(config)
  const request = decodeRequest(await contract.getRequest(BigInt(id)))
  request.serviceTerms = await contract.serviceTerms(BigInt(id))
  return request
}

export async function readRequestPage(
  config: RegistryConfig,
  scope: 'requester' | 'receiver' | 'dataset',
  address: string,
  offset: string,
  signal?: AbortSignal
) {
  signal?.throwIfAborted()
  const contract = await registry(config)
  const block = await contract.runner.provider.getBlock('latest')
  const [count, rows] = await Promise.all([
    contract[`${scope}Count`](address, { blockTag: block.number }),
    contract[`${scope}Page`](address, BigInt(offset), 50, {
      blockTag: block.number
    })
  ])
  signal?.throwIfAborted()
  return {
    requests: await Promise.all(
      rows.map(async (row) => {
        const request = decodeRequest(row)
        request.serviceTerms = await contract.serviceTerms(request.id, {
          blockTag: block.number
        })
        return request
      })
    ),
    now: BigInt(block.timestamp),
    next:
      BigInt(offset) + BigInt(rows.length) < count
        ? (BigInt(offset) + BigInt(rows.length)).toString()
        : undefined
  }
}

export async function registryWrite(
  config: RegistryConfig,
  signer: Signer,
  wallet: string,
  action: 'createServiceRequest' | 'reject' | 'cancel' | 'markSeen',
  args: unknown[],
  onSubmitted?: (hash: string) => void,
  beforeSubmit?: () => void
) {
  if (!signer?.provider || !sameAddress(await signer.getAddress(), wallet))
    throw new Error('Reconnect the signing wallet.')
  if (Number((await signer.provider.getNetwork()).chainId) !== config.chainId)
    throw new Error('Switch to OP Sepolia.')
  const contract = (await registry(config)).connect(signer) as Contract
  beforeSubmit?.()
  const tx = await contract[action](...args)
  onSubmitted?.(tx.hash)
  const receipt = await waitForReceipt(tx)
  if (receipt.hash !== tx.hash) onSubmitted?.(receipt.hash)
  return receipt
}

export async function hasMetadataPermission(
  config: RegistryConfig,
  nft: string
) {
  const contract = new Contract(
    nft,
    nftAbi,
    getOrCreateProvider(config.chainId)
  )
  return Boolean((await contract.getPermissions(config.address)).updateMetadata)
}

/** One-time NFT authorization; never authorize a registry from an unverified network. */
export async function authorizeMetadata(
  config: RegistryConfig,
  nft: string,
  signer: Signer,
  wallet: string,
  onSubmitted: (hash: string) => void
) {
  await registry(config)
  if (
    !sameAddress(await signer.getAddress(), wallet) ||
    Number((await signer.provider.getNetwork()).chainId) !== config.chainId ||
    !sameAddress(await nftOwner(config.chainId, nft), wallet)
  )
    throw new Error(
      'Only the current dataset owner can authorize metadata updates.'
    )
  const tx = await new Contract(nft, nftAbi, signer).addToMetadataList(
    config.address
  )
  onSubmitted(tx.hash)
  const receipt = await waitForReceipt(tx)
  if (receipt.hash !== tx.hash) onSubmitted(receipt.hash)
  return receipt
}
