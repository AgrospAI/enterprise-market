import { getQueryResult } from './searchResponse'

const assets = [{ id: 'did:ope:dataset' }, { id: 'did:ope:algorithm' }]

describe('metadata search response compatibility', () => {
  test('reads the local node grouped DDO arrays', () => {
    expect(getQueryResult([[assets[0]], [assets[1]]])).toEqual({
      results: assets,
      totalResults: 2
    })
  })

  test.each([{ response: [] }, { response: [[]] }])(
    'normalizes empty node results: %j',
    ({ response }) => {
      expect(getQueryResult(response)).toEqual({ results: [], totalResults: 0 })
    }
  )

  test('preserves totals and aggregations from Aquarius responses', () => {
    const response = { results: assets, totalResults: 42, aggregations: {} }
    expect(getQueryResult(response)).toEqual(response)
    expect(getQueryResult([response])).toEqual(response)
  })
})
