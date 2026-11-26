import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement } from 'react'
import Link from 'next/link'
import { usePontusXLegalName } from '@context/PontusXIdentity'
import Identifier from './Identifier'
import styles from './index.module.css'

/** Consistent portal identity used in the ledger and both request dialogs. */
export default function WalletLabel({
  address,
  isSelf = false
}: {
  address: string
  isSelf?: boolean
}): ReactElement {
  useLingui()
  const name = usePontusXLegalName(address)
  const href = `/profile/${address}`
  return (
    <div className={styles.assetCell}>
      <Link className={styles.requesterName} href={href}>
        {name || i18n._('Wallet account')}
        {isSelf && i18n._(' (You)')}
      </Link>
      <Identifier value={address} label={i18n._('Wallet')} href={href} />
    </div>
  )
}
