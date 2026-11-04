import { ReactElement } from 'react'
import Link from 'next/link'
import removeMarkdown from 'remove-markdown'
import Publisher from '@shared/Publisher'
import AssetType from '@shared/AssetType'
import NetworkName from '@shared/NetworkName'
import styles from './index.module.css'
import { isSaasAsset } from '@utils/ddo'
import { AssetExtended } from 'src/@types/AssetExtended'
import Bookmark from '@components/Asset/AssetContent/Bookmark'
import { ServiceTypeIcons } from '@shared/AssetList/ServiceTypeIcons'
import IconLocation from '@images/location.svg'

declare type AssetTeaserProps = {
  asset: AssetExtended
  noPublisher?: boolean
  noDescription?: boolean
  noPrice?: boolean
}

export default function AssetTeaser({
  asset,
  noPublisher,
  noDescription
}: AssetTeaserProps): ReactElement {
  const { name, type, description, additionalInformation } =
    asset.credentialSubject.metadata
  const spatial = additionalInformation?.['dct:spatial']
  const hasGeoCoverage = Boolean(spatial?.['dcat:bbox']?.['@value'])
  const geoLabel = spatial?.['skos:prefLabel'] || 'Geographic coverage'
  const isSaas = isSaasAsset(asset)
  const services = asset.credentialSubject?.services
  const hasServiceTypes = services?.some((service) =>
    ['access', 'compute'].includes(service.type)
  )
  const owner = asset.indexedMetadata.nft?.owner
  const { orders } = asset.indexedMetadata.stats[0] || {}

  return (
    <article className={`${styles.teaser} ${styles[type]}`}>
      <Link href={`/asset/${asset.id}`} className={styles.link}>
        <aside className={styles.detailLine}>
          <AssetType
            className={styles.assetTypeLabel}
            type={isSaas ? 'saas' : type}
            variant="metadata"
          />
          {hasServiceTypes && (
            <>
              <span className={styles.detailDivider} aria-hidden="true" />
              <ServiceTypeIcons
                services={services}
                hideEmpty
                className={styles.serviceTypes}
              />
            </>
          )}
          {hasGeoCoverage && (
            <>
              <span className={styles.detailDivider} aria-hidden="true" />
              <span className={styles.geoCoverage} title={geoLabel}>
                <IconLocation aria-hidden="true" />
                <span className={styles.geoLabel}>{geoLabel}</span>
              </span>
            </>
          )}
        </aside>
        <header className={styles.header}>
          <h1 className={styles.title}>{name.slice(0, 200)}</h1>

          {!noPublisher && (
            <span className={styles.owner}>
              <Publisher account={owner} minimal />
            </span>
          )}
        </header>
        {!noDescription && (
          <div className={styles.content}>
            <p className={styles.description}>
              {removeMarkdown(description?.['@value']?.substring(0, 300) || '')}
            </p>
          </div>
        )}
        <footer className={styles.footer}>
          <div className={styles.stats}>
            {orders && orders > 0 ? (
              <span className={styles.typeLabel}>
                {orders < 0 ? (
                  'N/A'
                ) : (
                  <>
                    <strong>{orders}</strong> {orders === 1 ? 'sale' : 'sales'}
                  </>
                )}
              </span>
            ) : null}
            {asset.views && asset.views > 0 ? (
              <span className={styles.typeLabel}>
                {asset.views < 0 ? (
                  'N/A'
                ) : (
                  <>
                    <strong>{asset.views}</strong>{' '}
                    {asset.views === 1 ? 'view' : 'views'}
                  </>
                )}
              </span>
            ) : null}
          </div>
          <NetworkName
            networkId={asset.credentialSubject?.chainId}
            className={styles.networkName}
          />
        </footer>
      </Link>
      <Bookmark did={asset.id} className={styles.bookmark} />
    </article>
  )
}
