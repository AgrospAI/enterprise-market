import type { MetadataEditForm } from './_types'
import type { License } from 'src/@types/ddo/License'
import type { RemoteObject } from 'src/@types/ddo/RemoteObject'
import type { FileInfo } from '@oceanprotocol/lib'
import { inferNameFromUrl } from '@components/Publish/_license'

/** Build from current fields at submission, rather than a stale derived license. */
export function buildEditedLicense(
  values: Pick<
    MetadataEditForm,
    | 'useRemoteLicense'
    | 'uploadedLicense'
    | 'licenseUrl'
    | 'additionalLicenseFiles'
    | 'descriptionLanguage'
    | 'descriptionDirection'
  >
): License | undefined {
  const language = (value: string) => ({
    '@value': value,
    '@language': values.descriptionLanguage || '',
    '@direction': values.descriptionDirection || ''
  })
  const fromUrl = (file: FileInfo, name: string): RemoteObject => {
    const size = Number(file.contentLength)
    return {
      name,
      fileType: file.contentType || '',
      sha256: file.checksum || '',
      ...(Number.isFinite(size) &&
        size >= 0 && { additionalInformation: { size } }),
      description: language(''),
      displayName: language(name),
      mirrors: [
        {
          url: file.url,
          type: file.type || 'url',
          method: file.method || 'get'
        }
      ]
    }
  }
  const main = values.useRemoteLicense
    ? values.uploadedLicense?.licenseDocuments?.[0]
    : values.licenseUrl?.[0]?.valid
    ? fromUrl(values.licenseUrl[0], inferNameFromUrl(values.licenseUrl[0].url))
    : undefined
  if (!main) return
  const documents: RemoteObject[] = [main]
  for (const file of values.additionalLicenseFiles || []) {
    const name = file.name?.trim()
    if (file.sourceType === 'Upload file' && file.uploadedDocument) {
      const documentName = name || file.uploadedDocument.name
      documents.push({
        ...file.uploadedDocument,
        name: documentName,
        displayName: {
          ...file.uploadedDocument.displayName,
          '@value': documentName
        }
      })
    } else if (file.sourceType === 'URL' && file.url?.[0]?.valid) {
      documents.push(
        fromUrl(file.url[0], name || inferNameFromUrl(file.url[0].url))
      )
    }
  }
  return { name: main.name, licenseDocuments: documents }
}
