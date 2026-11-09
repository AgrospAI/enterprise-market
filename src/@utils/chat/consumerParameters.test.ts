import {
  declaredParameters,
  resolveConsumerParameters
} from './consumerParameters'

const declared = declaredParameters([
  { name: 'lookbackDays', type: 'number', required: true, default: 60 },
  {
    name: 'index',
    type: 'select',
    options: [{ ndvi: 'NDVI' }, { ndwi: 'NDWI' }]
  },
  { name: 'clip', type: 'boolean', required: 'true', default: 'false' },
  { name: 'note', type: 'text' },
  { notAName: true },
  'nonsense'
])

describe('consumer parameters', () => {
  it('reads the declared parameters of a DDO', () => {
    expect(declared.map((param) => param.name)).toEqual([
      'lookbackDays',
      'index',
      'clip',
      'note'
    ])
    expect(declared[1].choices).toEqual(['ndvi', 'ndwi'])
    expect(declared[2].required).toBe(true)
  })

  it('fills defaults and coerces values', () => {
    expect(
      resolveConsumerParameters(
        declared,
        { lookbackDays: '45', index: 'ndwi' },
        'Clip Raster'
      )
    ).toEqual({ values: { lookbackDays: 45, index: 'ndwi', clip: false } })
  })

  it.each([
    [{ unknown: 1 }, 'does not accept: unknown'],
    [{ lookbackDays: 'many' }, 'invalid value for "lookbackDays"'],
    [{ index: 'evi' }, 'invalid value for "index"'],
    [{ clip: 'yes' }, 'invalid value for "clip"']
  ])('refuses %p', (given, message) => {
    expect(
      resolveConsumerParameters(declared, given, 'Clip Raster').error
    ).toContain(message)
  })

  it('refuses a missing required value without default', () => {
    const required = declaredParameters([{ name: 'parcel', required: true }])
    expect(resolveConsumerParameters(required, {}, 'SIGPAC').error).toBe(
      'SIGPAC needs a value for "parcel"'
    )
  })

  it('accepts no values when nothing is declared', () => {
    expect(resolveConsumerParameters([], undefined, 'x')).toEqual({})
    expect(resolveConsumerParameters([], { a: 1 }, 'x').error).toContain(
      'does not accept'
    )
  })
})
