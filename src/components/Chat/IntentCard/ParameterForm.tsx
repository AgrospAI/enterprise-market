import { ReactElement, useId } from 'react'
import type {
  DeclaredParameter,
  ParameterProblem,
  ParameterValue
} from '@utils/chat/consumerParameters'
import { EditIcon } from '../icons'
import styles from './index.module.css'

function isOn(value: ParameterValue | undefined): boolean {
  return value === true || value === 'true'
}

/** How a value reads in the summary: the label of a choice, yes/no for a switch. */
export function valueText(
  param: DeclaredParameter,
  value: ParameterValue | undefined
): string {
  if (value === undefined || value === '') return 'not set'
  if (param.type === 'boolean') return isOn(value) ? 'yes' : 'no'
  return param.choiceLabels[String(value)] ?? String(value)
}

const PROBLEM_TEXT: Record<ParameterProblem, string> = {
  missing: 'Required: give it a value.',
  invalid: 'This value is not valid.'
}

function Field({
  param,
  value,
  problem,
  onChange
}: {
  param: DeclaredParameter
  value: ParameterValue | undefined
  problem?: ParameterProblem
  onChange: (value: ParameterValue) => void
}): ReactElement {
  const id = useId()
  const label = param.label || param.name
  const describedBy = [
    param.description ? `${id}-help` : '',
    problem ? `${id}-problem` : ''
  ]
    .filter(Boolean)
    .join(' ')
  const common = {
    id,
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': describedBy || undefined
  }

  let input: ReactElement
  if (param.type === 'boolean') {
    input = (
      <input
        {...common}
        type="checkbox"
        checked={isOn(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    )
  } else if (param.type === 'select') {
    input = (
      <select
        {...common}
        className={styles.input}
        value={value === undefined ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {(!param.required || value === undefined || value === '') && (
          <option value="">{param.required ? 'Choose…' : 'Not set'}</option>
        )}
        {param.choices.map((choice) => (
          <option key={choice} value={choice}>
            {param.choiceLabels[choice] ?? choice}
          </option>
        ))}
      </select>
    )
  } else {
    input = (
      <input
        {...common}
        className={styles.input}
        type={param.type === 'number' ? 'number' : 'text'}
        inputMode={param.type === 'number' ? 'decimal' : undefined}
        value={value === undefined ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <div
      className={
        param.type === 'boolean'
          ? `${styles.field} ${styles.fieldInline}`
          : styles.field
      }
    >
      <label htmlFor={id}>
        {label}
        {param.required && <span aria-hidden="true"> *</span>}
        {label !== param.name && (
          <code className={styles.fieldName}>{param.name}</code>
        )}
      </label>
      {input}
      {param.description && (
        <span id={`${id}-help`} className={styles.fieldHelp}>
          {param.description}
        </span>
      )}
      {problem && (
        <span id={`${id}-problem`} className={styles.fieldProblem}>
          {PROBLEM_TEXT[problem]}
        </span>
      )}
    </div>
  )
}

/**
 * The consumer parameters of one asset. Closed, it lists the values that will
 * be sent; open, the user changes them before running. The values are checked
 * against the DDO again on every change.
 */
export default function ParameterForm({
  assetName,
  declared,
  values,
  problems,
  isEdited,
  isOpen,
  canEdit,
  onToggle,
  onChange,
  onReset
}: {
  assetName: string
  declared: DeclaredParameter[]
  values: Record<string, ParameterValue>
  problems: Record<string, ParameterProblem>
  isEdited: boolean
  isOpen: boolean
  canEdit: boolean
  onToggle: () => void
  onChange: (name: string, value: ParameterValue) => void
  onReset: () => void
}): ReactElement {
  const hasProblems = Object.keys(problems).length > 0

  if (!isOpen || !canEdit) {
    return (
      <div className={styles.parameterSummary}>
        <ul className={styles.parameters}>
          {declared.map((param) => (
            <li key={param.name}>
              <code>{param.name}</code>: {valueText(param, values[param.name])}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className={styles.parameterActions}>
            <button
              type="button"
              className={styles.editButton}
              onClick={onToggle}
              aria-expanded={false}
              aria-label={`Edit the parameters of ${assetName}`}
            >
              <EditIcon width={14} height={14} />
              Edit parameters
            </button>
            {isEdited && <span className={styles.editedTag}>Edited</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <fieldset className={styles.parameterForm}>
      <legend className={styles.label}>Parameters of {assetName}</legend>
      {declared.map((param) => (
        <Field
          key={param.name}
          param={param}
          value={values[param.name]}
          problem={problems[param.name]}
          onChange={(value) => onChange(param.name, value)}
        />
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.textButton}
          onClick={onToggle}
          disabled={hasProblems}
        >
          Done
        </button>
        {isEdited && (
          <button type="button" className={styles.textButton} onClick={onReset}>
            Undo changes
          </button>
        )}
      </div>
    </fieldset>
  )
}
