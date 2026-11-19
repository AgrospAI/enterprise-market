import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import Modal from '@shared/atoms/Modal'
import Button from '@shared/atoms/Button'
import { authSetupCopy } from '@components/Auth/constants'
import styles from './index.module.css'

interface WalletChoiceModalProps {
  isOpen: boolean
  isDfnsConnecting?: boolean
  isSignerServerConnecting?: boolean
  showDfns?: boolean
  showSignerServer?: boolean
  showJsonWallet?: boolean
  onClose: () => void
  onSelectMetaMask: () => void
  onSelectDfns: () => void
  onSelectSignerServer: () => void
  onSelectJsonWallet?: () => void
}

export default function WalletChoiceModal({
  isOpen,
  isDfnsConnecting = false,
  isSignerServerConnecting = false,
  showDfns = true,
  showSignerServer = false,
  showJsonWallet = false,
  onClose,
  onSelectMetaMask,
  onSelectDfns,
  onSelectSignerServer,
  onSelectJsonWallet
}: WalletChoiceModalProps): ReactElement {
  useLingui()

  if (!isOpen) return null

  return (
    <Modal
      title={i18n._('Connect a wallet')}
      isOpen
      onToggleModal={onClose}
      shouldCloseOnOverlayClick
    >
      <div className={styles.choices}>
        <Button
          style="primary"
          type="button"
          onClick={onSelectMetaMask}
          className={styles.choice}
        >
          {authSetupCopy.connectBrowserWallet}
        </Button>
        {showDfns && (
          <Button
            style="primary"
            type="button"
            onClick={onSelectDfns}
            disabled={isDfnsConnecting}
            className={styles.choice}
          >
            {isDfnsConnecting
              ? authSetupCopy.dfnsConnecting
              : authSetupCopy.connectDfnsWallet}
          </Button>
        )}
        {showSignerServer && (
          <Button
            style="primary"
            type="button"
            onClick={onSelectSignerServer}
            disabled={isSignerServerConnecting}
            className={styles.choice}
          >
            {isSignerServerConnecting
              ? authSetupCopy.signerServerConnecting
              : authSetupCopy.connectSignerServer}
          </Button>
        )}
        {showJsonWallet && onSelectJsonWallet && (
          <Button
            style="primary"
            type="button"
            onClick={onSelectJsonWallet}
            className={styles.choice}
          >
            {authSetupCopy.connectJsonWallet}
          </Button>
        )}
      </div>
    </Modal>
  )
}
