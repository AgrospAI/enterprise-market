import { Trans, useLingui } from '@lingui/react'
import { ReactElement, useEffect, useState } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import { generateBaseQuery, queryMetadata } from '@utils/aquarius'
import { useUserPreferences } from '@context/UserPreferences'
import { useAsset } from '@context/Asset'
import styles from './index.module.css'
import { useCancelToken } from '@hooks/useCancelToken'
import AssetList from '@shared/AssetList'
import { generateQuery } from './_utils'
import { withoutPortalTag } from '@utils/portalTag'
import { Asset } from 'src/@types/Asset'

export default function RelatedAssets(): ReactElement {
  useLingui()

  const { asset } = useAsset()
  const { chainIds } = useUserPreferences()
  const newCancelToken = useCancelToken()

  const [relatedAssets, setRelatedAssets] = useState<Asset[]>()
  const [isLoading, setIsLoading] = useState<boolean>()
  const assetId = asset?.id
  const assetNftAddress = asset?.credentialSubject?.nftAddress
  const assetOwner = asset?.indexedMetadata?.nft?.owner
  const assetTags = asset?.credentialSubject?.metadata?.tags
  const hasAssetMetadata = Boolean(asset?.credentialSubject?.metadata)

  useEffect(() => {
    if (
      !chainIds?.length ||
      !assetId ||
      !assetNftAddress ||
      !assetOwner ||
      !hasAssetMetadata
    ) {
      return
    }

    async function getAssets() {
      setIsLoading(true)

      try {
        let tagResults: Asset[] = []

        // Tareando: every asset carries the portal tag, so ignore it when
        // looking for related assets by tag.
        const relatedTags = withoutPortalTag(
          assetTags instanceof Array ? assetTags : []
        )

        // safeguard against faults in the metadata
        if (relatedTags.length > 0) {
          const baseQuery = generateBaseQuery({
            chainIds,
            esPaginationOptions: { from: 0, size: 4 }
          })
          // keep the base filters (portal tag, chain, purgatory, nodes...)
          // and only narrow the result down by tag and current asset
          const tagQuery = {
            ...baseQuery,
            query: {
              bool: {
                ...baseQuery.query.bool,
                must: [
                  ...(baseQuery.query.bool.must || []),
                  {
                    terms: {
                      'credentialSubject.metadata.tags.keyword': relatedTags
                    }
                  }
                ],
                must_not: [
                  {
                    term: {
                      id: assetId
                    }
                  }
                ]
              }
            }
          }
          tagResults =
            (await queryMetadata(tagQuery, newCancelToken()))?.results || []
        }
        if (tagResults?.length === 4) {
          setRelatedAssets(tagResults)
        } else {
          const ownerQuery = generateBaseQuery(
            generateQuery(
              chainIds,
              assetNftAddress,
              4 - tagResults?.length,
              null,
              assetOwner
            )
          )

          const ownerResults = (
            await queryMetadata(ownerQuery, newCancelToken())
          )?.results

          // combine both results, and filter out duplicates
          // stolen from: https://stackoverflow.com/a/70326769/733677
          const bothResults = tagResults?.concat(
            ownerResults?.filter(
              (asset2) => !tagResults?.find((asset1) => asset1.id === asset2.id)
            )
          )
          setRelatedAssets(bothResults?.filter((a) => a.id !== assetId))
        }
      } catch (error) {
        LoggerInstance.error(error.message)
      } finally {
        setIsLoading(false)
      }
    }
    getAssets()
  }, [
    chainIds,
    assetId,
    assetNftAddress,
    assetOwner,
    assetTags,
    hasAssetMetadata,
    newCancelToken
  ])

  return (
    <section className={styles.section}>
      <h3>
        <Trans id="Related Assets" />
      </h3>
      <AssetList
        assets={relatedAssets}
        showPagination={false}
        isLoading={isLoading}
        noPrice
        skeletonCount={4}
      />
    </section>
  )
}
