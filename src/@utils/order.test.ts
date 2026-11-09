import { Datatoken, FixedRateExchange, approve } from '@oceanprotocol/lib'
import { order } from './order'

const CONFIGURED = '0x6976320eC365202118B4B0B0906E13DDf21633A5'
const ASSET_EXCHANGE = '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776'
const TOKEN = '0xD35141583f374d401fee1BFdDc35910E1D33a588'
const DATATOKEN = '0x1089656C63Ab961b78E9d64230156bdc99c10F73'

jest.mock('@oceanprotocol/lib', () => ({
  approve: jest.fn(),
  approveWei: jest.fn(),
  allowance: jest.fn(),
  Datatoken: jest.fn(),
  Dispenser: jest.fn(),
  FixedRateExchange: jest.fn(),
  LoggerInstance: { log: jest.fn(), error: jest.fn() },
  ProviderInstance: {},
  getErrorMessage: jest.fn()
}))
jest.mock('./ocean', () => ({
  getOceanConfig: () => ({ fixedRateExchangeAddress: CONFIGURED })
}))
jest.mock('../../app.config.cjs', () => ({
  __esModule: true,
  default: {},
  marketFeeAddress: '0x0000000000000000000000000000000000000009',
  consumeMarketFixedSwapFee: '0',
  customProviderUrl: ''
}))
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }))
jest.mock('./wallet', () => ({ getTokenInfo: jest.fn() }))
jest.mock('./consumeMarketFee', () => ({
  getConsumeMarketFeeWei: () => ({ totalFeeWei: '0' })
}))

const datatoken = {
  buyFromFreAndOrder: jest.fn(),
  startOrder: jest.fn()
}
const fre = { buyDatatokens: jest.fn() }
const confirmed = { wait: async () => ({ hash: '0xtx' }) }

const asset = {
  id: 'did:ope:1',
  credentialSubject: { chainId: 11155420, services: [{ id: 'access-1' }] }
} as never
const service = { id: 'access-1', datatokenAddress: DATATOKEN } as never
const accessDetails = (templateId: number) =>
  ({
    type: 'fixed',
    templateId,
    addressOrId: '0xexchangeid',
    fixedRateExchangeAddress: ASSET_EXCHANGE,
    price: '1',
    baseToken: { address: TOKEN, symbol: 'devEURAU', decimals: 6 },
    datatoken: { address: DATATOKEN }
  } as never)
// The exchange quote holds the price, Ocean's fee and the publishing
// market's swap fee: 1 + 0.002 + 0.05.
const priceAndFees = {
  price: '1',
  opcFee: '0.002',
  baseTokenAmount: '1.052',
  providerFee: { providerFeeAmount: '0' }
} as never

describe('order of a fixed-price asset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(Datatoken).mockImplementation(() => datatoken as never)
    jest.mocked(FixedRateExchange).mockImplementation(() => fre as never)
    jest.mocked(approve).mockResolvedValue(confirmed as never)
    datatoken.buyFromFreAndOrder.mockResolvedValue(confirmed)
    datatoken.startOrder.mockResolvedValue(confirmed)
    fre.buyDatatokens.mockResolvedValue(confirmed)
    const { allowance } = jest.requireMock('@oceanprotocol/lib')
    allowance.mockResolvedValue('1000')
  })

  it('buys from the exchange that holds the offer (template 2)', async () => {
    await order(
      {} as never,
      asset,
      service,
      accessDetails(2),
      priceAndFees,
      '0xUser',
      false
    )
    const [, , freParams] = datatoken.buyFromFreAndOrder.mock.calls[0]
    expect(freParams.exchangeContract).toBe(ASSET_EXCHANGE)
    expect(freParams.exchangeId).toBe('0xexchangeid')
    expect(freParams.maxBaseTokenAmount).toBe('1.052')
    expect(jest.mocked(approve).mock.calls.at(-1).slice(4, 6)).toEqual([
      DATATOKEN,
      '1.052'
    ])
  })

  it('falls back to the price and Ocean fee without a quote', async () => {
    await order(
      {} as never,
      asset,
      service,
      accessDetails(2),
      {
        price: '1',
        opcFee: '0.002',
        providerFee: { providerFeeAmount: '0' }
      } as never,
      '0xUser',
      false
    )
    const [, , freParams] = datatoken.buyFromFreAndOrder.mock.calls[0]
    expect(freParams.maxBaseTokenAmount).toBe('1.002')
  })

  it('approves and buys on the exchange that holds the offer (template 1)', async () => {
    await order(
      {} as never,
      asset,
      service,
      accessDetails(1),
      priceAndFees,
      '0xUser',
      false
    )
    expect(jest.mocked(approve).mock.calls[0].slice(4, 6)).toEqual([
      ASSET_EXCHANGE,
      '1.052'
    ])
    expect(fre.buyDatatokens.mock.calls[0][2]).toBe('1.052')
    expect(jest.mocked(FixedRateExchange).mock.calls[0][0]).toBe(ASSET_EXCHANGE)
  })
})
