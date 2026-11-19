import { Trans, useLingui } from '@lingui/react'
import Publisher from '@shared/Publisher'
import { ReactElement } from 'react'
import styles from './MetaAsset.module.css'
import { AssetExtended } from 'src/@types/AssetExtended'

export default function MetaAsset({
  asset
}: {
  asset: AssetExtended
}): ReactElement {
  useLingui()

  return (
    <div className={styles.wrapper}>
      <span className={styles.owner}>
        <Trans id="Owned by" />{' '}
        <Publisher account={asset?.indexedMetadata?.nft?.owner} />
      </span>
    </div>
  )
}
