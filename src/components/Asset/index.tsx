import { translate } from '../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { useState, useEffect, ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import Alert from '@shared/atoms/Alert'
import { useAsset } from '@context/Asset'
import AssetContent from './AssetContent'
import AssetDetailsSkeleton from './Skeleton'
import { toMetaDescription } from '@utils/seo'

function getAssetDescription(description: unknown): string {
  if (typeof description === 'string') return toMetaDescription(description)
  if (description && typeof description === 'object') {
    return toMetaDescription((description as { '@value'?: string })['@value'])
  }
  return ''
}

export default function AssetDetails({ uri }: { uri: string }): ReactElement {
  useLingui()

  const router = useRouter()
  const { asset, title, error, isInPurgatory, loading } = useAsset()
  const [pageTitle, setPageTitle] = useState<string>()

  useEffect(() => {
    if (!asset || error) {
      setPageTitle(title || i18n._('Could not retrieve asset'))
      return
    }
    setPageTitle(isInPurgatory ? '' : title)
  }, [asset, error, isInPurgatory, router, title, uri])

  const pageDescription = isInPurgatory
    ? undefined
    : getAssetDescription(asset?.credentialSubject?.metadata?.description) ||
      undefined

  return asset && pageTitle !== undefined && !loading ? (
    <Page title={pageTitle} description={pageDescription} uri={uri}>
      <AssetContent asset={asset} />
    </Page>
  ) : error ? (
    <Page title={pageTitle} noPageHeader uri={uri}>
      <Alert title={pageTitle} text={translate(error)} state={'error'} />
    </Page>
  ) : (
    <Page title=" " uri={uri}>
      <AssetDetailsSkeleton />
    </Page>
  )
}
