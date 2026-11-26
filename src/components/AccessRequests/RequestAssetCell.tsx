import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement } from 'react'
import Link from 'next/link'
import Identifier from './Identifier'
import useRequestAsset from '@hooks/useRequestAsset'
import { Asset } from 'src/@types/Asset'
import styles from './index.module.css'

export default function RequestAssetCell({
  chainId,
  nft,
  type,
  knownAsset,
  did
}: {
  chainId: number
  nft?: string
  type: 'Asset' | 'Dataset' | 'Algorithm'
  knownAsset?: Asset
  did?: string
}): ReactElement {
  useLingui()
  const metadata = useRequestAsset(chainId, nft, did, knownAsset)
  if (!did && (!nft || /^0x0+$/.test(nft)))
    return <span className={styles.secondary}>{i18n._('Not applicable')}</span>
  const asset = knownAsset || metadata.data
  const resolvedDid = asset?.id || did
  const href = resolvedDid ? `/asset/${resolvedDid}` : undefined
  return (
    <div className={styles.assetCell}>
      {href ? (
        <Link className={styles.requesterName} href={href}>
          {asset?.credentialSubject.metadata.name || i18n._(type)}
        </Link>
      ) : (
        <span className={styles.secondary}>
          {metadata.isFetching
            ? type === 'Dataset'
              ? i18n._('Loading dataset…')
              : type === 'Algorithm'
              ? i18n._('Loading algorithm…')
              : i18n._('Loading asset…')
            : type === 'Dataset'
            ? i18n._('Dataset metadata unavailable')
            : type === 'Algorithm'
            ? i18n._('Algorithm metadata unavailable')
            : i18n._('Asset metadata unavailable')}
        </span>
      )}
      {href && <Identifier value={resolvedDid} label="DID" href={href} />}
    </div>
  )
}
