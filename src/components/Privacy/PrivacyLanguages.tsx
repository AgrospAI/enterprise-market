import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import LanguageSwitcher from '../../i18n/LanguageSwitcher'
import styles from './PrivacyLanguages.module.css'

export default function PrivacyLanguages({
  label
}: {
  label?: string
}): ReactElement {
  const { i18n } = useLingui()
  return (
    <div className={styles.langSelect}>
      <span className={styles.langLabel}>{label || i18n._('Language')}</span>
      <div className={styles.langOptions}>
        <LanguageSwitcher />
      </div>
    </div>
  )
}
