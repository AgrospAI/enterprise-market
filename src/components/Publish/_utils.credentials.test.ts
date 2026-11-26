import { generateCredentials } from './_utils'
import { CredentialForm } from '@components/@shared/PolicyEditor/types'

jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

it('keeps an explicit empty address allow rule when no wallets are selected', () => {
  const credentials = generateCredentials({
    allow: [],
    deny: [],
    enabled: false
  } as CredentialForm)
  expect(credentials).toEqual({
    allow: [{ type: 'address', values: [] }],
    deny: [],
    match_deny: 'any'
  })
})

it('publishes public access only when the wildcard is selected', () => {
  expect(
    generateCredentials({
      allow: ['*'],
      deny: [],
      enabled: false
    } as CredentialForm).allow
  ).toEqual([{ type: 'address', values: [{ address: '*' }] }])
})
