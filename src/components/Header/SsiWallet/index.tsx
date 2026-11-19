import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import SsiWalletControl from '@components/@shared/SsiWalletControl'
import styles from './index.module.css'

interface SsiWalletProps {
  showConnectedToast?: boolean
  walletRequiredMessage?: string
}

export function SsiWallet({
  showConnectedToast = true,
  walletRequiredMessage = i18n._('You need to connect your EVM wallet first')
}: SsiWalletProps): ReactElement {
  useLingui()

  return (
    <SsiWalletControl
      styles={styles}
      showConnectedToast={showConnectedToast}
      walletRequiredMessage={walletRequiredMessage}
    />
  )
}
