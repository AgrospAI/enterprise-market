import axios from 'axios'
import { Contract } from 'ethers'
import { getAsset, queryMetadata } from '@utils/aquarius'
import { createTrustedAlgorithmList } from '@utils/compute'
import {
  nftOwner,
  readRequest,
  registry,
  hasMetadataPermission
} from './client'
import { persistDdo } from '@utils/metadataPersistence'
import {
  activateRequest,
  reviewActivation,
  resolveRequestAsset,
  ReviewChangedError
} from './activate'
import { Asset } from 'src/@types/Asset'
import { AccessRequest } from 'src/@types/AccessRequest'
import { RegistryConfig } from './config'

jest.mock('@utils/aquarius', () => ({
  getAsset: jest.fn(),
  queryMetadata: jest.fn(),
  generateBaseQuery: (query) => query,
  getFilterTerm: (field, value) => ({ [field]: value })
}))
jest.mock('./files', () => ({
  prepareFileClone: jest.fn().mockResolvedValue('peer'),
  cloneServiceFiles: jest.fn().mockResolvedValue('0xnewcipher')
}))
jest.mock('./provision', () => ({
  provisionRequestedService: jest.fn().mockResolvedValue('new-token')
}))
jest.mock('@utils/compute', () => ({ createTrustedAlgorithmList: jest.fn() }))
jest.mock('@utils/accessRequests/client', () => ({
  nftOwner: jest.fn(),
  registry: jest.fn(),
  hasMetadataPermission: jest.fn().mockResolvedValue(true),
  readRequest: jest.fn(),
  sameAddress: (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase(),
  nftAbi: []
}))
jest.mock('@utils/wallet', () => ({ getOrCreateProvider: jest.fn() }))
jest.mock('@utils/metadataPersistence', () => ({
  cloneDdo: (asset) => asset,
  persistDdo: jest.fn()
}))
jest.mock('@utils/accessRequests/transactions', () => ({
  reconcileActivation: jest.fn()
}))
jest.mock('../../../app.config.cjs', () => ({
  nodeUriIndex: ['https://node.example']
}))
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn()
}))

const config: RegistryConfig = {
  chainId: 11155420,
  address: 'registry',
  deploymentBlock: 1
}
const request = {
  id: 1n,
  requester: '0x1111111111111111111111111111111111111111',
  serviceTerms: JSON.stringify({
    name: 'New service',
    price: '1',
    baseToken: '0x1111111111111111111111111111111111111111',
    timeout: 3600,
    compute: {
      allowRawAlgorithm: false,
      allowNetworkAccess: true,
      publisherTrustedAlgorithms: [],
      publisherTrustedAlgorithmPublishers: []
    }
  }),
  receiver: 'owner',
  datasetNft: 'dataset',
  datasetServiceId: 'dataset-service',
  status: 0,
  expiresAt: 2000000000n
} as AccessRequest
function asset(type: string, nft: string, id: string): Asset {
  return {
    id: `did:op:${nft}`,
    indexedMetadata: { event: { block: 1, txid: 'version1' } },
    credentialSubject: {
      chainId: 11155420,
      nftAddress: nft,
      metadata: { type, name: nft },
      services: [
        {
          id,
          type: 'compute',
          state: 0,
          serviceEndpoint: 'https://node.example',
          compute: {
            allowNetworkAccess: false,
            publisherTrustedAlgorithms: [],
            publisherTrustedAlgorithmPublishers: []
          }
        }
      ]
    }
  } as unknown as Asset
}
let dataset: Asset
let algorithm: Asset
const signer = {
  getAddress: async () => 'owner',
  provider: {
    getNetwork: async () => ({ chainId: 11155420n }),
    getBlock: async () => ({ timestamp: 1000000000 })
  }
}
beforeEach(() => {
  dataset = asset('dataset', 'dataset', 'dataset-service')
  algorithm = asset('algorithm', 'algorithm', 'algorithm-service')
  ;(readRequest as jest.Mock).mockResolvedValue(request)
  ;(nftOwner as jest.Mock).mockImplementation(async (_, nft) =>
    nft === 'dataset' ? 'owner' : 'publisher'
  )
  ;(queryMetadata as jest.Mock).mockImplementation(async (query) => ({
    results: [
      query.filters[0].term['credentialSubject.nftAddress'].value === 'dataset'
        ? dataset
        : algorithm
    ]
  }))
  ;(getAsset as jest.Mock).mockImplementation(async (did) =>
    did === dataset.id ? dataset : algorithm
  )
  jest.spyOn(axios, 'get').mockImplementation(async (url: string) => ({
    data: url.endsWith(encodeURIComponent(dataset.id)) ? dataset : algorithm
  }))
  ;(Contract as unknown as jest.Mock).mockImplementation(() => ({
    getMetaData: async () => ['', '', 0, true]
  }))
  ;(createTrustedAlgorithmList as jest.Mock).mockResolvedValue([
    {
      did: algorithm.id,
      serviceId: 'algorithm-service',
      filesChecksum: 'files',
      containerSectionChecksum: 'container'
    }
  ])
  ;(persistDdo as jest.Mock).mockClear()
})
afterEach(() => jest.restoreAllMocks())
it('resolves checksum-cased NFT addresses with a case-insensitive exact lookup', async () => {
  const nft = '0x0E9689fFdc67bBD4BbC27b2d1dfd705d951bf345'
  dataset.credentialSubject.nftAddress = nft
  ;(queryMetadata as jest.Mock).mockImplementationOnce(async (query) => {
    const filter = query.filters[0].term['credentialSubject.nftAddress']
    const matches = filter.case_insensitive
      ? nft.toLowerCase() === filter.value.toLowerCase()
      : nft === filter.value
    return { results: matches ? [dataset] : [] }
  })
  await expect(
    resolveRequestAsset(
      config.chainId,
      nft.toLowerCase(),
      axios.CancelToken.source().token
    )
  ).resolves.toBe(dataset)
  expect(queryMetadata).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filters: [
        {
          term: {
            'credentialSubject.nftAddress': {
              value: nft.toLowerCase(),
              case_insensitive: true
            }
          }
        }
      ]
    }),
    expect.anything()
  )
})
it('reviews service terms and persists the new service on approval', async () => {
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  expect(createTrustedAlgorithmList).not.toHaveBeenCalled()
  await activateRequest(
    config,
    review,
    signer as never,
    'owner',
    {} as never,
    jest.fn(),
    token
  )
  expect(persistDdo).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceId: 'dataset-service',
      beforeSigning: expect.any(Function)
    })
  )
})
it('requires review again when metadata changes before signing', async () => {
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  dataset = JSON.parse(JSON.stringify(dataset))
  dataset.credentialSubject.metadata.name = 'Changed'
  await expect(
    activateRequest(
      config,
      review,
      signer as never,
      'owner',
      {} as never,
      jest.fn(),
      token
    )
  ).rejects.toBeInstanceOf(ReviewChangedError)
  expect(persistDdo).not.toHaveBeenCalled()
})
it('rejects approval after ownership changes or a terminal decision', async () => {
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  ;(nftOwner as jest.Mock).mockResolvedValue('new-owner')
  await expect(
    activateRequest(
      config,
      review,
      signer as never,
      'owner',
      {} as never,
      jest.fn(),
      token
    )
  ).rejects.toThrow('current dataset owner')
  ;(nftOwner as jest.Mock).mockResolvedValue('owner')
  ;(readRequest as jest.Mock).mockResolvedValue({ ...request, status: 1 })
  await expect(
    activateRequest(
      config,
      review,
      signer as never,
      'owner',
      {} as never,
      jest.fn(),
      token
    )
  ).rejects.toThrow('pending request')
  expect(persistDdo).not.toHaveBeenCalled()
})
it('still records the atomic decision when the policy already matches', async () => {
  dataset.credentialSubject.services[0].compute.publisherTrustedAlgorithmPublishers =
    ['publisher']
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  await activateRequest(
    config,
    review,
    signer as never,
    'owner',
    {} as never,
    jest.fn(),
    token
  )
  expect(persistDdo).toHaveBeenCalled()
})

it('builds a single registry transaction containing the metadata update', async () => {
  const populateTransaction = jest
    .fn()
    .mockResolvedValue({ to: config.address })
  ;(registry as jest.Mock).mockResolvedValue({
    connect: () => ({ approve: { populateTransaction } })
  })
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  await activateRequest(
    config,
    review,
    signer as never,
    'owner',
    {} as never,
    jest.fn(),
    token
  )
  const { buildTransaction } = (persistDdo as jest.Mock).mock.calls[0][0]
  const metadata = { state: 0, data: '0x1234', metadataHash: '0xhash' }
  await expect(buildTransaction(metadata)).resolves.toEqual({
    to: config.address
  })
  expect(populateTransaction).toHaveBeenCalledWith(request.id, metadata)
})
it('requires the one-time metadata authorization before signing', async () => {
  ;(hasMetadataPermission as jest.Mock)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  await expect(
    activateRequest(
      config,
      review,
      signer as never,
      'owner',
      {} as never,
      jest.fn(),
      token
    )
  ).rejects.toThrow('Authorize the consent contract')
  expect(persistDdo).not.toHaveBeenCalled()
})

it('provisions a new service and persists an appended clone on approval', async () => {
  const { provisionRequestedService } = await import('./provision')
  ;(provisionRequestedService as jest.Mock).mockClear()
  ;(provisionRequestedService as jest.Mock).mockResolvedValue('new-token')
  const terms = {
    name: 'Custom compute',
    price: '3.5',
    baseToken: '0x1111111111111111111111111111111111111111',
    timeout: 7200,
    compute: {
      allowRawAlgorithm: false,
      allowNetworkAccess: true,
      publisherTrustedAlgorithms: [],
      publisherTrustedAlgorithmPublishers: []
    }
  }
  ;(readRequest as jest.Mock).mockResolvedValue({
    ...request,
    serviceTerms: JSON.stringify(terms)
  })
  const before = JSON.stringify(dataset)
  const { token } = axios.CancelToken.source()
  const review = await reviewActivation(config, '1', token)
  expect(review.patch.active).toBe(false)
  await activateRequest(
    config,
    review,
    signer as never,
    'owner',
    {} as never,
    jest.fn(),
    token
  )
  expect(provisionRequestedService).toHaveBeenCalledTimes(1)
  const saved = (persistDdo as jest.Mock).mock.calls[0][0].asset
  expect(saved.credentialSubject.services).toHaveLength(2)
  expect(saved.credentialSubject.services[0]).toEqual(
    dataset.credentialSubject.services[0]
  )
  expect(saved.credentialSubject.services[1]).toMatchObject({
    name: 'Custom compute',
    timeout: 7200,
    datatokenAddress: 'new-token',
    files: '0xnewcipher',
    compute: { allowNetworkAccess: true }
  })
  expect(JSON.stringify(dataset)).toBe(before)
})
