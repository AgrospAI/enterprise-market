import { ProviderInstance } from '@oceanprotocol/lib'
import {
  downloadFile,
  initializeProviderForComputeMulti
} from '@utils/provider'
import { handleComputeOrder, order } from '@utils/order'
import {
  assertNoProviderFees,
  getJobStatus,
  runDownload,
  startComputeJob
} from './runIntent'
import { ensureEscrow } from './escrow'
import type { VerifiedCompute, VerifiedDownload } from './verifyIntent'

jest.mock('@oceanprotocol/lib', () => ({
  ProviderInstance: {
    freeComputeStart: jest.fn(),
    computeStart: jest.fn(),
    computeStatus: jest.fn()
  }
}))
jest.mock('@utils/provider', () => ({
  initializeProviderForComputeMulti: jest.fn(),
  downloadFile: jest.fn()
}))
jest.mock('@utils/order', () => ({
  order: jest.fn(),
  handleComputeOrder: jest.fn()
}))
jest.mock('./escrow', () => ({ ensureEscrow: jest.fn() }))

const signer = { getAddress: async () => '0xUser' } as never
const NODE = 'https://node.example'

function asset(id: string, serviceId: string, parameters?: object) {
  return {
    asset: {
      id,
      credentialSubject: {
        chainId: 11155420,
        metadata: { algorithm: { container: { image: 'clip' } } }
      }
    },
    service: { id: serviceId, serviceEndpoint: NODE },
    serviceIndex: 0,
    accessDetails: { type: 'free', validOrderTx: '' },
    name: id,
    requiresSsi: false,
    needsSession: true,
    parameters
  } as never
}

const TOKEN = '0xD35141583f374d401fee1BFdDc35910E1D33a588'
const baseToken = { address: TOKEN, symbol: 'devEURAU', decimals: 6 }

/** An asset to buy: 1 devEURAU, with nothing bought yet. */
function paid(id: string, serviceId: string, costWei = BigInt(1_000_000)) {
  const free = asset(id, serviceId) as object
  return {
    ...free,
    accessDetails: { type: 'fixed', validOrderTx: '', baseToken },
    order: { orderPriceAndFees: { price: '1' }, costWei }
  } as never
}

const computePlan = {
  kind: 'compute',
  mode: 'free',
  paymentToken: '0xFee',
  dataset: asset('did:dataset', 'ds-1', { province: '25' }),
  algorithm: asset('did:algo', 'algo-1', { lookbackDays: 45 }),
  environment: {
    id: 'env-free',
    resources: [],
    fees: { '11155420': [{ feeToken: '0xFee' }] },
    free: { resources: [{ id: 'cpu', min: 1, max: 1 }] }
  },
  resources: { mode: 'free', cpu: 1, jobDuration: 10 },
  maxJobDurationSeconds: 600
} as unknown as VerifiedCompute

const freeInit = {
  algorithm: { providerFee: { providerFeeAmount: '0' } },
  datasets: [{ providerFee: { providerFeeAmount: '0' } }],
  // The escrow quote for the paid environment: never used by a free job.
  payment: { amount: '10000000' }
}

describe('startFreeComputeJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(initializeProviderForComputeMulti)
      .mockResolvedValue(freeInit as never)
    jest
      .mocked(ProviderInstance.freeComputeStart)
      .mockResolvedValue([{ jobId: 'env-hash-job-1' }] as never)
  })

  it('checks the job with the node, then starts it for free', async () => {
    const job = await startComputeJob(computePlan, signer, '0xUser', {
      dataset: 'session-ds',
      algorithm: 'session-algo'
    })

    expect(job.jobId).toBe('env-hash-job-1')
    const init = jest.mocked(initializeProviderForComputeMulti).mock.calls[0]
    expect(init[2]).toBe('session-algo')
    expect(init[7]).toBe('0xFee')
    expect(init[10]).toEqual({ lookbackDays: 45 })
    expect(init[11]).toEqual({ province: '25' })

    const [endpoint, usedSigner, envId, datasets, algorithm, resources] =
      jest.mocked(ProviderInstance.freeComputeStart).mock.calls[0]
    expect(endpoint).toBe(NODE)
    expect(usedSigner).toBe(signer)
    expect(envId).toBe('env-free')
    expect(datasets).toEqual([
      {
        documentId: 'did:dataset',
        serviceId: 'ds-1',
        userdata: { province: '25' }
      }
    ])
    expect(algorithm).toMatchObject({
      documentId: 'did:algo',
      serviceId: 'algo-1',
      algocustomdata: { lookbackDays: 45 }
    })
    expect(algorithm).not.toHaveProperty('transferTxId')
    expect(resources).toEqual([{ id: 'cpu', amount: 1 }])
    expect(handleComputeOrder).not.toHaveBeenCalled()
    expect(ensureEscrow).not.toHaveBeenCalled()
    const policies = jest.mocked(ProviderInstance.freeComputeStart).mock
      .calls[0][9]
    expect(policies.map((p) => [p.documentId, p.sessionId])).toEqual([
      ['did:algo', 'session-algo'],
      ['did:dataset', 'session-ds']
    ])
  })

  it('does not start a job the node wants a fee for', async () => {
    jest.mocked(initializeProviderForComputeMulti).mockResolvedValue({
      ...freeInit,
      datasets: [{ providerFee: { providerFeeAmount: '5' } }]
    } as never)

    await expect(
      startComputeJob(computePlan, signer, '0xUser', {
        dataset: 'a',
        algorithm: 'b'
      })
    ).rejects.toThrow('asks for a fee')
    expect(ProviderInstance.freeComputeStart).not.toHaveBeenCalled()
  })

  it('fails when the node answers without a job', async () => {
    jest
      .mocked(ProviderInstance.freeComputeStart)
      .mockResolvedValue({} as never)
    await expect(
      startComputeJob(computePlan, signer, '0xUser', {
        dataset: 'a',
        algorithm: 'b'
      })
    ).rejects.toThrow('did not start')
  })

  it('buys a paid algorithm before a job in the free environment', async () => {
    jest.mocked(handleComputeOrder).mockResolvedValue('0xAlgoOrder')
    const steps = []
    await startComputeJob(
      { ...computePlan, algorithm: paid('did:algo', 'algo-1') },
      signer,
      '0xUser',
      { dataset: 'session-ds', algorithm: 'session-algo' },
      (step) => steps.push(step)
    )

    expect(handleComputeOrder).toHaveBeenCalledTimes(1)
    const call = jest.mocked(handleComputeOrder).mock.calls[0]
    expect((call[1] as { id: string }).id).toBe('did:algo')
    expect(call[4]).toEqual({ price: '1' })
    expect(call[8]).toBe('session-algo')
    expect(steps).toEqual([
      { step: 'order', asset: 'did:algo', amount: '1 devEURAU' },
      { step: 'start' }
    ])
    expect(ProviderInstance.freeComputeStart).toHaveBeenCalled()
    expect(ensureEscrow).not.toHaveBeenCalled()
  })
})

describe('startComputeJob in the paid environment', () => {
  const ESCROW = '0xfa48673a7C36A2A768f89AC1ee8C355D5c367B02'
  const paidPlan = {
    ...computePlan,
    mode: 'paid',
    paymentToken: TOKEN,
    dataset: {
      ...(asset('did:dataset', 'ds-1', { province: '25' }) as object),
      order: { orderPriceAndFees: { price: '0' }, costWei: BigInt(0) }
    },
    algorithm: paid('did:algo', 'algo-1'),
    resources: { mode: 'paid', cpu: 1, ram: 1, disk: 1, jobDuration: 10 },
    environment: {
      ...computePlan.environment,
      consumerAddress: '0xNode',
      resources: [{ id: 'cpu', min: 1, max: 2 }]
    },
    payment: {
      token: baseToken,
      ordersWei: BigInt(1_000_000),
      escrow: {
        address: ESCROW,
        jobCostWei: BigInt(10_000_000),
        availableWei: BigInt(0),
        depositWei: BigInt(10_000_000)
      },
      totalWei: BigInt(11_000_000),
      transactions: 6
    }
  } as unknown as VerifiedCompute
  const quote = {
    escrowAddress: ESCROW.toLowerCase(),
    token: TOKEN.toLowerCase(),
    payee: '0xNode',
    amount: '10000000',
    minLockSeconds: 4200
  }
  const sessions = { dataset: 'session-ds', algorithm: 'session-algo' }

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(initializeProviderForComputeMulti)
      .mockResolvedValue({ ...freeInit, payment: quote } as never)
    jest
      .mocked(handleComputeOrder)
      .mockImplementation(async (_signer, orderAsset) =>
        orderAsset.id === 'did:algo' ? '0xAlgoOrder' : '0xDatasetOrder'
      )
    jest
      .mocked(ProviderInstance.computeStart)
      .mockResolvedValue([{ jobId: 'paid-job' }] as never)
  })

  it('orders every asset, funds the escrow, then starts the job', async () => {
    const job = await startComputeJob(paidPlan, signer, '0xUser', sessions)

    expect(job.jobId).toBe('paid-job')
    expect(handleComputeOrder).toHaveBeenCalledTimes(2)
    for (const call of jest.mocked(handleComputeOrder).mock.calls) {
      expect(call[9]).toBe('0xNode')
    }
    expect(ensureEscrow).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowAddress: ESCROW,
        token: TOKEN,
        decimals: 6,
        payee: '0xNode',
        amountWei: BigInt(10_000_000),
        minLockSeconds: BigInt(4200)
      })
    )
    const [, , envId, datasets, algorithm, duration, token] = jest.mocked(
      ProviderInstance.computeStart
    ).mock.calls[0]
    expect(envId).toBe('env-free')
    expect(datasets).toEqual([
      {
        documentId: 'did:dataset',
        serviceId: 'ds-1',
        transferTxId: '0xDatasetOrder',
        userdata: { province: '25' }
      }
    ])
    expect(algorithm).toMatchObject({ transferTxId: '0xAlgoOrder' })
    expect(duration).toBe(600)
    expect(token).toBe(TOKEN)
    expect(ProviderInstance.freeComputeStart).not.toHaveBeenCalled()

    const order = (fn: unknown) => (fn as jest.Mock).mock.invocationCallOrder[0]
    expect(order(handleComputeOrder)).toBeLessThan(order(ensureEscrow))
    expect(order(ensureEscrow)).toBeLessThan(
      order(ProviderInstance.computeStart)
    )
  })

  it.each([
    ['more than the card showed', { amount: '10000001' }],
    [
      'another escrow',
      { escrowAddress: '0x0000000000000000000000000000000000000001' }
    ],
    ['another token', { token: '0x0000000000000000000000000000000000000002' }],
    ['no amount', { amount: undefined }]
  ])('pays nothing when the node asks for %s', async (_name, change) => {
    jest.mocked(initializeProviderForComputeMulti).mockResolvedValue({
      ...freeInit,
      payment: { ...quote, ...change }
    } as never)

    await expect(
      startComputeJob(paidPlan, signer, '0xUser', sessions)
    ).rejects.toThrow('different payment')
    expect(handleComputeOrder).not.toHaveBeenCalled()
    expect(ensureEscrow).not.toHaveBeenCalled()
  })

  it('starts nothing when an order fails', async () => {
    jest.mocked(handleComputeOrder).mockRejectedValueOnce(new Error('reverted'))

    await expect(
      startComputeJob(paidPlan, signer, '0xUser', sessions)
    ).rejects.toThrow('reverted')
    expect(ensureEscrow).not.toHaveBeenCalled()
    expect(ProviderInstance.computeStart).not.toHaveBeenCalled()
  })

  it('reuses an order that is still valid', async () => {
    const bought = {
      ...paidPlan,
      algorithm: {
        ...paidPlan.algorithm,
        accessDetails: {
          ...paidPlan.algorithm.accessDetails,
          validOrderTx: '0xOld'
        }
      }
    }
    await startComputeJob(bought, signer, '0xUser', sessions)

    expect(handleComputeOrder).toHaveBeenCalledTimes(1)
    expect(
      jest.mocked(ProviderInstance.computeStart).mock.calls[0][4]
    ).toMatchObject({ transferTxId: '0xOld' })
  })
})

describe('assertNoProviderFees', () => {
  it('ignores the escrow quote of the paid environment', () => {
    expect(() => assertNoProviderFees(freeInit as never)).not.toThrow()
  })

  it('throws on an algorithm provider fee', () => {
    expect(() =>
      assertNoProviderFees({
        ...freeInit,
        algorithm: { providerFee: { providerFeeAmount: '1' } }
      } as never)
    ).toThrow()
  })
})

describe('getJobStatus', () => {
  it('finds the job by the id the start answered', async () => {
    jest.mocked(ProviderInstance.computeStatus).mockResolvedValue([
      { jobId: 'other', status: 70 },
      { jobId: 'job-1', status: 40 }
    ] as never)
    const status = await getJobStatus(NODE, signer, 'env-hash-job-1')
    expect(status).toMatchObject({ jobId: 'job-1', status: 40 })
    expect(jest.mocked(ProviderInstance.computeStatus).mock.calls[0]).toEqual([
      NODE,
      signer
    ])
  })
})

describe('runDownload', () => {
  const plan = (validOrderTx = '') =>
    ({
      kind: 'download',
      asset: {
        ...(asset('did:dataset', 'access-1', { parcel: '1' }) as object),
        accessDetails: { type: 'free', validOrderTx }
      },
      orderPriceAndFees: { price: '0' }
    } as unknown as VerifiedDownload)

  beforeEach(() => jest.clearAllMocks())

  it('reuses a valid order without a transaction', async () => {
    const onOrdering = jest.fn()
    await expect(
      runDownload(plan('0xOld'), signer, '0xUser', 'session', onOrdering)
    ).resolves.toBe('0xOld')

    expect(order).not.toHaveBeenCalled()
    expect(onOrdering).not.toHaveBeenCalled()
    expect(jest.mocked(downloadFile).mock.calls[0].slice(4)).toEqual([
      '0xUser',
      'session',
      '0xOld',
      { parcel: '1' }
    ])
  })

  it('orders first when there is no valid order', async () => {
    jest.mocked(order).mockResolvedValue({
      wait: async () => ({ hash: '0xNew' })
    } as never)
    await expect(
      runDownload(plan(), signer, '0xUser', 'session')
    ).resolves.toBe('0xNew')
    expect(jest.mocked(downloadFile).mock.calls[0][6]).toBe('0xNew')
  })

  it('buys a paid dataset with the price the market checked', async () => {
    jest.mocked(order).mockResolvedValue({
      wait: async () => ({ hash: '0xBought' })
    } as never)
    const paidPlan = {
      ...plan(),
      asset: paid('did:dataset', 'access-1'),
      orderPriceAndFees: { price: '1', opcFee: '0' }
    } as unknown as VerifiedDownload
    await expect(
      runDownload(paidPlan, signer, '0xUser', 'session')
    ).resolves.toBe('0xBought')

    expect(jest.mocked(order).mock.calls[0][4]).toEqual({
      price: '1',
      opcFee: '0'
    })
    expect(jest.mocked(downloadFile).mock.calls[0][6]).toBe('0xBought')
  })

  it('does not download when the order is not confirmed', async () => {
    jest.mocked(order).mockResolvedValue({ wait: async () => null } as never)
    await expect(
      runDownload(plan(), signer, '0xUser', 'session')
    ).rejects.toThrow('not confirmed')
    expect(downloadFile).not.toHaveBeenCalled()
  })
})
