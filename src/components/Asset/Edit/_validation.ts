import { i18n } from '../../../i18n/index'
import * as Yup from 'yup'
import { isAddress } from 'ethers'
import { MAX_DECIMALS } from '@utils/constants'
import { getMaxDecimalsValidation } from '@utils/numbers'
import {
  getOriginalValue,
  testOptionalUrl,
  validationGeoMetadata
} from '@utils/yup'
import { validationConsumerParameters } from '@shared/FormInput/InputElement/ConsumerParameters/_validation'
import { isS3File } from 'src/@types/S3File'
import {
  TIMEOUT_VALIDATION_MESSAGE,
  isCustomTimeoutValue,
  isTimeoutPreset
} from '@utils/ddo'
import {
  normalizeDockerImageReference,
  parseDockerImageReference
} from '@utils/docker'

const validationRequestCredentials = {
  format: Yup.string().required(() => i18n._('Required')),
  type: Yup.string().required(() => i18n._('Required')),
  policies: Yup.array().of(
    Yup.object().shape({
      type: Yup.string(),
      name: Yup.string()
        .when('type', {
          is: 'staticPolicy',
          then: (shema) => shema.required(i18n._('Required'))
        })
        .when('type', {
          is: 'customUrlPolicy',
          then: (shema) => shema.required(i18n._('Required'))
        })
        .when('type', {
          is: 'customPolicy',
          then: (shema) =>
            shema
              .required(i18n._('Required'))
              .matches(/^[A-Za-z]+$/, i18n._('Only letters A–Z are allowed'))
        }),
      args: Yup.array().when('type', {
        is: 'parameterizedPolicy',
        then: (shema) => shema.of(Yup.string().required(i18n._('Required')))
      }),
      policy: Yup.string().when('type', {
        is: 'parameterizedPolicy',
        then: (shema) => shema.required(i18n._('Required'))
      }),
      policyUrl: Yup.string().when('type', {
        is: 'customUrlPolicy',
        then: (shema) =>
          shema
            .required(i18n._('Required'))
            .test('isValidUrl', i18n._('Invalid URL format'), (value) => {
              if (!value) return false
              const trimmedValue = value.trim()
              if (
                !trimmedValue.startsWith('http://') &&
                !trimmedValue.startsWith('https://')
              ) {
                return false
              }
              try {
                const url = new URL(trimmedValue)
                return url.protocol === 'http:' || url.protocol === 'https:'
              } catch {
                return false
              }
            })
      }),
      arguments: Yup.array()
        .when('type', {
          is: 'customUrlPolicy',
          then: (shema) =>
            shema.of(
              Yup.object().shape({
                name: Yup.string().required(i18n._('Required')),
                value: Yup.string().required(i18n._('Required'))
              })
            )
        })
        .when('type', {
          is: 'customPolicy',
          then: (shema) =>
            shema.of(
              Yup.object().shape({
                name: Yup.string().required(i18n._('Required')),
                value: Yup.string().required(i18n._('Required'))
              })
            )
        }),
      rules: Yup.array().when('type', {
        is: 'customPolicy',
        then: (shema) =>
          shema.of(
            Yup.object().shape({
              leftValue: Yup.string().required(i18n._('Required')),
              operator: Yup.string().required(i18n._('Required')),
              rightValue: Yup.string().required(i18n._('Required'))
            })
          )
      })
    })
  )
}

const validationVpPolicy = {
  type: Yup.string().required(() => i18n._('Required')),
  name: Yup.mixed().when('type', {
    is: 'staticVpPolicy',
    then: (shema) =>
      shema.test('static-name', i18n._('Required'), (value) => {
        if (typeof value === 'string') return value.trim().length > 0
        if (
          value &&
          typeof value === 'object' &&
          typeof (value as any).policy === 'string'
        ) {
          return (value as any).policy.trim().length > 0
        }
        return false
      })
  }),
  policy: Yup.string().when('type', {
    is: 'argumentVpPolicy',
    then: (shema) => shema.required(i18n._('Required'))
  }),
  args: Yup.string().when('type', {
    is: 'argumentVpPolicy',
    then: (shema) => shema.required(i18n._('Required'))
  }),
  url: Yup.string().when('type', {
    is: 'externalEvpForwardVpPolicy',
    then: (shema) =>
      shema.test('isValidUrlOpt', i18n._('Invalid URL format'), (value) => {
        // Optional here to avoid transient invalid state; main enforcement occurs on credentials.externalEvpForwardUrl
        if (!value) return true
        const trimmedValue = value.trim()
        const pattern = /^https?:\/\/\S+$/i
        return pattern.test(trimmedValue)
      })
  })
}

const validationCredentials = {
  requestCredentials: Yup.array().of(
    Yup.object().shape(validationRequestCredentials)
  ),
  vcPolicies: Yup.array().of(Yup.string().required(() => i18n._('Required'))),
  vpPolicies: Yup.array().of(Yup.object().shape(validationVpPolicy)),
  allow: Yup.array().of(Yup.string()).nullable(),
  deny: Yup.array().of(Yup.string()).nullable(),
  allowInputValue: Yup.string().nullable(),
  externalEvpForwardUrl: Yup.string().test(
    'external-evp-url',
    () => i18n._('Invalid URL format'),
    function (value) {
      const vpPolicies = (this.parent as any)?.vpPolicies || []
      const hasExternal = vpPolicies.some(
        (p: any) => p?.type === 'externalEvpForwardVpPolicy'
      )
      if (!hasExternal) return true

      if (!value) return false
      const trimmedValue = value.trim()
      // Accept any http(s) URL format without strict parsing to avoid false negatives
      const pattern = /^https?:\/\/\S+$/i
      return pattern.test(trimmedValue)
    }
  )
}

export const metadataValidationSchema = Yup.object().shape({
  name: Yup.string()
    .min(4, (param) =>
      i18n._('Title must be at least {value0} characters', {
        value0: param.min
      })
    )
    .required(() => i18n._('Required')),
  description: Yup.string()
    .required(() => i18n._('Required'))
    .min(10),
  copyrightHolder: Yup.string().nullable(),
  providedBy: testOptionalUrl(() => i18n._('Provided By must be a valid URL.')),
  links: Yup.array()
    .of(
      Yup.object().shape({
        key: Yup.string(),
        value: testOptionalUrl(() => i18n._('Each link must be a valid URL.'))
      })
    )
    .nullable(),
  tags: Yup.array<string[]>().nullable(),
  ontologyTerms: Yup.array().nullable(),
  geoMetadata: validationGeoMetadata,
  containerImage: Yup.string().when('type', {
    is: 'algorithm',
    then: Yup.string()
      .required(() => i18n._('Required'))
      .test('docker-image', function (value) {
        try {
          const parsedReference = parseDockerImageReference(value)
          return parsedReference.tag
            ? this.createError({
                message: i18n._(
                  'Enter the Docker tag in the separate tag field'
                )
              })
            : true
        } catch (error) {
          return this.createError({ message: error.message })
        }
      })
  }),
  containerTag: Yup.string().when('type', {
    is: 'algorithm',
    then: Yup.string()
      .required(() => i18n._('Required'))
      .test('docker-tag', function (value) {
        try {
          normalizeDockerImageReference(this.parent.containerImage, value)
          return true
        } catch (error) {
          return this.createError({ message: error.message })
        }
      })
  }),
  containerChecksum: Yup.string().when('type', {
    is: 'algorithm',
    then: Yup.string()
      .trim()
      .required(() => i18n._('Required'))
  }),
  containerEntrypoint: Yup.string().when('type', {
    is: 'algorithm',
    then: Yup.string()
      .trim()
      .required(() => i18n._('Required'))
  }),
  usesConsumerParameters: Yup.boolean(),
  saas: Yup.object({
    redirectUrl: Yup.string()
      .url(() => i18n._('Must be a valid URL.'))
      .required(() => i18n._('Redirect URL is required'))
  }).default(undefined),
  consumerParameters: Yup.array().when('usesConsumerParameters', {
    is: true,
    then: Yup.array()
      .of(Yup.object().shape(validationConsumerParameters))
      .required(() => i18n._('Required')),
    otherwise: Yup.array()
      .nullable()
      .transform((value) => value || null)
  }),
  credentials: Yup.object().shape(validationCredentials),
  allow: Yup.array().of(Yup.string()).nullable(),
  deny: Yup.array().of(Yup.string()).nullable(),
  retireAsset: Yup.string(),
  useRemoteLicense: Yup.boolean(),
  licenseUrl: Yup.array().when('useRemoteLicense', {
    is: false,
    then: Yup.array().test('urlTest', (array, context) => {
      if (!array || !array[0]) {
        return context.createError({ message: i18n._('Need a valid url') })
      }
      const { url, valid } = array[0] as {
        url: string
        type: 'url'
        valid: boolean
      }
      if (!url || url.length === 0) {
        return context.createError({ message: i18n._('Need a valid url') })
      }
      // Only check valid flag if validation has been attempted (valid is not undefined)
      if (valid !== undefined && !valid) {
        return context.createError({ message: i18n._('Need a valid url') })
      }
      return true
    })
  }),
  uploadedLicense: Yup.object().when('useRemoteLicense', {
    is: true,
    then: Yup.object().test('remoteTest', (license, context) => {
      if (!license) {
        return context.createError({ message: i18n._('Need a license file') })
      }
      return true
    })
  }),
  additionalDdos: Yup.array()
    .of(
      Yup.object().shape({
        data: Yup.string().required(() => i18n._('Required')),
        type: Yup.string().required(() => i18n._('Required'))
      })
    )
    .nullable()
})

const noWhitespaceTest = (fieldName: string) =>
  Yup.string().test(
    'no-whitespace',
    () =>
      i18n._('{fieldName} cannot have leading or trailing spaces', {
        fieldName: i18n._(fieldName)
      }),
    (value) => {
      if (!value) return true
      return value === value.trim()
    }
  )

export const serviceValidationSchema = Yup.object().shape({
  name: Yup.string()
    .min(4, (param) =>
      i18n._('Name must be at least {value0} characters', { value0: param.min })
    )
    .required(() => i18n._('Required')),
  description: Yup.string()
    .required(() => i18n._('Required'))
    .min(10),
  price: Yup.number()
    .required(() => i18n._('Required'))
    .min(1, () => i18n._('Price must be at least 1'))
    .max(1000000, (param: { max: number }) =>
      i18n._('Must be less than or equal to {value0}', { value0: param.max })
    )
    .test(
      'maxDigitsAfterDecimal',
      () =>
        i18n._('Must have maximum {MAX_DECIMALS} decimal digits', {
          MAX_DECIMALS
        }),
      function (_value, ctx) {
        const rawValue = getOriginalValue(ctx, _value)
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return true
        }
        return getMaxDecimalsValidation(MAX_DECIMALS).test(String(rawValue))
      }
    ),
  files: Yup.array()
    .of(
      Yup.object().shape({
        url: Yup.string().nullable(),
        type: Yup.string().nullable(),
        valid: Yup.boolean().nullable(),
        s3Access: Yup.object().when('type', {
          is: 's3',
          then: Yup.object().shape({
            endpoint: noWhitespaceTest('Endpoint')
              .nullable()
              .test(
                'endpoint-trim',
                () => i18n._('Endpoint cannot have leading or trailing spaces'),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            region: Yup.string()
              .nullable()
              .test(
                'region-trim',
                () => i18n._('Region cannot have leading or trailing spaces'),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            bucket: noWhitespaceTest('Bucket name')
              .nullable()
              .test(
                'bucket-trim',
                () =>
                  i18n._('Bucket name cannot have leading or trailing spaces'),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            objectKey: noWhitespaceTest('Object key')
              .nullable()
              .test(
                'objectKey-trim',
                () =>
                  i18n._('Object key cannot have leading or trailing spaces'),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            accessKeyId: noWhitespaceTest('Access Key ID')
              .nullable()
              .test(
                'accessKeyId-trim',
                () =>
                  i18n._(
                    'Access Key ID cannot have leading or trailing spaces'
                  ),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            secretAccessKey: noWhitespaceTest('Secret Access Key')
              .nullable()
              .test(
                'secretAccessKey-trim',
                () =>
                  i18n._(
                    'Secret Access Key cannot have leading or trailing spaces'
                  ),
                (value) => {
                  if (!value) return true
                  return value === value.trim()
                }
              ),
            forcePathStyle: Yup.boolean().nullable()
          })
        })
      })
    )
    .test(
      'files-validation',
      () => i18n._('Please provide a valid file'),
      function (files) {
        const fileList = (files || []) as any[]
        const hasEncryptedFile = fileList.some(
          (file) =>
            (file?.type === 'hidden' || file?.isEncrypted) &&
            (!file?.url || file.url?.trim() === '')
        )

        if (hasEncryptedFile) {
          return true
        }
        if (fileList.length === 0) {
          return this.createError({
            message: i18n._('At least one file is required')
          })
        }

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]

          if (isS3File(file) && file.s3Access) {
            const {
              endpoint,
              region,
              bucket,
              objectKey,
              accessKeyId,
              secretAccessKey
            } = file.s3Access

            if (endpoint && endpoint !== endpoint.trim()) {
              return this.createError({
                message: i18n._(
                  'Endpoint cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.endpoint`
              })
            }
            if (region && region !== region.trim()) {
              return this.createError({
                message: i18n._(
                  'Region cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.region`
              })
            }
            if (bucket && bucket !== bucket.trim()) {
              return this.createError({
                message: i18n._(
                  'Bucket name cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.bucket`
              })
            }
            if (objectKey && objectKey !== objectKey.trim()) {
              return this.createError({
                message: i18n._(
                  'Object key cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.objectKey`
              })
            }
            if (accessKeyId && accessKeyId !== accessKeyId.trim()) {
              return this.createError({
                message: i18n._(
                  'Access Key ID cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.accessKeyId`
              })
            }
            if (secretAccessKey && secretAccessKey !== secretAccessKey.trim()) {
              return this.createError({
                message: i18n._(
                  'Secret Access Key cannot have leading or trailing spaces'
                ),
                path: `${this.path}[${i}].s3Access.secretAccessKey`
              })
            }
          }
        }

        const hasValidFile = fileList.some(
          (file) => file?.url?.trim() && file.valid !== false
        )
        return (
          hasValidFile ||
          this.createError({
            message: i18n._('Please provide a valid file URL')
          })
        )
      }
    ),
  timeout: Yup.string()
    .required(() => i18n._('Required'))
    .test(
      'valid-timeout',
      () => TIMEOUT_VALIDATION_MESSAGE(),
      (value) => isTimeoutPreset(value) || isCustomTimeoutValue(value)
    ),
  usesConsumerParameters: Yup.boolean(),
  consumerParameters: Yup.array().when('usesConsumerParameters', {
    is: true,
    then: Yup.array()
      .of(Yup.object().shape(validationConsumerParameters))
      .required(() => i18n._('Required')),
    otherwise: Yup.array()
      .nullable()
      .transform((value) => value || null)
  }),
  paymentCollector: Yup.string().test(
    'ValidAddress',
    () => i18n._('Must be a valid Ethereum Address.'),
    (value) => {
      return isAddress(value)
    }
  ),
  allowAllPublishedAlgorithms: Yup.string().nullable(),
  publisherTrustedAlgorithms: Yup.array().nullable(),
  publisherTrustedAlgorithmPublishers: Yup.string().nullable(),
  credentials: Yup.object().shape(validationCredentials)
})

export const newServiceValidationSchema = serviceValidationSchema.shape({
  price: Yup.number()
    .required(() => i18n._('Required'))
    .min(0, () => i18n._('Price must be at least 0'))
    .max(1000000, (param: { max: number }) =>
      i18n._('Must be less than or equal to {value0}', { value0: param.max })
    )
    .test(
      'maxDigitsAfterDecimal',
      () =>
        i18n._('Must have maximum {MAX_DECIMALS} decimal digits', {
          MAX_DECIMALS
        }),
      function (_value, ctx) {
        const rawValue = getOriginalValue(ctx, _value)
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return true
        }
        return getMaxDecimalsValidation(MAX_DECIMALS).test(String(rawValue))
      }
    )
})
