import { mergeEditedCredentials } from './credentials'
import { Credential, CredentialPolicyBased } from 'src/@types/ddo/Credentials'

const policy: CredentialPolicyBased = {
  type: 'SSIpolicy',
  values: [
    {
      request_credentials: [],
      vc_policies: [],
      vp_policies: [{ policy: 'signature' }]
    }
  ]
}
const original: Credential = {
  allow: [{ type: 'address', values: [{ address: '*' }] }, policy],
  deny: [{ type: 'address', values: [{ address: '*' }] }],
  match_allow: 'all',
  match_deny: 'all'
}
const empty: Credential = { allow: [], deny: [], match_deny: 'any' }

it('removes address wildcards while preserving policies hidden in wallet-only mode', () => {
  expect(mergeEditedCredentials(original, empty, false)).toEqual({
    allow: [policy],
    deny: [],
    match_allow: 'all',
    match_deny: 'all'
  })
  expect(original.allow[0].values).toEqual([{ address: '*' }])
})

it('persists removal of visible service policies', () => {
  expect(mergeEditedCredentials(original, empty, true).allow).toEqual([])
})

it('replaces visible policies with their edited values', () => {
  const replacement: CredentialPolicyBased = {
    ...policy,
    values: [{ ...policy.values[0], vp_policies: [{ policy: 'expiration' }] }]
  }
  const updated = { ...empty, allow: [replacement] }
  expect(mergeEditedCredentials(original, updated, true).allow).toEqual([
    replacement
  ])
})
