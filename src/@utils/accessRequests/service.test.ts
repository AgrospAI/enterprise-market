import { AccessRequest } from 'src/@types/AccessRequest'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
import {
  createRequestedService,
  ServiceTerms,
  validateServiceTerms
} from './service'

const token = '0x1111111111111111111111111111111111111111'
const source = {
  id: 'source',
  name: 'Original',
  type: 'compute',
  datatokenAddress: token,
  timeout: 3600,
  files: 'encrypted',
  serviceEndpoint: 'https://node.example',
  state: 0,
  credentials: {
    match_deny: 'any',
    allow: [{ type: 'address', values: [{ address: token }] }]
  },
  compute: {
    allowRawAlgorithm: false,
    allowNetworkAccess: false,
    publisherTrustedAlgorithms: [],
    publisherTrustedAlgorithmPublishers: []
  }
} as Service
const terms: ServiceTerms = {
  name: 'Custom',
  price: '2.75',
  baseToken: token,
  timeout: 7200,
  compute: { ...source.compute, allowNetworkAccess: true }
}
const request = {
  id: 1n,
  requester: '0x3333333333333333333333333333333333333333',
  datasetServiceId: source.id,
  serviceTerms: JSON.stringify(terms)
} as AccessRequest
const asset = { credentialSubject: { services: [source] } } as Asset

it('appends an independent service with inherited files and credentials without mutating its source', () => {
  const before = JSON.stringify(asset)
  const result = createRequestedService(
    asset,
    request,
    token,
    '0x2222222222222222222222222222222222222222'
  )
  expect(JSON.stringify(asset)).toBe(before)
  expect(result.asset.credentialSubject.services).toHaveLength(2)
  expect(result.after).toMatchObject({
    name: 'Custom',
    timeout: 7200,
    files: source.files,
    credentials: {
      match_allow: 'all',
      allow: [{ type: 'address', values: [{ address: request.requester }] }]
    },
    compute: { allowNetworkAccess: true },
    datatokenAddress: '0x2222222222222222222222222222222222222222'
  })
  expect(result.after.id).not.toBe(source.id)
  expect(result.after.credentials).not.toBe(source.credentials)
  expect(createRequestedService(result.asset, request, token).active).toBe(true)
  expect(
    createRequestedService(result.asset, request, token).asset.credentialSubject
      .services
  ).toHaveLength(2)
})

it('uses distinct service IDs for distinct requests and registries', () => {
  const first = createRequestedService(asset, request, token).after.id
  expect(
    createRequestedService(asset, { ...request, id: 2n }, token).after.id
  ).not.toBe(first)
  expect(
    createRequestedService(asset, request, 'another-registry').after.id
  ).not.toBe(first)
})

it.each(['-1', 'NaN', '', '1e3', '1.1234567890123456789', '1000001'])(
  'rejects invalid prices %s',
  (price) => {
    expect(() => validateServiceTerms({ ...terms, price }, source)).toThrow(
      'price'
    )
  }
)

it.each([-1, 0.5, NaN, Infinity, 2147483648])(
  'rejects invalid access duration %s',
  (timeout) => {
    expect(() => validateServiceTerms({ ...terms, timeout }, source)).toThrow(
      'duration'
    )
  }
)

it('supports free unlimited download services and rejects compute changes for them', () => {
  const download = { ...source, type: 'access', compute: undefined }
  const value = { name: 'Download', price: '0', baseToken: token, timeout: 0 }
  expect(validateServiceTerms(value, download)).toEqual(value)
  expect(() => validateServiceTerms(terms, download)).toThrow('Compute options')
})

it('preserves wildcard compute defaults while rejecting malformed publishers and raw execution changes', () => {
  const wildcard = {
    ...terms,
    compute: {
      ...terms.compute,
      publisherTrustedAlgorithmPublishers: ['*'],
      publisherTrustedAlgorithms: [
        {
          did: '*',
          serviceId: '*',
          filesChecksum: '*',
          containerSectionChecksum: '*'
        }
      ]
    }
  }
  expect(validateServiceTerms(wildcard, source)).toEqual(wildcard)
  expect(() =>
    validateServiceTerms(
      {
        ...terms,
        compute: {
          ...terms.compute,
          publisherTrustedAlgorithmPublishers: ['invalid']
        }
      },
      source
    )
  ).toThrow('compute settings')
  expect(() =>
    validateServiceTerms(
      { ...terms, compute: { ...terms.compute, allowRawAlgorithm: true } },
      source
    )
  ).toThrow('Raw algorithm')
})

it.each(['access', 'compute'] as const)(
  'clones either base type into %s access',
  (type) => {
    for (const baseType of ['access', 'compute']) {
      const base = {
        ...source,
        type: baseType,
        compute: baseType === 'compute' ? source.compute : undefined
      }
      const proposal = {
        ...terms,
        type,
        compute: type === 'compute' ? terms.compute : undefined
      }
      const result = createRequestedService(
        { credentialSubject: { services: [base] } } as Asset,
        { ...request, serviceTerms: JSON.stringify(proposal) },
        token
      )
      expect(result.after.type).toBe(type)
      expect(result.after.files).toBe(source.files)
      expect(result.after.compute).toEqual(
        type === 'compute' ? terms.compute : undefined
      )
      expect(result.before.type).toBe(baseType)
    }
  }
)

it('rejects unsupported requested access types', () => {
  expect(() =>
    validateServiceTerms({ ...terms, type: 'invalid' }, source)
  ).toThrow('Select compute or download')
})

it.each(['Updated description', ''])(
  'applies the requested description %j while preserving language metadata',
  (description) => {
    const base = {
      ...source,
      description: {
        '@value': 'Original description',
        '@language': 'es',
        '@direction': 'ltr'
      }
    }
    const value = { ...terms, description }
    expect(validateServiceTerms(value, base).description).toBe(description)
    const result = createRequestedService(
      { credentialSubject: { services: [base] } } as Asset,
      { ...request, serviceTerms: JSON.stringify(value) },
      token
    )
    expect(result.after.description).toEqual({
      ...base.description,
      '@value': description
    })
    expect(base.description['@value']).toBe('Original description')
    expect(
      createRequestedService(
        { credentialSubject: { services: [base] } } as Asset,
        request,
        token
      ).after.description
    ).toEqual(base.description)
  }
)
