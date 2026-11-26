import { buildEditedLicense } from './_license'
import { i18n } from '../../../i18n/index'
import { useFormikContext } from 'formik'
import { useEffect, useState, useMemo } from 'react'
import { MetadataEditForm, FormAdditionalLicenseFile } from './_types'
import { deleteIpfsFile, uploadFileItemToIPFS } from '@utils/ipfs'
import { FileItem } from '@utils/fileItem'
import { RemoteObject } from 'src/@types/ddo/RemoteObject'
import { RemoteSource } from 'src/@types/ddo/RemoteSource'
import { LoggerInstance } from '@oceanprotocol/lib'
import appConfig from 'app.config.cjs'
import { toast } from 'react-toastify'
import {
  reindexBooleanMapAfterDeletion,
  additionalLicenseSourceOptions,
  inferNameFromUrl,
  getAdditionalLicenseSubtext
} from '@components/Publish/_license'
import { AdditionalLicenseSourceType } from '@components/Publish/_types'
import { supportedLanguages } from '@components/Asset/languageType'

export default function useEditMetadata() {
  const { values, setFieldValue, setFieldTouched, setFieldError } =
    useFormikContext<MetadataEditForm>()
  const [additionalFilesUploading, setAdditionalFilesUploading] = useState<
    Record<number, boolean>
  >({})
  const [additionalFilesDeleting, setAdditionalFilesDeleting] = useState<
    Record<number, boolean>
  >({})

  const languageOptions = useMemo(() => {
    return supportedLanguages
      .map((lang) => lang.name)
      .sort((a, b) => a.localeCompare(b))
  }, [])

  const handleDescriptionLanguageChange = (languageName: string) => {
    const selectedLanguage = supportedLanguages.find(
      (lang) => lang.name === languageName
    )

    if (selectedLanguage) {
      setFieldValue('descriptionLanguage', selectedLanguage.code)
      setFieldValue('descriptionDirection', selectedLanguage.direction)
    }
  }

  const getCurrentDescriptionLanguageName = () => {
    const currentCode = values.descriptionLanguage
    if (!currentCode) return ''

    const language = supportedLanguages.find(
      (lang) => lang.code === currentCode
    )
    return language?.name || ''
  }

  function isPrimaryLicenseReady(): boolean {
    if (values.useRemoteLicense) {
      return !!values.uploadedLicense?.licenseDocuments?.[0]
    }
    return !!values.licenseUrl?.[0]?.valid
  }

  async function updateLicenseDocuments(
    additionalFiles: FormAdditionalLicenseFile[]
  ) {
    await setFieldValue(
      'license',
      buildEditedLicense({ ...values, additionalLicenseFiles: additionalFiles })
    )
  }

  useEffect(() => {
    const additionalFiles = values.additionalLicenseFiles || []
    if (!additionalFiles.length) return

    const updatedFiles = additionalFiles.map((additionalFile) => {
      if (additionalFile.name?.trim()) return additionalFile
      if (additionalFile.sourceType !== 'URL') return additionalFile

      const url = additionalFile.url?.[0]?.url?.trim()
      if (!url || !additionalFile.url?.[0]?.valid) return additionalFile

      return {
        ...additionalFile,
        name: inferNameFromUrl(url)
      }
    })

    const hasUpdates = updatedFiles.some(
      (additionalFile, index) => additionalFile !== additionalFiles[index]
    )
    if (hasUpdates) {
      setFieldValue('additionalLicenseFiles', updatedFiles)
    }
  }, [values.additionalLicenseFiles, setFieldValue])

  function getAdditionalFilesSnapshot(): FormAdditionalLicenseFile[] {
    return [...(values.additionalLicenseFiles || [])]
  }

  async function setAdditionalFiles(
    additionalFiles: FormAdditionalLicenseFile[],
    shouldValidate = true
  ) {
    await setFieldValue(
      'additionalLicenseFiles',
      additionalFiles,
      shouldValidate
    )
  }

  function getRemoteObjectFromFileItem(
    fileItem: FileItem,
    remoteSource: RemoteSource
  ): RemoteObject {
    const fileType = fileItem.name.split('.').pop() || ''
    return {
      name: fileItem.name,
      fileType,
      sha256: fileItem.checksum,
      additionalInformation: {
        size: fileItem.size
      },
      description: {
        '@value': '',
        '@language': values.descriptionLanguage || '',
        '@direction': values.descriptionDirection || ''
      },
      displayName: {
        '@value': fileItem.name,
        '@language': values.descriptionLanguage || '',
        '@direction': values.descriptionDirection || ''
      },
      mirrors: [remoteSource]
    }
  }

  async function unpinUploadedDocument(document?: RemoteObject) {
    const ipfsHash = document?.mirrors?.[0]?.ipfsCid
    if (!appConfig.ipfsUnpinFiles || !ipfsHash || ipfsHash.length === 0) {
      return
    }

    try {
      await deleteIpfsFile(ipfsHash)
    } catch {
      LoggerInstance.error("Can't delete license file")
    }
  }

  async function handleAdditionalFileUpload(
    index: number,
    fileItem: FileItem,
    onError: () => void
  ) {
    setAdditionalFilesUploading((prev) => ({ ...prev, [index]: true }))

    try {
      const remoteSource = await uploadFileItemToIPFS(fileItem)
      const remoteObject = getRemoteObjectFromFileItem(fileItem, remoteSource)
      const additionalFiles = getAdditionalFilesSnapshot()
      const currentName = additionalFiles[index]?.name?.trim()
      const finalName = currentName || fileItem.name
      const updatedRemoteObject = {
        ...remoteObject,
        name: finalName
      }

      additionalFiles[index] = {
        ...additionalFiles[index],
        name: finalName,
        url: [],
        uploadedDocument: updatedRemoteObject
      }
      await setAdditionalFiles(additionalFiles)
      await updateLicenseDocuments(additionalFiles)
    } catch (error) {
      toast.error(i18n._('Could not upload file'))
      LoggerInstance.error(error)

      const additionalFiles = getAdditionalFilesSnapshot()
      additionalFiles[index] = {
        ...additionalFiles[index],
        uploadedDocument: undefined
      }
      await setAdditionalFiles(additionalFiles)
      onError()
    } finally {
      setAdditionalFilesUploading((prev) => {
        const next = { ...prev }
        delete next[index]
        return next
      })
    }
  }

  async function handleNewAdditionalFile() {
    if (!isPrimaryLicenseReady()) return

    const additionalFiles = getAdditionalFilesSnapshot()
    const newIndex = additionalFiles.length

    const newFile: FormAdditionalLicenseFile = {
      id: `new-${Date.now()}-${Math.random()}`,
      name: '',
      sourceType: 'URL',
      url: [{ url: '', type: 'url', valid: false }]
    }

    additionalFiles.push(newFile)
    await setAdditionalFiles(additionalFiles, false)

    setFieldTouched(`additionalLicenseFiles[${newIndex}].name`, false, false)
    setFieldTouched(`additionalLicenseFiles[${newIndex}].url`, false, false)
    setFieldTouched(
      `additionalLicenseFiles[${newIndex}].url[0].url`,
      false,
      false
    )
    setFieldError(`additionalLicenseFiles[${newIndex}].name`, undefined)
    setFieldError(`additionalLicenseFiles[${newIndex}].url`, undefined)
  }

  async function handleDeleteAdditionalFile(index: number) {
    setAdditionalFilesDeleting((prev) => ({ ...prev, [index]: true }))

    try {
      const additionalFiles = getAdditionalFilesSnapshot()
      const additionalFile = additionalFiles[index]

      await unpinUploadedDocument(additionalFile?.uploadedDocument)
      additionalFiles.splice(index, 1)
      await setAdditionalFiles(additionalFiles)
      await updateLicenseDocuments(additionalFiles)

      setAdditionalFilesUploading((prev) =>
        reindexBooleanMapAfterDeletion(prev, index)
      )
    } finally {
      setAdditionalFilesDeleting((prev) =>
        reindexBooleanMapAfterDeletion(prev, index)
      )
    }
  }

  async function handleAdditionalFileSourceChange(
    index: number,
    sourceType: AdditionalLicenseSourceType
  ) {
    const additionalFiles = getAdditionalFilesSnapshot()
    const currentAdditionalFile = additionalFiles[index]

    if (
      currentAdditionalFile?.sourceType === 'Upload file' &&
      sourceType === 'URL'
    ) {
      await unpinUploadedDocument(currentAdditionalFile.uploadedDocument)
    }

    additionalFiles[index] = {
      id: currentAdditionalFile?.id || `new-${Date.now()}-${Math.random()}`,
      name: currentAdditionalFile?.name || '',
      sourceType,
      url: sourceType === 'URL' ? [{ url: '', type: 'url', valid: false }] : [],
      uploadedDocument:
        sourceType === 'Upload file'
          ? currentAdditionalFile?.uploadedDocument
          : undefined
    }

    await setAdditionalFiles(additionalFiles)
  }

  async function handleAdditionalFileUrlValidate(
    index: number,
    url: string,
    isValid: boolean,
    fileData?: any
  ) {
    const additionalFiles = getAdditionalFilesSnapshot()

    if (isValid && fileData) {
      const currentName = additionalFiles[index]?.name?.trim()
      let finalName = currentName
      if (!finalName) {
        finalName = fileData.name || inferNameFromUrl(url)
      }

      additionalFiles[index] = {
        ...additionalFiles[index],
        url: [
          {
            url,
            type: 'url',
            valid: true,
            checksum: fileData.checksum,
            method: fileData.method || 'get',
            contentLength: fileData.contentLength,
            contentType: fileData.contentType
          }
        ],
        name: finalName
      }

      await setAdditionalFiles(additionalFiles)

      await updateLicenseDocuments(additionalFiles)

      setFieldTouched(`additionalLicenseFiles[${index}].url`, true, false)
    } else {
      additionalFiles[index] = {
        ...additionalFiles[index],
        url: [
          {
            url,
            type: 'url',
            valid: false
          }
        ]
      }
      await setAdditionalFiles(additionalFiles)
    }
  }

  async function handleResetPrimaryUploadedLicense() {
    await unpinUploadedDocument(values.uploadedLicense?.licenseDocuments?.[0])

    const additionalFiles = values.additionalLicenseFiles || []
    await Promise.all(
      additionalFiles.map((file) =>
        unpinUploadedDocument(file.uploadedDocument)
      )
    )

    await setFieldValue('additionalLicenseFiles', [])
    await setFieldValue('uploadedLicense', undefined)
  }

  const additionalFiles = values.additionalLicenseFiles || []
  const primaryLicenseReady = isPrimaryLicenseReady()
  const additionalLicenseSubtext = getAdditionalLicenseSubtext(additionalFiles)

  return {
    values,
    additionalFiles,
    additionalFilesUploading,
    additionalFilesDeleting,
    additionalFileSourceOptions: additionalLicenseSourceOptions,
    additionalLicenseSubtext,
    primaryLicenseReady,
    languageOptions,
    handleAdditionalFileUpload,
    handleNewAdditionalFile,
    handleDeleteAdditionalFile,
    handleAdditionalFileSourceChange,
    handleAdditionalFileUrlValidate,
    handleResetPrimaryUploadedLicense,
    getCurrentDescriptionLanguageName,
    handleDescriptionLanguageChange
  }
}
