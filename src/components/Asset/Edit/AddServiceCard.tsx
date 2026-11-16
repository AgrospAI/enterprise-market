import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import styles from './AddServiceCard.module.css'

export default function AddServiceCard({
  onClick
}: {
  onClick: () => void
}): ReactElement {
  useLingui()

  return (
    <div onClick={onClick} className={styles.service}>
      <span className={styles.title}>
        <Trans id="Add a new service" />
      </span>
    </div>
  )
}
