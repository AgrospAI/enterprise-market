import { Contract, ZeroAddress } from 'ethers'
import { getOrCreateProvider } from '@utils/wallet'
import { readRequestPage, registry } from './client'

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn()
}))
jest.mock('@utils/wallet', () => ({ getOrCreateProvider: jest.fn() }))
jest.mock('@utils/metadataPersistence', () => ({ waitForReceipt: jest.fn() }))

const receiver = '0x94549951623DD6c3265DBbB1b032d6cF48Ba7811'
const config = { chainId: 11155420, address: receiver, deploymentBlock: 1 }
const raw = {
  id: 1n,
  requester: ZeroAddress,
  receiver,
  datasetNft: receiver,
  datasetServiceId: 'service',
  createdAt: 1n,
  expiresAt: 100n,
  decidedAt: 0n,
  status: 0,
  message: 'Please grant access.\nThank you!',
  decidedBy: ZeroAddress
}
const provider = {
  getNetwork: jest.fn(async () => ({ chainId: 11155420n })),
  getCode: jest.fn(async () => '0x1234'),
  getBlock: jest.fn(async () => ({ number: 42, timestamp: 50 }))
}
const contract = {
  VERSION: jest.fn(),
  serviceTerms: jest.fn(),
  receiverCount: jest.fn(),
  receiverPage: jest.fn(),
  runner: { provider }
}
beforeEach(() => {
  jest.clearAllMocks()
  contract.VERSION.mockResolvedValue(6n)
  contract.receiverCount.mockResolvedValue(1n)
  contract.receiverPage.mockResolvedValue([raw])
  ;(Contract as unknown as jest.Mock).mockImplementation(() => contract)
  ;(getOrCreateProvider as jest.Mock).mockReturnValue(provider)
})

it('reads the receiver index at a consistent block and decodes the recorded receiver', async () => {
  const page = await readRequestPage(config, 'receiver', receiver, '0')
  expect(contract.receiverCount).toHaveBeenCalledWith(receiver, {
    blockTag: 42
  })
  expect(contract.receiverPage).toHaveBeenCalledWith(receiver, 0n, 50, {
    blockTag: 42
  })
  expect(page.requests).toEqual([raw])
  expect(page.next).toBeUndefined()
})
it('uses the count to continue pagination and handles an empty inbox', async () => {
  contract.receiverCount.mockResolvedValue(51n)
  contract.receiverPage.mockResolvedValue(Array.from({ length: 50 }, () => raw))
  expect((await readRequestPage(config, 'receiver', receiver, '0')).next).toBe(
    '50'
  )
  contract.receiverCount.mockResolvedValue(0n)
  contract.receiverPage.mockResolvedValue([])
  expect(
    (await readRequestPage(config, 'receiver', receiver, '0')).requests
  ).toEqual([])
})
it.each([1n, 2n, 3n, 4n])(
  'refuses version %s instead of falling back to metadata discovery',
  async (version) => {
    contract.VERSION.mockResolvedValue(version)
    await expect(registry(config)).rejects.toThrow('version 6')
    expect(contract.receiverPage).not.toHaveBeenCalled()
  }
)
it('does not read after cancellation', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(
    readRequestPage(config, 'receiver', receiver, '0', controller.signal)
  ).rejects.toThrow()
  expect(Contract).not.toHaveBeenCalled()
})

it('loads immutable service proposals at the same block as their inbox page', async () => {
  const terms = JSON.stringify({
    name: 'Requested service',
    price: '1',
    timeout: 3600
  })
  contract.receiverPage.mockResolvedValue([{ ...raw, kind: 3 }])
  contract.serviceTerms.mockResolvedValue(terms)
  const page = await readRequestPage(config, 'receiver', receiver, '0')
  expect(page.requests[0].serviceTerms).toBe(terms)
  expect(contract.serviceTerms).toHaveBeenCalledWith(1n, { blockTag: 42 })
})

it('reports RPC verification failures without claiming the version is incompatible', async () => {
  contract.VERSION.mockRejectedValueOnce(new Error('RPC unavailable'))
  await expect(registry(config)).rejects.toThrow(
    'Could not verify the service request contract. Check your connection and try again.'
  )
  expect(contract.receiverPage).not.toHaveBeenCalled()
})
