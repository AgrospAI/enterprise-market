import { getAddress, isAddress } from 'viem'

/**
 * An action the MCP server prepared for the signed-in user (its `prepare_*`
 * tools). It is only a proposal: the browser checks it again against the node
 * and the chain, and nothing runs until the user confirms and signs.
 *
 * Version 1 only prepares free actions. Version 2 adds the prices the server
 * saw, so the market can also prepare paid ones: the browser compares them
 * with the chain and refuses the action if they changed.
 */
export const CHAT_INTENT_VERSION = 2
export type ChatIntentVersion = 1 | 2

export type IntentParameters = Record<string, string | number | boolean>

/** A price as the MCP server saw it, in token units ("1", "0.5"). */
export interface IntentPrice {
  type: 'free' | 'fixed'
  amount: string
  tokenAddress?: string
  tokenSymbol?: string
}

export interface IntentAssetRef {
  did: string
  serviceId: string
  name?: string
  requiresSsi: boolean
  parameters?: IntentParameters
  /** Version 2 only. Without it, the asset must be free. */
  price?: IntentPrice
}

export interface IntentResource {
  id: string
  type?: string
  total?: number
  min?: number
  max?: number
  inUse?: number
}

export interface IntentResourceRequest {
  id: string
  amount: number
}

export interface ComputeIntent {
  kind: 'compute'
  version: ChatIntentVersion
  chainId: number
  consumerAddress: string
  dataset: IntentAssetRef
  algorithm: IntentAssetRef
  environment: {
    id: string
    /** Version 1 is always free. */
    free: boolean
    maxJobDurationSeconds?: number
    resources: IntentResource[]
    /** Paid environment only: what the job asks for. */
    requested?: IntentResourceRequest[]
    paymentToken?: string
    estimatedCost?: { amount: string; tokenSymbol?: string }
  }
}

export interface DownloadIntent {
  kind: 'download'
  version: ChatIntentVersion
  chainId: number
  consumerAddress: string
  asset: IntentAssetRef
  datatokenAddress: string
  timeoutSeconds: number
}

export type ChatIntent = ComputeIntent | DownloadIntent

const DID = /^did:ope:[0-9a-f]{64}$/
const ID = /^[0-9a-zA-Z_.:-]{1,300}$/
const MAX_NAME = 300
const MAX_PARAMETERS = 50
const MAX_PARAMETER_NAME = 128
const MAX_PARAMETER_VALUE = 10_000
const MAX_RESOURCES = 20
const MAX_SYMBOL = 20
const AMOUNT = /^\d{1,30}(\.\d{1,18})?$/

type Unknown = Record<string, unknown>

const isObject = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isAmount = (value: unknown): value is string =>
  typeof value === 'string' && AMOUNT.test(value)

const isSymbol = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_SYMBOL

const checksum = (value: unknown): string | undefined =>
  typeof value === 'string' && isAddress(value, { strict: false })
    ? getAddress(value)
    : undefined

function parsePrice(value: unknown): IntentPrice | undefined {
  if (!isObject(value)) return undefined
  const { type, amount, tokenSymbol } = value
  const tokenAddress = checksum(value.tokenAddress)
  if (
    (type !== 'free' && type !== 'fixed') ||
    !isAmount(amount) ||
    (value.tokenAddress !== undefined && !tokenAddress) ||
    (type === 'fixed' && !tokenAddress) ||
    (tokenSymbol !== undefined && !isSymbol(tokenSymbol))
  ) {
    return undefined
  }
  return {
    type,
    amount,
    ...(tokenAddress ? { tokenAddress } : {}),
    ...(tokenSymbol ? { tokenSymbol: tokenSymbol as string } : {})
  }
}

function parseParameters(value: unknown): IntentParameters | null | undefined {
  if (value === undefined) return undefined
  if (!isObject(value)) return null
  const entries = Object.entries(value)
  if (entries.length > MAX_PARAMETERS) return null
  const parameters: IntentParameters = {}
  for (const [name, parameter] of entries) {
    const isValid =
      name.length <= MAX_PARAMETER_NAME &&
      ((typeof parameter === 'string' &&
        parameter.length <= MAX_PARAMETER_VALUE) ||
        (typeof parameter === 'number' && Number.isFinite(parameter)) ||
        typeof parameter === 'boolean')
    if (!isValid) return null
    parameters[name] = parameter as string | number | boolean
  }
  return parameters
}

function parseAssetRef(
  value: unknown,
  version: ChatIntentVersion
): IntentAssetRef | undefined {
  if (!isObject(value)) return undefined
  const { did, serviceId, name, requiresSsi } = value
  const parameters = parseParameters(value.parameters)
  // Version 1 has no prices: anything there is ignored, and the asset must be
  // free. Version 2 always says what the server saw.
  const price = version === 2 ? parsePrice(value.price) : undefined
  if (version === 2 && !price) return undefined
  if (
    typeof did !== 'string' ||
    !DID.test(did) ||
    typeof serviceId !== 'string' ||
    !ID.test(serviceId) ||
    (name !== undefined &&
      (typeof name !== 'string' || name.length > MAX_NAME)) ||
    typeof requiresSsi !== 'boolean' ||
    parameters === null
  ) {
    return undefined
  }
  return {
    did,
    serviceId,
    ...(name ? { name: name as string } : {}),
    requiresSsi,
    ...(parameters ? { parameters } : {}),
    ...(price ? { price } : {})
  }
}

function parseResource(value: unknown): IntentResource | undefined {
  if (!isObject(value) || typeof value.id !== 'string' || !ID.test(value.id)) {
    return undefined
  }
  const resource: IntentResource = { id: value.id }
  if (typeof value.type === 'string') resource.type = value.type.slice(0, 50)
  for (const key of ['total', 'min', 'max', 'inUse'] as const) {
    if (value[key] === undefined) continue
    if (!isCount(value[key])) return undefined
    resource[key] = value[key] as number
  }
  return resource
}

function parseRequest(value: unknown): IntentResourceRequest | undefined {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    !ID.test(value.id) ||
    !isCount(value.amount) ||
    value.amount <= 0
  ) {
    return undefined
  }
  return { id: value.id, amount: value.amount }
}

function parseCommon(value: Unknown) {
  const { version, chainId, consumerAddress } = value
  if (
    (version !== 1 && version !== 2) ||
    !Number.isSafeInteger(chainId) ||
    (chainId as number) <= 0 ||
    typeof consumerAddress !== 'string' ||
    !isAddress(consumerAddress, { strict: false })
  ) {
    return undefined
  }
  return {
    version: version as ChatIntentVersion,
    chainId: chainId as number,
    consumerAddress: getAddress(consumerAddress)
  }
}

function parsePaidEnvironment(env: Unknown) {
  const { requested, estimatedCost } = env
  const paymentToken = checksum(env.paymentToken)
  if (
    !Array.isArray(requested) ||
    requested.length === 0 ||
    requested.length > MAX_RESOURCES ||
    !paymentToken ||
    !isObject(estimatedCost) ||
    !isAmount(estimatedCost.amount) ||
    (estimatedCost.tokenSymbol !== undefined &&
      !isSymbol(estimatedCost.tokenSymbol))
  ) {
    return undefined
  }
  const requests = requested.map(parseRequest)
  if (requests.some((request) => !request)) return undefined
  return {
    requested: requests,
    paymentToken,
    estimatedCost: {
      amount: estimatedCost.amount,
      ...(estimatedCost.tokenSymbol
        ? { tokenSymbol: estimatedCost.tokenSymbol as string }
        : {})
    }
  }
}

function parseCompute(value: Unknown): ComputeIntent | undefined {
  const common = parseCommon(value)
  if (!common) return undefined
  const dataset = parseAssetRef(value.dataset, common.version)
  const algorithm = parseAssetRef(value.algorithm, common.version)
  const env = value.environment
  if (!dataset || !algorithm || !isObject(env)) return undefined
  // Only version 2 can run in the paid environment.
  const isFree = env.free === true
  const paid =
    !isFree && env.free === false && common.version === 2
      ? parsePaidEnvironment(env)
      : undefined
  if (
    typeof env.id !== 'string' ||
    !ID.test(env.id) ||
    (!isFree && !paid) ||
    (isFree &&
      (env.requested !== undefined ||
        env.paymentToken !== undefined ||
        env.estimatedCost !== undefined)) ||
    (env.maxJobDurationSeconds !== undefined &&
      !isCount(env.maxJobDurationSeconds)) ||
    !Array.isArray(env.resources) ||
    env.resources.length > MAX_RESOURCES
  ) {
    return undefined
  }
  const resources = env.resources.map(parseResource)
  if (resources.some((resource) => !resource)) return undefined

  return {
    kind: 'compute',
    ...common,
    dataset,
    algorithm,
    environment: {
      id: env.id,
      free: isFree,
      ...(env.maxJobDurationSeconds !== undefined
        ? { maxJobDurationSeconds: env.maxJobDurationSeconds as number }
        : {}),
      resources,
      ...(paid ?? {})
    }
  }
}

function parseDownload(value: Unknown): DownloadIntent | undefined {
  const common = parseCommon(value)
  if (!common) return undefined
  const asset = parseAssetRef(value.asset, common.version)
  const { datatokenAddress, timeoutSeconds } = value
  if (
    !asset ||
    typeof datatokenAddress !== 'string' ||
    !isAddress(datatokenAddress, { strict: false }) ||
    !isCount(timeoutSeconds)
  ) {
    return undefined
  }
  return {
    kind: 'download',
    ...common,
    asset,
    datatokenAddress: getAddress(datatokenAddress),
    timeoutSeconds
  }
}

/**
 * Validates an intent and copies only the fields the market knows. Anything
 * unexpected, including an unknown version, gives `undefined`.
 */
export function parseChatIntent(value: unknown): ChatIntent | undefined {
  if (!isObject(value)) return undefined
  if (value.kind === 'compute') return parseCompute(value)
  if (value.kind === 'download') return parseDownload(value)
  return undefined
}
