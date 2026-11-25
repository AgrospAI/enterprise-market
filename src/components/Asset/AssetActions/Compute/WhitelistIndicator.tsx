import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { accountTruncate } from '@utils/wallet'
import { Badge } from '@components/@shared/VerifiedBadge'
import classNames from 'classnames/bind'
import styles from './WhitelistIndicator.module.css'

const cx = classNames.bind(styles)

export default function WhitelistIndicator({
  accountId,
  isAccountIdWhitelisted,
  minimal
}: {
  accountId: string
  isAccountIdWhitelisted: boolean
  minimal?: boolean
}) {
  useLingui()

  const styleClasses = cx({
    container: true,
    minimal
  })

  return (
    <div className={styleClasses}>
      <Badge
        isValid={isAccountIdWhitelisted}
        verifiedService={
          isAccountIdWhitelisted
            ? i18n._('Wallet address meets access rules')
            : i18n._('Access denied for web3 address')
        }
        className={styles.whitelistBadge}
      />
      {!isAccountIdWhitelisted && (
        <p className={styles.invalidAddressMessage}>
          {i18n._(
            'The address {value0} is not allowed to access this asset. Please, connect with a different account and try again.',
            { value0: accountTruncate(accountId) }
          )}
        </p>
      )}
    </div>
  )
}
