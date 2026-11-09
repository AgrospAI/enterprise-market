import { fireEvent, render, screen } from '@testing-library/react'
import { useAccount, useSwitchChain } from 'wagmi'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { useSsiWallet } from '@context/SsiWallet'
import {
  verifyComputeIntent,
  verifyDownloadIntent
} from '@utils/chat/verifyIntent'
import {
  getJobStatus,
  runDownload,
  startComputeJob
} from '@utils/chat/runIntent'
import { openPolicySession } from '@utils/wallet/policySession'
import IntentCard from '.'
import {
  USER,
  computeIntent,
  downloadIntent,
  paidComputeIntent,
  paidDownloadIntent
} from '../../../../.jest/__fixtures__/chatIntents'

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useSwitchChain: jest.fn()
}))
jest.mock('@hooks/useEthersSigner', () => ({ useEthersSigner: jest.fn() }))
const newCancelToken = () => undefined
jest.mock('@hooks/useCancelToken', () => ({
  useCancelToken: () => newCancelToken
}))
jest.mock('@context/SsiWallet', () => ({ useSsiWallet: jest.fn() }))
jest.mock('@utils/chat/verifyIntent', () => ({
  verifyComputeIntent: jest.fn(),
  verifyDownloadIntent: jest.fn(),
  formatTokenAmount: (wei: bigint) => (Number(wei) / 1e6).toString()
}))
jest.mock('@utils/chat/runIntent', () => ({
  getJobStatus: jest.fn(),
  runDownload: jest.fn(),
  startComputeJob: jest.fn()
}))
jest.mock('@utils/wallet/policySession', () => ({
  openPolicySession: jest.fn()
}))
jest.mock(
  '@components/Asset/AssetActions/Compute/CredentialDialogProvider',
  () => ({
    CredentialDialogProvider: ({ children }) => children
  })
)
jest.mock('@components/Asset/AssetActions/CheckCredentials', () => ({
  AssetActionCheckCredentials: ({ asset }) => (
    <button type="button">Check credentials of {asset.id}</button>
  )
}))
jest.mock('@utils/chat/license', () => ({
  getLicenseLink: (asset) => `https://license.example/${asset.id}`
}))
jest.mock('@utils/markdown', () => ({
  markdownToHtml: (text: string) => `<p>${text}</p>`
}))

const signer = { getAddress: async () => USER }
const switchChain = jest.fn()

function verified(name: string, overrides = {}) {
  return {
    asset: { id: `did:${name}` },
    service: { id: `${name}-svc`, serviceEndpoint: 'https://node' },
    serviceIndex: 0,
    accessDetails: { type: 'free', validOrderTx: '' },
    name,
    requiresSsi: false,
    needsSession: true,
    ...overrides
  }
}

function acceptTerms() {
  fireEvent.click(
    screen.getByRole('checkbox', { name: /Terms and Conditions/ })
  )
  fireEvent.click(screen.getByRole('checkbox', { name: /license terms/ }))
}

function computePlan(overrides = {}) {
  return {
    kind: 'compute',
    mode: 'free',
    dataset: verified('Checked dataset', { parameters: { province: '25' } }),
    algorithm: verified('Checked algorithm', {
      parameters: { lookbackDays: 45 }
    }),
    environment: { id: 'env' },
    resources: {},
    maxJobDurationSeconds: 600,
    ...overrides
  }
}

describe('IntentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(useAccount)
      .mockReturnValue({ address: USER, chainId: 11155420 } as never)
    jest
      .mocked(useSwitchChain)
      .mockReturnValue({ switchChain, isPending: false } as never)
    jest.mocked(useEthersSigner).mockReturnValue(signer as never)
    jest
      .mocked(useSsiWallet)
      .mockReturnValue({ lookupVerifierSessionId: () => '' } as never)
    jest
      .mocked(verifyComputeIntent)
      .mockResolvedValue({ plan: computePlan() } as never)
    jest
      .mocked(openPolicySession)
      .mockImplementation(async (asset) => `session-${asset.id}`)
    jest.mocked(startComputeJob).mockResolvedValue({
      jobId: 'job-1',
      statusText: 'Pulling image'
    } as never)
    jest.mocked(getJobStatus).mockResolvedValue(undefined)
  })

  it('shows what the market checked, not what the intent said', async () => {
    render(<IntentCard intent={computeIntent()} live />)

    await screen.findByRole('button', { name: 'Run the job' })
    expect(screen.getAllByText('Checked dataset')[0]).toHaveAttribute(
      'href',
      '/asset/did:Checked dataset'
    )
    expect(screen.getAllByText('Checked algorithm')).toHaveLength(2)
    expect(screen.queryByText('Clip Raster')).not.toBeInTheDocument()
    expect(screen.getByText('lookbackDays')).toBeInTheDocument()
    expect(screen.getByText(/up to 10 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/You sign 3 messages/)).toBeInTheDocument()
  })

  it('runs nothing until the user clicks', async () => {
    render(<IntentCard intent={computeIntent()} live />)
    await screen.findByRole('button', { name: 'Run the job' })

    expect(openPolicySession).not.toHaveBeenCalled()
    expect(startComputeJob).not.toHaveBeenCalled()
  })

  it('asks to accept the terms and licenses before running', async () => {
    render(<IntentCard intent={computeIntent()} live />)
    const run = await screen.findByRole('button', { name: 'Run the job' })
    expect(run).toBeDisabled()
    expect(
      screen.getByRole('link', { name: 'Terms and Conditions' })
    ).toHaveAttribute('href', '/privacy/terms')
    expect(
      screen
        .getAllByRole('link', { name: 'Checked algorithm' })
        .map((link) => link.getAttribute('href'))
    ).toEqual([
      '/asset/did:Checked algorithm',
      'https://license.example/did:Checked algorithm'
    ])

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Terms and Conditions/ })
    )
    expect(run).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /license terms/ }))
    expect(run).toBeEnabled()
  })

  it('opens the sessions, then starts the job', async () => {
    render(<IntentCard intent={computeIntent()} live />)
    await screen.findByRole('button', { name: 'Run the job' })
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))

    expect(await screen.findByText(/Job started/)).toBeInTheDocument()
    expect(openPolicySession).toHaveBeenCalledTimes(2)
    expect(jest.mocked(startComputeJob).mock.calls[0][3]).toEqual({
      dataset: 'session-did:Checked dataset',
      algorithm: 'session-did:Checked algorithm'
    })
    expect(
      screen.getByRole('link', { name: /your compute jobs/ })
    ).toHaveAttribute('href', '/profile?defaultTab=computeJobs')
    expect(
      screen.queryByRole('button', { name: 'Run the job' })
    ).not.toBeInTheDocument()
  })

  it('tells the conversation while it is running', async () => {
    const onRunningChange = jest.fn()
    render(
      <IntentCard
        intent={computeIntent()}
        live
        onRunningChange={onRunningChange}
      />
    )
    await screen.findByRole('button', { name: 'Run the job' })
    acceptTerms()
    expect(onRunningChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
    await screen.findByText(/Job started/)

    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
  })

  it('says the results are ready while the node is settling', async () => {
    jest.useFakeTimers()
    jest.mocked(getJobStatus).mockResolvedValue({
      jobId: 'job-1',
      status: 71,
      statusText: 'Job settling',
      results: [{ index: 0 }]
    } as never)
    render(<IntentCard intent={computeIntent()} live />)
    await screen.findByRole('button', { name: 'Run the job' })
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
    await screen.findByText(/Job started/)

    await jest.advanceTimersByTimeAsync(10_000)
    expect(
      await screen.findByText('The job is done and its results are ready.')
    ).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('explains a cancelled signature and offers to try again', async () => {
    jest
      .mocked(openPolicySession)
      .mockRejectedValueOnce({ code: 'ACTION_REJECTED' })
    render(<IntentCard intent={computeIntent()} live />)
    await screen.findByRole('button', { name: 'Run the job' })
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))

    expect(
      await screen.findByText('You cancelled it in your wallet.')
    ).toBeInTheDocument()
    expect(startComputeJob).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Try again' })
    ).toBeInTheDocument()
  })

  it('shows why an action cannot run', async () => {
    jest.mocked(verifyComputeIntent).mockResolvedValue({
      problems: ['Clip Raster is not free: buy it in the market']
    })
    render(<IntentCard intent={computeIntent()} live />)

    expect(await screen.findByText(/is not free/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Run the job' })
    ).not.toBeInTheDocument()
  })

  it('refuses an action prepared for another wallet', () => {
    jest.mocked(useAccount).mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      chainId: 11155420
    } as never)
    render(<IntentCard intent={computeIntent()} live />)

    expect(screen.getByText(/prepared for another wallet/)).toBeInTheDocument()
    expect(verifyComputeIntent).not.toHaveBeenCalled()
  })

  it('asks to switch to the network of the action', () => {
    jest
      .mocked(useAccount)
      .mockReturnValue({ address: USER, chainId: 1 } as never)
    render(<IntentCard intent={computeIntent()} live />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch network' }))
    expect(switchChain).toHaveBeenCalledWith({ chainId: 11155420 })
    expect(verifyComputeIntent).not.toHaveBeenCalled()
  })

  it('does not check or run an action prepared earlier', () => {
    render(<IntentCard intent={computeIntent()} live={false} />)

    expect(screen.getByText(/Prepared earlier/)).toBeInTheDocument()
    expect(verifyComputeIntent).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('waits for credentials of an asset that asks for them', async () => {
    jest.mocked(verifyComputeIntent).mockResolvedValue({
      plan: computePlan({
        dataset: verified('Checked dataset', { requiresSsi: true })
      })
    } as never)
    render(<IntentCard intent={computeIntent()} live />)

    expect(
      await screen.findByRole('button', {
        name: 'Check credentials of did:Checked dataset'
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run the job' })).toBeDisabled()
  })

  describe('download', () => {
    beforeEach(() => {
      jest.mocked(verifyDownloadIntent).mockResolvedValue({
        plan: {
          kind: 'download',
          asset: verified('Checked file'),
          orderPriceAndFees: {}
        }
      } as never)
    })

    it('warns about gas when a new order is needed and downloads', async () => {
      render(<IntentCard intent={downloadIntent()} live />)

      expect(
        await screen.findByText(/you pay a little gas/)
      ).toBeInTheDocument()
      acceptTerms()
      fireEvent.click(screen.getByRole('button', { name: 'Download' }))

      expect(
        await screen.findByText(/download has started/)
      ).toBeInTheDocument()
      expect(jest.mocked(runDownload).mock.calls[0].slice(2, 4)).toEqual([
        USER,
        'session-did:Checked file'
      ])
    })
  })

  describe('paying', () => {
    const token = { address: '0xToken', symbol: 'devEURAU', decimals: 6 }
    const bought = (name: string, costWei: number) =>
      verified(name, {
        accessDetails: {
          type: 'fixed',
          validOrderTx: '',
          baseToken: token
        },
        order: { orderPriceAndFees: {}, costWei: BigInt(costWei) }
      })
    const paidJob = computePlan({
      mode: 'paid',
      algorithm: bought('Checked algorithm', 1_000_000),
      resources: { cpu: 1, ram: 1, disk: 1 },
      payment: {
        token,
        ordersWei: BigInt(1_000_000),
        escrow: {
          address: '0xEscrow',
          jobCostWei: BigInt(10_000_000),
          availableWei: BigInt(4_000_000),
          depositWei: BigInt(6_000_000)
        },
        totalWei: BigInt(7_000_000),
        transactions: 6
      }
    })

    beforeEach(() => {
      jest
        .mocked(verifyComputeIntent)
        .mockResolvedValue({ plan: paidJob } as never)
    })

    it('shows the price, the escrow and the total it checked', async () => {
      render(<IntentCard intent={paidComputeIntent()} live />)

      await screen.findByRole('button', {
        name: 'Pay 7 devEURAU and run the job'
      })
      expect(screen.getByText('1 devEURAU')).toBeInTheDocument()
      expect(
        screen.getByText(/In the paid environment with 1 CPU/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/The job costs 10 devEURAU: you deposit 6 devEURAU/)
      ).toBeInTheDocument()
      expect(screen.getByText('7 devEURAU now')).toBeInTheDocument()
      expect(
        screen.getByText(/up to 6 transactions and 3 signatures/)
      ).toBeInTheDocument()
      expect(startComputeJob).not.toHaveBeenCalled()
    })

    it('asks to agree to the amount before paying', async () => {
      render(<IntentCard intent={paidComputeIntent()} live />)
      const pay = await screen.findByRole('button', {
        name: 'Pay 7 devEURAU and run the job'
      })
      acceptTerms()
      expect(pay).toBeDisabled()

      fireEvent.click(
        screen.getByRole('checkbox', { name: 'I agree to pay 7 devEURAU' })
      )
      expect(pay).toBeEnabled()
      fireEvent.click(pay)
      expect(await screen.findByText(/Job started/)).toBeInTheDocument()
      expect(jest.mocked(startComputeJob).mock.calls[0][2]).toBe(USER)
    })

    it('checks again instead of paying again after a failure', async () => {
      jest
        .mocked(startComputeJob)
        .mockRejectedValueOnce(new Error('The deposit reverted'))
      render(<IntentCard intent={paidComputeIntent()} live />)
      const pay = await screen.findByRole('button', {
        name: 'Pay 7 devEURAU and run the job'
      })
      acceptTerms()
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'I agree to pay 7 devEURAU' })
      )
      fireEvent.click(pay)

      expect(
        await screen.findByText('The deposit reverted')
      ).toBeInTheDocument()
      expect(screen.getByText(/does not buy it twice/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      await screen.findByRole('button', {
        name: 'Pay 7 devEURAU and run the job'
      })
      expect(verifyComputeIntent).toHaveBeenCalledTimes(2)
      expect(startComputeJob).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('checkbox', { name: 'I agree to pay 7 devEURAU' })
      ).not.toBeChecked()
    })

    it('explains a node without gas instead of its raw error', async () => {
      jest
        .mocked(startComputeJob)
        .mockRejectedValueOnce(
          new Error(
            'Node insufficient gas funds. If you are the node owner, please add gas funds to the node.'
          )
        )
      render(<IntentCard intent={paidComputeIntent()} live />)
      const pay = await screen.findByRole('button', {
        name: 'Pay 7 devEURAU and run the job'
      })
      acceptTerms()
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'I agree to pay 7 devEURAU' })
      )
      fireEvent.click(pay)

      expect(
        await screen.findByText(/compute node has no gas to start paid jobs/)
      ).toBeInTheDocument()
      expect(screen.queryByText(/node owner/)).not.toBeInTheDocument()
    })

    it('buys a paid dataset', async () => {
      jest.mocked(verifyDownloadIntent).mockResolvedValue({
        plan: {
          kind: 'download',
          asset: bought('Checked file', 1_000_000),
          orderPriceAndFees: {},
          payment: {
            token,
            ordersWei: BigInt(1_000_000),
            totalWei: BigInt(1_000_000),
            transactions: 2
          }
        }
      } as never)
      render(<IntentCard intent={paidDownloadIntent()} live />)

      expect(
        await screen.findByRole('heading', { name: 'Dataset purchase' })
      ).toBeInTheDocument()
      acceptTerms()
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'I agree to pay 1 devEURAU' })
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Pay 1 devEURAU and download' })
      )
      expect(
        await screen.findByText(/download has started/)
      ).toBeInTheDocument()
    })
  })
})
