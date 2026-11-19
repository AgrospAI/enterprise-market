import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { toDataUrl } from 'myetherwallet-blockies'
import { ReactElement } from 'react'
import styles from './index.module.css'

interface AvatarProps {
  accountId: string
  src?: string
  className?: string
}

export default function Avatar({
  accountId,
  src,
  className
}: AvatarProps): ReactElement {
  useLingui()

  return (
    <img
      className={`${className || ''} ${styles.avatar} `}
      src={src || (accountId ? toDataUrl(accountId) : '')}
      alt={i18n._('Avatar')}
      aria-hidden="true"
    />
  )
}
