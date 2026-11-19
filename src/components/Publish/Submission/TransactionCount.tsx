import { Trans, useLingui } from '@lingui/react'
import ExplorerLink from '@shared/ExplorerLink'
import styles from './TransactionCount.module.css'

export default function TransactionCount({
  txCount,
  chainId,
  txHash
}: {
  txCount: number
  chainId: number
  txHash: string
}) {
  useLingui()

  return txHash ? (
    <ExplorerLink
      networkId={chainId}
      path={`/tx/${txHash}`}
      className={styles.txHash}
    >
      <Trans id="View Transaction" />{' '}
    </ExplorerLink>
  ) : (
    <span className={styles.txHash}>
      <Trans
        id="{count, plural, one {# transaction} other {# transactions}}"
        values={{ count: txCount }}
      />
    </span>
  )
}
