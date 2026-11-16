import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import styles from './index.module.css'

interface CurrencySplitRowProps {
  value: string
  symbol: string
}

export default function CurrencySplitRow({
  value,
  symbol
}: CurrencySplitRowProps): ReactElement {
  useLingui()

  return (
    <div className={styles.currencySplitRow}>
      <span className={styles.currencySplitValue}>{value}</span>
      <span className={styles.currencySplitSymbol}>{symbol}</span>
    </div>
  )
}
