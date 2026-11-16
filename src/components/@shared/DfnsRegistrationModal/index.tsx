import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { FormEvent, ReactElement } from 'react'
import Modal from '@shared/atoms/Modal'
import Button from '@shared/atoms/Button'
import styles from './index.module.css'

interface DfnsRegistrationModalProps {
  isOpen: boolean
  registrationCode: string
  isConnecting?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

export default function DfnsRegistrationModal({
  isOpen,
  registrationCode,
  isConnecting = false,
  onChange,
  onSubmit,
  onClose
}: DfnsRegistrationModalProps): ReactElement {
  useLingui()

  if (!isOpen) return null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!registrationCode.trim()) return
    onSubmit()
  }

  return (
    <Modal
      title={i18n._('Enter registration code')}
      isOpen
      onToggleModal={onClose}
      shouldCloseOnOverlayClick
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.description}>
          <Trans id="Use the Dfns registration code for this account." />{' '}
        </p>
        <label className={styles.label} htmlFor="dfns-registration-code">
          <Trans id="Registration code" />{' '}
        </label>
        <input
          id="dfns-registration-code"
          className={styles.input}
          value={registrationCode}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="one-time-code"
          autoFocus
        />
        <div className={styles.actions}>
          <Button type="button" style="text" onClick={onClose}>
            <Trans id="Cancel" />{' '}
          </Button>
          <Button
            type="submit"
            style="primary"
            disabled={!registrationCode.trim() || isConnecting}
          >
            {isConnecting ? i18n._('Connecting…') : i18n._('Continue')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
