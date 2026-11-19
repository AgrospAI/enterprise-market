import { useLingui } from '@lingui/react'
import { useContext, useState } from 'react'
import { useAsset } from '@context/Asset'
import Tooltip from '@shared/atoms/Tooltip'
import { decodeTokenURI } from '@utils/nft'
import { FormikContext, FormikContextType } from 'formik'
import { FormPublishData } from '@components/Publish/_types'
import NftTooltip from './NftTooltip'
import styles from './index.module.css'

export default function Nft({
  isBlockscoutExplorer
}: {
  isBlockscoutExplorer: boolean
}) {
  useLingui()

  const { asset } = useAsset()
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const nftMetadata = decodeTokenURI(asset?.indexedMetadata.nft?.tokenURI)

  // TODO: using this for the publish preview works fine, but produces a console warning
  // on asset details page as there is no formik context there:
  // Warning: Formik context is undefined, please verify you are calling useFormikContext()
  // as child of a <Formik> component.
  const formikState = useContext(FormikContext) as
    | FormikContextType<FormPublishData>
    | undefined

  // checking if the NFT has an image associated (tokenURI)
  // if tokenURI is undefined, then we are in Preview
  // for Preview we need to show accessDetails.dataImage
  // as this is where the NFT's SVG (during publish) is stored
  const nftImage = nftMetadata?.image_data
    ? nftMetadata.image_data
    : nftMetadata?.image
    ? nftMetadata.image
    : formikState?.values?.metadata?.nft?.image_data
    ? formikState.values.metadata.nft.image_data
    : null
  const displayImage = nftImage && nftImage !== failedImage ? nftImage : null

  return (
    <div className={styles.nftImage}>
      {displayImage ? (
        <img
          key={displayImage}
          src={displayImage}
          alt={asset?.indexedMetadata.nft?.name}
          onError={() => setFailedImage(displayImage)}
        />
      ) : (
        <div className={styles.placeholder} />
      )}

      {(nftMetadata || asset?.credentialSubject?.nftAddress) && (
        <Tooltip
          className={styles.tooltip}
          contentClassName={styles.tooltipContent}
          content={
            <NftTooltip
              nft={nftMetadata}
              nftImage={displayImage}
              address={asset?.credentialSubject?.nftAddress}
              chainId={asset?.credentialSubject?.chainId}
              isBlockscoutExplorer={isBlockscoutExplorer}
            />
          }
        />
      )}
    </div>
  )
}
