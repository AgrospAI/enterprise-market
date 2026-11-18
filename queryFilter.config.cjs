// Global query filters applied to all Aquarius/Elasticsearch metadata queries.
// Use nested objects matching the Elasticsearch document structure.
// Leaf values can be:
//   - a single string/number/boolean  → translated to a "term" filter
//   - an array of strings/numbers     → translated to a "terms" filter
//   - an object with { match: value } → translated to a case-insensitive "match" filter
//
// Scope: these filters are injected into every query built by
// generateBaseQuery, which also covers the Compute-to-Data algorithm
// allowlist (getAlgorithmAllowlistQuery) and the dataset-for-algorithm
// selection lists. Orders are exempt via the isOrderIndex guard.
//
// Tareando: the portal only lists assets tagged "tareando". The same tag is
// forced on every asset published or edited from this portal (see
// src/@utils/portalTag.ts), so new assets always show up in the catalogue.
module.exports = {
  credentialSubject: { metadata: { tags: { keyword: 'tareando' } } }
}
