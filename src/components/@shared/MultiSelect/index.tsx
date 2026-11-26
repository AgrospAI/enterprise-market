import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import styles from './index.module.css'
import CreatableSelect from 'react-select/creatable'

export interface SelectOption {
  value: string
  label: string
  description?: string
  href?: string
}

/** Shared keyboard-accessible autocomplete for controlled multi-selection. */
export default function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  onSearch,
  isValidNewOption,
  loading,
  disabled
}: {
  id: string
  label: string
  options: SelectOption[]
  value: SelectOption[]
  onChange: (value: SelectOption[]) => void
  onSearch?: (value: string) => void
  isValidNewOption?: (value: string) => boolean
  loading?: boolean
  disabled?: boolean
}): ReactElement {
  useLingui()
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <CreatableSelect<SelectOption, true>
        className={styles.select}
        classNames={{
          valueContainer: () => styles.valueContainer,
          input: () => styles.input,
          multiValue: () => styles.multiValue
        }}
        inputId={id}
        instanceId={id}
        formatOptionLabel={(option, { context }) => {
          const content = (
            <>
              <span>{option.label}</span>
              {option.description && <small>{option.description}</small>}
            </>
          )
          return option.href && context === 'value' ? (
            <a
              className={styles.optionLabel}
              href={option.href}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {content}
            </a>
          ) : (
            <span className={styles.optionLabel}>{content}</span>
          )
        }}
        isMulti
        options={options}
        value={value.map(
          (item) =>
            options.find((option) => option.value === item.value) || item
        )}
        onChange={(items) => onChange([...items])}
        onInputChange={(input) => onSearch?.(input)}
        isValidNewOption={(input) =>
          !!isValidNewOption?.(input.trim()) &&
          ![...options, ...value].some(
            (option) =>
              option.value.toLowerCase() === input.trim().toLowerCase()
          )
        }
        getNewOptionData={(input, label) => ({
          value: input.trim(),
          label: typeof label === 'string' ? label.trim() : input.trim(),
          __isNew__: true
        })}
        formatCreateLabel={(input) =>
          i18n._('Add {value}', { value: input.trim() })
        }
        loadingMessage={() => i18n._('Loading…')}
        isLoading={loading}
        isDisabled={disabled}
        placeholder={label}
        noOptionsMessage={() =>
          i18n._('No matches. Try another name or address.')
        }
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, primary25: 'var(--border-color)' }
        })}
      />
    </div>
  )
}
