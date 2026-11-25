import { prepareFileClone, cloneServiceFiles } from './files'
import {
  createRequestedService,
  requestedServiceId,
  ServiceTerms
} from './service'
import { Service, PublisherTrustedAlgorithms } from 'src/@types/ddo/Service'
import { provisionRequestedService } from './provision'
import axios, { CancelToken } from 'axios'
import { Contract, Signer, keccak256, toUtf8Bytes } from 'ethers'
import { getAsset, generateBaseQuery, queryMetadata } from '@utils/aquarius'
import { createTrustedAlgorithmList } from '@utils/compute'
import { getOrCreateProvider } from '@utils/wallet'
import { cloneDdo, persistDdo } from '@utils/metadataPersistence'
import { isNftActive } from '@utils/assetState'
import { signAssetAndUploadToIpfs } from '@components/Publish/_utils'
import { reconcileActivation } from './transactions'
import { Asset } from 'src/@types/Asset'
import { AccessRequest, AccessRequestStatus } from 'src/@types/AccessRequest'
import { nodeUriIndex } from '../../../app.config.cjs'
import { RegistryConfig } from './config'
import {
  nftAbi,
  nftOwner,
  readRequest,
  sameAddress,
  registry,
  hasMetadataPermission
} from './client'

export function configuredEndpoint(endpoint: string): boolean {
  return (nodeUriIndex as string[]).some(
    (url) => url.replace(/\/+$/, '') === endpoint?.replace(/\/+$/, '')
  )
}

export async function resolveRequestAsset(
  chainId: number,
  nft: string,
  token: CancelToken
): Promise<Asset> {
  const result = await queryMetadata(
    generateBaseQuery({
      chainIds: [chainId],
      filters: [
        {
          term: {
            'credentialSubject.nftAddress': {
              value: nft.toLowerCase(),
              case_insensitive: true
            }
          }
        }
      ],
      ignoreState: true,
      esPaginationOptions: { from: 0, size: 2 }
    } as BaseQueryParams),
    token
  )
  if (result?.partial || result?.results?.length !== 1)
    throw new Error(
      'Asset is unknown or ambiguous in the configured metadata cache.'
    )
  const cached: Asset = await getAsset(result.results[0].id, token)
  const endpoint = cached?.credentialSubject?.services.find((s) =>
    configuredEndpoint(s.serviceEndpoint)
  )?.serviceEndpoint
  if (!endpoint) throw new Error('Asset has no configured metadata node.')
  const response = await axios.get<Asset>(
    `${endpoint.replace(
      /\/+$/,
      ''
    )}/api/aquarius/assets/ddo/${encodeURIComponent(cached.id)}`,
    { cancelToken: token }
  )
  const asset = response.data
  if (
    !asset ||
    asset.id !== result.results[0].id ||
    asset.credentialSubject.chainId !== chainId ||
    !sameAddress(asset.credentialSubject.nftAddress, nft)
  )
    throw new Error('Asset identity could not be verified.')
  return asset
}

function sameAlgorithm(
  a: PublisherTrustedAlgorithms,
  b: PublisherTrustedAlgorithms
) {
  return (
    a.did === b.did &&
    a.serviceId === b.serviceId &&
    a.filesChecksum === b.filesChecksum &&
    a.containerSectionChecksum === b.containerSectionChecksum
  )
}

/** New trust entries must resolve to live algorithm services on configured nodes. */
export async function validateRequestedAlgorithms(
  terms: ServiceTerms,
  source: Service,
  chainId: number,
  token: CancelToken
) {
  for (const descriptor of terms.compute?.publisherTrustedAlgorithms || []) {
    if (
      descriptor.did === '*' ||
      source.compute?.publisherTrustedAlgorithms?.some((a) =>
        sameAlgorithm(a, descriptor)
      )
    )
      continue
    const cached = await getAsset(descriptor.did, token)
    const cachedService = cached?.credentialSubject.services.find(
      (s) => s.id === descriptor.serviceId
    )
    if (
      cached?.credentialSubject.chainId !== chainId ||
      !configuredEndpoint(cachedService?.serviceEndpoint)
    )
      throw new Error(
        'The selected algorithm is not available on a configured node.'
      )
    const algorithm = await resolveRequestAsset(
      chainId,
      cached.credentialSubject.nftAddress,
      token
    )
    const service = algorithm.credentialSubject.services.find(
      (s) => s.id === descriptor.serviceId
    )
    if (
      algorithm.id !== descriptor.did ||
      algorithm.credentialSubject.metadata.type !== 'algorithm' ||
      service?.type !== 'compute' ||
      !isNftActive(service.state) ||
      !configuredEndpoint(service.serviceEndpoint)
    )
      throw new Error('The selected algorithm service is unavailable.')
    const [verified] = await createTrustedAlgorithmList(
      [
        JSON.stringify({
          algoDid: descriptor.did,
          serviceId: descriptor.serviceId
        })
      ],
      chainId,
      token
    )
    if (!verified || !sameAlgorithm(descriptor, verified))
      throw new Error(
        'A requested algorithm changed. Create a new service request with its updated version.'
      )
  }
}

export async function validateRequestAssets(
  config: RegistryConfig,
  request: AccessRequest,
  token: CancelToken
) {
  const dataset = await resolveRequestAsset(
    config.chainId,
    request.datasetNft,
    token
  )
  const service = dataset.credentialSubject.services.find(
    (s) => s.id === request.datasetServiceId
  )
  if (!service || !isNftActive(service.state))
    throw new Error(
      'The selected service is unavailable. Create a new request.'
    )
  if (!configuredEndpoint(service.serviceEndpoint))
    throw new Error('The service node is not configured for this marketplace.')
  const owner = await nftOwner(
    config.chainId,
    dataset.credentialSubject.nftAddress
  )
  const metadata = await new Contract(
    request.datasetNft,
    nftAbi,
    getOrCreateProvider(config.chainId)
  ).getMetaData()
  if (!isNftActive(metadata[2]) || !metadata[3])
    throw new Error('NFT metadata is inactive or unavailable.')
  const patch = createRequestedService(dataset, request, config.address)
  await validateRequestedAlgorithms(patch.terms, service, config.chainId, token)
  const metadataAuthorized = await hasMetadataPermission(
    config,
    request.datasetNft
  )
  return {
    dataset,
    owner,
    patch,
    terms: patch.terms,
    metadataAuthorized
  }
}

export interface ActivationReview
  extends Awaited<ReturnType<typeof validateRequestAssets>> {
  fingerprint: string
  request: AccessRequest
}

function fingerprint(
  data: Awaited<ReturnType<typeof validateRequestAssets>>
): string {
  return keccak256(
    toUtf8Bytes(
      JSON.stringify({
        dataset: cloneDdo(data.dataset),
        event: data.dataset.indexedMetadata?.event,
        owner: data.owner
      })
    )
  )
}

export async function reviewActivation(
  config: RegistryConfig,
  id: string,
  token: CancelToken
): Promise<ActivationReview> {
  const request = await readRequest(config, id)
  const data = await validateRequestAssets(config, request, token)
  return { ...data, request, fingerprint: fingerprint(data) }
}

export class ReviewChangedError extends Error {}

export async function activateRequest(
  config: RegistryConfig,
  review: ActivationReview,
  signer: Signer,
  wallet: string,
  ssiWalletContext: Parameters<typeof signAssetAndUploadToIpfs>[4],
  onSubmitted: (hash: string) => void,
  token: CancelToken
) {
  async function recheck() {
    token.throwIfRequested()
    if (Number((await signer.provider.getNetwork()).chainId) !== config.chainId)
      throw new Error('Wallet network changed.')
    if (!sameAddress(await signer.getAddress(), wallet))
      throw new Error('Wallet changed.')
    const fresh = await reviewActivation(
      config,
      review.request.id.toString(),
      token
    )
    if (
      fresh.request.status !== AccessRequestStatus.Pending ||
      fresh.request.expiresAt <=
        BigInt((await signer.provider.getBlock('latest')).timestamp) ||
      !sameAddress(fresh.owner, wallet) ||
      !sameAddress(fresh.request.receiver, wallet)
    )
      throw new Error(
        'Only the recorded receiver who is the current dataset owner can approve a pending request.'
      )
    if (fresh.fingerprint !== review.fingerprint)
      throw new ReviewChangedError(
        'Asset policy, ownership or algorithm changed. Review the updated change again.'
      )
    return fresh
  }
  const fresh = await recheck()
  if (!fresh.metadataAuthorized)
    throw new Error(
      'Authorize the consent contract to update this dataset first.'
    )
  await reconcileActivation(
    config,
    review.request.id.toString(),
    fresh.dataset.indexedMetadata?.event?.block
  )
  if (fresh.patch.active)
    throw new Error('This service already exists. Retry verification.')
  const { terms } = createRequestedService(
    fresh.dataset,
    fresh.request,
    config.address
  )
  const cloneNode = await prepareFileClone(fresh.patch.before as Service)
  const datatoken = await provisionRequestedService(
    fresh.request.datasetNft,
    requestedServiceId(config.address, fresh.request),
    terms,
    signer,
    config.chainId,
    recheck
  )
  fresh.patch = createRequestedService(
    fresh.dataset,
    fresh.request,
    config.address,
    datatoken
  )
  const encrypted = await cloneServiceFiles(
    fresh.dataset,
    fresh.patch.before as Service,
    datatoken,
    signer,
    cloneNode
  )
  const after = fresh.patch.after as Service
  after.files = encrypted
  fresh.patch.asset.credentialSubject.services.find(
    (service) => service.id === after.id
  ).files = encrypted
  fresh.patch.asset.credentialSubject.metadata.updated =
    new Date().toISOString()
  return persistDdo({
    asset: fresh.patch.asset,
    signer,
    ssiWalletContext,
    serviceId: fresh.request.datasetServiceId,
    onSubmitted,
    beforeSigning: async () => {
      await recheck()
    },
    buildTransaction: async (metadata) => {
      await recheck()
      const contract = (await registry(config)).connect(signer) as Contract
      return contract.approve.populateTransaction(fresh.request.id, metadata)
    }
  })
}

/** Bounded cache observation; a timeout does not mean the on-chain write failed. */
export async function observePermission(
  config: RegistryConfig,
  id: string,
  signal: AbortSignal
): Promise<boolean> {
  const source = axios.CancelToken.source()
  const cancel = () => source.cancel('Cancelled')
  signal.addEventListener('abort', cancel)
  try {
    for (const delay of [0, 2000, 4000, 8000, 16000]) {
      signal.throwIfAborted()
      if (delay)
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      signal.throwIfAborted()
      if ((await reviewActivation(config, id, source.token)).patch.active)
        return true
    }
    return false
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}
