import { i18n } from '../../i18n/index'
import {
  ComputeOutput,
  EncryptMethod,
  StorageObject,
  UrlFileObject,
  S3FileObject,
  FtpFileObject
} from '@oceanprotocol/lib'
import { FormComputeData } from './_types'

const COMPUTE_OUTPUT_ENCRYPTION_STORAGE_PREFIX = 'computeOutputEncryption:'
const COMPUTE_OUTPUT_ENCRYPTION_KEY_REGEX = /^[0-9a-f]{64}$/i

export function getComputeOutputEncryptionStorageKey(jobId: string): string {
  return `${COMPUTE_OUTPUT_ENCRYPTION_STORAGE_PREFIX}${jobId}`
}

export function isValidComputeOutputEncryptionKey(key?: string): boolean {
  return COMPUTE_OUTPUT_ENCRYPTION_KEY_REGEX.test(key?.trim() || '')
}

function normalizeHeaders(headers?: { key: string; value: string }[]) {
  return (headers || []).reduce<Record<string, string>>((acc, header) => {
    const key = header?.key?.trim()
    const value = header?.value?.trim()
    if (!key || !value) return acc
    acc[key] = value
    return acc
  }, {})
}

export function getOutputStorageValidationMessage(
  enabled?: boolean,
  storage?: FormComputeData['outputStorage']
): string | null {
  if (!enabled) return null
  if (!storage?.type) return i18n._('Select an output storage type.')

  let validationMessage: string | null = null

  switch (storage.type) {
    case 'url':
      validationMessage = storage.url?.trim()
        ? null
        : i18n._('Enter the output storage URL.')
      break
    case 'ftp':
      validationMessage = storage.url?.trim()
        ? null
        : i18n._('Enter the FTP/FTPS destination URL.')
      break
    case 's3':
      validationMessage =
        storage.s3Access?.endpoint?.trim() &&
        storage.s3Access?.bucket?.trim() &&
        storage.s3Access?.objectKey?.trim() &&
        storage.s3Access?.accessKeyId?.trim() &&
        storage.s3Access?.secretAccessKey?.trim()
          ? null
          : i18n._('Complete the S3 destination fields.')
      break
    default:
      validationMessage = i18n._('Unsupported output storage type.')
  }

  if (validationMessage) {
    return validationMessage
  }

  if (
    storage.useEncryption &&
    !isValidComputeOutputEncryptionKey(storage.encryptionKey)
  ) {
    return i18n._('Enter a 64-character hex encryption key.')
  }

  return null
}

export function buildRemoteStorageObject(
  storage?: FormComputeData['outputStorage']
): StorageObject | undefined {
  if (!storage?.type) return undefined

  switch (storage.type) {
    case 'url': {
      const file: UrlFileObject = {
        type: 'url',
        url: storage.url?.trim(),
        method: 'get'
      }
      const headers = normalizeHeaders(storage.headers)
      if (Object.keys(headers).length > 0) {
        file.headers = headers
      }
      return file
    }
    case 'ftp': {
      const file: FtpFileObject = {
        type: 'ftp',
        url: storage.url?.trim()
      }
      return file
    }
    case 's3': {
      const file: S3FileObject = {
        type: 's3',
        s3Access: {
          endpoint: storage.s3Access?.endpoint?.trim(),
          region: storage.s3Access?.region?.trim() || 'us-east-1',
          bucket: storage.s3Access?.bucket?.trim(),
          objectKey: storage.s3Access?.objectKey?.trim(),
          accessKeyId: storage.s3Access?.accessKeyId?.trim(),
          secretAccessKey: storage.s3Access?.secretAccessKey?.trim(),
          forcePathStyle: Boolean(storage.s3Access?.forcePathStyle)
        }
      }
      return file
    }
    default:
      return undefined
  }
}

export function generateComputeOutputEncryptionKey(byteLength = 32): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error(
      'Secure random generation is not available in this browser.'
    )
  }

  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )
}

export function createComputeOutput(
  enabled?: boolean,
  storage?: FormComputeData['outputStorage']
): { output?: ComputeOutput; encryptionKey?: string } {
  if (!enabled) return {}

  const validationError = getOutputStorageValidationMessage(enabled, storage)
  if (validationError) {
    throw new Error(validationError)
  }

  const remoteStorage = buildRemoteStorageObject(storage)
  if (!remoteStorage) {
    throw new Error('Failed to build the output storage configuration.')
  }

  if (!storage?.useEncryption) {
    return {
      output: {
        remoteStorage
      }
    }
  }

  const encryptionKey = storage.encryptionKey?.trim().toLowerCase()

  if (!isValidComputeOutputEncryptionKey(encryptionKey)) {
    throw new Error('Enter a 64-character hex encryption key.')
  }

  return {
    output: {
      remoteStorage,
      encryption: {
        encryptMethod: EncryptMethod.AES,
        key: encryptionKey
      }
    },
    encryptionKey
  }
}

export function storeComputeOutputEncryptionKey(
  jobId: string,
  encryptionKey: string,
  storage?: FormComputeData['outputStorage']
): void {
  if (typeof window === 'undefined' || !window.localStorage) return

  window.localStorage.setItem(
    getComputeOutputEncryptionStorageKey(jobId),
    JSON.stringify({
      key: encryptionKey,
      storageType: storage?.type,
      createdAt: new Date().toISOString()
    })
  )
}
