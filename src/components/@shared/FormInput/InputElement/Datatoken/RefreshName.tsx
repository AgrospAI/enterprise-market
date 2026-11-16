import { useLingui } from '@lingui/react'
import { i18n } from '../../../../../i18n/index'
import { ReactElement } from 'react'
import styles from './RefreshName.module.css'
import Button from '@shared/atoms/Button'
import Refresh from '@images/refresh.svg'

export default function RefreshName({
  generateName
}: {
  generateName: () => void
}): ReactElement {
  useLingui()

  return (
    <Button
      style="text"
      size="small"
      className={styles.refresh}
      title={i18n._('Generate new name & symbol')}
      onClick={(e) => {
        e.preventDefault()
        generateName()
      }}
    >
      <Refresh />
    </Button>
  )
}
