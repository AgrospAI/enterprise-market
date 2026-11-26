import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useEffect, useState } from 'react'
import styles from './index.module.css'
import Link from 'next/link'
import { accountTruncate } from '@utils/wallet'
import { useIsMounted } from '@hooks/useIsMounted'
import { usePontusXLegalName } from '@context/PontusXIdentity'
import { useAccountDisplayName } from '@hooks/useAccountDisplayName'

interface PublisherProps {
  account: string
  minimal?: boolean
  verifiedServiceProviderName?: string
  className?: string
}

export default function Publisher({
  account,
  minimal,
  verifiedServiceProviderName,
  className
}: PublisherProps): ReactElement {
  useLingui()

  const isMounted = useIsMounted()
  const legalName = usePontusXLegalName(account)
  const resolvedName = verifiedServiceProviderName || legalName
  const [name, setName] = useState(resolvedName || accountTruncate(account))

  useEffect(() => {
    if (!account) return

    if (resolvedName && isMounted()) {
      setName(resolvedName)
    } else {
      setName(accountTruncate(account))
    }
  }, [account, isMounted, resolvedName])

  const displayName = useAccountDisplayName(account, name)

  if (minimal) {
    return <span className={styles.publisher}>{displayName}</span>
  }

  return (
    <div className={`${styles.publisher} ${className || ''}`}>
      <span className={styles.hoverReveal}>
        <Link
          href={`/profile/${account}`}
          className={styles.truncated}
          title={i18n._('Show profile page.')}
        >
          {displayName}
        </Link>

        <span className={styles.fullValue}>{account}</span>
      </span>
    </div>
  )
}
