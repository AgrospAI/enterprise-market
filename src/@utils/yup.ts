import { i18n } from '../i18n/index'
import { isCID } from '@utils/ipfs'
import isUrl from 'is-url-superb'
import * as Yup from 'yup'
import { isAddress } from 'ethers'
import { isGoogleUrl, isValidWebUrl } from './url/index'

export type YupTestContext = Yup.TestContext<Record<string, unknown>>

export function getOriginalValue(
  ctx: YupTestContext,
  fallback: unknown
): unknown {
  const opts = ctx.options as unknown
  if (opts && typeof opts === 'object' && 'originalValue' in opts) {
    return (opts as { originalValue?: unknown }).originalValue
  }
  return fallback
}

// Optional URL field validation, reused by the metadata `providedBy` and
// `links` value fields. Empty passes; scheme-less hosts are accepted.
export function testOptionalUrl(
  message: string | (() => string) = () => i18n._('Must be a valid URL.')
) {
  return Yup.string().test('optional-url', message, (value) =>
    isValidWebUrl(value)
  )
}

export function testLinks(_isEdit?: boolean) {
  return Yup.string().test((value, context) => {
    const { type } = context.parent
    let validField
    let errorMessage

    switch (type) {
      // we allow submit if the type input is hidden as will be ignore
      case 'hidden':
        validField = true
        break
      case 'url':
      case 'saas':
      case 'rea':
      case 'edc':
        validField = isUrl(value?.toString() || '')
        // if we're in publish, the field must be valid
        if (!validField) {
          validField = false
          errorMessage = i18n._('Must be a valid url.')
        }
        // we allow submit on empty sample field
        if (
          !value?.toString() &&
          (context.path === 'links[0].url' ||
            context.path === 'services[0].links[0].url')
        ) {
          validField = true
        }
        // if the url has google drive, we need to block the user from submit
        if (isGoogleUrl(value?.toString())) {
          validField = false
          errorMessage = i18n._(
            'Google Drive is not a supported hosting service. Please use an alternative.'
          )
        }
        break
      case 'ipfs':
        validField = isCID(value?.toString())
        errorMessage = !value?.toString()
          ? i18n._('CID required.')
          : i18n._('CID not valid.')
        break
      case 'arweave':
        validField = value && !value?.toString().includes('http')
        errorMessage = !value?.toString()
          ? i18n._('Transaction ID required.')
          : i18n._('Transaction ID not valid.')
        break
      case 'smartcontract':
        validField = isAddress(value?.toString())
        errorMessage = !value?.toString()
          ? i18n._('Address required.')
          : i18n._('Address not valid.')
        break
    }

    if (!validField) {
      return context.createError({
        message: errorMessage
      })
    }

    return true
  })
}

// Geographic metadata is optional, but a temporal coverage must not end
// before it starts. ISO dates (YYYY-MM-DD) compare correctly as strings.
export const validationGeoMetadata = Yup.object()
  .shape({
    boundingBox: Yup.object().shape({
      wkt: Yup.string(),
      label: Yup.string().max(256, () => i18n._('Location name is too long'))
    }),
    temporalCoverage: Yup.object().shape({
      startDate: Yup.string(),
      endDate: Yup.string().test(
        'endAfterStart',
        () => i18n._('End date must be on or after the start date'),
        (endDate, context) => {
          const { startDate } = context.parent
          return !startDate || !endDate || endDate >= startDate
        }
      )
    })
  })
  .nullable()
