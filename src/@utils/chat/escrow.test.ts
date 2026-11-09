import { EscrowContract } from '@oceanprotocol/lib'
import { Contract } from 'ethers'
import { ensureEscrow } from './escrow'

jest.mock('@oceanprotocol/lib', () => ({ EscrowContract: jest.fn() }))
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn()
}))
jest.mock('@components/ComputeWizard/hooks/escrowAuthorization', () => ({
  getFirstEscrowAuthorization: (list: unknown[]) => list[0]
}))

const USER = '0x23fDe279bdbA37a6Bcb501595Be4ba3ab679ccE8'
const ESCROW = '0xfa48673a7C36A2A768f89AC1ee8C355D5c367B02'
const TOKEN = '0xD35141583f374d401fee1BFdDc35910E1D33a588'
const NODE = '0x94549951623DD6c3265DBbB1b032d6cF48Ba7811'
const signer = { getAddress: async () => USER } as never
const confirmed = { wait: async () => ({ status: 1 }) }

const escrow = {
  getUserFunds: jest.fn(),
  getAuthorizations: jest.fn(),
  deposit: jest.fn(),
  contract: { authorize: jest.fn() }
}
const erc20 = { approve: jest.fn(), allowance: jest.fn() }

function request(amountWei = BigInt(10_000_000)) {
  return {
    signer,
    chainId: 11155420,
    escrowAddress: ESCROW,
    token: TOKEN,
    decimals: 6,
    payee: NODE,
    amountWei,
    minLockSeconds: BigInt(4200)
  }
}

describe('ensureEscrow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(EscrowContract).mockImplementation(() => escrow as never)
    jest.mocked(Contract).mockImplementation(() => erc20 as never)
    escrow.getUserFunds.mockResolvedValue({ available: '0', locked: '0' })
    escrow.getAuthorizations.mockResolvedValue([])
    escrow.deposit.mockResolvedValue(confirmed)
    escrow.contract.authorize.mockResolvedValue(confirmed)
    erc20.approve.mockResolvedValue(confirmed)
    erc20.allowance.mockResolvedValue(BigInt(10_000_000))
  })

  it('deposits only what the free escrow funds do not cover', async () => {
    escrow.getUserFunds.mockResolvedValue({ available: '4000000' })
    const onStep = jest.fn()
    await ensureEscrow({ ...request(), onStep })

    expect(erc20.approve).toHaveBeenCalledWith(ESCROW, BigInt(6_000_000))
    expect(escrow.deposit).toHaveBeenCalledWith(TOKEN, '6.0', 6)
    expect(onStep.mock.calls).toEqual([['deposit'], ['authorize']])
  })

  it('deposits nothing when the free funds cover the job', async () => {
    escrow.getUserFunds.mockResolvedValue({ available: '25000000' })
    await ensureEscrow(request())

    expect(erc20.approve).not.toHaveBeenCalled()
    expect(escrow.deposit).not.toHaveBeenCalled()
  })

  it('authorizes exactly this job: one more lock for its amount', async () => {
    escrow.getAuthorizations.mockResolvedValue([
      {
        currentLockedAmount: '3000000',
        currentLocks: '2',
        maxLockedAmount: '5000000',
        maxLockSeconds: '4200',
        maxLockCounts: '10'
      }
    ])
    await ensureEscrow(request())

    expect(escrow.contract.authorize).toHaveBeenCalledWith(
      TOKEN,
      NODE,
      '13000000',
      '4200',
      '3'
    )
  })

  it('does not authorize again when the authorization covers the job', async () => {
    escrow.getUserFunds.mockResolvedValue({ available: '10000000' })
    escrow.getAuthorizations.mockResolvedValue([
      {
        currentLockedAmount: '0',
        currentLocks: '0',
        maxLockedAmount: '10000000',
        maxLockSeconds: '4200',
        maxLockCounts: '1'
      }
    ])
    const onStep = jest.fn()
    await ensureEscrow({ ...request(), onStep })

    expect(escrow.contract.authorize).not.toHaveBeenCalled()
    expect(onStep).not.toHaveBeenCalled()
  })

  it('fails when the deposit is not confirmed', async () => {
    escrow.deposit.mockResolvedValue({ wait: async () => null })

    await expect(ensureEscrow(request())).rejects.toThrow('not confirmed')
    expect(escrow.contract.authorize).not.toHaveBeenCalled()
  })
})
