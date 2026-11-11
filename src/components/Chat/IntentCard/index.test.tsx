import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { readJobResults } from '@utils/chat/jobResults'
import { declaredParameters } from '@utils/chat/consumerParameters'
import IntentCard from '.'
import {
  USER,
  computeIntent,
  downloadIntent,
  jobResultAttachment,
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
jest.mock('@utils/chat/jobResults', () => ({ readJobResults: jest.fn() }))
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

const datasetParameters = declaredParameters([
  { name: 'province', type: 'text', label: 'Province', required: true }
])
const algorithmParameters = declaredParameters([
  {
    name: 'lookbackDays',
    type: 'number',
    label: 'Days to look back',
    description: 'How far back to search for scenes',
    required: true,
    default: 60
  },
  {
    name: 'index',
    type: 'select',
    label: 'Index',
    default: 'ndvi',
    options: [{ ndvi: 'NDVI' }, { ndwi: 'NDWI' }]
  },
  { name: 'clip', type: 'boolean', label: 'Clip to the parcel', default: false }
])

function computePlan(overrides = {}) {
  return {
    kind: 'compute',
    mode: 'free',
    dataset: verified('Checked dataset', {
      parameters: { province: '25' },
      declaredParameters: datasetParameters,
      initialParameters: { province: '25' }
    }),
    algorithm: verified('Checked algorithm', {
      parameters: { lookbackDays: 45, index: 'ndvi', clip: false },
      declaredParameters: algorithmParameters,
      initialParameters: { lookbackDays: 45, index: 'ndvi', clip: false }
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

  describe('asking about the results', () => {
    async function finishJob(
      props: Partial<Parameters<typeof IntentCard>[0]> = {}
    ) {
      jest.useFakeTimers()
      jest.mocked(getJobStatus).mockResolvedValue({
        jobId: 'job-1',
        status: 70,
        statusText: 'Job finished',
        results: [{ index: 0, type: 'output', filesize: 10 }]
      } as never)
      render(<IntentCard intent={computeIntent()} live {...props} />)
      await screen.findByRole('button', { name: 'Run the job' })
      acceptTerms()
      fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
      await screen.findByText(/Job started/)
      await jest.advanceTimersByTimeAsync(10_000)
      await screen.findByText('The job is done and its results are ready.')
      jest.useRealTimers()
    }

    it('is offered only once the results are ready', async () => {
      const onAskAboutResults = jest.fn()
      render(
        <IntentCard
          intent={computeIntent()}
          live
          onAskAboutResults={onAskAboutResults}
        />
      )
      await screen.findByRole('button', { name: 'Run the job' })
      acceptTerms()
      fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
      await screen.findByText(/Job started/)

      expect(
        screen.queryByRole('button', { name: 'Ask about the results' })
      ).not.toBeInTheDocument()
    })

    const reports = [{ name: 'report.html', url: 'blob:report' }]

    it('reads the results once with the wallet and sends them', async () => {
      const attachment = jobResultAttachment()
      jest.mocked(readJobResults).mockResolvedValue({ attachment, reports })
      const onAskAboutResults = jest.fn()
      await finishJob({ onAskAboutResults })

      const ask = screen.getByRole('button', { name: 'Ask about the results' })
      fireEvent.click(ask)
      await waitFor(() =>
        expect(onAskAboutResults).toHaveBeenCalledWith(attachment, reports)
      )
      expect(
        screen.getByRole('link', { name: 'Open report.html' })
      ).toHaveAttribute('href', 'blob:report')
      expect(readJobResults).toHaveBeenCalledWith({
        providerUrl: expect.any(String),
        signer,
        job: expect.objectContaining({ jobId: 'job-1' }),
        dataset: 'Checked dataset',
        algorithm: 'Checked algorithm'
      })

      fireEvent.click(ask)
      await waitFor(() => expect(onAskAboutResults).toHaveBeenCalledTimes(2))
      expect(readJobResults).toHaveBeenCalledTimes(1)
    })

    it('opens the report without asking the assistant', async () => {
      jest
        .mocked(readJobResults)
        .mockResolvedValue({ attachment: jobResultAttachment(), reports })
      const onAskAboutResults = jest.fn()
      await finishJob({ onAskAboutResults })

      fireEvent.click(screen.getByRole('button', { name: 'Open the report' }))
      const link = await screen.findByRole('link', { name: 'Open report.html' })
      expect(link).toHaveAttribute('href', 'blob:report')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(onAskAboutResults).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'Open the report' })
      ).not.toBeInTheDocument()
    })

    it('says when the results have no report to open', async () => {
      jest
        .mocked(readJobResults)
        .mockResolvedValue({ attachment: jobResultAttachment(), reports: [] })
      await finishJob({ onAskAboutResults: jest.fn() })

      fireEvent.click(screen.getByRole('button', { name: 'Open the report' }))
      expect(
        await screen.findByText(/The results have no HTML report/)
      ).toBeInTheDocument()
    })

    it('says why the results could not be read', async () => {
      jest
        .mocked(readJobResults)
        .mockRejectedValue(
          new Error('The node did not give the results (403).')
        )
      const onAskAboutResults = jest.fn()
      await finishJob({ onAskAboutResults })

      fireEvent.click(
        screen.getByRole('button', { name: 'Ask about the results' })
      )
      expect(
        await screen.findByText(
          'The results could not be read: The node did not give the results (403).'
        )
      ).toBeInTheDocument()
      expect(onAskAboutResults).not.toHaveBeenCalled()
    })

    it('waits while the assistant is answering', async () => {
      await finishJob({ onAskAboutResults: jest.fn(), canAsk: false })
      expect(
        screen.getByRole('button', { name: 'Ask about the results' })
      ).toBeDisabled()
    })
  })

  describe('parameters', () => {
    const algorithmPlanOf = () =>
      jest.mocked(startComputeJob).mock.calls[0][0].algorithm

    it('lists the values to send, closed, with labels of the choices', async () => {
      render(<IntentCard intent={computeIntent()} live />)
      await screen.findByRole('button', { name: 'Run the job' })

      expect(screen.getByText(/: NDVI$/)).toBeInTheDocument()
      expect(screen.getByText(/: no$/)).toBeInTheDocument()
      expect(
        screen.queryByRole('spinbutton', { name: /Days to look back/ })
      ).not.toBeInTheDocument()
    })

    it('runs the job with the values the user changed', async () => {
      render(<IntentCard intent={computeIntent()} live />)
      await screen.findByRole('button', { name: 'Run the job' })

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Edit the parameters of Checked algorithm'
        })
      )
      fireEvent.change(
        screen.getByRole('spinbutton', { name: /Days to look back/ }),
        { target: { value: '90' } }
      )
      fireEvent.change(screen.getByRole('combobox', { name: /Index/ }), {
        target: { value: 'ndwi' }
      })
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Clip to the parcel/ })
      )
      expect(
        screen.getByText('How far back to search for scenes')
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      expect(screen.getByText(/: NDWI$/)).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'Edit the parameters of Checked algorithm'
        })
      ).toHaveTextContent('Edit parameters')
      expect(screen.getByText('Edited')).toBeInTheDocument()

      acceptTerms()
      fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
      await screen.findByText(/Job started/)

      expect(algorithmPlanOf().parameters).toEqual({
        lookbackDays: 90,
        index: 'ndwi',
        clip: true
      })
      expect(
        jest.mocked(startComputeJob).mock.calls[0][0].dataset.parameters
      ).toEqual({ province: '25' })
      // A job that started shows its values, without a way to change them.
      expect(
        screen.queryByRole('button', { name: /Edit the parameters/ })
      ).not.toBeInTheDocument()
    })

    it('blocks the job until a required value is valid', async () => {
      render(<IntentCard intent={computeIntent()} live />)
      await screen.findByRole('button', { name: 'Run the job' })
      acceptTerms()
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Edit the parameters of Checked algorithm'
        })
      )
      const days = screen.getByRole('spinbutton', {
        name: /Days to look back/
      })

      fireEvent.change(days, { target: { value: '' } })
      expect(screen.getByText('Required: give it a value.')).toBeInTheDocument()
      expect(days).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: 'Run the job' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()

      fireEvent.change(days, { target: { value: '30' } })
      expect(screen.getByRole('button', { name: 'Run the job' })).toBeEnabled()
    })

    it('opens the form when a value is missing, and undoes changes', async () => {
      jest.mocked(verifyComputeIntent).mockResolvedValue({
        plan: computePlan({
          dataset: verified('Checked dataset', {
            declaredParameters: datasetParameters,
            initialParameters: {}
          })
        })
      } as never)
      render(<IntentCard intent={computeIntent()} live />)
      await screen.findByRole('button', { name: 'Run the job' })
      acceptTerms()

      const province = screen.getByRole('textbox', { name: /Province/ })
      expect(screen.getByRole('button', { name: 'Run the job' })).toBeDisabled()
      fireEvent.change(province, { target: { value: '08' } })
      expect(screen.getByRole('button', { name: 'Run the job' })).toBeEnabled()

      fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }))
      expect(screen.getByRole('button', { name: 'Run the job' })).toBeDisabled()
    })
  })

  it('lets the user change the parameters of SIGPAC and Clip Raster', async () => {
    // The declarations of the published assets, as the node indexes them.
    const sigpac = declaredParameters([
      {
        name: 'province',
        type: 'text',
        label: 'Province',
        required: true,
        description: 'INE province code.',
        default: '25'
      },
      {
        name: 'municipality',
        type: 'text',
        label: 'Municipality',
        required: true,
        description: 'INE municipality code.',
        default: '168'
      },
      {
        name: 'aggregation',
        type: 'text',
        label: 'Aggregation',
        required: false,
        description: 'SIGPAC aggregation code (0 if none).',
        default: '0'
      },
      {
        name: 'zone',
        type: 'text',
        label: 'Zone',
        required: false,
        description: 'SIGPAC zone code (0 if none).',
        default: '0'
      },
      {
        name: 'polygon',
        type: 'text',
        label: 'Polygon',
        required: true,
        description: 'SIGPAC polygon number.',
        default: '10'
      },
      {
        name: 'parcel',
        type: 'text',
        label: 'Parcel',
        required: true,
        description: 'SIGPAC parcel number.',
        default: '6'
      },
      {
        name: 'precint',
        type: 'text',
        label: 'Precinct',
        required: true,
        description: 'SIGPAC precinct number within the parcel.',
        default: '1'
      }
    ])
    const clipRaster = declaredParameters([
      {
        name: 'lookbackDays',
        type: 'number',
        label: 'Search window (days)',
        required: false,
        description:
          'How many days back to search for Sentinel-2 scenes (1-365).',
        default: '60'
      },
      {
        name: 'maxCloudCover',
        type: 'number',
        label: 'Maximum cloud cover in the parcel (%)',
        required: false,
        description:
          'Maximum share of cloudy, shadowed or missing pixels inside the parcel (0-100). The newest scene under this limit is used; if none is, the clearest one.',
        default: '20'
      }
    ])
    const given = {
      province: '25',
      municipality: '168',
      aggregation: '0',
      zone: '0',
      polygon: '10',
      parcel: '6',
      precint: '1'
    }
    jest.mocked(verifyComputeIntent).mockResolvedValue({
      plan: computePlan({
        dataset: verified('SIGPAC', {
          parameters: given,
          declaredParameters: sigpac,
          initialParameters: given
        }),
        algorithm: verified('Clip Raster', {
          parameters: { lookbackDays: 60, maxCloudCover: 20 },
          declaredParameters: clipRaster,
          initialParameters: { lookbackDays: '60', maxCloudCover: '20' }
        })
      })
    } as never)
    render(<IntentCard intent={computeIntent()} live />)
    await screen.findByRole('button', { name: 'Run the job' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit the parameters of SIGPAC' })
    )
    fireEvent.change(screen.getByRole('textbox', { name: /Parcel/ }), {
      target: { value: '7' }
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edit the parameters of Clip Raster'
      })
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: /Search window/ }),
      { target: { value: '30' } }
    )
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: 'Run the job' }))
    await screen.findByText(/Job started/)

    const [ran] = jest.mocked(startComputeJob).mock.calls[0]
    expect(ran.dataset.parameters).toEqual({ ...given, parcel: '7' })
    expect(ran.algorithm.parameters).toEqual({
      lookbackDays: 30,
      maxCloudCover: 20
    })
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
