import { ReactElement, useEffect, useMemo, useRef } from 'react'
import AsyncSelect from 'react-select/async'
import { SingleValue } from 'react-select'
import { LoggerInstance } from '@oceanprotocol/lib'
import { LatLngBoundsTuple } from '@utils/dcat'
import selectStyles from '../TagsAutoComplete/index.module.css'
import styles from './index.module.css'

// https://nominatim.org/release-docs/latest/api/Search/
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search'
const MIN_QUERY_LENGTH = 3
// Nominatim's usage policy allows at most one request per second
const DEBOUNCE_MS = 1000

interface NominatimResult {
  display_name: string
  boundingbox: [string, string, string, string] // [south, north, west, east]
}

interface LocationOption {
  label: string
  bounds: LatLngBoundsTuple
}

async function searchLocations(query: string): Promise<LocationOption[]> {
  try {
    const params = new URLSearchParams({ q: query, format: 'json', limit: '5' })
    const response = await fetch(`${NOMINATIM_API}?${params.toString()}`)
    if (!response.ok) throw new Error(response.statusText)
    const results: NominatimResult[] = await response.json()

    return results.map(({ display_name: label, boundingbox }) => {
      const [south, north, west, east] = boundingbox.map(Number)
      return {
        label,
        bounds: [
          [south, west],
          [north, east]
        ]
      }
    })
  } catch (error) {
    LoggerInstance.error('Nominatim search error:', error)
    return []
  }
}

export default function LocationSearch({
  onLocationSelect
}: {
  onLocationSelect: (bounds: LatLngBoundsTuple, label: string) => void
}): ReactElement {
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(debounceTimeout.current), [])

  const loadOptions = useMemo(
    () =>
      (query: string): Promise<LocationOption[]> => {
        clearTimeout(debounceTimeout.current)
        if (query.trim().length < MIN_QUERY_LENGTH) return Promise.resolve([])

        return new Promise((resolve) => {
          debounceTimeout.current = setTimeout(
            () => resolve(searchLocations(query)),
            DEBOUNCE_MS
          )
        })
      },
    []
  )

  function handleChange(option: SingleValue<LocationOption>) {
    if (option) onLocationSelect(option.bounds, option.label)
  }

  return (
    <div className={styles.locationSearch}>
      <AsyncSelect<LocationOption>
        className={selectStyles.select}
        components={{
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null
        }}
        cacheOptions
        defaultOptions={false}
        loadOptions={loadOptions}
        getOptionValue={(option) => option.label}
        noOptionsMessage={({ inputValue }) =>
          inputValue.trim().length < MIN_QUERY_LENGTH
            ? `Type at least ${MIN_QUERY_LENGTH} characters to search.`
            : 'No locations found.'
        }
        onChange={handleChange}
        placeholder="Search for a city or region..."
        value={null}
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, primary25: 'var(--border-color)' }
        })}
      />
    </div>
  )
}
