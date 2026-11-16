import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import MetaItem from './MetaItem'
import styles from './MetaFull.module.css'
import Publisher from '@shared/Publisher'
import { useAsset } from '@context/Asset'
import { Asset } from 'src/@types/Asset'
import { IpfsRemoteSource } from '@components/@shared/IpfsRemoteSource'
import Label from '@components/@shared/FormInput/Label'
import { assetStateToString, displayAssetState } from '@utils/assetState'
import { safeExternalWebUrl } from '@utils/url'
import AdditionalLicenseFiles from './AdditionalLicenseFiles'
import MetaLinks from './MetaLinks'
import TruncatedMetaValue from './TruncatedMetaValue'

export default function MetaFull({ ddo }: { ddo: Asset }): ReactElement {
  useLingui()

  const { isInPurgatory, assetState, asset } = useAsset()
  const credentialSubject = ddo?.credentialSubject
  const metadata = credentialSubject?.metadata
  const license = credentialSubject?.license || metadata?.license
  const primaryLicenseDocument = license?.licenseDocuments?.[0]
  const primaryLicenseMirror = primaryLicenseDocument?.mirrors?.[0]
  const oeNode = credentialSubject?.services?.[0]?.serviceEndpoint
  const datatokenAddress =
    ddo?.indexedMetadata?.stats?.[0]?.datatokenAddress ||
    credentialSubject?.datatokens?.[0]?.address
  const algorithmContainer = metadata?.algorithm?.container
  const dockerImage =
    algorithmContainer?.image && algorithmContainer?.tag
      ? `${algorithmContainer.image}:${algorithmContainer.tag}`
      : undefined

  const effectiveAssetState =
    assetState ||
    (ddo?.indexedMetadata?.nft?.state !== undefined
      ? assetStateToString(ddo.indexedMetadata.nft.state)
      : 'Active')

  const temporal = metadata?.additionalInformation?.['dct:temporal']
  const temporalStart = temporal?.['dcat:startDate']?.['@value']
  const temporalEnd = temporal?.['dcat:endDate']?.['@value']

  const paymentCollector = asset?.accessDetails?.[0]?.paymentCollector
  const publisherDid = ddo?.issuer

  return ddo ? (
    <>
      <div className={styles.didContainer}>
        <MetaItem
          title={i18n._('DID')}
          content={<TruncatedMetaValue value={ddo.id} start={12} end={8} />}
        />
      </div>

      <div className={styles.metaFull}>
        {!isInPurgatory && metadata?.author && (
          <span className={styles.dataAuther}>
            <MetaItem title={i18n._('Data Author')} content={metadata.author} />
          </span>
        )}
        {metadata?.copyrightHolder && (
          <MetaItem
            title={i18n._('Copyright Holder')}
            content={metadata.copyrightHolder}
          />
        )}
        {metadata?.providedBy && (
          <MetaItem
            title={i18n._('Provided By')}
            content={
              <a
                href={safeExternalWebUrl(metadata.providedBy)}
                target="_blank"
                rel="noreferrer"
              >
                {metadata.providedBy}
              </a>
            }
          />
        )}
        <MetaItem
          title={i18n._('Owner')}
          content={<Publisher account={ddo?.indexedMetadata?.nft?.owner} />}
        />
        {publisherDid && (
          <MetaItem
            title={i18n._('Publisher DID')}
            content={
              <TruncatedMetaValue value={publisherDid} start={12} end={12} />
            }
          />
        )}
        {effectiveAssetState !== 'Active' && (
          <MetaItem
            title={i18n._('Asset State')}
            content={displayAssetState(effectiveAssetState)}
          />
        )}
        {paymentCollector &&
          paymentCollector !== ddo?.indexedMetadata?.nft?.owner && (
            <MetaItem
              title={i18n._('Revenue Sent To')}
              content={<Publisher account={paymentCollector} />}
            />
          )}
        {(temporalStart || temporalEnd) && (
          <MetaItem
            title={i18n._('Temporal Coverage')}
            content={
              temporalStart && temporalEnd
                ? `${temporalStart} – ${temporalEnd}`
                : temporalStart
                ? i18n._('From {temporalStart}', {
                    temporalStart
                  })
                : i18n._('Until {temporalEnd}', { temporalEnd })
            }
          />
        )}
        {metadata?.type === 'algorithm' && dockerImage && (
          <MetaItem title={i18n._('Docker Image')} content={dockerImage} />
        )}
      </div>

      <MetaLinks links={ddo?.credentialSubject?.metadata?.links} />

      <div className={styles.licenseRow}>
        <Label htmlFor="license">
          <span className={styles.licenceTitle}>
            <Trans id="License" />
          </span>
        </Label>
        {primaryLicenseMirror?.type === 'url' && primaryLicenseMirror?.url ? (
          <a
            target="_blank"
            href={safeExternalWebUrl(primaryLicenseMirror.url)}
            rel="noreferrer"
          >
            {primaryLicenseDocument.name}
          </a>
        ) : (
          <IpfsRemoteSource
            noDocumentLabel={i18n._('No license document available')}
            remoteSource={primaryLicenseMirror}
            name={primaryLicenseDocument?.name}
          />
        )}
        <AdditionalLicenseFiles licenseDocuments={license?.licenseDocuments} />
        <MetaItem
          title={i18n._('OE Node')}
          content={oeNode || i18n._('Not available')}
        />
      </div>
    </>
  ) : null
}
