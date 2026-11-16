import { FixedRateExchange } from '@oceanprotocol/lib'
import { getFixedBuyPrice } from './fixedRateExchange'

const CONFIGURED = '0x6976320eC365202118B4B0B0906E13DDf21633A5'
const ASSET_EXCHANGE = '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776'

jest.mock('@oceanprotocol/lib', () => ({ FixedRateExchange: jest.fn() }))
jest.mock('.', () => ({
  getOceanConfig: () => ({ fixedRateExchangeAddress: CONFIGURED })
}))
jest.mock('../../../app.config.cjs', () => ({ consumeMarketFixedSwapFee: '0' }))
jest.mock('@utils/wallet', () => ({ getDummySigner: async () => ({}) }))

const calcBaseInGivenDatatokensOut = jest.fn()
const fixed = (fixedRateExchangeAddress?: string) =>
  ({
    type: 'fixed',
    addressOrId: '0xexchangeid',
    fixedRateExchangeAddress
  } as AccessDetails)

describe('getFixedBuyPrice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(FixedRateExchange)
      .mockImplementation(() => ({ calcBaseInGivenDatatokensOut } as never))
    calcBaseInGivenDatatokensOut.mockResolvedValue({ baseTokenAmount: '1' })
  })

  it('quotes the offer on its own exchange', async () => {
    await expect(
      getFixedBuyPrice(fixed(ASSET_EXCHANGE), 11155420)
    ).resolves.toEqual({ baseTokenAmount: '1' })
    expect(jest.mocked(FixedRateExchange).mock.calls[0][0]).toBe(ASSET_EXCHANGE)
    expect(calcBaseInGivenDatatokensOut.mock.calls[0][0]).toBe('0xexchangeid')
  })

  it('quotes on the configured exchange when the offer has none', async () => {
    await getFixedBuyPrice(fixed(), 11155420)
    expect(jest.mocked(FixedRateExchange).mock.calls[0][0]).toBe(CONFIGURED)
  })
})
