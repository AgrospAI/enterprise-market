import { getResults } from './utils'
import { generateBaseQuery, queryMetadata } from '@utils/aquarius'

jest.mock('@oceanprotocol/lib', () => ({ LoggerInstance: { log: jest.fn() } }))
jest.mock('./Filter', () => ({
  filterSets: {},
  getInitialFilters: jest.fn(() => ({}))
}))
jest.mock('@utils/aquarius', () => ({
  escapeEsReservedCharacters: (value: string) => value,
  getFilterTerm: jest.fn(),
  parseFilters: () => [],
  generateBaseQuery: jest.fn((params) => params),
  queryMetadata: jest.fn(async () => ({ results: [], totalResults: 0 }))
}))

describe('search query generation', () => {
  test('browses all assets without a text clause on plain /search', async () => {
    await getResults({}, [11155420])
    expect(generateBaseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ chainIds: [11155420], nestedQuery: undefined })
    )
    expect(queryMetadata).toHaveBeenCalled()
  })

  test('retains text matching for searches by name', async () => {
    await getResults({ text: 'Red Wine' }, [11155420])
    expect(generateBaseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ nestedQuery: { must: expect.any(Array) } })
    )
  })
})
