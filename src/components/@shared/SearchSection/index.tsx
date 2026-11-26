import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, ChangeEvent } from 'react'
import SearchIcon from '@images/search.svg'
import styles from './index.module.css'

interface SearchSectionProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  onSearch?: () => void
  label?: string
}

export default function SearchSection({
  placeholder = i18n._('Search by title, datatoken, or DID...'),
  value,
  onChange,
  disabled = false,
  onSearch,
  label = i18n._('Search assets')
}: SearchSectionProps): ReactElement {
  useLingui()

  function handleSearchInput(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  return (
    <div className={styles.searchContainer}>
      <input
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSearch?.()
          }
        }}
        type="search"
        name="search"
        placeholder={placeholder}
        value={value}
        onChange={handleSearchInput}
        className={styles.search}
        disabled={disabled}
      />
      <div className={styles.searchButtonContainer}>
        <button
          onClick={() => onSearch?.()}
          type="button"
          className={styles.searchButton}
          disabled={disabled}
        >
          <SearchIcon className={styles.searchIcon} />
          <span className={styles.searchButtonText}>
            <Trans id="Search" />
          </span>
        </button>
      </div>
    </div>
  )
}
