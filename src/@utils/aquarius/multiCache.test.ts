import axios, { CancelToken } from 'axios'
import { queryMetadata } from '.'

jest.mock('axios')
jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { log: jest.fn(), error: jest.fn() }
}))
jest.mock('../../../app.config.cjs', () => ({
  metadataCacheUri: ['https://cache-a.test', 'https://cache-b.test'],
  nodeUriIndex: ['https://cache-a.test', 'https://cache-b.test']
}))

const query: SearchQuery = {
  from: 0,
  size: 1000,
  query: {
    bool: {
      filter: [
        {
          terms: {
            'credentialSubject.services.serviceEndpoint.keyword': [
              'https://cache-a.test',
              'https://cache-b.test'
            ]
          }
        }
      ]
    }
  }
}

beforeEach(() => jest.clearAllMocks())

it.each(['flat', 'nested'])(
  'finds assets with a %s service mapping, including silent empty nested matches',
  async (mapping) => {
    ;(axios.post as jest.Mock).mockImplementation(async (url, request) => {
      const filter = request.query.bool.filter[0]
      // Elasticsearch returns zero hits, not an error, for ignore_unmapped
      // nested queries against existing flat service mappings.
      const branches = filter.bool?.should || [filter]
      const matchingBranch = branches.find((branch) =>
        mapping === 'nested' ? !!branch.nested : !!branch.bool
      )
      const endpointQuery = matchingBranch?.nested?.query || matchingBranch
      const endpointFilters = endpointQuery?.bool?.should || []
      const endpointField =
        mapping === 'nested'
          ? 'credentialSubject.services.serviceEndpoint'
          : 'credentialSubject.services.serviceEndpoint.keyword'
      const endpoint = url.includes('cache-a')
        ? 'https://cache-a.test'
        : 'https://cache-b.test'
      const matches = endpointFilters.some((branch) =>
        branch.terms?.[endpointField]?.includes(endpoint)
      )
      return {
        status: 200,
        data: {
          results: matches ? [{ id: endpoint }] : [],
          totalResults: matches ? 1 : 0
        }
      }
    })
    const result = await queryMetadata(query, {} as CancelToken)
    expect(result.results.map((asset) => asset.id)).toEqual([
      'https://cache-a.test',
      'https://cache-b.test'
    ])
    expect(axios.post).toHaveBeenCalledTimes(2)
    const sent = (axios.post as jest.Mock).mock.calls[0][1]
    const branches = sent.query.bool.filter[0].bool.should
    expect(sent.query.bool.filter[0].bool.minimum_should_match).toBe(1)
    expect(branches[0].nested).toEqual({
      path: 'credentialSubject.services',
      ignore_unmapped: true,
      query: branches[1]
    })
  }
)

it('includes the first algorithm from each cache when selecting trusted services', async () => {
  ;(axios.post as jest.Mock).mockImplementation(async (url, request) => {
    const assets = [
      { id: url.includes('cache-a') ? 'algorithm-a' : 'algorithm-b' }
    ]
    return {
      status: 200,
      data: {
        results: assets.slice(request.from, request.from + request.size),
        totalResults: 1
      }
    }
  })
  const result = await queryMetadata(query, {} as CancelToken)
  expect(result.results.map((asset) => asset.id)).toEqual([
    'algorithm-a',
    'algorithm-b'
  ])
  expect(axios.post).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ from: 0 }),
    expect.anything()
  )
})

it('still finds an algorithm when the other cache has no matching assets', async () => {
  ;(axios.post as jest.Mock).mockImplementation(async (url, request) => {
    const assets = url.includes('cache-b') ? [{ id: 'only-algorithm' }] : []
    return {
      status: 200,
      data: {
        results: assets.slice(request.from, request.from + request.size),
        totalResults: assets.length
      }
    }
  })
  const result = await queryMetadata(query, {} as CancelToken)
  expect(result.results.map((asset) => asset.id)).toEqual(['only-algorithm'])
})

it('falls back to flat filters for older object mappings without dropping endpoint restrictions', async () => {
  ;(axios.post as jest.Mock).mockImplementation(async (url, request) => {
    if (request.query.bool.filter[0].bool?.should?.[0]?.nested)
      throw Object.assign(new Error('Services use a flat mapping'), {
        response: { status: 400 }
      })
    return {
      status: 200,
      data: {
        results: [{ id: url.includes('cache-a') ? 'legacy-a' : 'legacy-b' }],
        totalResults: 1
      }
    }
  })
  const result = await queryMetadata(query, {} as CancelToken)
  expect(result.results.map((asset) => asset.id)).toEqual([
    'legacy-a',
    'legacy-b'
  ])
  expect(axios.post).toHaveBeenCalledTimes(4)
  const fallback = (axios.post as jest.Mock).mock.calls.find(
    ([, request]) => !request.query.bool.filter[0].bool?.should?.[0]?.nested
  )[1]
  expect(
    fallback.query.bool.filter[0].bool.should[0].terms[
      'credentialSubject.services.serviceEndpoint'
    ]
  ).toEqual(['https://cache-a.test'])
})
