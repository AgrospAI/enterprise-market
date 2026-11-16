import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Head from 'next/head'

import { isBrowser } from '@utils/index'
import { useMarketMetadata } from '@context/MarketMetadata'
import {
  getAbsoluteUrl,
  getPageTitle,
  isIndexingAllowed,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
  THEME_COLOR,
  toMetaDescription
} from '@utils/seo'
import { DatasetSchema } from './DatasetSchema'

export default function Seo({
  title,
  description,
  uri
}: {
  title?: string
  description?: string
  uri: string
}): ReactElement {
  useLingui()

  const { siteContent } = useMarketMetadata()

  // Some pages pass the route pattern (e.g. /publish/[step]) as uri; use the
  // real pathname for those. Query strings and hashes never belong in the
  // canonical URL (getAbsoluteUrl strips them).
  const isRoutePattern = /\[[^\]]+\]/.test(uri)
  const canonicalPath =
    isRoutePattern && isBrowser ? window.location.pathname : uri
  const canonical = getAbsoluteUrl(canonicalPath)
  const pageTitle = getPageTitle(title, uri === '/')
  const metaDescription =
    toMetaDescription(description) ||
    toMetaDescription(siteContent?.siteDescription)
  const image = getAbsoluteUrl(siteContent?.siteImage || '/share.png')
  const imageAlt = siteContent?.siteImageAlt || siteContent?.siteTitle

  const allowIndexing = isBrowser
    ? isIndexingAllowed(window?.location?.hostname)
    : false

  const datasetSchema = DatasetSchema()

  return (
    <Head>
      <title>{pageTitle}</title>

      <meta
        name="robots"
        content={allowIndexing ? 'index,follow' : 'noindex,nofollow'}
        key="robots"
      />

      <link rel="canonical" href={canonical} key="canonical" />
      <link rel="icon" href="/favicon.ico" sizes="any" key="icon-ico" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" key="icon-svg" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
        key="apple-touch-icon"
      />
      <link rel="manifest" href="/site.webmanifest" key="manifest" />
      <meta name="theme-color" content={THEME_COLOR} key="theme-color" />

      <meta name="description" content={metaDescription} key="description" />

      <meta property="og:type" content="website" key="og:type" />
      <meta
        property="og:site_name"
        content={siteContent?.siteTitle}
        key="og:site_name"
      />
      <meta property="og:title" content={pageTitle} key="og:title" />
      <meta
        property="og:description"
        content={metaDescription}
        key="og:description"
      />
      <meta property="og:url" content={canonical} key="og:url" />
      <meta property="og:image" content={image} key="og:image" />
      <meta
        property="og:image:width"
        content={String(SHARE_IMAGE_WIDTH)}
        key="og:image:width"
      />
      <meta
        property="og:image:height"
        content={String(SHARE_IMAGE_HEIGHT)}
        key="og:image:height"
      />
      <meta property="og:image:alt" content={imageAlt} key="og:image:alt" />

      <meta
        name="twitter:card"
        content="summary_large_image"
        key="twitter:card"
      />
      <meta name="twitter:title" content={pageTitle} key="twitter:title" />
      <meta
        name="twitter:description"
        content={metaDescription}
        key="twitter:description"
      />
      <meta name="twitter:image" content={image} key="twitter:image" />
      <meta
        name="twitter:image:alt"
        content={imageAlt}
        key="twitter:image:alt"
      />

      {datasetSchema && (
        <script type="application/ld+json" id="datasetSchema">
          {JSON.stringify(datasetSchema).replace(/</g, '\\u003c')}
        </script>
      )}
      <script
        defer
        src="https://umami.agrospai.udl.cat/umami"
        data-website-id="dd68db0f-4cc5-4114-b3b2-9d9621a7ce27"
      ></script>
    </Head>
  )
}
