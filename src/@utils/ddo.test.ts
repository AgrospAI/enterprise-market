import {
  MAX_CUSTOM_TIMEOUT_SECONDS,
  TIMEOUT_PRESETS,
  formatSecondsPrecise,
  formatServiceTimeout,
  isAddressWhitelisted,
  isCustomTimeoutValue,
  isTimeoutPreset,
  mapTimeoutStringToSeconds,
  normalizeCustomTimeoutInput,
  timeoutSecondsToFormValue
} from './ddo'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'

describe('service timeout (access duration)', () => {
  it('keeps the DDO seconds of existing presets unchanged', () => {
    expect(mapTimeoutStringToSeconds('Forever')).toBe(0)
    expect(mapTimeoutStringToSeconds('1 day')).toBe(86400)
    expect(mapTimeoutStringToSeconds('1 week')).toBe(604800)
    expect(mapTimeoutStringToSeconds('1 month')).toBe(2630000)
    expect(mapTimeoutStringToSeconds('1 year')).toBe(31556952)
  })

  it('maps every preset to integer seconds and back', () => {
    TIMEOUT_PRESETS.forEach(({ label, seconds }) => {
      const mapped = mapTimeoutStringToSeconds(label)
      expect(mapped).toBe(seconds)
      expect(Number.isInteger(mapped)).toBe(true)
      expect(timeoutSecondsToFormValue(seconds)).toBe(label)
      expect(formatServiceTimeout(seconds)).toBe(label)
    })
  })

  it('maps custom second values to integers', () => {
    expect(mapTimeoutStringToSeconds('5400')).toBe(5400)
    expect(mapTimeoutStringToSeconds('unknown')).toBe(0)
    expect(mapTimeoutStringToSeconds('')).toBe(0)
  })

  it('keeps non-preset seconds as custom form values', () => {
    expect(timeoutSecondsToFormValue(3600)).toBe('1 hour')
    expect(timeoutSecondsToFormValue(7200)).toBe('7200')
  })

  it('validates timeout form values', () => {
    expect(isTimeoutPreset('1 hour')).toBe(true)
    expect(isTimeoutPreset('7200')).toBe(false)
    expect(isCustomTimeoutValue('7200')).toBe(true)
    expect(isCustomTimeoutValue('0')).toBe(false)
    expect(isCustomTimeoutValue('1.5')).toBe(false)
    expect(isCustomTimeoutValue('-5')).toBe(false)
    expect(isCustomTimeoutValue('')).toBe(false)
    expect(isCustomTimeoutValue('1e5')).toBe(false)
    expect(isCustomTimeoutValue('0100')).toBe(false)
  })

  it('offers Forever plus the timed presets in order', () => {
    expect(TIMEOUT_PRESETS.map(({ label }) => label)).toEqual([
      'Forever',
      '1 minute',
      '10 minutes',
      '1 hour',
      '1 day',
      '1 week',
      '1 month',
      '6 months',
      '1 year'
    ])
  })

  it('shows stored values that are no longer presets as custom', () => {
    expect(timeoutSecondsToFormValue(900)).toBe('900')
    expect(formatServiceTimeout(900)).toBe('15 minutes')
    expect(formatServiceTimeout(10800)).toBe('3 hours')
  })

  it('caps custom seconds at 1 year', () => {
    expect(MAX_CUSTOM_TIMEOUT_SECONDS).toBe(31556952)
    expect(MAX_CUSTOM_TIMEOUT_SECONDS).toBe(mapTimeoutStringToSeconds('1 year'))
    expect(isCustomTimeoutValue('31556952')).toBe(true)
    expect(isCustomTimeoutValue('31556953')).toBe(false)
    expect(isCustomTimeoutValue('99999999999999999999')).toBe(false)
  })

  it('ignores non-digit input instead of altering the number', () => {
    expect(normalizeCustomTimeoutInput('1.5')).toBeUndefined()
    expect(normalizeCustomTimeoutInput('1e5')).toBeUndefined()
    expect(normalizeCustomTimeoutInput('-5')).toBeUndefined()
    expect(normalizeCustomTimeoutInput('5400')).toBe('5400')
    expect(normalizeCustomTimeoutInput('')).toBe('')
  })

  it('strips leading zeros from custom input', () => {
    expect(normalizeCustomTimeoutInput('0100')).toBe('100')
    expect(normalizeCustomTimeoutInput('000')).toBe('0')
    expect(normalizeCustomTimeoutInput('0')).toBe('0')
  })

  it('formats custom durations precisely', () => {
    expect(formatServiceTimeout(5400)).toBe('1 hour 30 minutes')
    expect(formatSecondsPrecise(1)).toBe('1 second')
    expect(formatSecondsPrecise(90061)).toBe('1 day 1 hour')
    expect(formatSecondsPrecise(0)).toBe('Forever')
    expect(formatSecondsPrecise(365 * 86400)).toBe('1 year')
    expect(formatSecondsPrecise(30 * 86400)).toBe('1 month')
  })

  it('accepts timeouts stored as strings', () => {
    expect(formatServiceTimeout('86400' as unknown as number)).toBe('1 day')
    expect(formatServiceTimeout(undefined)).toBe('Forever')
  })

  it('formats short access durations', () => {
    expect(formatServiceTimeout(60)).toBe('1 minute')
    expect(formatServiceTimeout(600)).toBe('10 minutes')
    expect(formatServiceTimeout(3600)).toBe('1 hour')
    expect(formatServiceTimeout(1)).toBe('1 second')
    expect(formatServiceTimeout(90)).toBe('1 minute 30 seconds')
    expect(formatServiceTimeout(120)).toBe('2 minutes')
    expect(formatServiceTimeout('600')).toBe('10 minutes')
  })
})

describe('Forever access duration (stored as 0)', () => {
  it('is the first preset and maps to 0 in the DDO', () => {
    expect(TIMEOUT_PRESETS[0]).toEqual({ label: 'Forever', seconds: 0 })
    expect(mapTimeoutStringToSeconds('Forever')).toBe(0)
  })

  it('displays 0 and missing or invalid values as Forever', () => {
    expect(formatServiceTimeout(0)).toBe('Forever')
    expect(formatServiceTimeout('0')).toBe('Forever')
    expect(formatServiceTimeout(undefined)).toBe('Forever')
    expect(formatServiceTimeout(null)).toBe('Forever')
    expect(formatServiceTimeout(NaN)).toBe('Forever')
    expect(formatServiceTimeout('abc')).toBe('Forever')
  })

  it('round-trips through the edit form', () => {
    expect(timeoutSecondsToFormValue(0)).toBe('Forever')
    expect(timeoutSecondsToFormValue(undefined)).toBe('Forever')
    expect(mapTimeoutStringToSeconds(timeoutSecondsToFormValue(0))).toBe(0)
    expect(isTimeoutPreset('Forever')).toBe(true)
  })
})

describe('credentials allow/deny lists', () => {
  // Invented accounts, stored checksummed the way a publisher would write them.
  const accountId = '0x1234567890AbcdEF1234567890aBcdef12345678'
  const otherAccountId = '0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD'

  // DDOs are published with the checksummed address the spec holds, while the
  // connected account and the marketplace lower-case what they compare against.
  const addressEntry = (...addresses: string[]) => ({
    type: 'address',
    values: addresses.map((address) => ({ address }))
  })

  const service = (credentials?: unknown) =>
    ({ id: 'service-1', type: 'access', credentials } as unknown as Service)

  const asset = (credentials?: unknown) =>
    ({
      credentialSubject: { credentials, services: [service(credentials)] }
    } as unknown as Asset)

  it('matches a checksummed allow entry against a checksummed account', () => {
    const credentials = { allow: [addressEntry(accountId)] }

    expect(
      isAddressWhitelisted(asset(credentials), accountId, service(credentials))
    ).toBe(true)
  })

  it('matches regardless of the case used on either side', () => {
    const checksummed = { allow: [addressEntry(accountId)] }
    const lowercased = { allow: [addressEntry(accountId.toLowerCase())] }

    expect(
      isAddressWhitelisted(
        asset(checksummed),
        accountId.toLowerCase(),
        service(checksummed)
      )
    ).toBe(true)
    expect(
      isAddressWhitelisted(asset(lowercased), accountId, service(lowercased))
    ).toBe(true)
  })

  it('reads bare string values as well as { address } objects', () => {
    const credentials = {
      allow: [{ type: 'address', values: [accountId] }]
    }
    const ddo = asset(credentials)

    expect(isAddressWhitelisted(ddo, accountId, service(credentials))).toBe(
      true
    )
  })

  it('still rejects an address that is not listed', () => {
    const credentials = { allow: [addressEntry(otherAccountId)] }
    const ddo = asset(credentials)

    expect(isAddressWhitelisted(ddo, accountId, service(credentials))).toBe(
      false
    )
  })

  it('honours a checksummed deny entry', () => {
    // The wildcard allow must not paper over a deny entry: before the address
    // normalisation the deny list silently failed to match and let the account in.
    const credentials = {
      allow: [addressEntry('*')],
      deny: [addressEntry(accountId)]
    }
    const ddo = asset(credentials)

    expect(isAddressWhitelisted(ddo, accountId, service(credentials))).toBe(
      false
    )
  })

  it('accepts the wildcard allow entry', () => {
    const credentials = { allow: [addressEntry('*')] }
    const ddo = asset(credentials)

    expect(isAddressWhitelisted(ddo, accountId, service(credentials))).toBe(
      true
    )
  })

  it('checks the service list in addition to the dataset list', () => {
    const datasetCredentials = { allow: [addressEntry(accountId)] }
    const serviceCredentials = { allow: [addressEntry(otherAccountId)] }
    const ddo = {
      credentialSubject: { credentials: datasetCredentials }
    } as unknown as Asset

    expect(
      isAddressWhitelisted(ddo, accountId, service(serviceCredentials))
    ).toBe(false)
  })

  it('allows assets without credentials', () => {
    expect(
      isAddressWhitelisted(asset(undefined), accountId, service(undefined))
    ).toBe(true)
  })
})
