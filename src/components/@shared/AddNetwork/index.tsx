import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, ReactNode } from 'react'
import { useSwitchChain } from 'wagmi'
import Button from '@shared/atoms/Button'
import styles from './index.module.css'
import EthIcon from '@images/eth.svg'
import AddTokenStyles from '../AddToken/index.module.css'

interface AddNetworkProps {
  chainId: number
  networkName: string
  logo?: ReactNode
}

export default function AddNetwork({
  chainId,
  networkName,
  logo
}: AddNetworkProps): ReactElement {
  useLingui()

  const { switchChain } = useSwitchChain()

  return (
    <Button
      className={AddTokenStyles.button}
      style="text"
      size="small"
      onClick={() => switchChain({ chainId })}
    >
      <span className={AddTokenStyles.logoWrap}>
        <div className={styles.logo}>{logo || <EthIcon />}</div>
      </span>

      <span className={AddTokenStyles.text}>
        {i18n._('Add ')}
        <span className={AddTokenStyles.symbol}>{networkName}</span>
      </span>
    </Button>
  )
}
