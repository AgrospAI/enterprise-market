import { getOrCreateProvider } from '@utils/wallet'
import {
  reconcileActivation,
  rememberActivation,
  submittedActivation
} from './transactions'

jest.mock('@utils/wallet', () => ({ getOrCreateProvider: jest.fn() }))
const config = { chainId: 11155420, address: 'registry', deploymentBlock: 1 }
const hash = '0x' + 'a'.repeat(64)
const getReceipt = jest.fn()
beforeEach(() => {
  sessionStorage.clear()
  ;(getOrCreateProvider as jest.Mock).mockReturnValue({
    getTransactionReceipt: getReceipt
  })
})
it('recovers a submitted hash after reloading the feature', () => {
  rememberActivation(config, '1', hash)
  expect(submittedActivation(config, '1')).toBe(hash)
  expect(
    submittedActivation({ ...config, address: 'other-registry' }, '1')
  ).toBeUndefined()
})
it('blocks a repeat activation while its known transaction is pending or the cache is delayed', async () => {
  rememberActivation(config, '1', hash)
  getReceipt.mockResolvedValue(null)
  await expect(reconcileActivation(config, '1', 1)).rejects.toThrow('pending')
  getReceipt.mockResolvedValue({ status: 1, blockNumber: 10 })
  await expect(reconcileActivation(config, '1', 9)).rejects.toThrow('indexing')
  await expect(reconcileActivation(config, '1', 10)).resolves.toBeUndefined()
})
it('permits retry after a reverted transaction', async () => {
  rememberActivation(config, '1', hash)
  getReceipt.mockResolvedValue({ status: 0, blockNumber: 10 })
  await expect(reconcileActivation(config, '1')).resolves.toBeUndefined()
})
