import { parseRegistryConfig } from './config'

it('disables missing and unsupported deployments', () => {
  expect(parseRegistryConfig(undefined, 11155420)).toBeUndefined()
  expect(parseRegistryConfig('{}', 1)).toBeUndefined()
})
it.each([
  'bad',
  '[]',
  'null',
  '{"11155420":{}}',
  '{"11155420":{"address":"0x0000000000000000000000000000000000000000","deploymentBlock":0}}'
])('rejects malformed configuration %s', (raw) => {
  expect(() => parseRegistryConfig(raw, 11155420)).toThrow()
})
it('validates the checksum address and integer deployment block', () => {
  const address = '0x52908400098527886E0F7030069857D2E4169EE7'
  expect(
    parseRegistryConfig(
      JSON.stringify({ 11155420: { address, deploymentBlock: 1 } }),
      11155420
    )
  ).toEqual({ chainId: 11155420, address, deploymentBlock: 1 })
  expect(() =>
    parseRegistryConfig(
      JSON.stringify({
        11155420: { address: address.toLowerCase(), deploymentBlock: 1 }
      }),
      11155420
    )
  ).toThrow()
  expect(() =>
    parseRegistryConfig(
      JSON.stringify({ 11155420: { address, deploymentBlock: -1 } }),
      11155420
    )
  ).toThrow()
})
