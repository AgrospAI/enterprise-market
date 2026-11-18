import { getQueryFilterTerms } from './useQueryFilter'

// Tareando: queryFilter.config.cjs restricts every metadata query built by
// generateBaseQuery (catalogue, home, profile, compute allowlists) to assets
// tagged "tareando".
describe('@hooks/useQueryFilter (Tareando config)', () => {
  test('only assets tagged tareando are queried', () => {
    expect(getQueryFilterTerms()).toEqual([
      { term: { 'credentialSubject.metadata.tags.keyword': 'tareando' } }
    ])
  })
})
