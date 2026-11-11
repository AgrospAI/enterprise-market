import { ipfsGateway } from 'app.config.cjs'
import { Asset } from 'src/@types/Asset'

/** The license document of an asset, as the download form links it. */
export function getLicenseLink(asset: Asset): string | undefined {
  const mirror =
    asset?.credentialSubject?.metadata?.license?.licenseDocuments?.[0]
      ?.mirrors?.[0]
  if (!mirror) return undefined
  if (mirror.type === 'ipfs' && mirror.ipfsCid) {
    return `${ipfsGateway}/${mirror.ipfsCid}`
  }
  return mirror.url || undefined
}
