import { i18n } from '../../../../../i18n/index'
import { useLingui } from '@lingui/react'
import { ChangeEvent } from 'react'
import Loader from '@shared/atoms/Loader'
import styles from './index.module.css'

export interface BoxSelectionOption {
  name: string
  value?: string
  checked: boolean
  title: JSX.Element | string
  icon?: JSX.Element
  text?: JSX.Element | string
}

export type BoxSelectionSize = 'mini' | 'small' | 'large' | 'default' | 'medium'

export default function BoxSelection({
  name,
  options,
  disabled,
  handleChange,
  size = 'default',
  ...props
}: {
  name: string
  options: BoxSelectionOption[]
  disabled?: boolean
  size?: BoxSelectionSize
  handleChange?: (event: ChangeEvent<HTMLInputElement>) => void
}): JSX.Element {
  const { i18n } = useLingui()

  const styleClassesWrapper = `${styles.boxSelectionsWrapper} ${
    disabled ? styles.disabled : ''
  } ${size === 'mini' ? styles.small : ''}`

  const styleClassesInput = `${styles.input} ${styles.radio}`

  return (
    <div className={styleClassesWrapper}>
      {!options ? (
        <Loader />
      ) : (
        options.map((option: BoxSelectionOption) => (
          <div key={option.name}>
            <input
              id={option.name}
              checked={option.checked}
              onChange={(event) => handleChange(event)}
              {...props}
              type="radio"
              className={styleClassesInput}
              disabled={disabled}
              value={option.value || option.name}
              name={name}
            />
            <label
              className={`${styles.boxSelection} ${styles.label}`}
              htmlFor={option.name}
              title={i18n._(option.name)}
            >
              {option.icon}
              <span className={styles.title}>
                {typeof option.title === 'string'
                  ? i18n._(option.title)
                  : option.title}
              </span>
              {typeof option.text === 'string'
                ? i18n._(option.text)
                : option.text}
            </label>
          </div>
        ))
      )}
    </div>
  )
}
