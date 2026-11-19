import { Trans } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { forwardRef, useEffect } from 'react'
import Caret from '@images/caret.svg'
import { accountTruncate } from '@utils/wallet'
import styles from './Account.module.css'
import Avatar from '@shared/atoms/Avatar'
import { useAccount } from 'wagmi'
import { useUserPreferences } from '@context/UserPreferences'

interface AccountProps {
  onSsiModalOpenChange?: (isOpen: boolean) => void
}

const Account = forwardRef<HTMLButtonElement, AccountProps>(
  ({ onSsiModalOpenChange }, ref) => {
    const { address: accountId } = useAccount()
    const { showSsiWalletModule } = useUserPreferences()

    useEffect(() => {
      onSsiModalOpenChange?.(showSsiWalletModule)
    }, [onSsiModalOpenChange, showSsiWalletModule])

    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={`${styles.button} ${!accountId ? styles.initial : ''}`}
          aria-label={accountId ? i18n._('Account') : i18n._('Wallet menu')}
          ref={ref}
          onClick={(e) => {
            e.preventDefault()
          }}
        >
          {accountId ? (
            <>
              <Avatar accountId={accountId} />
              <span className={styles.address} title={accountId}>
                {accountTruncate(accountId)}
              </span>
            </>
          ) : (
            <span className={styles.initialLabel}>
              <Trans id="Account" />
            </span>
          )}
          <Caret aria-hidden="true" className={styles.caret} />
        </button>
      </div>
    )
  }
)

export default Account

Account.displayName = 'Account'
