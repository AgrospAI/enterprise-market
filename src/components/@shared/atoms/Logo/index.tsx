import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import LogoAsset from '@images/tareando_logo_horizontal.svg'
import styles from './index.module.css'

export default function Logo(): ReactElement {
  useLingui()

  return <LogoAsset className={styles.logo} />
}
