import { i18n } from '../../../i18n/index'
import { ChangeEvent, useRef, useState } from 'react'
import crypto from 'crypto'
import { FileItem } from '@utils/fileItem'
import cleanupContentType from '@utils/cleanupContentType'
import { prettySize } from '@shared/FormInput/InputElement/FilesInput/utils'
import { FILE_UPLOAD_CONFIG, getFileSizeErrorMessage } from './helper'

interface UseFileUploadParams {
  fileName?: string
  fileSize?: number
  fileType?: string
  disabled?: boolean
  onReset?: () => void | Promise<void>
  setFileItem: (fileItem: FileItem, onError: () => void) => void | Promise<void>
  maxFileSizeKB?: number
}

export default function useFileUpload({
  fileName,
  fileSize,
  fileType,
  disabled = false,
  onReset,
  setFileItem,
  maxFileSizeKB
}: UseFileUploadParams) {
  const [uploadFileName, setUploadFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadMeta, setUploadMeta] = useState<{
    size?: number
    fileType?: string
  }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE_KB =
    maxFileSizeKB || FILE_UPLOAD_CONFIG.MAX_LICENSE_FILE_SIZE_KB
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024

  function inferFileTypeFromName(name?: string): string {
    if (!name || !name.includes('.')) return ''
    return name.split('.').pop()?.toLowerCase() || ''
  }

  function estimateUploadTime(fileSizeBytes: number): number {
    const uploadSpeedKBps = 500
    const fileSizeKB = fileSizeBytes / 1024
    const estimatedSeconds = fileSizeKB / uploadSpeedKBps
    return Math.max(3, Math.min(estimatedSeconds, 60))
  }

  function startRealisticProgress(
    fileSizeBytes: number,
    onProgress: (progress: number) => void
  ): NodeJS.Timeout {
    const startTime = Date.now()
    const estimatedSeconds = estimateUploadTime(fileSizeBytes)
    const totalDuration = estimatedSeconds * 1000

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      let progress = Math.min(95, (elapsed / totalDuration) * 100)

      progress = Math.min(95, progress + Math.random() * 2)

      onProgress(Math.floor(progress))

      if (elapsed >= totalDuration) {
        clearInterval(interval)
      }
    }, 200)

    return interval
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    event.preventDefault()

    setErrorMessage(null)
    setUploadProgress(0)

    for (const file of event.target.files || []) {
      if (maxFileSizeKB !== undefined && file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(getFileSizeErrorMessage())
        setUploadFileName('')
        setUploadMeta({})
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      setUploadFileName(file.name)
      setIsUploading(true)
      setUploadProgress(0)
      setUploadMeta({
        size: file.size,
        fileType:
          cleanupContentType(file.type) || inferFileTypeFromName(file.name)
      })

      const reader = new FileReader()
      let progressInterval: NodeJS.Timeout | null = null
      const uploadPromise = new Promise<FileItem>((resolve, reject) => {
        reader.onloadend = () => {
          const hash = crypto.createHash('sha256')
          let content = ''
          if (typeof reader.result === 'string') {
            content = reader.result
          } else if (reader.result) {
            const uint8Array = new Uint8Array(reader.result)
            const decoder = new TextDecoder('utf-8')
            content = decoder.decode(uint8Array)
          }

          hash.update(content)

          const newFileItem: FileItem = {
            checksum: hash.digest('hex'),
            content,
            size: file.size,
            name: file.name
          }
          resolve(newFileItem)
        }
        reader.onerror = () => {
          reject(new Error('Failed to read file'))
        }
        reader.readAsDataURL(file)
      })

      try {
        const newFileItem = await uploadPromise
        progressInterval = startRealisticProgress(file.size, (progress) => {
          setUploadProgress(progress)
        })

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(
              new Error(
                'Upload timeout - please check your connection and try again'
              )
            )
          }, FILE_UPLOAD_CONFIG.UPLOAD_TIMEOUT_MS)

          Promise.resolve(
            setFileItem(newFileItem, () => {
              clearTimeout(timeoutId)
              reject(new Error('Upload failed - server error'))
            })
          )
            .then(() => {
              clearTimeout(timeoutId)
              resolve()
            })
            .catch((error) => {
              clearTimeout(timeoutId)
              reject(error)
            })
        })

        if (progressInterval) clearInterval(progressInterval)
        setUploadProgress(100)
        setTimeout(() => {
          setIsUploading(false)
          setUploadProgress(0)
        }, 1000)
      } catch (error) {
        console.error('Upload error:', error)
        if (progressInterval) clearInterval(progressInterval)
        setUploadProgress(0)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : i18n._(
                'Upload failed. Please check your connection and try again.'
              )
        )
        setUploadFileName('')
        setUploadMeta({})
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  const currentFileName = uploadFileName || fileName || ''
  const hasUploadedFile = !!fileName && !isUploading
  const resolvedSize = uploadMeta.size ?? fileSize
  const confirmedSize = resolvedSize ? prettySize(resolvedSize) : ''
  const confirmedType =
    uploadMeta.fileType ||
    (fileType ? cleanupContentType(fileType) : '') ||
    inferFileTypeFromName(fileName || uploadFileName)

  function handleButtonClick() {
    if (disabled || isUploading || isResetting) return
    fileInputRef.current?.click()
  }

  async function handleResetClick() {
    if (!onReset || isResetting) return
    setIsResetting(true)
    setErrorMessage(null)
    setUploadProgress(0)
    try {
      await onReset()
      setUploadFileName('')
      setUploadMeta({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsResetting(false)
    }
  }

  return {
    fileInputRef,
    currentFileName,
    hasUploadedFile,
    confirmedSize,
    confirmedType,
    isUploading,
    isResetting,
    uploadProgress,
    errorMessage,
    handleChange,
    handleButtonClick,
    handleResetClick
  }
}
