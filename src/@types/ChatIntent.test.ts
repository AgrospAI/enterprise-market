import { parseChatIntent } from './ChatIntent'
import {
  TOKEN,
  USER,
  computeIntent,
  downloadIntent,
  fixedPrice,
  paidComputeIntent,
  paidDownloadIntent
} from '../../.jest/__fixtures__/chatIntents'

describe('parseChatIntent', () => {
  it('accepts the compute intent of the MCP server', () => {
    const intent = computeIntent()
    expect(parseChatIntent({ ...intent, marketUrl: 'x' })).toEqual(intent)
  })

  it('accepts the download intent of the MCP server', () => {
    expect(parseChatIntent(downloadIntent())).toEqual(downloadIntent())
  })

  it('keeps only known fields', () => {
    const raw = {
      ...computeIntent(),
      extra: 'x',
      dataset: {
        ...computeIntent().dataset,
        marketUrl: 'https://evil.example',
        script: '<script>'
      }
    }
    const parsed = parseChatIntent(raw)
    expect(parsed).not.toHaveProperty('extra')
    expect(parsed.kind === 'compute' && parsed.dataset).not.toHaveProperty(
      'marketUrl'
    )
  })

  it('normalizes addresses to their checksum', () => {
    const parsed = parseChatIntent(
      downloadIntent({
        consumerAddress: USER.toLowerCase(),
        datatokenAddress: '0x1089656c63ab961b78e9d64230156bdc99c10f73'
      })
    )
    expect(parsed?.consumerAddress).toBe(USER)
    expect(parsed?.kind === 'download' && parsed.datatokenAddress).toBe(
      '0x1089656C63Ab961b78E9d64230156bdc99c10F73'
    )
  })

  it.each([
    ['an unknown version', { version: 3 }],
    ['an unknown kind', { kind: 'purchase' }],
    ['a bad address', { consumerAddress: '0x123' }],
    ['a bad chain', { chainId: -1 }],
    [
      'a bad DID',
      { dataset: { ...computeIntent().dataset, did: 'did:op:1234' } }
    ],
    [
      'a missing SSI flag',
      { dataset: { ...computeIntent().dataset, requiresSsi: 'no' } }
    ],
    [
      'an object as parameter value',
      { dataset: { ...computeIntent().dataset, parameters: { a: { b: 1 } } } }
    ],
    [
      'a paid environment',
      { environment: { ...computeIntent().environment, free: false } }
    ],
    [
      'a negative resource',
      {
        environment: {
          ...computeIntent().environment,
          resources: [{ id: 'cpu', max: -1 }]
        }
      }
    ]
  ])('refuses %s', (_name, overrides) => {
    expect(parseChatIntent(computeIntent(overrides))).toBeUndefined()
  })

  it.each([null, 'compute', [], 42])('refuses %p', (value) => {
    expect(parseChatIntent(value)).toBeUndefined()
  })

  it('ignores prices in version 1', () => {
    const raw = downloadIntent({
      asset: { ...downloadIntent().asset, price: fixedPrice() }
    })
    expect(parseChatIntent(raw)).toEqual(downloadIntent())
  })

  describe('version 2', () => {
    it('accepts a paid download', () => {
      expect(parseChatIntent(paidDownloadIntent())).toEqual(
        paidDownloadIntent()
      )
    })

    it('accepts a job in the paid environment', () => {
      expect(parseChatIntent(paidComputeIntent())).toEqual(paidComputeIntent())
    })

    it('normalizes the token addresses', () => {
      const lower = TOKEN.toLowerCase()
      const parsed = parseChatIntent(
        paidComputeIntent({
          environment: {
            ...paidComputeIntent().environment,
            paymentToken: lower
          }
        })
      )
      expect(parsed.kind === 'compute' && parsed.environment.paymentToken).toBe(
        TOKEN
      )
    })

    const { asset } = paidDownloadIntent()
    const env = paidComputeIntent().environment
    it.each([
      ['an asset without price', { asset: { ...asset, price: undefined } }],
      ['a negative price', { asset: { ...asset, price: fixedPrice('-1') } }],
      ['a price in words', { asset: { ...asset, price: fixedPrice('one') } }],
      [
        'a fixed price without token',
        { asset: { ...asset, price: { type: 'fixed', amount: '1' } } }
      ],
      [
        'an unknown price type',
        { asset: { ...asset, price: { ...fixedPrice(), type: 'auction' } } }
      ]
    ])('refuses %s', (_name, overrides) => {
      expect(parseChatIntent(paidDownloadIntent(overrides))).toBeUndefined()
    })

    it.each([
      ['no requested resources', { requested: [] }],
      ['a zero resource', { requested: [{ id: 'cpu', amount: 0 }] }],
      ['no payment token', { paymentToken: undefined }],
      ['a bad payment token', { paymentToken: '0x123' }],
      ['no estimated cost', { estimatedCost: undefined }],
      ['a bad estimated cost', { estimatedCost: { amount: '1e3' } }],
      ['a free environment with a cost', { free: true }]
    ])('refuses a paid environment with %s', (_name, overrides) => {
      expect(
        parseChatIntent(
          paidComputeIntent({ environment: { ...env, ...overrides } })
        )
      ).toBeUndefined()
    })
  })

  it('refuses a download without its datatoken', () => {
    expect(
      parseChatIntent(downloadIntent({ datatokenAddress: undefined }))
    ).toBeUndefined()
  })
})
