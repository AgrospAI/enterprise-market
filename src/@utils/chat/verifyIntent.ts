import { ComputeEnvironment, EscrowContract } from '@oceanprotocol/lib'
import type { CancelToken } from 'axios'
import { formatUnits, parseUnits } from 'ethers'
import appConfig from 'app.config.cjs'
import { getAsset } from '@utils/aquarius'
import {
  getAccessDetails,
  getOrderPriceAndFees
} from '@utils/accessDetailsAndPricing'
import { getComputeEnvironments } from '@utils/provider'
import { getOceanConfig } from '@utils/ocean'
import { getDummySigner, getTokenBalance, getTokenInfo } from '@utils/wallet'
import { getIsPolicyServerConfigured } from '@utils/wallet/policyServer'
import {
  isPolicyServerConsumptionDisabled,
  isSsiPolicyConsumptionDisabled,
  requiresPolicyServerCredentialCheck,
  requiresSsi
} from '@utils/credentials'
import { createDefaultComputeResourceValues } from '@components/ComputeWizard/computeEnvironmentDefaults'
import { mergeConsumerParameters } from '@components/ComputeWizard/consumerParameters'
import { AssetExtended } from 'src/@types/AssetExtended'
import { Service } from 'src/@types/ddo/Service'
import { ResourceType } from 'src/@types/ResourceType'
import type {
  ComputeIntent,
  DownloadIntent,
  IntentAssetRef,
  IntentParameters,
  IntentPrice
} from 'src/@types/ChatIntent'
import {
  declaredParameters,
  resolveConsumerParameters
} from './consumerParameters'

/** Active and unlisted assets can be consumed (as in agrospai-on-mcp). */
const CONSUMABLE_STATES = [0, 5]

export interface VerifiedAsset {
  asset: AssetExtended
  service: Service
  serviceIndex: number
  accessDetails: AccessDetails
  name: string
  /** The asset asks for verifiable credentials from the user's SSI wallet. */
  requiresSsi: boolean
  /** A policy-server session must be opened before consuming it. */
  needsSession: boolean
  parameters?: IntentParameters
  /**
   * The order to place before using the asset. None when it was bought
   * already, or when it is free and the job runs in the free environment.
   */
  order?: { orderPriceAndFees: OrderPriceAndFees; costWei: bigint }
}

export interface PaymentToken {
  address: string
  symbol: string
  decimals: number
}

export interface EscrowPlan {
  address: string
  /** What the job costs, as the market computes it from the environment. */
  jobCostWei: bigint
  /** Funds the user already has in escrow, free to lock. */
  availableWei: bigint
  /** What has to be deposited first: the job cost minus the free funds. */
  depositWei: bigint
}

/** What an action costs, read from the chain. All amounts are in wei. */
export interface Payment {
  token: PaymentToken
  ordersWei: bigint
  escrow?: EscrowPlan
  /** What leaves the wallet now: the orders and the escrow deposit. */
  totalWei: bigint
  /** The transactions the wallet will ask for, at most. */
  transactions: number
}

export interface VerifiedCompute {
  kind: 'compute'
  mode: 'free' | 'paid'
  dataset: VerifiedAsset
  algorithm: VerifiedAsset
  environment: ComputeEnvironment
  resources: ResourceType
  maxJobDurationSeconds: number
  paymentToken: string
  payment?: Payment
}

export interface VerifiedDownload {
  kind: 'download'
  asset: VerifiedAsset
  orderPriceAndFees: OrderPriceAndFees
  payment?: Payment
}

export type Verification<T> = { plan: T } | { problems: string[] }

type Problem = { problem: string }

function isProblem(value: unknown): value is Problem {
  return typeof (value as Problem)?.problem === 'string'
}

export const isPositive = (amount?: string | number): boolean => {
  try {
    return BigInt(String(amount ?? '0').split('.')[0] || '0') > BigInt(0)
  } catch {
    return Number(amount) > 0
  }
}

const ZERO = BigInt(0)
const AMOUNT = /^\d{1,30}(\.\d{1,18})?$/

/** A token amount for people: "1", "0.5", never "1.0". */
export function formatTokenAmount(wei: bigint, decimals: number): string {
  const text = formatUnits(wei, decimals)
  return text.endsWith('.0') ? text.slice(0, -2) : text
}

function toWei(amount: string | number | undefined, decimals: number): bigint {
  return parseUnits(String(amount ?? '0'), decimals)
}

const sameAddress = (a?: string, b?: string): boolean =>
  Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase()

/**
 * Compares the price on the chain with the one the MCP server saw. A version 1
 * intent has no price: the asset must be free, as before.
 */
function checkPrice(
  name: string,
  accessDetails: AccessDetails,
  price: IntentPrice | undefined
): string | undefined {
  const { type } = accessDetails ?? {}
  if (!price) {
    return type === 'free'
      ? undefined
      : `${name} is not free: buy it in the market`
  }
  if (type !== 'free' && type !== 'fixed') {
    return `${name} cannot be bought from the chat: use the market`
  }
  const changed = `the price of ${name} changed since it was prepared: ask again`
  if (type !== price.type) return changed
  if (type === 'free') return undefined
  const decimals = accessDetails.baseToken?.decimals || 18
  try {
    if (
      !sameAddress(accessDetails.baseToken?.address, price.tokenAddress) ||
      toWei(accessDetails.price, decimals) !== toWei(price.amount, decimals)
    ) {
      return changed
    }
  } catch {
    return changed
  }
  return undefined
}

/**
 * What an order costs in the base token, as the market's `order()` approves
 * it: the exchange's quote (price and swap fees), the consume market fee and
 * the provider fee when it is in the same token.
 */
function orderCostWei(
  name: string,
  accessDetails: AccessDetails,
  orderPriceAndFees: OrderPriceAndFees
): bigint | Problem {
  const { baseToken } = accessDetails
  const decimals = baseToken?.decimals || 18
  const providerFee = BigInt(
    orderPriceAndFees?.providerFee?.providerFeeAmount || '0'
  )
  if (
    providerFee > ZERO &&
    !sameAddress(
      orderPriceAndFees.providerFee.providerFeeToken,
      baseToken?.address
    )
  ) {
    return {
      problem: `${name} has a fee in another token: buy it in the market`
    }
  }
  // The exchange's quote already holds the price and its swap fees.
  return (
    toWei(orderPriceAndFees?.baseTokenAmount, decimals) +
    BigInt(orderPriceAndFees?.consumeMarketOrderFee || '0') +
    providerFee
  )
}

/**
 * Prices the order an asset needs. A free asset may need an order (it costs
 * gas, never a fee); a bought one with a valid order needs none.
 */
async function priceOrder(
  verified: VerifiedAsset,
  account: string
): Promise<VerifiedAsset | Problem> {
  const { asset, service, accessDetails, name } = verified
  if (accessDetails.validOrderTx) return verified
  const orderPriceAndFees = await getOrderPriceAndFees(
    asset,
    service,
    accessDetails,
    account
  )
  if (accessDetails.type === 'free') {
    if (
      isPositive(orderPriceAndFees?.providerFee?.providerFeeAmount) ||
      isPositive(orderPriceAndFees?.consumeMarketOrderFee)
    ) {
      return { problem: `${name} has a fee: get it in the market` }
    }
    return { ...verified, order: { orderPriceAndFees, costWei: ZERO } }
  }
  // The market buys through the exchange of its configuration. If that
  // exchange cannot quote the asset, the purchase would revert: refuse it
  // before the wallet is asked for anything.
  if (!(Number(orderPriceAndFees?.baseTokenAmount) > 0)) {
    return {
      problem: `the market could not get a quote for ${name} from its exchange: buying it would fail`
    }
  }
  const costWei = orderCostWei(name, accessDetails, orderPriceAndFees)
  if (isProblem(costWei)) return costWei
  return { ...verified, order: { orderPriceAndFees, costWei } }
}

function transactionsFor({ order, accessDetails }: VerifiedAsset): number {
  if (!order) return 0
  if (accessDetails.type === 'free') return 1
  // Approve and buy; template 1 buys the datatoken and orders it separately.
  return accessDetails.templateId === 1 ? 3 : 2
}

/** The most the chat may spend on one action, or none if it may not pay. */
function getSpendingCap(): string | undefined {
  const cap = String(appConfig.chatMaxSpend ?? '').trim()
  return AMOUNT.test(cap) ? cap : undefined
}

/**
 * Adds up what an action costs and checks it against the spending cap, the
 * wallet balance and, for a paid job, the funds already in escrow. Returns
 * nothing when the action is free.
 */
async function planPayment(
  account: string,
  chainId: number,
  assets: VerifiedAsset[],
  job: { token: PaymentToken; costWei: bigint } | undefined,
  problems: string[]
): Promise<Payment | undefined> {
  const paid = assets.filter((asset) => asset.order?.costWei > ZERO)
  if (paid.length === 0 && !job) return undefined

  const tokens = new Map<string, PaymentToken>()
  for (const { accessDetails } of paid) {
    const { address, symbol, decimals } = accessDetails.baseToken
    tokens.set(address.toLowerCase(), { address, symbol, decimals })
  }
  if (job) tokens.set(job.token.address.toLowerCase(), job.token)
  if (tokens.size > 1) {
    problems.push('it needs payments in more than one token: use the market')
    return undefined
  }
  const [token] = tokens.values()
  const signer = await getDummySigner(chainId)

  const ordersWei = paid.reduce((sum, asset) => sum + asset.order.costWei, ZERO)
  let escrow: EscrowPlan | undefined
  if (job) {
    const { escrowAddress } = getOceanConfig(chainId)
    const funds = await new EscrowContract(
      escrowAddress,
      signer,
      chainId
    ).getUserFunds(account, token.address)
    const availableWei = BigInt(funds?.available?.toString() ?? '0')
    escrow = {
      address: escrowAddress,
      jobCostWei: job.costWei,
      availableWei,
      depositWei: job.costWei > availableWei ? job.costWei - availableWei : ZERO
    }
  }
  const totalWei = ordersWei + (escrow?.depositWei ?? ZERO)
  const spendWei = ordersWei + (escrow?.jobCostWei ?? ZERO)
  const amount = (wei: bigint) =>
    `${formatTokenAmount(wei, token.decimals)} ${token.symbol}`

  const cap = getSpendingCap()
  if (!cap) {
    problems.push(
      'paying from the chat is turned off in this market: buy it on the asset page'
    )
  } else if (spendWei > toWei(cap, token.decimals)) {
    problems.push(
      `it costs ${amount(spendWei)}, above the chat limit of ${amount(
        toWei(cap, token.decimals)
      )}: buy it on the asset page`
    )
  }

  const balance = await getTokenBalance(
    account,
    token.decimals,
    token.address,
    signer.provider
  )
  const balanceWei = toWei(balance || '0', token.decimals)
  if (balanceWei < totalWei) {
    problems.push(
      `you need ${amount(totalWei - balanceWei)} more in your wallet`
    )
  }

  const transactions =
    assets.reduce((sum, asset) => sum + transactionsFor(asset), 0) +
    (escrow ? (escrow.depositWei > ZERO ? 2 : 0) + 1 : 0)
  return { token, ordersWei, escrow, totalWei, transactions }
}

/**
 * Loads one asset of the intent from the market's own sources: the metadata
 * cache for the DDO and the chain for the price. Nothing in the intent is
 * trusted beyond the DID and service to look up.
 */
async function loadAsset(
  ref: IntentAssetRef,
  chainId: number,
  account: string,
  type: 'dataset' | 'algorithm',
  serviceType: string | undefined,
  cancelToken: CancelToken
): Promise<VerifiedAsset | Problem> {
  const asset: AssetExtended = await getAsset(ref.did, cancelToken)
  if (!asset) return { problem: `${ref.name ?? ref.did} was not found` }

  const name = asset.credentialSubject?.metadata?.name ?? ref.did
  if (asset.credentialSubject?.chainId !== chainId) {
    return { problem: `${name} is on another network` }
  }
  if (asset.credentialSubject?.metadata?.type !== type) {
    return {
      problem: `${name} is not ${type === 'algorithm' ? 'an' : 'a'} ${type}`
    }
  }
  const services = asset.credentialSubject?.services ?? []
  const serviceIndex = services.findIndex((s) => s.id === ref.serviceId)
  const service = services[serviceIndex]
  if (!service || (serviceType && service.type !== serviceType)) {
    return { problem: `${name} has no such ${serviceType ?? ''} service` }
  }
  const state = asset.indexedMetadata?.nft?.state ?? 0
  if (!CONSUMABLE_STATES.includes(state)) {
    return { problem: `${name} cannot be consumed right now` }
  }
  if (isSsiPolicyConsumptionDisabled(asset, appConfig.ssiEnabled, service)) {
    return { problem: `${name} asks for credentials this market cannot check` }
  }

  const accessDetails = await getAccessDetails(
    chainId,
    service,
    account,
    cancelToken
  )
  const priceProblem = checkPrice(name, accessDetails, ref.price)
  if (priceProblem) return { problem: priceProblem }

  const isPSConfigured = await getIsPolicyServerConfigured(
    service.serviceEndpoint
  )
  if (isPolicyServerConsumptionDisabled(appConfig.ssiEnabled, isPSConfigured)) {
    return { problem: `${name} is served by a node this market cannot use` }
  }

  return {
    asset: {
      ...asset,
      accessDetails: services.map((_, index) =>
        index === serviceIndex ? accessDetails : undefined
      )
    },
    service,
    serviceIndex,
    accessDetails,
    name,
    requiresSsi:
      requiresSsi(asset.credentialSubject?.credentials) ||
      requiresSsi(service.credentials),
    needsSession: requiresPolicyServerCredentialCheck(
      appConfig.ssiEnabled,
      isPSConfigured
    )
  }
}

function withParameters(
  verified: VerifiedAsset,
  declared: unknown,
  given: IntentParameters | undefined,
  problems: string[]
): VerifiedAsset {
  const { values, error } = resolveConsumerParameters(
    declaredParameters(declared),
    given,
    verified.name
  )
  if (error) problems.push(error)
  return { ...verified, parameters: values }
}

/**
 * The resources, duration and cost of a job in the paid environment. The cost
 * is computed as the market's compute wizard does: the price per minute of
 * each resource, times the amount, times the minutes. It may not be above the
 * estimate the user was told.
 */
async function planPaidJob(
  intent: ComputeIntent,
  environment: ComputeEnvironment,
  problems: string[]
): Promise<
  | {
      resources: ResourceType
      maxJobDurationSeconds: number
      token: PaymentToken
      costWei: bigint
      /** The fee token exactly as the environment lists it. */
      feeToken: string
    }
  | undefined
> {
  const { chainId } = intent
  const { paymentToken, requested, estimatedCost } = intent.environment
  const fee = environment.fees?.[String(chainId)]?.find((f) =>
    sameAddress(f.feeToken, paymentToken)
  )
  if (!fee) {
    problems.push('The paid environment does not take that token')
    return undefined
  }

  const minutes = Math.ceil(
    (intent.environment.maxJobDurationSeconds ?? 0) / 60
  )
  if (
    minutes < 1 ||
    (environment.maxJobDuration && minutes * 60 > environment.maxJobDuration)
  ) {
    problems.push('The job duration is outside the limits of the environment')
  }

  const resources: ResourceType = {
    ...createDefaultComputeResourceValues(environment, 'paid', true),
    jobDuration: minutes
  }
  for (const { id, amount } of requested ?? []) {
    const resource = environment.resources?.find((res) => res.id === id)
    const max = resource?.max ?? resource?.total ?? 0
    if (!resource || amount < (resource.min ?? 0) || amount > max) {
      problems.push(`The paid environment cannot give ${amount} ${id}`)
      continue
    }
    resources[id] = amount
  }

  const token = await getTokenInfo(
    paymentToken,
    (
      await getDummySigner(chainId)
    ).provider
  )
  const decimals = token.decimals ?? 18
  const MILLI = BigInt(1000)
  const costWei = (fee.prices ?? []).reduce((sum, { id, price }) => {
    const units = Number(resources[id] ?? 0)
    return (
      sum +
      (toWei(price, decimals) *
        BigInt(Math.round(units * 1000)) *
        BigInt(minutes)) /
        MILLI
    )
  }, ZERO)
  if (costWei > toWei(estimatedCost?.amount, decimals)) {
    problems.push(
      'The price of the compute environment changed since it was prepared: ask again'
    )
  }
  return {
    resources: { ...resources, price: formatUnits(costWei, decimals) },
    maxJobDurationSeconds: minutes * 60,
    token: {
      address: paymentToken,
      symbol: token.symbol ?? estimatedCost?.tokenSymbol ?? '',
      decimals
    },
    costWei,
    // The node compares the token as text: it refuses the checksummed
    // address when its environment lists it in lower case.
    feeToken: fee.feeToken
  }
}

export async function verifyComputeIntent(
  intent: ComputeIntent,
  account: string,
  cancelToken: CancelToken
): Promise<Verification<VerifiedCompute>> {
  const [dataset, algorithm] = await Promise.all([
    loadAsset(
      intent.dataset,
      intent.chainId,
      account,
      'dataset',
      'compute',
      cancelToken
    ),
    loadAsset(
      intent.algorithm,
      intent.chainId,
      account,
      'algorithm',
      undefined,
      cancelToken
    )
  ])
  const problems = [dataset, algorithm].filter(isProblem).map((p) => p.problem)
  if (isProblem(dataset) || isProblem(algorithm)) return { problems }

  if (dataset.service.serviceEndpoint !== algorithm.service.serviceEndpoint) {
    problems.push('The dataset and the algorithm are served by different nodes')
  }

  const environments =
    (await getComputeEnvironments(
      dataset.service.serviceEndpoint,
      intent.chainId
    )) ?? []
  const environment = environments.find(
    (env) => env.id === intent.environment.id
  )
  const isFree = intent.environment.free
  if (isFree ? !environment?.free : !environment) {
    problems.push(
      `The ${isFree ? 'free' : 'paid'} compute environment is not available`
    )
    return { problems }
  }

  let resources: ResourceType
  let maxJobDurationSeconds: number
  let job: { token: PaymentToken; costWei: bigint } | undefined
  let paymentToken = environment.fees?.[String(intent.chainId)]?.[0]?.feeToken
  if (isFree) {
    const limit = environment.free.maxJobDuration
    maxJobDurationSeconds = intent.environment.maxJobDurationSeconds ?? limit
    if (!maxJobDurationSeconds || (limit && maxJobDurationSeconds > limit)) {
      problems.push('The job duration is above the free limit')
    }
    resources = {
      ...createDefaultComputeResourceValues(environment, 'free', true),
      jobDuration: Math.max(1, Math.floor(maxJobDurationSeconds / 60))
    }
  } else {
    const paidJob = await planPaidJob(intent, environment, problems)
    if (!paidJob) return { problems }
    ;({ resources, maxJobDurationSeconds } = paidJob)
    job = { token: paidJob.token, costWei: paidJob.costWei }
    paymentToken = paidJob.feeToken
  }

  // The paid environment checks an order for every asset. The free one checks
  // none, but paid assets are bought anyway, as the market's wizard does.
  const priced = await Promise.all(
    [dataset, algorithm].map((asset) =>
      !isFree || asset.accessDetails.type !== 'free'
        ? priceOrder(asset, account)
        : asset
    )
  )
  const [pricedDataset, pricedAlgorithm] = priced
  problems.push(...priced.filter(isProblem).map((p) => p.problem))
  if (isProblem(pricedDataset) || isProblem(pricedAlgorithm)) {
    return { problems }
  }
  const payment = await planPayment(
    account,
    intent.chainId,
    [pricedDataset, pricedAlgorithm],
    job,
    problems
  )

  const algorithmMetadata =
    algorithm.asset.credentialSubject?.metadata?.algorithm
  const plan: VerifiedCompute = {
    kind: 'compute',
    mode: isFree ? 'free' : 'paid',
    dataset: withParameters(
      pricedDataset,
      dataset.service.consumerParameters,
      intent.dataset.parameters,
      problems
    ),
    algorithm: withParameters(
      pricedAlgorithm,
      mergeConsumerParameters(
        algorithmMetadata?.consumerParameters as { name?: unknown }[],
        algorithm.service.consumerParameters as { name?: unknown }[]
      ),
      intent.algorithm.parameters,
      problems
    ),
    environment,
    resources,
    maxJobDurationSeconds,
    paymentToken,
    payment
  }
  return problems.length ? { problems } : { plan }
}

export async function verifyDownloadIntent(
  intent: DownloadIntent,
  account: string,
  cancelToken: CancelToken
): Promise<Verification<VerifiedDownload>> {
  const loaded = await loadAsset(
    intent.asset,
    intent.chainId,
    account,
    'dataset',
    'access',
    cancelToken
  )
  if (isProblem(loaded)) return { problems: [loaded.problem] }

  const problems: string[] = []
  if (
    loaded.service.datatokenAddress?.toLowerCase() !==
    intent.datatokenAddress.toLowerCase()
  ) {
    problems.push(`${loaded.name} has a different datatoken`)
  }
  const withValues = withParameters(
    loaded,
    loaded.service.consumerParameters,
    intent.asset.parameters,
    problems
  )

  // Asks the node for its fees, as the market's download button does. A free
  // download may cost gas, never a fee; a paid one costs what the chain says.
  const asset = await priceOrder(withValues, account)
  if (isProblem(asset)) return { problems: [...problems, asset.problem] }
  const payment = await planPayment(
    account,
    intent.chainId,
    [asset],
    undefined,
    problems
  )
  const orderPriceAndFees =
    asset.order?.orderPriceAndFees ??
    ({
      price: '0',
      providerFee: { providerFeeAmount: '0' }
    } as OrderPriceAndFees)
  return problems.length
    ? { problems }
    : { plan: { kind: 'download', asset, orderPriceAndFees, payment } }
}
