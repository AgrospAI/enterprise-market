import { Metadata } from 'src/@types/ddo/Metadata'
import { getInitialValues, getServiceInitialValues } from './_constants'
import { Service } from 'src/@types/ddo/Service'

jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

it('preserves an encrypted file when opening a service without waiting for file info', () => {
  const service = {
    id: 'download',
    type: 'access',
    files: '0x04encrypted',
    credentials: {},
    serviceEndpoint: 'https://node.example',
    timeout: 3600,
    consumerParameters: []
  } as unknown as Service
  const values = getServiceInitialValues(service, {
    price: '1',
    paymentCollector: '0xowner'
  } as AccessDetails)
  expect(values.files).toEqual([
    { type: 'hidden', url: '', valid: true, isEncrypted: true }
  ])
})

it.each([
  [{ allow: [] }, ['*']],
  [{ allow: [{ type: 'address', values: [] }] }, []],
  [undefined, ['*']]
])(
  'preserves address access semantics when opening an existing service',
  (credentials, expected) => {
    const values = getServiceInitialValues(
      { credentials, files: 'encrypted' } as unknown as Service,
      { price: '1' } as AccessDetails
    )
    expect(values.credentials.allow).toEqual(expected)
  }
)

it('keeps edit initial values stable across later renders with supplemental licenses', () => {
  const metadata = {
    name: 'Dataset',
    type: 'dataset',
    license: {
      name: 'Terms',
      licenseDocuments: [
        {
          name: 'Primary',
          mirrors: [{ type: 'url', url: 'https://example.com/terms' }]
        },
        {
          name: 'Supplement',
          mirrors: [{ type: 'url', url: 'https://example.com/supplement' }]
        },
        { name: 'Upload', mirrors: [{ type: 'ipfs', ipfsCid: 'sample-cid' }] }
      ]
    }
  } as Metadata
  const clock = jest.spyOn(Date, 'now')
  try {
    clock.mockReturnValue(1000)
    const initial = getInitialValues(metadata, undefined, [], 'Active')
    clock.mockReturnValue(2000)
    expect(getInitialValues(metadata, undefined, [], 'Active')).toEqual(initial)
  } finally {
    clock.mockRestore()
  }
})
