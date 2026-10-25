import {
  MetadataEditForm,
  ServiceEditForm
} from '@components/Asset/Edit/_types'
import {
  FormConsumerParameter,
  FormPublishData
} from '@components/Publish/_types'
import {
  ArweaveFileObject,
  IpfsFileObject,
  UrlFileObject,
  S3FileObject,
  FileInfo,
  S3Object,
  FtpFileObject
} from '@oceanprotocol/lib'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
import { Option } from 'src/@types/ddo/Option'
import { SaasMetadata } from 'src/@types/ddo/Metadata'
import {
  isCredentialAddressBased,
  credentialAddressValues
} from './credentials'
import {
  CredentialAddressBased,
  Credential,
  CredentialPolicyBased
} from 'src/@types/ddo/Credentials'
import { FormFileData } from 'src/@types/S3File'
import { StorageType } from './provider'

export function isValidDid(did: string): boolean {
  const regex = /^did:ope:[A-Za-z0-9]{64}$/
  return regex.test(did)
}

// TODO: this function doesn't make sense, since market is now supporting multiple services. We should remove it after checking all the flows where it's being used.
export function getServiceByName(
  ddo: Asset,
  name: 'access' | 'compute'
): Service {
  if (!ddo) return

  const service = ddo.credentialSubject?.services.filter(
    (service) => service.type === name
  )[0]
  return service
}

export function getServiceById(ddo: Asset, serviceId: string): Service {
  if (!ddo) return

  const service = ddo.credentialSubject?.services.find(
    (s) => s.id === serviceId
  )
  return service
}

export function getSaasMetadata(asset: Asset): SaasMetadata | undefined {
  return asset?.credentialSubject?.metadata?.additionalInformation?.saas
}

export function isSaasAsset(asset: Asset): boolean {
  return Boolean(getSaasMetadata(asset))
}

export function getAssetAccessType(
  asset: Asset
): 'saas' | 'compute' | 'access' {
  if (isSaasAsset(asset)) return 'saas'
  return getServiceByName(asset, 'compute') ? 'compute' : 'access'
}

export const CUSTOM_TIMEOUT_OPTION = 'Custom (seconds)'

// '1 year' as stored in the DDO (365.2425 days). Also the custom maximum.
const ONE_YEAR_SECONDS = 31556952

// Service access duration presets. Values are stored in the DDO as
// `service.timeout` (integer seconds, 0 = forever). Day, week, month and
// year values must stay unchanged so existing assets keep matching their
// preset; any other stored value is shown as a custom duration.
export const TIMEOUT_PRESETS: { label: string; seconds: number }[] = [
  { label: 'Forever', seconds: 0 },
  { label: '1 minute', seconds: 60 },
  { label: '10 minutes', seconds: 600 },
  { label: '1 hour', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
  { label: '1 month', seconds: 2630000 },
  { label: '6 months', seconds: 15780000 },
  { label: '1 year', seconds: ONE_YEAR_SECONDS }
]

export function isTimeoutPreset(timeout: string): boolean {
  return TIMEOUT_PRESETS.some((preset) => preset.label === timeout)
}

// Upper bound for custom durations: 1 year. Anything longer should use
// 'Forever'; the bound also keeps values far below Number.MAX_SAFE_INTEGER
// so they survive the string -> number conversion.
export const MAX_CUSTOM_TIMEOUT_SECONDS = ONE_YEAR_SECONDS

export const TIMEOUT_VALIDATION_MESSAGE = `Enter a whole number of seconds between 1 and ${MAX_CUSTOM_TIMEOUT_SECONDS} (1 year), or choose 'Forever'`

export function isCustomTimeoutValue(timeout: string): boolean {
  return (
    /^[1-9]\d*$/.test(timeout ?? '') &&
    Number(timeout) <= MAX_CUSTOM_TIMEOUT_SECONDS
  )
}

// Normalises what the user typed into the custom seconds field. Returns
// `undefined` when the input contains anything but digits (e.g. "1.5", "1e5",
// "-5") so the keystroke can be ignored instead of silently changing the
// number. Leading zeros are stripped ("0100" -> "100"), a lone "0" is kept so
// validation can flag it.
export function normalizeCustomTimeoutInput(input: string): string | undefined {
  if (!/^\d*$/.test(input ?? '')) return undefined
  return input.replace(/^0+(?=\d)/, '')
}

export function mapTimeoutStringToSeconds(timeout: string): number {
  const preset = TIMEOUT_PRESETS.find((preset) => preset.label === timeout)
  if (preset) return preset.seconds
  if (/^\d+$/.test(timeout ?? '')) return Number(timeout)
  return 0
}

export function timeoutSecondsToFormValue(seconds: number): string {
  const timeout = Number(seconds) || 0
  const preset = TIMEOUT_PRESETS.find((preset) => preset.seconds === timeout)
  return preset ? preset.label : String(timeout)
}

// Display units for custom durations. Year and month use whole days
// (365 / 30) so e.g. 365 days reads "1 year" instead of "11 months 4 weeks".
// The preset seconds above are unaffected.
const DURATION_UNITS: { name: string; seconds: number }[] = [
  { name: 'year', seconds: 31536000 },
  { name: 'month', seconds: 2592000 },
  { name: 'week', seconds: 604800 },
  { name: 'day', seconds: 86400 },
  { name: 'hour', seconds: 3600 },
  { name: 'minute', seconds: 60 },
  { name: 'second', seconds: 1 }
]

// Formats seconds with the two largest units, e.g. 5400 -> "1 hour 30 minutes"
export function formatSecondsPrecise(numberOfSeconds: number): string {
  let remaining = Math.floor(Number(numberOfSeconds) || 0)
  if (remaining <= 0) return 'Forever'

  const parts: string[] = []
  for (const unit of DURATION_UNITS) {
    if (parts.length === 2) break
    const amount = Math.floor(remaining / unit.seconds)
    if (amount > 0) {
      parts.push(`${amount} ${unit.name}${amount === 1 ? '' : 's'}`)
      remaining -= amount * unit.seconds
    }
  }
  return parts.join(' ')
}

export function formatServiceTimeout(timeout: number | string): string {
  const seconds = Number(timeout) || 0
  const preset = TIMEOUT_PRESETS.find((preset) => preset.seconds === seconds)
  return preset ? preset.label : formatSecondsPrecise(seconds)
}

// this is required to make it work properly for preview/publish/edit/debug.
export function normalizeFile(
  storageType: StorageType,
  file: FormFileData | FormFileData[],
  _chainId: number
):
  | IpfsFileObject
  | ArweaveFileObject
  | UrlFileObject
  | S3FileObject
  | FtpFileObject {
  const fileData = Array.isArray(file) ? file[0] : file
  const headersProvider: Record<string, string> = {}
  const headers = fileData?.headers
  if (headers && Array.isArray(headers) && headers.length > 0) {
    headers.forEach((el: any) => {
      if (el.key && el.value) {
        headersProvider[el.key] = el.value
      }
    })
  }
  switch (storageType) {
    case 'ipfs': {
      return {
        type: 'ipfs',
        hash: fileData?.url || ''
      } as IpfsFileObject
    }
    case 'arweave': {
      return {
        type: 'arweave',
        transactionId: fileData?.url || fileData?.transactionId || ''
      } as ArweaveFileObject
    }
    case 's3': {
      if (!fileData.s3Access) {
        throw new Error('S3 configuration is required for S3 file type')
      }
      const s3Access: S3Object = {
        endpoint: fileData.s3Access.endpoint,
        region: fileData.s3Access.region || 'us-east-1',
        bucket: fileData.s3Access.bucket,
        objectKey: fileData.s3Access.objectKey,
        accessKeyId: fileData.s3Access.accessKeyId,
        secretAccessKey: fileData.s3Access.secretAccessKey,
        forcePathStyle: fileData.s3Access.forcePathStyle || false
      }
      return {
        type: 's3',
        url: fileData.url || `s3://${s3Access.bucket}/${s3Access.objectKey}`,
        contentType: fileData.contentType,
        contentLength: fileData.contentLength,
        valid: fileData.valid,
        method: fileData.method || 'GET',
        s3Access
      } as S3FileObject
    }
    case 'ftp': {
      return {
        type: 'ftp',
        url: fileData?.url || ''
      } as FtpFileObject
    }
    default: {
      return {
        type: 'url',
        index: 0,
        url: fileData?.url || null,
        headers: headersProvider,
        method: fileData?.method || 'get'
      } as UrlFileObject
    }
  }
}

export function previewDebugPatch(
  values: FormPublishData | MetadataEditForm | ServiceEditForm
) {
  // handle file's object property dynamically
  // without braking Yup and type validation
  const buildValuesPreview = JSON.parse(JSON.stringify(values))

  return buildValuesPreview
}

export function parseConsumerParameters(
  consumerParameters: Record<string, string | number | boolean | Option[]>[]
): FormConsumerParameter[] {
  if (!consumerParameters) {
    return []
  }
  return consumerParameters.map<FormConsumerParameter>((param) => {
    let transformedOptions
    if (Array.isArray(param.options)) {
      transformedOptions = param.options.map((option) => {
        const key = Object.keys(option)[0]
        return {
          key,
          value: option[key]
        }
      })
    }

    return {
      ...param,
      required: param.required ? 'required' : 'optional',
      options: param.type === 'select' ? transformedOptions : [],
      default:
        param.type === 'boolean'
          ? param.default === 'true'
          : param.type === 'number'
          ? Number(param.default)
          : param.default
    } as FormConsumerParameter
  })
}

function findCredential(
  credentials: (CredentialAddressBased | CredentialPolicyBased)[],
  consumerCredentials: CredentialAddressBased,
  type?: string
) {
  const hasAddressType = credentials.some((credential) => {
    const type = String(credential.type ?? '').toLowerCase()
    return type === 'address'
  })
  if (type === 'service' && !hasAddressType) return true
  return credentials.find((credential) => {
    if (!isCredentialAddressBased(credential)) {
      return false
    }
    // Compare case-insensitively: the DDO keeps whatever case the publisher
    // stored (usually checksummed), while the consumer address is lowercased.
    const credentialValues = credentialAddressValues(credential).map(
      (address) => address.toLowerCase()
    )
    if (credentialValues.length > 0) {
      const credentialType = String(credential?.type)?.toLowerCase()
      const result =
        credentialType === consumerCredentials.type &&
        (credentialValues.includes('*') ||
          credentialValues.includes(consumerCredentials.values[0].address))
      return result
    }
    if (type === 'service') return true
    return false
  })
}

/**
 * This method checks credentials
 * @param credentials credentials
 * @param consumerAddress consumer address
 */
function checkCredentials(
  credentials: Credential,
  consumerAddress: string,
  type?: string
) {
  const consumerCredentials: CredentialAddressBased = {
    type: 'address',
    values: [{ address: String(consumerAddress)?.toLowerCase() }]
  }
  // check deny access
  if (Array.isArray(credentials?.deny) && credentials.deny.length > 0) {
    const accessDeny = findCredential(credentials.deny, consumerCredentials)
    if (accessDeny) {
      return false
    }
  }
  // check allow access
  if (Array.isArray(credentials?.allow) && credentials.allow.length > 0) {
    const accessAllow = findCredential(
      credentials.allow,
      consumerCredentials,
      type
    )
    if (!accessAllow) {
      return false
    }
  }
  return true
}

export function isAddressWhitelisted(
  ddo: Asset,
  accountId: string,
  service?: Service
): boolean {
  if (!ddo || !accountId) return false

  // If SSI is not configured at asset or service level, allow access (no credential check required)
  if (!ddo.credentialSubject?.credentials) {
    return true
  }

  if (!service || !service.credentials) {
    return true
  }

  const assetAccessGranted = checkCredentials(
    ddo.credentialSubject.credentials,
    accountId
  )
  const serviceAccessGranted = checkCredentials(
    service.credentials,
    accountId,
    'service'
  )
  return assetAccessGranted && serviceAccessGranted
}
