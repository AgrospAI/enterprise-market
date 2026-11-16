import { i18n } from '../../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Button from '../atoms/Button'
import DeleteIcon from '@images/delete.svg'
import Loader from '../atoms/Loader'
import styles from './DeleteButton.module.css'

interface DeleteButtonProps {
  onClick: () => void | Promise<void>
  disabled?: boolean
  className?: string
  loading?: boolean
  loadingText?: string
  text?: string
}

export default function DeleteButton({
  onClick,
  disabled = false,
  className = '',
  loading = false,
  loadingText = i18n._('Deleting...'),
  text = i18n._('Delete')
}: DeleteButtonProps): ReactElement {
  useLingui()

  return (
    <Button
      type="button"
      style="ghost"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${styles.deleteButton} ${className}`}
    >
      {loading ? (
        <span className={styles.loadingContent}>
          <Loader
            variant="primary"
            noMargin
            className={styles.loadingSpinner}
          />
          {loadingText}
        </span>
      ) : (
        <>
          <DeleteIcon />
          {text}
        </>
      )}
    </Button>
  )
}
