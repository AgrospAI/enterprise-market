import { i18n } from '../../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import styles from './index.module.css'
import { ComputeFlow } from '../_types'
import { AssetExtended } from 'src/@types/AssetExtended'
import { Service } from 'src/@types/ddo/Service'

interface TitleProps {
  flow: ComputeFlow
  asset: AssetExtended
  service: Service
}

const titleCopy: Record<ComputeFlow, string> = {
  get dataset() {
    return i18n._('Buy Compute Job')
  },
  get algorithm() {
    return i18n._('Buy Compute Job')
  }
}

export default function Title({
  flow,
  asset,
  service
}: TitleProps): ReactElement {
  useLingui()

  const assetTitle = `${asset.credentialSubject.metadata.name} - ${service.name}`

  return (
    <div className={styles.titleContainer}>
      <span className={styles.titleText}>{titleCopy[flow]}</span>
      <span
        className={`${styles.assetInfo} ${styles.right}`}
        title={assetTitle}
      >
        {assetTitle}
      </span>
    </div>
  )
}
