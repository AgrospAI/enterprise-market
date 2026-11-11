import {
  ComputeAlgorithm,
  ComputeAsset,
  ComputeJob,
  ProviderComputeInitializeResults,
  ProviderInstance,
  UserCustomParameters
} from '@oceanprotocol/lib'
import type { Signer } from 'ethers'
import {
  initializeProviderForComputeMulti,
  downloadFile
} from '@utils/provider'
import { handleComputeOrder, order } from '@utils/order'
import { buildResourceRequests } from '@components/ComputeWizard/computeResources'
import { PolicyServerInitiateComputeActionData } from 'src/@types/PolicyServer'
import {
  VerifiedAsset,
  VerifiedCompute,
  VerifiedDownload,
  formatTokenAmount,
  isPositive
} from './verifyIntent'
import { ensureEscrow } from './escrow'

export interface ComputeSessions {
  dataset: string
  algorithm: string
}

export type ComputeStep =
  | { step: 'order'; asset: string; amount?: string }
  | { step: 'deposit' | 'authorize' | 'start' }

function policyFor(
  { asset, service }: VerifiedAsset,
  sessionId: string
): PolicyServerInitiateComputeActionData {
  return {
    sessionId,
    serviceId: service.id,
    documentId: asset.id,
    successRedirectUri: '',
    errorRedirectUri: '',
    responseRedirectUri: '',
    presentationDefinitionUri: ''
  }
}

const sameAddress = (a?: string, b?: string): boolean =>
  Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase()

/**
 * Throws when the node asks for a provider fee: the card showed none, so the
 * chat pays none. The `payment` the node also returns is the escrow quote for
 * the paid environment; a free job never uses it, as in the compute wizard.
 */
export function assertNoProviderFees(
  init: ProviderComputeInitializeResults
): void {
  const fees = [
    init?.algorithm?.providerFee?.providerFeeAmount,
    ...(init?.datasets ?? []).map((ds) => ds?.providerFee?.providerFeeAmount)
  ]
  if (fees.some(isPositive)) {
    throw new Error(
      'The node asks for a fee for this job. Run it from the market instead.'
    )
  }
}

/**
 * Throws when the node's escrow quote does not match the card: another escrow
 * or token, or more than the market computed.
 */
export function assertEscrowQuote(
  plan: VerifiedCompute,
  init: ProviderComputeInitializeResults
): void {
  const { payment } = plan
  const quote = init?.payment
  const amount = /^\d{1,78}$/.test(String(quote?.amount ?? ''))
    ? BigInt(quote.amount)
    : undefined
  if (
    !payment?.escrow ||
    !amount ||
    !sameAddress(quote.escrowAddress, payment.escrow.address) ||
    !sameAddress(quote.token, payment.token.address) ||
    amount > payment.escrow.jobCostWei
  ) {
    throw new Error(
      'The node asks for a different payment than the card showed. Nothing was paid: ask again.'
    )
  }
}

/**
 * Checks the job with the node, buys what has to be bought, and starts it with
 * the user's signature:
 * - in the free environment, paid assets are ordered first (as the market's
 *   compute wizard does) and the job starts without escrow;
 * - in the paid environment, every asset is ordered, the escrow gets what the
 *   job costs, and the node checks the orders and locks the payment.
 * Nothing is paid before the node's answer matches the card. Algorithm
 * parameters go in `algocustomdata`, as in the compute wizard: Ocean Node
 * writes them to /data/inputs/algoCustomData.json.
 */
export async function startComputeJob(
  plan: VerifiedCompute,
  signer: Signer,
  account: string,
  sessions: ComputeSessions,
  onStep?: (step: ComputeStep) => void
): Promise<ComputeJob> {
  const { dataset, algorithm, environment, resources, mode } = plan
  const { chainId } = dataset.asset.credentialSubject

  const init = await initializeProviderForComputeMulti(
    [
      {
        asset: dataset.asset,
        service: dataset.service,
        accessDetails: dataset.accessDetails,
        sessionId: sessions.dataset
      }
    ],
    algorithm.asset,
    sessions.algorithm,
    signer,
    environment,
    resources,
    algorithm.serviceIndex,
    plan.paymentToken,
    undefined,
    undefined,
    algorithm.parameters,
    dataset.parameters
  )
  assertNoProviderFees(init)
  if (mode === 'paid') assertEscrowQuote(plan, init)

  const orderOf = async (
    asset: VerifiedAsset,
    initialized: ProviderComputeInitializeResults['algorithm'],
    sessionId: string
  ): Promise<string | undefined> => {
    if (asset.accessDetails.validOrderTx)
      return asset.accessDetails.validOrderTx
    if (!asset.order) return undefined
    const { baseToken } = asset.accessDetails
    onStep?.({
      step: 'order',
      asset: asset.name,
      ...(asset.order.costWei > BigInt(0)
        ? {
            amount: `${formatTokenAmount(
              asset.order.costWei,
              baseToken.decimals
            )} ${baseToken.symbol}`
          }
        : {})
    })
    const tx = await handleComputeOrder(
      signer,
      asset.asset,
      asset.service,
      asset.accessDetails,
      asset.order.orderPriceAndFees,
      account,
      initialized,
      false,
      sessionId,
      environment.consumerAddress
    )
    if (!tx) throw new Error(`The order of ${asset.name} was not confirmed.`)
    return tx
  }
  const datasetOrder = await orderOf(
    dataset,
    init.datasets?.[0],
    sessions.dataset
  )
  const algorithmOrder = await orderOf(
    algorithm,
    init.algorithm,
    sessions.algorithm
  )

  const policies = [
    policyFor(algorithm, sessions.algorithm),
    policyFor(dataset, sessions.dataset)
  ]
  const resourceRequests = buildResourceRequests(environment, resources)
  let response: ComputeJob | ComputeJob[]

  if (mode === 'paid') {
    if (!datasetOrder || !algorithmOrder) {
      throw new Error('The job needs an order for each asset.')
    }
    const { payment } = plan
    await ensureEscrow({
      signer,
      chainId,
      escrowAddress: payment.escrow.address,
      token: payment.token.address,
      decimals: payment.token.decimals,
      payee: init.payment.payee,
      amountWei: BigInt(init.payment.amount),
      minLockSeconds: BigInt(init.payment.minLockSeconds ?? 0),
      onStep: (step) => onStep?.({ step })
    })
    onStep?.({ step: 'start' })
    const datasets: ComputeAsset[] = [
      {
        documentId: dataset.asset.id,
        serviceId: dataset.service.id,
        transferTxId: datasetOrder,
        ...(dataset.parameters ? { userdata: dataset.parameters } : {})
      }
    ]
    // As in the paid branch of the market's compute wizard.
    const algorithmInput: ComputeAlgorithm = {
      documentId: algorithm.asset.id,
      serviceId: algorithm.service.id,
      transferTxId: algorithmOrder,
      ...(algorithm.parameters
        ? {
            algocustomdata: algorithm.parameters,
            userdata: algorithm.parameters
          }
        : {})
    }
    response = await ProviderInstance.computeStart(
      dataset.service.serviceEndpoint,
      signer,
      environment.id,
      datasets,
      algorithmInput,
      plan.maxJobDurationSeconds,
      plan.paymentToken,
      resourceRequests,
      chainId,
      null,
      null,
      undefined,
      policies
    )
  } else {
    onStep?.({ step: 'start' })
    response = await ProviderInstance.freeComputeStart(
      dataset.service.serviceEndpoint,
      signer,
      environment.id,
      [
        {
          documentId: dataset.asset.id,
          serviceId: dataset.service.id,
          ...(dataset.parameters ? { userdata: dataset.parameters } : {})
        }
      ],
      {
        documentId: algorithm.asset.id,
        serviceId: algorithm.service.id,
        ...(algorithm.parameters
          ? { algocustomdata: algorithm.parameters }
          : {}),
        meta: algorithm.asset.credentialSubject?.metadata?.algorithm as never
      },
      resourceRequests,
      null,
      null,
      undefined,
      policies
    )
  }
  const job = Array.isArray(response) ? response[0] : response
  if (!job?.jobId) throw new Error('The node did not start the job.')
  return job
}

/**
 * The status of one of the user's jobs. It needs the signer only for its
 * address: reading the status asks for no signature.
 */
export async function getJobStatus(
  providerUrl: string,
  signer: Signer,
  jobId: string
): Promise<ComputeJob | undefined> {
  const jobs = (await ProviderInstance.computeStatus(
    providerUrl,
    signer
  )) as ComputeJob[]
  // Starting a job answers `<environment hash>-<jobId>`, the status `jobId`.
  return (Array.isArray(jobs) ? jobs : []).find(
    (job) => job.jobId === jobId || jobId.endsWith(`-${job.jobId}`)
  )
}

/**
 * Orders the dataset if there is no valid order yet, then downloads it with
 * the market's own download code. The order is an on-chain transaction: a free
 * dataset costs only gas, a paid one what the card showed (the market's
 * `order()` approves exactly that amount and buys). Returns the order.
 */
export async function runDownload(
  plan: VerifiedDownload,
  signer: Signer,
  account: string,
  sessionId: string,
  onOrdering?: () => void
): Promise<string> {
  const { asset } = plan
  let orderTx = asset.accessDetails.validOrderTx
  if (!orderTx) {
    onOrdering?.()
    const tx = await order(
      signer,
      asset.asset,
      asset.service,
      asset.accessDetails,
      plan.orderPriceAndFees,
      account,
      false
    )
    const receipt = await tx.wait()
    orderTx = receipt?.hash
    if (!orderTx) throw new Error('The order was not confirmed.')
  }
  await downloadFile(
    signer,
    asset.asset,
    asset.service,
    asset.accessDetails,
    account,
    sessionId,
    orderTx,
    asset.parameters as UserCustomParameters
  )
  return orderTx
}
