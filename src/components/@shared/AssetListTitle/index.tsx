import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import Link from 'next/link'
import { ReactElement, useEffect, useState } from 'react'
import styles from './index.module.css'
import axios from 'axios'
import { useMarketMetadata } from '@context/MarketMetadata'
import { Asset } from 'src/@types/Asset'
import { getAsset } from '@utils/aquarius'

export default function AssetListTitle({
  asset,
  did,
  title,
  openInNewTab,
  maxTitleLength = 16
}: {
  asset?: Asset
  did?: string
  title?: string
  openInNewTab?: boolean
  maxTitleLength?: number
}): ReactElement {
  useLingui()

  const { appConfig } = useMarketMetadata()
  const [resolvedName, setResolvedName] = useState<{
    did: string
    name: string
  }>()
  const assetTitle =
    title ||
    asset?.credentialSubject?.metadata?.name ||
    (resolvedName?.did === did ? resolvedName.name : undefined) ||
    did ||
    ''
  const assetTitleTrimmed =
    assetTitle.length > maxTitleLength
      ? assetTitle.slice(0, Math.max(0, maxTitleLength - 3)) + '...'
      : assetTitle
  useEffect(() => {
    if (title || asset || !did || !appConfig.metadataCacheUri) return

    const source = axios.CancelToken.source()
    let active = true

    async function getAssetName() {
      try {
        const resolved = await getAsset(did, source.token)
        const name = resolved?.credentialSubject?.metadata?.name
        if (active && name) setResolvedName({ did, name })
      } catch {
        // Keep the DID visible when metadata cannot be resolved.
      }
    }
    getAssetName()

    return () => {
      active = false
      source.cancel()
    }
  }, [appConfig.metadataCacheUri, asset, did, title])

  const assetId = did || asset?.id
  const assetHref = assetId ? `/asset/${assetId}` : undefined
  const titleContent = (
    <span className={styles.titleWrapper} title={assetTitle}>
      {assetTitleTrimmed}
    </span>
  )

  return (
    <span className={styles.title}>
      {assetHref ? (
        <Link
          href={assetHref}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? i18n._('noopener noreferrer') : undefined}
        >
          {titleContent}
        </Link>
      ) : (
        titleContent
      )}
    </span>
  )
}
