import { Datatoken, FixedRateExchange } from '@oceanprotocol/lib'
import { getAccessDetails } from './accessDetailsAndPricing'

const ASSET_EXCHANGE = '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776'
const TOKEN = '0xD35141583f374d401fee1BFdDc35910E1D33a588'

jest.mock('@oceanprotocol/lib', () => ({
  Datatoken: jest.fn(),
  FixedRateExchange: jest.fn(),
  LoggerInstance: { error: jest.fn(), log: jest.fn() },
  ProviderInstance: {},
  getErrorMessage: jest.fn()
}))
jest.mock('../../app.config.cjs', () => ({
  publisherMarketOrderFee: '0',
  customProviderUrl: ''
}))
jest.mock('./ocean/fixedRateExchange', () => ({ getFixedBuyPrice: jest.fn() }))
jest.mock('./wallet', () => ({
  getDummySigner: async () => ({ provider: {} }),
  getTokenInfo: async () => ({
    symbol: 'devEURAU',
    name: 'devEURAU',
    decimals: 6
  })
}))
jest.mock('./aquarius', () => ({
  getUserOrders: async () => ({ results: [], totalPages: 0 })
}))
jest.mock('./consumeMarketFee', () => ({
  getConsumeMarketFeeWei: () => ({ totalFeeWei: '0' })
}))

describe('getAccessDetails', () => {
  it('keeps the exchange contract that holds a fixed-price offer', async () => {
    jest.mocked(Datatoken).mockImplementation(
      () =>
        ({
          getName: async () => 'DT',
          getSymbol: async () => 'DT',
          getPaymentCollector: async () => '0xCollector',
          getId: async () => 2,
          getDispensers: async () => [],
          getFixedRates: async () => [
            { contractAddress: ASSET_EXCHANGE, id: '0xexchangeid' }
          ]
        } as never)
    )
    jest.mocked(FixedRateExchange).mockImplementation(
      () =>
        ({
          getExchange: async () => ({
            baseToken: TOKEN,
            fixedRate: '1',
            btDecimals: '6'
          })
        } as never)
    )

    const details = await getAccessDetails(
      11155420,
      {
        id: 'access-1',
        type: 'access',
        datatokenAddress: '0xDT',
        timeout: 0
      } as never,
      '0xUser',
      undefined
    )
    expect(details).toMatchObject({
      type: 'fixed',
      addressOrId: '0xexchangeid',
      fixedRateExchangeAddress: ASSET_EXCHANGE,
      price: '1'
    })
    expect(jest.mocked(FixedRateExchange).mock.calls[0][0]).toBe(ASSET_EXCHANGE)
  })
})
