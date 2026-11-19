import { useLingui } from '@lingui/react'
import Loader from '@shared/atoms/Loader'
import { authLogoutCopy } from '../constants'
import styles from './LogoutPanel.module.css'

export default function LogoutPanel() {
  useLingui()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{authLogoutCopy.title}</h2>
        <p className={styles.subtitle}>{authLogoutCopy.subtitle}</p>
      </div>

      <div className={styles.loaderWrap}>
        <Loader variant="primary" noMargin className={styles.loader} />
      </div>

      <p className={styles.waiting}>{authLogoutCopy.waiting}</p>
    </div>
  )
}
