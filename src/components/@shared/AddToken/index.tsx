import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, ReactNode } from 'react'
import classNames from 'classnames/bind'
import { addTokenToWallet } from '@utils/wallet'
import Button from '@shared/atoms/Button'
import OceanLogo from '@images/logo.svg'
import styles from './index.module.css'

const cx = classNames.bind(styles)

interface AddTokenProps {
  address: string
  symbol: string
  decimals?: number
  logo?: {
    image?: ReactNode
    url?: string
  }
  text?: string
  className?: string
  minimal?: boolean
  disabled?: boolean
}

export default function AddToken({
  address,
  symbol,
  decimals,
  logo,
  text,
  className,
  minimal,
  disabled = false
}: AddTokenProps): ReactElement {
  useLingui()

  const styleClasses = cx({
    button: true,
    minimal,
    disabled,
    [className]: className
  })

  async function handleAddToken() {
    if (disabled) return
    if (!window?.ethereum) return

    await addTokenToWallet(address, symbol, decimals, logo?.url)
  }

  const buttonText = text || i18n._('Add {symbol}', { symbol })

  return (
    <Button
      className={styleClasses}
      style="text"
      size="small"
      disabled={disabled}
      onClick={handleAddToken}
    >
      <span className={styles.logoWrap}>
        <div className={styles.logo}>{logo?.image || <OceanLogo />}</div>
      </span>

      <span className={styles.text} data-text={buttonText}>
        {buttonText}
      </span>
    </Button>
  )
}
