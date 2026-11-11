import type { JobResultAttachment } from 'src/@types/Chat'
import type { ComputeIntent, DownloadIntent } from 'src/@types/ChatIntent'

export const USER = '0x23fDe279bdbA37a6Bcb501595Be4ba3ab679ccE8'
export const DATASET_DID =
  'did:ope:e28c61585df6c3b1636a0c019b35a58fa56cb0e8fcab0aca75ea27cbc34f1cb3'
export const ALGORITHM_DID =
  'did:ope:61bca61ad408ffde872e1af43c1712476db8cc104941de1b2719406b2dac45af'

/** The shape agrospai-on-mcp prepare_compute_job returns (WALLET_MODE=user). */
export function computeIntent(overrides = {}): ComputeIntent {
  return {
    kind: 'compute',
    version: 1,
    chainId: 11155420,
    consumerAddress: USER,
    dataset: {
      did: DATASET_DID,
      serviceId: '423bcd361d4f',
      name: 'SIGPAC (Compute-to-Data)',
      requiresSsi: false,
      parameters: { province: '25', polygon: '3' }
    },
    algorithm: {
      did: ALGORITHM_DID,
      serviceId: '044db2a4ff8e',
      name: 'Clip Raster',
      requiresSsi: false,
      parameters: { lookbackDays: 45 }
    },
    environment: {
      id: '0xff1004b67de08fc5-free',
      free: true,
      maxJobDurationSeconds: 600,
      resources: [{ id: 'cpu', type: 'cpu', total: 4, min: 1, max: 1 }]
    },
    ...overrides
  }
}

export function downloadIntent(overrides = {}): DownloadIntent {
  return {
    kind: 'download',
    version: 1,
    chainId: 11155420,
    consumerAddress: USER,
    asset: {
      did: DATASET_DID,
      serviceId: 'access-1',
      name: 'SIGPAC GeoJSON',
      requiresSsi: false
    },
    datatokenAddress: '0x1089656C63Ab961b78E9d64230156bdc99c10F73',
    timeoutSeconds: 0,
    ...overrides
  }
}

export const TOKEN = '0xD35141583f374d401fee1BFdDc35910E1D33a588'

export const fixedPrice = (amount = '1') => ({
  type: 'fixed' as const,
  amount,
  tokenAddress: TOKEN,
  tokenSymbol: 'devEURAU'
})

export const freePrice = () => ({ type: 'free' as const, amount: '0' })

/** A version 2 download of a paid dataset. */
export function paidDownloadIntent(overrides = {}): DownloadIntent {
  const intent = downloadIntent()
  return {
    ...intent,
    version: 2,
    asset: { ...intent.asset, price: fixedPrice() },
    ...overrides
  }
}

/** A version 2 job with a paid algorithm in the paid environment. */
export function paidComputeIntent(overrides = {}): ComputeIntent {
  const intent = computeIntent()
  return {
    ...intent,
    version: 2,
    dataset: { ...intent.dataset, price: freePrice() },
    algorithm: { ...intent.algorithm, price: fixedPrice() },
    environment: {
      id: '0xff1004b67de08fc5',
      free: false,
      maxJobDurationSeconds: 600,
      resources: [{ id: 'cpu', type: 'cpu', total: 4, min: 1, max: 2 }],
      requested: [{ id: 'cpu', amount: 1 }],
      paymentToken: TOKEN,
      estimatedCost: { amount: '10', tokenSymbol: 'devEURAU' }
    },
    ...overrides
  }
}

/** The results of a finished job, as the card reads them for the assistant. */
export function jobResultAttachment(
  overrides: Partial<JobResultAttachment> = {}
): JobResultAttachment {
  return {
    kind: 'jobResult',
    jobId: 'env-hash-job-1',
    dataset: 'Red Wine Dataset',
    algorithm: 'Enhanced Exploratory Data Analysis',
    succeeded: true,
    files: [
      {
        name: 'outputs/report.html',
        size: 4_500_000,
        text: 'Overview\nNumber of variables | 12\nNumber of observations | 1599',
        truncated: true
      },
      { name: 'outputs/chart.png', size: 2048, truncated: false }
    ],
    ...overrides
  }
}
