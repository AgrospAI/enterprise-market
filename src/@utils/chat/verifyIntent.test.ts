import { getAsset } from '@utils/aquarius'
import {
  getAccessDetails,
  getOrderPriceAndFees
} from '@utils/accessDetailsAndPricing'
import { getComputeEnvironments } from '@utils/provider'
import { getIsPolicyServerConfigured } from '@utils/wallet/policyServer'
import { getTokenBalance } from '@utils/wallet'
import { EscrowContract } from '@oceanprotocol/lib'
import {
  VerifiedCompute,
  VerifiedDownload,
  verifyComputeIntent,
  verifyDownloadIntent
} from './verifyIntent'
import {
  ALGORITHM_DID,
  DATASET_DID,
  TOKEN,
  USER,
  computeIntent,
  downloadIntent,
  fixedPrice,
  freePrice,
  paidComputeIntent,
  paidDownloadIntent
} from '../../../.jest/__fixtures__/chatIntents'

const ESCROW = '0xfa48673a7C36A2A768f89AC1ee8C355D5c367B02'
let mockCap: string | null = '50'

jest.mock('@oceanprotocol/lib', () => ({ EscrowContract: jest.fn() }))
jest.mock('../../../app.config.cjs', () => ({
  __esModule: true,
  default: {
    ssiEnabled: true,
    get chatMaxSpend() {
      return mockCap
    }
  }
}))
jest.mock('@utils/ocean', () => ({
  getOceanConfig: () => ({ escrowAddress: ESCROW })
}))
jest.mock('@utils/wallet', () => ({
  getDummySigner: async () => ({ provider: {} }),
  getTokenBalance: jest.fn(),
  getTokenInfo: async (address: string) => ({
    address,
    symbol: 'devEURAU',
    decimals: 6
  })
}))
jest.mock('@utils/aquarius', () => ({ getAsset: jest.fn() }))
jest.mock('@utils/accessDetailsAndPricing', () => ({
  getAccessDetails: jest.fn(),
  getOrderPriceAndFees: jest.fn()
}))
jest.mock('@utils/provider', () => ({ getComputeEnvironments: jest.fn() }))
jest.mock('@utils/wallet/policyServer', () => ({
  getIsPolicyServerConfigured: jest.fn()
}))

const NODE = 'https://node.example'
const token = undefined

function ddo(did: string, type: string, services: object[], extra = {}) {
  return {
    id: did,
    credentialSubject: {
      chainId: 11155420,
      metadata: {
        type,
        name: type === 'dataset' ? 'SIGPAC' : 'Clip Raster',
        algorithm:
          type === 'algorithm'
            ? {
                consumerParameters: [
                  { name: 'lookbackDays', type: 'number', default: 60 }
                ]
              }
            : undefined
      },
      services,
      credentials: { allow: [], deny: [] }
    },
    indexedMetadata: { nft: { state: 0 } },
    ...extra
  }
}

const datasetDdo = ddo(DATASET_DID, 'dataset', [
  {
    id: '423bcd361d4f',
    type: 'compute',
    serviceEndpoint: NODE,
    consumerParameters: [
      { name: 'province', required: true },
      { name: 'polygon', required: true }
    ]
  }
])
const algorithmDdo = ddo(ALGORITHM_DID, 'algorithm', [
  { id: '044db2a4ff8e', type: 'compute', serviceEndpoint: NODE }
])
const freeEnvironment = {
  id: '0xff1004b67de08fc5-free',
  resources: [],
  free: {
    maxJobDuration: 600,
    resources: [
      { id: 'cpu', min: 1, max: 1 },
      { id: 'ram', min: 1, max: 1 },
      { id: 'disk', min: 0, max: 2 }
    ]
  }
}

function useCatalogue(assets: Record<string, unknown>) {
  jest.mocked(getAsset).mockImplementation(async (did) => assets[did])
}

describe('verifyComputeIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useCatalogue({ [DATASET_DID]: datasetDdo, [ALGORITHM_DID]: algorithmDdo })
    jest
      .mocked(getAccessDetails)
      .mockResolvedValue({ type: 'free', validOrderTx: '' } as never)
    jest
      .mocked(getComputeEnvironments)
      .mockResolvedValue([freeEnvironment] as never)
    jest.mocked(getIsPolicyServerConfigured).mockResolvedValue(true)
  })

  it('builds the plan from what the market loaded itself', async () => {
    const result = await verifyComputeIntent(computeIntent(), USER, token)

    if (!('plan' in result)) throw new Error(result.problems.join())
    const { plan } = result
    expect(plan.dataset.name).toBe('SIGPAC')
    expect(plan.algorithm.parameters).toEqual({ lookbackDays: 45 })
    expect(plan.dataset.parameters).toEqual({ province: '25', polygon: '3' })
    expect(plan.dataset.needsSession).toBe(true)
    expect(plan.resources).toMatchObject({ mode: 'free', jobDuration: 10 })
    expect(plan.dataset.asset.accessDetails[0]).toEqual({
      type: 'free',
      validOrderTx: ''
    })
    expect(getAccessDetails).toHaveBeenCalledWith(
      11155420,
      expect.objectContaining({ id: '423bcd361d4f' }),
      USER,
      token
    )
  })

  it.each([
    ['a paid asset', () => getAccessDetails, { type: 'fixed' }, 'not free'],
    ['a missing asset', null, null, 'was not found']
  ])('refuses %s', async (_name, _mock, details, message) => {
    if (details) {
      jest.mocked(getAccessDetails).mockResolvedValue(details as never)
    } else {
      useCatalogue({ [ALGORITHM_DID]: algorithmDdo })
    }
    const result = await verifyComputeIntent(computeIntent(), USER, token)
    expect('problems' in result && result.problems.join()).toContain(message)
  })

  it('refuses an asset on another network', async () => {
    useCatalogue({
      [DATASET_DID]: {
        ...datasetDdo,
        credentialSubject: { ...datasetDdo.credentialSubject, chainId: 1 }
      },
      [ALGORITHM_DID]: algorithmDdo
    })
    const result = await verifyComputeIntent(computeIntent(), USER, token)
    expect('problems' in result && result.problems.join()).toContain(
      'another network'
    )
  })

  it('refuses an asset whose ordering is disabled', async () => {
    useCatalogue({
      [DATASET_DID]: { ...datasetDdo, indexedMetadata: { nft: { state: 4 } } },
      [ALGORITHM_DID]: algorithmDdo
    })
    const result = await verifyComputeIntent(computeIntent(), USER, token)
    expect('problems' in result && result.problems.join()).toContain(
      'cannot be consumed'
    )
  })

  it('refuses swapped dataset and algorithm', async () => {
    const intent = computeIntent()
    const result = await verifyComputeIntent(
      { ...intent, dataset: intent.algorithm, algorithm: intent.dataset },
      USER,
      token
    )
    expect('problems' in result && result.problems.join()).toContain(
      'is not a dataset'
    )
  })

  it('refuses an environment without free compute', async () => {
    jest
      .mocked(getComputeEnvironments)
      .mockResolvedValue([{ ...freeEnvironment, free: undefined }] as never)
    const result = await verifyComputeIntent(computeIntent(), USER, token)
    expect('problems' in result && result.problems.join()).toContain(
      'free compute environment is not available'
    )
  })

  it('refuses a duration above the free limit', async () => {
    const intent = computeIntent()
    const result = await verifyComputeIntent(
      {
        ...intent,
        environment: { ...intent.environment, maxJobDurationSeconds: 9999 }
      },
      USER,
      token
    )
    expect('problems' in result && result.problems.join()).toContain(
      'above the free limit'
    )
  })

  it('checks the parameters against the DDO, not the intent', async () => {
    const intent = computeIntent()
    const result = await verifyComputeIntent(
      {
        ...intent,
        algorithm: { ...intent.algorithm, parameters: { injected: 'x' } }
      },
      USER,
      token
    )
    expect('problems' in result && result.problems.join()).toContain(
      'does not accept: injected'
    )
  })

  it('flags an asset that asks for verifiable credentials', async () => {
    const credentials = {
      allow: [
        {
          type: 'SSIpolicy',
          values: [{ request_credentials: [{ type: 'Membership' }] }]
        }
      ],
      deny: []
    }
    useCatalogue({
      [DATASET_DID]: {
        ...datasetDdo,
        credentialSubject: { ...datasetDdo.credentialSubject, credentials }
      },
      [ALGORITHM_DID]: algorithmDdo
    })
    const result = await verifyComputeIntent(computeIntent(), USER, token)
    expect('plan' in result && result.plan.dataset.requiresSsi).toBe(true)
    expect('plan' in result && result.plan.algorithm.requiresSsi).toBe(false)
  })
})

describe('verifyDownloadIntent', () => {
  const downloadDdo = ddo(DATASET_DID, 'dataset', [
    {
      id: 'access-1',
      type: 'access',
      serviceEndpoint: NODE,
      datatokenAddress: '0x1089656C63Ab961b78E9d64230156bdc99c10F73'
    }
  ])

  beforeEach(() => {
    jest.clearAllMocks()
    useCatalogue({ [DATASET_DID]: downloadDdo })
    jest
      .mocked(getAccessDetails)
      .mockResolvedValue({ type: 'free', validOrderTx: '' } as never)
    jest.mocked(getIsPolicyServerConfigured).mockResolvedValue(true)
    jest.mocked(getOrderPriceAndFees).mockResolvedValue({
      price: '0',
      consumeMarketOrderFee: '0',
      providerFee: { providerFeeAmount: '0' }
    } as never)
  })

  it('accepts a free download without fees', async () => {
    const result = await verifyDownloadIntent(downloadIntent(), USER, token)
    expect('plan' in result && result.plan.asset.name).toBe('SIGPAC')
  })

  it.each([
    ['a provider fee', { providerFee: { providerFeeAmount: '1000' } }],
    ['a market fee', { consumeMarketOrderFee: '5' }]
  ])('refuses %s', async (_name, fees) => {
    jest.mocked(getOrderPriceAndFees).mockResolvedValue({
      price: '0',
      consumeMarketOrderFee: '0',
      providerFee: { providerFeeAmount: '0' },
      ...fees
    } as never)
    const result = await verifyDownloadIntent(downloadIntent(), USER, token)
    expect('problems' in result && result.problems.join()).toContain(
      'has a fee'
    )
  })

  it('refuses a datatoken that is not the service one', async () => {
    const result = await verifyDownloadIntent(
      downloadIntent({
        datatokenAddress: '0x0000000000000000000000000000000000000001'
      }),
      USER,
      token
    )
    expect('problems' in result && result.problems.join()).toContain(
      'different datatoken'
    )
  })

  it('refuses a dataset without a download service', async () => {
    const result = await verifyDownloadIntent(
      downloadIntent({
        asset: { ...downloadIntent().asset, serviceId: 'compute-1' }
      }),
      USER,
      token
    )
    expect('problems' in result && result.problems.join()).toContain(
      'has no such access service'
    )
  })
})

const baseToken = { address: TOKEN, symbol: 'devEURAU', decimals: 6 }
const fixed = (price = '1', extra = {}) => ({
  type: 'fixed',
  price,
  templateId: 2,
  validOrderTx: '',
  baseToken,
  ...extra
})
const priceAndFees = (extra = {}) => ({
  price: '1',
  baseTokenAmount: '1',
  opcFee: '0',
  consumeMarketOrderFee: '0',
  providerFee: { providerFeeAmount: '0' },
  ...extra
})
const problemsOf = (result: object) =>
  'problems' in result ? (result.problems as string[]).join('; ') : ''
const escrowFunds = jest.fn()

describe('paying from the chat', () => {
  const downloadDdo = ddo(DATASET_DID, 'dataset', [
    {
      id: 'access-1',
      type: 'access',
      serviceEndpoint: NODE,
      datatokenAddress: '0x1089656C63Ab961b78E9d64230156bdc99c10F73'
    }
  ])

  beforeEach(() => {
    jest.clearAllMocks()
    mockCap = '50'
    jest.mocked(getIsPolicyServerConfigured).mockResolvedValue(true)
    jest.mocked(getTokenBalance).mockResolvedValue('100.0')
    jest.mocked(getOrderPriceAndFees).mockResolvedValue(priceAndFees() as never)
    jest
      .mocked(EscrowContract)
      .mockImplementation(() => ({ getUserFunds: escrowFunds } as never))
    escrowFunds.mockResolvedValue({ available: BigInt(0), locked: BigInt(0) })
  })

  describe('a paid download', () => {
    beforeEach(() => {
      useCatalogue({ [DATASET_DID]: downloadDdo })
      jest.mocked(getAccessDetails).mockResolvedValue(fixed() as never)
    })

    async function verify(intent = paidDownloadIntent()) {
      return verifyDownloadIntent(intent, USER, token)
    }

    it('reads the price from the chain and adds it up', async () => {
      const result = await verify()
      if (!('plan' in result)) throw new Error(problemsOf(result))
      const { payment } = result.plan as VerifiedDownload
      expect(payment.token).toEqual(baseToken)
      expect(payment.totalWei).toBe(BigInt(1_000_000))
      expect(payment.escrow).toBeUndefined()
      expect(payment.transactions).toBe(2)
      expect(result.plan.orderPriceAndFees).toEqual(priceAndFees())
    })

    it('adds every fee the order pays in the same token', async () => {
      jest.mocked(getOrderPriceAndFees).mockResolvedValue(
        priceAndFees({
          opcFee: '0.002',
          baseTokenAmount: '1.052',
          consumeMarketOrderFee: '20000',
          providerFee: { providerFeeAmount: '30000', providerFeeToken: TOKEN }
        }) as never
      )
      const result = await verify()
      // 1.052 from the exchange, 0.02 consume market fee, 0.03 provider fee.
      expect('plan' in result && result.plan.payment.totalWei).toBe(
        BigInt(1_102_000)
      )
    })

    it('needs no payment for a dataset bought already', async () => {
      jest
        .mocked(getAccessDetails)
        .mockResolvedValue(fixed('1', { validOrderTx: '0xOld' }) as never)
      const result = await verify()
      expect('plan' in result && result.plan.payment).toBeUndefined()
      expect(getOrderPriceAndFees).not.toHaveBeenCalled()
    })

    it.each([
      ['a higher price', () => fixed('2'), 'changed since it was prepared'],
      [
        'another token',
        () =>
          fixed('1', {
            baseToken: {
              ...baseToken,
              address: '0x0000000000000000000000000000000000000002'
            }
          }),
        'changed since it was prepared'
      ],
      [
        'a free asset that was paid',
        () => ({ type: 'free', validOrderTx: '' }),
        'changed since it was prepared'
      ],
      [
        'an asset without a price',
        () => ({ type: 'NOT_SUPPORTED', validOrderTx: '' }),
        'cannot be bought from the chat'
      ]
    ])('refuses %s on the chain', async (_name, details, message) => {
      jest.mocked(getAccessDetails).mockResolvedValue(details() as never)
      expect(problemsOf(await verify())).toContain(message)
    })

    it('refuses an asset the exchange of the market cannot quote', async () => {
      jest
        .mocked(getOrderPriceAndFees)
        .mockResolvedValue(priceAndFees({ baseTokenAmount: '0' }) as never)
      expect(problemsOf(await verify())).toContain(
        'could not get a quote for SIGPAC from its exchange'
      )
    })

    it('refuses a paid dataset prepared as version 1', async () => {
      const result = await verify(downloadIntent())
      expect(problemsOf(result)).toContain('is not free')
    })

    it('refuses a fee in another token', async () => {
      jest.mocked(getOrderPriceAndFees).mockResolvedValue(
        priceAndFees({
          providerFee: {
            providerFeeAmount: '5',
            providerFeeToken: '0x0000000000000000000000000000000000000003'
          }
        }) as never
      )
      expect(problemsOf(await verify())).toContain('fee in another token')
    })

    it('refuses to pay when the market sets no limit', async () => {
      mockCap = null
      expect(problemsOf(await verify())).toContain('turned off')
    })

    it('refuses to pay above the limit', async () => {
      mockCap = '0.5'
      expect(problemsOf(await verify())).toContain(
        'it costs 1 devEURAU, above the chat limit of 0.5 devEURAU'
      )
    })

    it('says how much is missing in the wallet', async () => {
      jest.mocked(getTokenBalance).mockResolvedValue('0.25')
      expect(problemsOf(await verify())).toContain(
        'you need 0.75 devEURAU more in your wallet'
      )
    })
  })

  describe('a job', () => {
    const paidEnvironment = {
      ...freeEnvironment,
      id: '0xff1004b67de08fc5',
      consumerAddress: '0x94549951623DD6c3265DBbB1b032d6cF48Ba7811',
      maxJobDuration: 3600,
      resources: [
        { id: 'cpu', min: 1, max: 2, total: 4 },
        { id: 'ram', min: 1, max: 4, total: 8 },
        { id: 'disk', min: 1, max: 10, total: 25 }
      ],
      fees: {
        '11155420': [
          { feeToken: TOKEN.toLowerCase(), prices: [{ id: 'cpu', price: 1 }] }
        ]
      }
    }

    beforeEach(() => {
      useCatalogue({ [DATASET_DID]: datasetDdo, [ALGORITHM_DID]: algorithmDdo })
      jest
        .mocked(getComputeEnvironments)
        .mockResolvedValue([freeEnvironment, paidEnvironment] as never)
      jest
        .mocked(getAccessDetails)
        .mockImplementation(
          async (_chain, service) =>
            (service.id === '044db2a4ff8e'
              ? fixed()
              : { type: 'free', validOrderTx: '' }) as never
        )
      jest.mocked(getOrderPriceAndFees).mockImplementation(
        async (_asset, _service, details) =>
          priceAndFees({
            price: details.type === 'free' ? '0' : '1'
          }) as never
      )
    })

    it('buys only the paid algorithm for a job in the free environment', async () => {
      const intent = paidComputeIntent()
      const result = await verifyComputeIntent(
        {
          ...intent,
          environment: computeIntent().environment
        },
        USER,
        token
      )
      if (!('plan' in result)) throw new Error(problemsOf(result))
      const plan = result.plan as VerifiedCompute
      expect(plan.mode).toBe('free')
      expect(plan.dataset.order).toBeUndefined()
      expect(plan.algorithm.order.costWei).toBe(BigInt(1_000_000))
      expect(plan.payment.totalWei).toBe(BigInt(1_000_000))
      expect(plan.payment.escrow).toBeUndefined()
      expect(getOrderPriceAndFees).toHaveBeenCalledTimes(1)
    })

    it('prices the paid environment and deposits only what is missing', async () => {
      escrowFunds.mockResolvedValue({ available: BigInt(4_000_000) })
      const result = await verifyComputeIntent(paidComputeIntent(), USER, token)
      if (!('plan' in result)) throw new Error(problemsOf(result))
      const plan = result.plan as VerifiedCompute

      expect(plan.mode).toBe('paid')
      // As the environment lists it: the node compares it as text.
      expect(plan.paymentToken).toBe(TOKEN.toLowerCase())
      expect(plan.maxJobDurationSeconds).toBe(600)
      expect(plan.resources).toMatchObject({
        mode: 'paid',
        cpu: 1,
        ram: 1,
        disk: 1,
        jobDuration: 10
      })
      // Every asset needs an order: the node checks them in a paid job.
      expect(plan.dataset.order.costWei).toBe(BigInt(0))
      expect(plan.payment.escrow).toEqual({
        address: ESCROW,
        jobCostWei: BigInt(10_000_000),
        availableWei: BigInt(4_000_000),
        depositWei: BigInt(6_000_000)
      })
      expect(plan.payment.totalWei).toBe(BigInt(7_000_000))
      // A free order, approve and buy, approve and deposit, authorize.
      expect(plan.payment.transactions).toBe(6)
      expect(EscrowContract).toHaveBeenCalledWith(
        ESCROW,
        expect.anything(),
        11155420
      )
    })

    it('counts the whole job cost against the limit', async () => {
      mockCap = '10'
      escrowFunds.mockResolvedValue({ available: BigInt(50_000_000) })
      const result = await verifyComputeIntent(paidComputeIntent(), USER, token)
      expect(problemsOf(result)).toContain(
        'it costs 11 devEURAU, above the chat limit'
      )
    })

    it.each([
      [
        'a cost above the estimate',
        { estimatedCost: { amount: '5' } },
        'compute environment changed'
      ],
      [
        'more CPU than the environment gives',
        { requested: [{ id: 'cpu', amount: 3 }] },
        'cannot give 3 cpu'
      ],
      [
        'an unknown resource',
        { requested: [{ id: 'gpu', amount: 1 }] },
        'cannot give 1 gpu'
      ],
      [
        'a duration above the limit',
        { maxJobDurationSeconds: 7200 },
        'outside the limits'
      ],
      [
        'a token the environment does not take',
        { paymentToken: '0x0000000000000000000000000000000000000004' },
        'does not take that token'
      ]
    ])('refuses %s', async (_name, change, message) => {
      const intent = paidComputeIntent()
      const result = await verifyComputeIntent(
        { ...intent, environment: { ...intent.environment, ...change } },
        USER,
        token
      )
      expect(problemsOf(result)).toContain(message)
    })

    it('refuses payments in two tokens', async () => {
      jest.mocked(getAccessDetails).mockImplementation(
        async (_chain, service) =>
          (service.id === '044db2a4ff8e'
            ? fixed('1', {
                baseToken: {
                  ...baseToken,
                  address: '0x0000000000000000000000000000000000000005'
                }
              })
            : { type: 'free', validOrderTx: '' }) as never
      )
      const intent = paidComputeIntent()
      const result = await verifyComputeIntent(
        {
          ...intent,
          algorithm: {
            ...intent.algorithm,
            price: {
              ...fixedPrice(),
              tokenAddress: '0x0000000000000000000000000000000000000005'
            }
          }
        },
        USER,
        token
      )
      expect(problemsOf(result)).toContain('more than one token')
    })

    it('refuses a paid algorithm the server saw as free', async () => {
      const intent = paidComputeIntent()
      const result = await verifyComputeIntent(
        {
          ...intent,
          algorithm: { ...intent.algorithm, price: freePrice() },
          environment: computeIntent().environment
        },
        USER,
        token
      )
      expect(problemsOf(result)).toContain('changed since it was prepared')
    })
  })
})
