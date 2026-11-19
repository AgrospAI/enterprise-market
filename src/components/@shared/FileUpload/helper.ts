import { i18n } from '../../../i18n/index'
import { getRuntimeConfig } from '@utils/runtimeConfig'

const DEFAULT_MAX_LICENSE_FILE_SIZE_KB = 700

export const getMaxLicenseFileSizeKB = (): number => {
  const rawValue = getRuntimeConfig().NEXT_PUBLIC_MAX_LICENSE_FILE_SIZE_KB
  const parsedValue = Number.parseInt(rawValue || '', 10)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_MAX_LICENSE_FILE_SIZE_KB
}

export const FILE_UPLOAD_CONFIG = {
  get MAX_LICENSE_FILE_SIZE_KB() {
    return getMaxLicenseFileSizeKB()
  },

  ALLOWED_FILE_TYPES: [
    '.pdf',
    '.txt',
    '.doc',
    '.docx',
    '.md',
    '.rtf',
    '.odt',
    '.xls',
    '.xlsx',
    '.csv',
    '.json',
    '.xml',
    '.zip',
    '.tar',
    '.gz',
    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
    '.mp4',
    '.avi',
    '.mov',
    '.wmv',
    '.mkv',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.svg',
    '.webp',
    '.tiff',
    '.ico'
  ],
  UPLOAD_TIMEOUT_MS: 60000,
  MAX_FILE_NAME_LENGTH: 255
} as const

export const getMaxFileSizeBytes = (): number => {
  return getMaxLicenseFileSizeKB() * 1024
}

export const getFormattedMaxFileSize = (): string => {
  const sizeKB = getMaxLicenseFileSizeKB()
  if (sizeKB >= 1024) {
    return i18n._('{value0} MB', { value0: (sizeKB / 1024).toFixed(1) })
  }
  return i18n._('{sizeKB} KB', { sizeKB })
}

export const getFileSizeErrorMessage = (): string => {
  const maxSize = getFormattedMaxFileSize()
  return i18n._(
    'File size exceeds {maxSize} limit. Please upload a smaller file.',
    { maxSize }
  )
}
