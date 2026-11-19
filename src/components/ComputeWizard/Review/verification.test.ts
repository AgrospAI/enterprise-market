import { getVerificationStatus } from './verification'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'

const account = '0x1234'
const addressList = (address: string) => ({
  allow: [{ type: 'address', values: [{ address }] }]
})
const ssiPolicy = {
  allow: [
    {
      type: 'SSIpolicy',
      values: [{ request_credentials: [{ type: 'IdentityCredential' }] }]
    }
  ]
}
const asset = (credentials?: unknown) =>
  ({ credentialSubject: { credentials } } as Asset)
const service = (credentials?: unknown) =>
  ({ id: 'compute', credentials } as Service)

describe('compute purchase verification', () => {
  it.each([false, true])(
    'verifies unrestricted assets without an SSI session (SSI enabled: %s)',
    (enabled) => {
      expect(getVerificationStatus(asset(), service(), account, enabled)).toBe(
        'verified'
      )
    }
  )

  it('requires a connected Web3 account', () => {
    expect(getVerificationStatus(asset(), service(), undefined, false)).toBe(
      'failed'
    )
  })

  it('checks asset and service address lists independently without SSI', () => {
    expect(
      getVerificationStatus(
        asset(addressList(account)),
        service(),
        account,
        false
      )
    ).toBe('verified')
    expect(
      getVerificationStatus(
        asset(addressList('other')),
        service(),
        account,
        false
      )
    ).toBe('failed')
    expect(
      getVerificationStatus(
        asset(),
        service(addressList('other')),
        account,
        false
      )
    ).toBe('failed')
  })

  it.each([
    [asset(ssiPolicy), service()],
    [asset(), service(ssiPolicy)]
  ])('requires SSI verification for policies at either level', (ddo, svc) => {
    expect(getVerificationStatus(ddo, svc, account, false, 'cached')).toBe(
      'failed'
    )
    expect(getVerificationStatus(ddo, svc, account, true)).toBe('unverified')
    expect(getVerificationStatus(ddo, svc, account, true, 'session')).toBe(
      'verified'
    )
  })

  it('does not let a cached SSI session bypass Web3 restrictions', () => {
    expect(
      getVerificationStatus(
        asset(addressList('other')),
        service(ssiPolicy),
        account,
        true,
        'session'
      )
    ).toBe('failed')
  })
})
