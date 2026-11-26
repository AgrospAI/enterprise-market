import { Datatoken, FixedRateExchange } from '@oceanprotocol/lib'
import { Signer } from 'ethers'
import {
  getFixedBuyPrice,
  resolveFixedRateExchangeAddress
} from './fixedRateExchange'

jest.mock('@oceanprotocol/lib', () => ({
  Datatoken: jest.fn(),
  FixedRateExchange: jest.fn()
}))
jest.mock('@utils/wallet', () => ({ getDummySigner: jest.fn() }))
jest.mock('../../../app.config.cjs', () => ({ consumeMarketFixedSwapFee: '0' }))

const signer = {} as Signer
const details = {
  type: 'fixed',
  addressOrId: '0xABC',
  datatoken: { address: '0xDataset' }
} as AccessDetails
const getFixedRates = jest.fn()
const quote = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(Datatoken as jest.Mock).mockImplementation(() => ({ getFixedRates }))
  ;(FixedRateExchange as jest.Mock).mockImplementation(() => ({
    calcBaseInGivenDatatokensOut: quote
  }))
})

it('quotes the registered legacy exchange for cached access details', async () => {
  getFixedRates.mockResolvedValue([
    { id: '0xOther', contractAddress: '0xOtherExchange' },
    { id: '0xabc', contractAddress: '0xLegacyExchange' }
  ])
  const expected = {
    baseTokenAmount: '1.052',
    marketFeeAmount: '0.05',
    oceanFeeAmount: '0.002',
    consumeMarketFeeAmount: '0'
  }
  quote.mockResolvedValue(expected)
  await expect(getFixedBuyPrice(details, 11155420, signer)).resolves.toEqual(
    expected
  )
  expect(FixedRateExchange).toHaveBeenCalledWith(
    '0xLegacyExchange',
    signer,
    11155420
  )
})

it('uses the contract retained when access details were loaded', async () => {
  await expect(
    resolveFixedRateExchangeAddress(
      { ...details, exchangeContract: '0xRegistered' },
      signer,
      11155420
    )
  ).resolves.toBe('0xRegistered')
  expect(getFixedRates).not.toHaveBeenCalled()
})

it('rejects unknown exchanges instead of falling back to a chain default', async () => {
  getFixedRates.mockResolvedValue([])
  await expect(getFixedBuyPrice(details, 11155420, signer)).rejects.toThrow(
    'not registered'
  )
  expect(FixedRateExchange).not.toHaveBeenCalled()
})

it('propagates failed quotes instead of presenting zero fees', async () => {
  quote.mockRejectedValue(new Error('RPC unavailable'))
  await expect(
    getFixedBuyPrice(
      { ...details, exchangeContract: '0xRegistered' },
      11155420,
      signer
    )
  ).rejects.toThrow('RPC unavailable')
})

it('quotes on the offer fixed-rate exchange address when retained', async () => {
  const expected = { baseTokenAmount: '1' }
  quote.mockResolvedValue(expected)
  await expect(
    getFixedBuyPrice(
      { ...details, fixedRateExchangeAddress: '0xAssetExchange' },
      11155420,
      signer
    )
  ).resolves.toEqual(expected)
  expect(FixedRateExchange).toHaveBeenCalledWith(
    '0xAssetExchange',
    signer,
    11155420
  )
  expect(getFixedRates).not.toHaveBeenCalled()
})
