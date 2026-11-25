import { Contract, Signer } from 'ethers'
import { Datatoken, FixedRateExchange, Nft } from '@oceanprotocol/lib'
import { provisionRequestedService } from './provision'
import { ServiceTerms } from './service'

jest.mock('@oceanprotocol/lib', () => ({
  Datatoken: jest.fn(),
  FixedRateExchange: jest.fn(),
  Nft: jest.fn()
}))
jest.mock('@utils/ocean', () => ({
  getOceanConfig: () => ({
    fixedRateExchangeAddress: 'exchange',
    dispenserAddress: 'dispenser'
  })
}))
jest.mock('@utils/wallet', () => ({
  getTokenInfo: async () => ({ decimals: 6 })
}))
jest.mock('./client', () => ({
  sameAddress: (a, b) => a.toLowerCase() === b.toLowerCase()
}))
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn()
}))
const token = '0x1111111111111111111111111111111111111111'
const terms: ServiceTerms = {
  name: 'Custom',
  baseToken: token,
  price: '2.5',
  timeout: 3600
}
const signer = {
  getAddress: async () => 'owner',
  provider: {}
} as unknown as Signer
const recheck = jest.fn()
const confirmPricing = jest.fn()
const nft = { createDatatoken: jest.fn() }
const dt = {
  getName: jest.fn(),
  getFixedRates: jest.fn(),
  getDispensers: jest.fn(),
  createFixedRate: jest.fn(),
  createDispenser: jest.fn()
}
const exchange = { getExchange: jest.fn() }
beforeEach(() => {
  jest.clearAllMocks()
  ;(Nft as jest.Mock).mockImplementation(() => nft)
  ;(Datatoken as jest.Mock).mockImplementation(() => dt)
  ;(FixedRateExchange as jest.Mock).mockImplementation(() => exchange)
  ;(Contract as unknown as jest.Mock).mockImplementation(() => ({
    getTokensList: async () => []
  }))
  nft.createDatatoken.mockResolvedValue('new-token')
  dt.getFixedRates.mockResolvedValue([])
  dt.getDispensers.mockResolvedValue([])
  dt.createFixedRate.mockResolvedValue({ wait: confirmPricing })
  dt.createDispenser.mockResolvedValue({ wait: confirmPricing })
  recheck.mockResolvedValue({})
})
it('creates separate paid pricing with an 18-decimal fixed rate and waits for its confirmation', async () => {
  expect(
    await provisionRequestedService(
      'nft',
      'service',
      terms,
      signer,
      11155420,
      recheck
    )
  ).toBe('new-token')
  expect(nft.createDatatoken).toHaveBeenCalledTimes(1)
  expect(dt.createFixedRate).toHaveBeenCalledWith(
    'new-token',
    'owner',
    expect.objectContaining({
      fixedRate: '2500000000000000000',
      baseTokenAddress: token,
      baseTokenDecimals: 6
    })
  )
  expect(dt.createDispenser).not.toHaveBeenCalled()
  expect(confirmPricing).toHaveBeenCalledTimes(1)
})
it('recovers a confirmed datatoken and exchange after an interrupted approval', async () => {
  ;(Contract as unknown as jest.Mock).mockImplementation(() => ({
    getTokensList: async () => ['existing-token']
  }))
  dt.getName.mockResolvedValue('Access request service')
  dt.getFixedRates.mockResolvedValue([
    { contractAddress: 'exchange', id: 'rate' }
  ])
  exchange.getExchange.mockResolvedValue({
    baseToken: token,
    fixedRate: '2.5',
    active: true
  })
  expect(
    await provisionRequestedService(
      'nft',
      'service',
      terms,
      signer,
      11155420,
      recheck
    )
  ).toBe('existing-token')
  expect(nft.createDatatoken).not.toHaveBeenCalled()
  expect(dt.createFixedRate).not.toHaveBeenCalled()
})
it('creates a dispenser for free service access', async () => {
  await provisionRequestedService(
    'nft',
    'service',
    { ...terms, price: '0' },
    signer,
    11155420,
    recheck
  )
  expect(dt.createDispenser).toHaveBeenCalledTimes(1)
  expect(dt.createFixedRate).not.toHaveBeenCalled()
})
it('stops before signing when ownership or the reviewed metadata changes', async () => {
  recheck.mockRejectedValue(new Error('Owner changed'))
  await expect(
    provisionRequestedService(
      'nft',
      'service',
      terms,
      signer,
      11155420,
      recheck
    )
  ).rejects.toThrow('Owner changed')
  expect(nft.createDatatoken).not.toHaveBeenCalled()
})
it('refuses to reuse an exchange with a different price', async () => {
  dt.getFixedRates.mockResolvedValue([
    { contractAddress: 'exchange', id: 'rate' }
  ])
  exchange.getExchange.mockResolvedValue({
    baseToken: token,
    fixedRate: '5',
    active: true
  })
  await expect(
    provisionRequestedService(
      'nft',
      'service',
      terms,
      signer,
      11155420,
      recheck
    )
  ).rejects.toThrow('differs')
  expect(dt.createFixedRate).not.toHaveBeenCalled()
})
