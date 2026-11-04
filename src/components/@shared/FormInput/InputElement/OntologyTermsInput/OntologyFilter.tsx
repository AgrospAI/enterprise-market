import { ReactElement, useEffect, useState } from 'react'
import CreatableSelect from 'react-select/creatable'
import { OnChangeValue } from 'react-select'
import { LoggerInstance } from '@oceanprotocol/lib'
import selectStyles from '../TagsAutoComplete/index.module.css'
import { selectSpacing } from './selectSpacing'

interface AutoCompleteOption {
  readonly value: string
  readonly label: string
}

interface Props {
  inputId?: string
  onChange: (ontologies: string[]) => void
}

export default function OntologyFilter({
  inputId,
  onChange
}: Props): ReactElement {
  const [options, setOptions] = useState<AutoCompleteOption[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false)

  useEffect(() => {
    const controller = new AbortController()

    const fetchOntologies = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/agroportal/ontologies', {
          signal: controller.signal
        })
        if (!response.ok) throw new Error(response.statusText)
        const data: string[] = await response.json()
        setOptions(
          data.map((ontology) => ({ label: ontology, value: ontology }))
        )
      } catch (error) {
        if (error.name === 'AbortError') return
        LoggerInstance.error('Error fetching AgroPortal ontologies:', error)
        setOptions([])
        setIsUnavailable(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    fetchOntologies()

    return () => controller.abort()
  }, [])

  const handleChange = (userInput: OnChangeValue<AutoCompleteOption, true>) => {
    onChange(userInput.map((option) => option.value))
  }

  return (
    <CreatableSelect
      inputId={inputId}
      isMulti
      isClearable
      options={options}
      className={selectStyles.select}
      styles={selectSpacing<AutoCompleteOption>()}
      hideSelectedOptions
      onChange={handleChange}
      openMenuOnClick
      isLoading={isLoading}
      noOptionsMessage={() =>
        isUnavailable ? 'Service unavailable' : 'No options'
      }
      placeholder="e.g. AGROVOC"
      theme={(theme) => ({
        ...theme,
        colors: { ...theme.colors, primary25: 'var(--border-color)' }
      })}
    />
  )
}
