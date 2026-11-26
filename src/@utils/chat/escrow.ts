import { EscrowContract } from '@oceanprotocol/lib'
import { Contract, formatUnits } from 'ethers'
import type { Signer } from 'ethers'
import { getFirstEscrowAuthorization } from '@components/ComputeWizard/hooks/escrowAuthorization'

const ZERO = BigInt(0)
const ALLOWANCE_WAIT_MS = 120_000
const ALLOWANCE_POLL_MS = 2_000

export interface EscrowRequest {
  signer: Signer
  chainId: number
  escrowAddress: string
  token: string
  decimals: number
  /** The node that locks the funds when the job starts. */
  payee: string
  /** What the job costs, as the node quoted it. */
  amountWei: bigint
  minLockSeconds: bigint
  onStep?: (step: 'deposit' | 'authorize') => void
}

const toBigInt = (value: unknown): bigint => BigInt(String(value ?? '0'))

async function waitForAllowance(
  erc20: Contract,
  owner: string,
  spender: string,
  amountWei: bigint
): Promise<void> {
  const deadline = Date.now() + ALLOWANCE_WAIT_MS
  while (toBigInt(await erc20.allowance(owner, spender)) < amountWei) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the escrow allowance.')
    }
    await new Promise((resolve) => setTimeout(resolve, ALLOWANCE_POLL_MS))
  }
}

/**
 * Makes the escrow ready for one paid job, moving no more than the job needs:
 * it deposits only what the free funds do not cover, and authorizes the node to
 * lock what is locked already plus this job, once more, for the time it asks.
 * The compute wizard deposits the job price and allows ten locks; the chat
 * keeps every amount to what its card showed.
 */
export async function ensureEscrow({
  signer,
  chainId,
  escrowAddress,
  token,
  decimals,
  payee,
  amountWei,
  minLockSeconds,
  onStep
}: EscrowRequest): Promise<void> {
  const owner = await signer.getAddress()
  const escrow = new EscrowContract(escrowAddress, signer, chainId)

  const funds = await escrow.getUserFunds(owner, token)
  const shortfall = amountWei - toBigInt(funds?.available)
  if (shortfall > ZERO) {
    onStep?.('deposit')
    const erc20 = new Contract(
      token,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)'
      ],
      signer
    )
    const approveTx = await erc20.approve(escrowAddress, shortfall)
    await approveTx.wait()
    await waitForAllowance(erc20, owner, escrowAddress, shortfall)
    const depositTx = await escrow.deposit(
      token,
      formatUnits(shortfall, decimals),
      decimals
    )
    const receipt = await (depositTx as { wait: () => Promise<unknown> }).wait()
    if (!receipt) throw new Error('The escrow deposit was not confirmed.')
  }

  const authorization = getFirstEscrowAuthorization(
    await escrow.getAuthorizations(token, owner, payee)
  )
  const lockedWei = toBigInt(authorization?.currentLockedAmount)
  const maxLockedAmount = lockedWei + amountWei
  const maxLockCounts = toBigInt(authorization?.currentLocks) + BigInt(1)
  const isEnough =
    authorization &&
    toBigInt(authorization.maxLockedAmount) >= maxLockedAmount &&
    toBigInt(authorization.maxLockSeconds) >= minLockSeconds &&
    toBigInt(authorization.maxLockCounts) >= maxLockCounts
  if (isEnough) return

  onStep?.('authorize')
  const authorizeTx = await escrow.contract.authorize(
    token,
    payee,
    maxLockedAmount.toString(),
    minLockSeconds.toString(),
    maxLockCounts.toString()
  )
  if (!(await authorizeTx.wait())) {
    throw new Error('The escrow authorization was not confirmed.')
  }
}
