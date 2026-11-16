import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import PriceUnit from '@components/@shared/Price/PriceUnit'
import Tooltip from '@shared/atoms/Tooltip'
import { getFeeTooltip } from '@utils/feeTooltips'
import styles from './row.module.css'

export function Row({
  price,
  hasPreviousOrder,
  hasDatatoken,
  symbol,
  timeout,
  sign,
  type,
  tooltip
}: {
  price: string
  hasPreviousOrder?: boolean
  hasDatatoken?: boolean
  symbol?: string
  timeout?: string
  sign?: string
  type?: string
  tooltip?: string
}) {
  useLingui()

  const tooltipContent = tooltip || getFeeTooltip(type)

  return (
    <div className={styles.priceRow}>
      <div className={styles.sign}>{sign}</div>
      <div className={styles.typeContainer}>
        <div className={styles.type}>{type}</div>
        {tooltipContent && (
          <Tooltip content={tooltipContent} className={styles.tooltip} />
        )}
      </div>
      <div className={styles.priceColumn}>
        <PriceUnit
          price={hasPreviousOrder || hasDatatoken ? 0 : Number(price)}
          symbol={symbol}
          size="mini"
          className={styles.price}
          explicitZero
        />
        <span className={styles.timeout}>
          {timeout &&
            timeout !== i18n._('Forever') &&
            !hasPreviousOrder &&
            i18n._('for {timeout}', { timeout })}
        </span>
      </div>
    </div>
  )
}
