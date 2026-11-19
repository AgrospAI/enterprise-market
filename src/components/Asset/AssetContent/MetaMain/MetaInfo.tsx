import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import AssetType from '@shared/AssetType'
import Time from '@shared/atoms/Time'
import Publisher from '@shared/Publisher'
import { isSaasAsset } from '@utils/ddo'
import { ReactElement } from 'react'
import styles from './MetaInfo.module.css'
import { AssetExtended } from 'src/@types/AssetExtended'

export default function MetaInfo({
  asset,
  nftPublisher,
  verifiedServiceProviderName
}: {
  asset: AssetExtended
  nftPublisher: string
  verifiedServiceProviderName?: string
}): ReactElement {
  useLingui()

  const isSaas = isSaasAsset(asset)
  const nftOwner = asset?.indexedMetadata?.nft?.owner

  return (
    <div className={styles.wrapper}>
      <AssetType
        type={isSaas ? 'saas' : asset?.credentialSubject?.metadata.type}
        variant="metadata"
        className={styles.assetType}
      />
      <div className={styles.byline}>
        <div>
          <Trans id="Published" />{' '}
          <Time date={asset?.credentialSubject?.metadata.created} relative />
          {(verifiedServiceProviderName ||
            (nftPublisher && nftPublisher !== nftOwner)) && (
            <span>
              {i18n._(' by ')}{' '}
              <Publisher
                account={nftPublisher}
                verifiedServiceProviderName={verifiedServiceProviderName}
              />
            </span>
          )}
          {asset?.credentialSubject?.metadata.created !==
            asset?.credentialSubject?.metadata.updated && (
            <>
              {' — '}
              <span className={styles.updated}>
                <Trans id="updated" />{' '}
                <Time
                  date={asset?.credentialSubject?.metadata.updated}
                  relative
                />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
