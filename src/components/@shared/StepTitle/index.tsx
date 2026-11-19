import { i18n } from '../../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import styles from './index.module.css'

export default function StepTitle({ title }: { title: string }): ReactElement {
  const { i18n } = useLingui()

  return (
    <div className={styles.titleContainer}>
      <span className={styles.titleText}>{i18n._(title)}</span>
    </div>
  )
}
