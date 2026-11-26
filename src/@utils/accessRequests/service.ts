import {
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  toUtf8Bytes,
  ZeroAddress
} from 'ethers'
import { Asset } from 'src/@types/Asset'
import { AccessRequest } from 'src/@types/AccessRequest'
import { Compute, Service } from 'src/@types/ddo/Service'

/** Values captured when the request is submitted; never recomputed from defaults. */
export interface ServiceTerms {
  name: string
  description?: string
  /** Omitted by legacy requests, which inherit the base service type. */
  type?: 'access' | 'compute'
  price: string
  baseToken: string
  timeout: number
  compute?: Compute
}

export function validateServiceTerms(
  value: unknown,
  source: Service
): ServiceTerms {
  const terms = value as ServiceTerms
  if (
    !terms ||
    typeof terms.name !== 'string' ||
    !terms.name.trim() ||
    terms.name.length > 128
  )
    throw new Error('Enter a service name (maximum 128 characters).')
  if (terms.description !== undefined && typeof terms.description !== 'string')
    throw new Error('Enter a valid service description.')
  if (
    typeof terms.price !== 'string' ||
    terms.price.length > 80 ||
    // Bounded input; decimal syntax is checked before parsing token units.
    // eslint-disable-next-line security/detect-unsafe-regex
    !/^\d+(\.\d{1,18})?$/.test(terms.price) ||
    parseUnits(terms.price, 18) > parseUnits('1000000', 18)
  )
    throw new Error(
      'Enter a price between 0 and 1000000 with at most 18 decimals.'
    )
  if (!isAddress(terms.baseToken) || terms.baseToken === ZeroAddress)
    throw new Error('The service needs a configured price token.')
  if (
    !Number.isSafeInteger(terms.timeout) ||
    terms.timeout < 0 ||
    terms.timeout > 2147483647
  )
    throw new Error(
      'Access duration must be a whole number of seconds (0 means unlimited).'
    )
  const type = terms.type ?? source.type
  if (type !== 'access' && type !== 'compute')
    throw new Error('Select compute or download access.')
  let compute: Compute
  if (type === 'compute') {
    const c = terms.compute
    if (
      !c ||
      typeof c.allowNetworkAccess !== 'boolean' ||
      typeof c.allowRawAlgorithm !== 'boolean' ||
      !Array.isArray(c.publisherTrustedAlgorithmPublishers) ||
      !Array.isArray(c.publisherTrustedAlgorithms) ||
      c.publisherTrustedAlgorithmPublishers.length > 50 ||
      c.publisherTrustedAlgorithms.length > 50 ||
      c.publisherTrustedAlgorithmPublishers.some(
        (a) => a !== '*' && (!isAddress(a) || a === ZeroAddress)
      ) ||
      c.publisherTrustedAlgorithms.some(
        (a) =>
          !a ||
          typeof a.did !== 'string' ||
          !(a.did.startsWith('did:') || a.did === '*') ||
          typeof a.serviceId !== 'string' ||
          !a.serviceId ||
          typeof a.filesChecksum !== 'string' ||
          !a.filesChecksum ||
          typeof a.containerSectionChecksum !== 'string' ||
          !a.containerSectionChecksum
      )
    )
      throw new Error('Invalid compute settings or trusted algorithms.')
    if (
      c.allowAllPublishedAlgorithms !== undefined &&
      typeof c.allowAllPublishedAlgorithms !== 'boolean'
    )
      throw new Error('Invalid algorithm policy.')
    // Raw algorithm execution is inherited, not a requestable field.
    if (c.allowRawAlgorithm !== (source.compute?.allowRawAlgorithm ?? false))
      throw new Error('Raw algorithm settings must match the source service.')
    compute = {
      ...JSON.parse(JSON.stringify(source.compute || {})),
      allowRawAlgorithm: source.compute?.allowRawAlgorithm ?? false,
      allowNetworkAccess: c.allowNetworkAccess,
      publisherTrustedAlgorithms: JSON.parse(
        JSON.stringify(c.publisherTrustedAlgorithms)
      ),
      publisherTrustedAlgorithmPublishers: [
        ...c.publisherTrustedAlgorithmPublishers
      ],
      ...(c.allowAllPublishedAlgorithms !== undefined && {
        allowAllPublishedAlgorithms: c.allowAllPublishedAlgorithms
      })
    }
  } else if (terms.compute !== undefined)
    throw new Error('Compute options only apply to compute services.')
  return {
    name: terms.name.trim(),
    ...(terms.description !== undefined && { description: terms.description }),
    ...(terms.type !== undefined && { type }),
    price: terms.price,
    baseToken: getAddress(terms.baseToken),
    timeout: terms.timeout,
    ...(compute && { compute })
  }
}

export function requestedServiceId(
  registry: string,
  request: AccessRequest
): string {
  return keccak256(
    toUtf8Bytes(`${registry.toLowerCase()}:${request.id.toString()}`)
  ).slice(2)
}

/** Append a deep clone. Existing services and inherited credentials stay intact. */
export function createRequestedService(
  asset: Asset,
  request: AccessRequest,
  registry: string,
  datatokenAddress?: string
) {
  const source = asset.credentialSubject.services.find(
    (s) => s.id === request.datasetServiceId
  )
  if (!source) throw new Error('The original service is unavailable.')
  const terms = validateServiceTerms(
    JSON.parse(request.serviceTerms || 'null'),
    source
  )
  const id = requestedServiceId(registry, request)
  const existing = asset.credentialSubject.services.find((s) => s.id === id)
  const service: Service = {
    ...JSON.parse(JSON.stringify(source)),
    id,
    type: terms.type ?? source.type,
    credentials: {
      ...JSON.parse(JSON.stringify(source.credentials || {})),
      match_allow: 'all',
      allow: [
        ...(source.credentials?.allow || []).filter(
          (rule) => rule.type !== 'address'
        ),
        { type: 'address', values: [{ address: request.requester }] }
      ]
    },
    name: terms.name,
    ...(terms.description !== undefined && {
      description: {
        '@language': 'en',
        '@direction': 'ltr',
        ...source.description,
        '@value': terms.description
      }
    }),
    ...(source.displayName && {
      displayName: { ...source.displayName, '@value': terms.name }
    }),
    timeout: terms.timeout,
    datatokenAddress: datatokenAddress || existing?.datatokenAddress || '',
    ...(terms.compute && { compute: terms.compute })
  }
  // Price is supplied by a new on-chain exchange/dispenser, never metadata alone.
  if (service.type !== 'compute') delete service.compute
  delete service.price
  const copy: Asset = JSON.parse(JSON.stringify(asset))
  if (!existing && datatokenAddress)
    copy.credentialSubject.services.push(service)
  return {
    asset: copy,
    active: !!existing,
    before: source,
    after: service,
    terms
  }
}
