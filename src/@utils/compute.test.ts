import { getAllComputeJobs } from './compute'
import { ProviderInstance } from '@oceanprotocol/lib'
import { getAssetsFromDids } from './aquarius'
import axios from 'axios'

jest.mock('@oceanprotocol/lib', () => ({
  ProviderInstance: { computeStatus: jest.fn() },
  LoggerInstance: { error: jest.fn(), warn: jest.fn() },
  getErrorMessage: (message: string) => message
}))
jest.mock('./aquarius', () => ({ getAssetsFromDids: jest.fn() }))
jest.mock('./provider', () => ({}))
jest.mock('./assetConverter', () => ({}))
jest.mock('app.config.cjs', () => ({ nodeUriIndex: ['http://node'] }), {
  virtual: true
})
jest.mock('chains.config.cjs', () => ({ getSupportedChainIds: () => [8996] }), {
  virtual: true
})

const algorithmDid = 'did:op:algorithm'
const datasetDid = 'did:op:dataset'
const asset = {
  id: algorithmDid,
  credentialSubject: { chainId: 8996, metadata: { name: 'Algorithm' } },
  indexedMetadata: { stats: [{ symbol: 'ALG' }] }
}

async function loadJobs(job: object) {
  ;(ProviderInstance.computeStatus as jest.Mock).mockResolvedValue([job])
  return getAllComputeJobs(
    'owner',
    { getAddress: async () => 'owner' } as any,
    axios.CancelToken.source().token
  )
}

beforeEach(() => jest.clearAllMocks())

it('resolves algorithm-only node jobs from algoDID', async () => {
  ;(getAssetsFromDids as jest.Mock).mockResolvedValue([asset])
  const result = await loadJobs({ jobId: 'job', algoDID: algorithmDid })
  expect(getAssetsFromDids).toHaveBeenCalledWith(
    [algorithmDid],
    expect.arrayContaining([8996]),
    expect.anything()
  )
  expect(result.computeJobs[0]).toMatchObject({
    algorithm: { documentId: algorithmDid },
    assets: [],
    networkId: 8996
  })
})

it('normalizes dataset DIDs and uses the payment chain when metadata is unavailable', async () => {
  ;(getAssetsFromDids as jest.Mock).mockResolvedValue([])
  const result = await loadJobs({
    jobId: 'job',
    algoDID: algorithmDid,
    inputDID: [datasetDid],
    payment: { chainId: 8996 }
  })
  expect(result.computeJobs[0]).toMatchObject({
    algorithm: { documentId: algorithmDid },
    assets: [{ documentId: datasetDid }],
    networkId: 8996
  })
})

it('preserves asset objects and service IDs from older provider responses', async () => {
  ;(getAssetsFromDids as jest.Mock).mockResolvedValue([asset])
  const algorithm = { documentId: algorithmDid, serviceId: 'service' }
  const result = await loadJobs({ jobId: 'job', algorithm, assets: [] })
  expect(result.computeJobs[0].algorithm).toEqual(algorithm)
})

it('enriches null DID status responses without replacing results or status', async () => {
  ;(getAssetsFromDids as jest.Mock).mockResolvedValue([asset])
  const post = jest.spyOn(axios, 'post').mockResolvedValue({
    data: [
      {
        owner: 'owner',
        jobId: 'job',
        algorithm: { documentId: algorithmDid, serviceId: 'service' },
        assets: [],
        results: null,
        statusText: 'stale'
      },
      {
        owner: 'another-owner',
        jobId: 'other',
        algorithm: { documentId: 'other' }
      }
    ]
  })
  const result = await loadJobs({
    owner: 'owner',
    jobId: 'job',
    algoDID: null,
    inputDID: null,
    results: [{ index: 0 }],
    statusText: 'Job finished'
  })
  expect(result.computeJobs[0]).toMatchObject({
    algorithm: { documentId: algorithmDid, serviceId: 'service' },
    networkId: 8996,
    results: [{ index: 0 }],
    statusText: 'Job finished'
  })
  post.mockRestore()
})
