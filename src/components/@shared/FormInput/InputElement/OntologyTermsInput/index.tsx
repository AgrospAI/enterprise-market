import { ReactElement, useEffect, useState } from 'react'
import Select, { OnChangeValue } from 'react-select'
import { useField } from 'formik'
import { LoggerInstance } from '@oceanprotocol/lib'
import { InputProps } from '../..'
import IconExternal from '@images/external.svg'
import type {
  AgroPortalClass,
  AgroPortalSearchResult,
  OntologyTerm
} from 'src/@types/AgroPortal'
import OntologyFilter from './OntologyFilter'
import selectStyles from '../TagsAutoComplete/index.module.css'
import { selectSpacing } from './selectSpacing'
import styles from './index.module.css'

const PAGE_SIZE = 10
const DEBOUNCE_MS = 400

function toOntologyTerm(item: AgroPortalClass): OntologyTerm {
  return {
    '@id': item['@id'],
    '@type': 'skos:Concept',
    'skos:prefLabel': {
      '@value': item.prefLabel,
      '@language': 'en'
    },
    'skos:inScheme': {
      '@id': item.links.ontology,
      'rdfs:label': item.links.ontology.split('/').pop() || ''
    },
    'dct:source': {
      '@id': item.links.ui
    }
  }
}

function formatOptionLabel(option: OntologyTerm): ReactElement {
  const sourceUrl = option['dct:source']?.['@id']
  return (
    <span className={styles.option}>
      {sourceUrl && (
        <a
          className={styles.sourceLink}
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Open ${option['skos:prefLabel']?.['@value']} in AgroPortal`}
          title="Open in AgroPortal"
          // Keep react-select from selecting the option or opening the menu
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <IconExternal />
        </a>
      )}
      <span className={styles.label}>
        {option['skos:prefLabel']?.['@value']}
      </span>
      <span className={styles.scheme}>
        {option['skos:inScheme']?.['rdfs:label']}
      </span>
    </span>
  )
}

export default function OntologyTermsInput({
  ...props
}: InputProps): ReactElement {
  const { name, placeholder } = props
  const [field, , helpers] = useField<OntologyTerm[]>(name)

  const [input, setInput] = useState<string>('')
  const [options, setOptions] = useState<OntologyTerm[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [ontologies, setOntologies] = useState<string[]>([])
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false)
  const ontologiesString = ontologies.join(',')

  useEffect(() => {
    if (!input) {
      setOptions([])
      setHasMore(false)
      setIsUnavailable(false)
      return
    }

    const controller = new AbortController()
    const debounceTimeout = setTimeout(async () => {
      setIsLoading(true)
      try {
        const searchParams = new URLSearchParams({
          q: input,
          page: page.toString(),
          pagesize: PAGE_SIZE.toString()
        })
        if (ontologiesString) {
          searchParams.append('ontologies', ontologiesString)
        }

        const response = await fetch(
          `/api/agroportal/search?${searchParams.toString()}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error(response.statusText)
        const data: AgroPortalSearchResult = await response.json()
        const newOptions = (data.collection || []).map(toOntologyTerm)

        setOptions((prevOptions) =>
          page === 1 ? newOptions : [...prevOptions, ...newOptions]
        )
        setHasMore(data.nextPage !== null)
        setIsUnavailable(false)
      } catch (error) {
        if (error.name === 'AbortError') return
        LoggerInstance.error('Error fetching AgroPortal terms:', error)
        setOptions([])
        setHasMore(false)
        setIsUnavailable(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(debounceTimeout)
    }
  }, [input, ontologiesString, page])

  const handleChange = (userInput: OnChangeValue<OntologyTerm, true>) => {
    helpers.setValue([...userInput])
    helpers.setTouched(true)
  }

  const handleInputChange = (newValue: string) => {
    setInput(newValue)
    setPage(1)
  }

  const handleOntologiesChange = (newOntologies: string[]) => {
    setOntologies(newOntologies)
    setPage(1)
  }

  const handleLoadMore = () => {
    if (hasMore && !isLoading) setPage((prevPage) => prevPage + 1)
  }

  const filterId = `${name}-ontologies`

  return (
    <div className={styles.container}>
      <Select<OntologyTerm, true>
        inputId={name}
        className={selectStyles.select}
        styles={selectSpacing<OntologyTerm>()}
        value={Array.isArray(field.value) ? field.value : []}
        getOptionValue={(option) => option['@id']}
        getOptionLabel={(option) => option['skos:prefLabel']?.['@value']}
        // Results are already filtered by AgroPortal (incl. synonyms)
        filterOption={null}
        formatOptionLabel={formatOptionLabel}
        hideSelectedOptions
        isMulti
        isClearable={false}
        isLoading={isLoading}
        noOptionsMessage={() =>
          isUnavailable
            ? 'Service unavailable'
            : input
            ? 'No results found'
            : 'Start typing to search AgroPortal ontology terms.'
        }
        onBlur={() => helpers.setTouched(true)}
        onChange={handleChange}
        onInputChange={handleInputChange}
        onMenuScrollToBottom={handleLoadMore}
        openMenuOnClick
        options={options}
        placeholder={placeholder || 'e.g. agriculture, plant, soil...'}
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, primary25: 'var(--border-color)' }
        })}
      />
      {isUnavailable && (
        <p className={styles.error} role="alert">
          Service unavailable
        </p>
      )}
      <div className={styles.filter}>
        <label className={styles.filterLabel} htmlFor={filterId}>
          Filter search by ontology
        </label>
        <OntologyFilter inputId={filterId} onChange={handleOntologiesChange} />
      </div>
    </div>
  )
}
