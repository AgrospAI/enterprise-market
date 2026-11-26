import { i18n } from '../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Link from 'next/link'
import CopyIconButton from '@shared/atoms/CopyIconButton'
import styles from './index.module.css'
import { truncateIdentifier } from '@utils/string'

export default function Identifier({
  value,
  label,
  href
}: {
  value: string
  label: string
  href: string
}): ReactElement {
  useLingui()
  return (
    <span className={styles.identifier}>
      <Link href={href} title={`${label}: ${value}`}>
        <code>{truncateIdentifier(value)}</code>
      </Link>
      <CopyIconButton
        text={value}
        copyAriaLabel={i18n._('Copy {label}', { label })}
      />
    </span>
  )
}
