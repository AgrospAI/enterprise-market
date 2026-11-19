import { useLingui } from '@lingui/react'
import { i18n } from '../i18n/index'
import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore
} from 'react'
import queryFilterConfig from '../../queryFilter.config.cjs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterValue = string | number | boolean | string[] | number[]

interface MatchWrapper {
  match: string
}

export type NestedFilterConfig = {
  [key: string]: FilterValue | MatchWrapper | NestedFilterConfig
}

// ---------------------------------------------------------------------------
// Config → FilterTerm[] helpers
// ---------------------------------------------------------------------------

function isMatchWrapper(value: unknown): value is MatchWrapper {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'match' in value &&
    Object.keys(value).length === 1 &&
    typeof (value as MatchWrapper).match === 'string'
  )
}

function isFilterValue(value: unknown): value is FilterValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return true
  if (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' || typeof v === 'number')
  )
    return true
  return false
}

/**
 * Flatten a nested filter config object into an array of Elasticsearch
 * FilterTerm entries that can be injected into a `bool.filter` clause.
 *
 * { indexedMetadata: { nft: { owner: '0x…' } } }
 *   → [{ term: { 'indexedMetadata.nft.owner': '0x…' } }]
 *
 * { credentialSubject: { metadata: { tags: { match: 'MyTag' } } } }
 *   → [{ match: { 'credentialSubject.metadata.tags': 'MyTag' } }]
 */
export function flattenFilterConfig(
  obj: NestedFilterConfig,
  prefix = ''
): FilterTerm[] {
  const terms: FilterTerm[] = []

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (isMatchWrapper(value)) {
      terms.push({ match: { [path]: value.match } })
    } else if (isFilterValue(value)) {
      if (Array.isArray(value)) {
        terms.push({ terms: { [path]: value } })
      } else {
        terms.push({ term: { [path]: value } })
      }
    } else if (typeof value === 'object' && value !== null) {
      terms.push(...flattenFilterConfig(value as NestedFilterConfig, path))
    }
  }

  return terms
}

// ---------------------------------------------------------------------------
// Shared store – bridges React context with non-React utility code
// ---------------------------------------------------------------------------

type Listener = () => void

let currentFilterTerms: FilterTerm[] = flattenFilterConfig(
  queryFilterConfig as NestedFilterConfig
)
const listeners = new Set<Listener>()

function emitChange() {
  listeners.forEach((l) => l())
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): FilterTerm[] {
  return currentFilterTerms
}

function setFilterTerms(terms: FilterTerm[]) {
  currentFilterTerms = terms
  emitChange()
}

/**
 * Non-React accessor – safe to call from utility / service code
 * (e.g. `generateBaseQuery` in aquarius).
 */
export function getQueryFilterTerms(): FilterTerm[] {
  return currentFilterTerms
}

// ---------------------------------------------------------------------------
// React Context + Provider
// ---------------------------------------------------------------------------

interface QueryFilterContextValue {
  /** Current flattened ES filter terms. */
  queryFilterTerms: FilterTerm[]
  /** Whether any global filters are active. */
  isQueryFilterEnabled: boolean
  /** Replace the full set of global filter terms at runtime. */
  setQueryFilterTerms: (terms: FilterTerm[]) => void
  /** Merge additional nested config into the current filters. */
  addFilterConfig: (config: NestedFilterConfig) => void
  /** Reset filters back to the static config file defaults. */
  resetQueryFilter: () => void
}

const QueryFilterContext = createContext<QueryFilterContextValue | null>(null)

export function QueryFilterProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  useLingui()

  const defaultTerms = useRef(
    flattenFilterConfig(queryFilterConfig as NestedFilterConfig)
  )

  // Stay in sync with the shared store so non-React code sees updates too.
  const queryFilterTerms = useSyncExternalStore(subscribe, getSnapshot)

  const setQueryFilterTerms = useCallback((terms: FilterTerm[]) => {
    setFilterTerms(terms)
  }, [])

  const addFilterConfig = useCallback((config: NestedFilterConfig) => {
    const additional = flattenFilterConfig(config)
    setFilterTerms([...getSnapshot(), ...additional])
  }, [])

  const resetQueryFilter = useCallback(() => {
    setFilterTerms(defaultTerms.current)
  }, [])

  const value = useMemo<QueryFilterContextValue>(
    () => ({
      queryFilterTerms,
      isQueryFilterEnabled: queryFilterTerms.length > 0,
      setQueryFilterTerms,
      addFilterConfig,
      resetQueryFilter
    }),
    [queryFilterTerms, setQueryFilterTerms, addFilterConfig, resetQueryFilter]
  )

  return (
    <QueryFilterContext.Provider value={value}>
      {children}
    </QueryFilterContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQueryFilter(): QueryFilterContextValue {
  const ctx = useContext(QueryFilterContext)
  if (!ctx) {
    throw new Error('useQueryFilter must be used within a QueryFilterProvider')
  }
  return ctx
}
