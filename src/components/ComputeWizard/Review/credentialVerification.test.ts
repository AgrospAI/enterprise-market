import {
  requiresSsiVerification,
  resolveCredentialVerification
} from './credentialVerification'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'

const accountId = '0x1234567890AbcdEF1234567890aBcdef12345678'
const otherAccountId = '0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD'

const addressEntry = (...addresses: string[]) => ({
  type: 'address',
  values: addresses.map((address) => ({ address }))
})

const ssiPolicy = () => ({
  allow: [
    {
      type: 'SSIpolicy',
      values: [
        {
          request_credentials: [
            { type: 'VerifiableCredential', format: 'jwt_vc', policies: [] }
          ],
          vp_policies: [],
          vc_policies: []
        }
      ]
    }
  ]
})

const service = (credentials?: unknown) =>
  ({ id: 'service-1', type: 'access', credentials } as unknown as Service)

const asset = (credentials?: unknown) =>
  ({
    credentialSubject: { credentials, services: [service(credentials)] }
  } as unknown as Asset)

describe('requiresSsiVerification', () => {
  it('is true for SSI policy credentials', () => {
    expect(
      requiresSsiVerification(asset(ssiPolicy()), service(ssiPolicy()))
    ).toBe(true)
  })

  it('is false for address-based credentials and missing credentials', () => {
    const credentials = { allow: [addressEntry(accountId)] }

    expect(
      requiresSsiVerification(asset(credentials), service(credentials))
    ).toBe(false)
    expect(requiresSsiVerification(asset(undefined), service(undefined))).toBe(
      false
    )
  })
})

describe('resolveCredentialVerification', () => {
  it('validates address-based credentials with SSI disabled', () => {
    const credentials = { allow: [addressEntry(accountId)] }

    expect(
      resolveCredentialVerification({
        asset: asset(credentials),
        service: service(credentials),
        accountId,
        ssiEnabled: false
      })
    ).toBe('verified')
  })

  it('rejects an account that is not in the address list', () => {
    const credentials = { allow: [addressEntry(otherAccountId)] }

    expect(
      resolveCredentialVerification({
        asset: asset(credentials),
        service: service(credentials),
        accountId,
        ssiEnabled: false
      })
    ).toBe('failed')
  })

  it('accepts assets without credentials', () => {
    expect(
      resolveCredentialVerification({
        asset: asset(undefined),
        service: service(undefined),
        accountId,
        ssiEnabled: false
      })
    ).toBe('verified')
  })

  it('keeps checking address credentials when SSI is enabled', () => {
    const credentials = { allow: [addressEntry(accountId)] }

    expect(
      resolveCredentialVerification({
        asset: asset(credentials),
        service: service(credentials),
        accountId,
        ssiEnabled: true
      })
    ).toBe('verified')
  })

  it('uses the SSI wallet for SSI policies when SSI is enabled', () => {
    expect(
      resolveCredentialVerification({
        asset: asset(ssiPolicy()),
        service: service(ssiPolicy()),
        accountId,
        ssiEnabled: true
      })
    ).toBe('ssi')
  })

  it('cannot validate SSI policies when SSI is disabled', () => {
    expect(
      resolveCredentialVerification({
        asset: asset(ssiPolicy()),
        service: service(ssiPolicy()),
        accountId,
        ssiEnabled: false
      })
    ).toBe('failed')
  })

  it('fails when no account is connected', () => {
    expect(
      resolveCredentialVerification({
        asset: asset(undefined),
        service: service(undefined),
        accountId: undefined,
        ssiEnabled: false
      })
    ).toBe('failed')
  })
})
