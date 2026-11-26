import { buildEditedLicense } from './_license'
import type { MetadataEditForm } from './_types'

const document = {
  name: 'original.txt',
  fileType: 'txt',
  sha256: 'checksum',
  displayName: { '@value': 'original.txt', '@language': 'en' },
  mirrors: [{ type: 'ipfs', ipfsCid: 'original-cid' }]
}
const values = {
  useRemoteLicense: true,
  uploadedLicense: { name: document.name, licenseDocuments: [document] },
  additionalLicenseFiles: [
    {
      id: 'one',
      name: 'Edited supplementary terms',
      sourceType: 'Upload file',
      url: [],
      uploadedDocument: document
    }
  ]
} as MetadataEditForm

it('saves edited supplemental names and display names without changing content or the input', () => {
  const license = buildEditedLicense(values)
  expect(license.licenseDocuments[1]).toMatchObject({
    name: 'Edited supplementary terms',
    displayName: { '@value': 'Edited supplementary terms' },
    sha256: 'checksum',
    mirrors: document.mirrors
  })
  expect(document.name).toBe('original.txt')
  expect(document.displayName['@value']).toBe('original.txt')
})

it('removes deleted additional documents from the derived license', () => {
  expect(
    buildEditedLicense({ ...values, additionalLicenseFiles: [] })
      .licenseDocuments
  ).toEqual([document])
})

it('uses the current primary URL rather than a previously uploaded license', () => {
  const license = buildEditedLicense({
    ...values,
    useRemoteLicense: false,
    licenseUrl: [
      {
        url: 'https://example.com/replacement.txt',
        type: 'url',
        valid: true,
        checksum: 'new-checksum',
        contentLength: '42',
        contentType: 'text/plain'
      }
    ]
  })
  expect(license.licenseDocuments[0]).toMatchObject({
    name: 'replacement.txt',
    sha256: 'new-checksum',
    additionalInformation: { size: 42 },
    mirrors: [{ url: 'https://example.com/replacement.txt' }]
  })
})
