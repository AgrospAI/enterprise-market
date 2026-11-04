import {
  boundsToWkt,
  emptyGeoMetadata,
  parseGeoMetadata,
  transformGeoMetadata,
  wktToBounds
} from './dcat'
import { validationGeoMetadata } from './yup'

const lleida: [[number, number], [number, number]] = [
  [41.5, 0.5],
  [41.7, 0.7]
]

describe('WKT bounding boxes', () => {
  it('writes a closed polygon in lng lat order', () => {
    expect(boundsToWkt(lleida)).toBe(
      'POLYGON((0.5 41.5,0.7 41.5,0.7 41.7,0.5 41.7,0.5 41.5))'
    )
  })

  it('round-trips bounds through WKT', () => {
    expect(wktToBounds(boundsToWkt(lleida))).toEqual(lleida)
  })

  it('reads the envelope of hand-written polygons', () => {
    expect(
      wktToBounds('polygon (( 0.7 41.5, 0.5 41.7, 0.6 41.6, 0.7 41.5 ))')
    ).toEqual(lleida)
  })

  it('rejects empty or malformed WKT', () => {
    expect(wktToBounds('')).toBeNull()
    expect(wktToBounds(undefined)).toBeNull()
    expect(wktToBounds('POINT(0 0)')).toBeNull()
    expect(wktToBounds('POLYGON((a b,c d,e f))')).toBeNull()
  })
})

describe('transformGeoMetadata', () => {
  it('returns only undefined keys for an empty form', () => {
    const result = transformGeoMetadata(emptyGeoMetadata)
    expect(JSON.parse(JSON.stringify(result))).toEqual({})
    expect(Object.keys(result)).toEqual([
      '@context',
      'dct:spatial',
      'dct:temporal'
    ])
  })

  it('maps the form to DCAT spatial and temporal coverage', () => {
    const wkt = boundsToWkt(lleida)
    const result = transformGeoMetadata({
      boundingBox: { wkt, label: '  Lleida, Spain ' },
      temporalCoverage: { startDate: '2024-01-01', endDate: '2024-12-31' }
    })

    expect(result['@context']).toMatchObject({
      dcat: 'http://www.w3.org/ns/dcat#',
      geo: 'http://www.opengis.net/ont/geosparql#'
    })
    expect(result['dct:spatial']).toEqual({
      '@type': ['dct:Location', 'skos:Concept'],
      'dcat:bbox': { '@type': 'geo:wktLiteral', '@value': wkt },
      'skos:prefLabel': 'Lleida, Spain'
    })
    expect(result['dct:temporal']).toEqual({
      '@type': 'dct:PeriodOfTime',
      'dcat:startDate': { '@type': 'xsd:date', '@value': '2024-01-01' },
      'dcat:endDate': { '@type': 'xsd:date', '@value': '2024-12-31' }
    })
  })

  it('drops a location name without a bounding box', () => {
    const result = transformGeoMetadata({
      boundingBox: { wkt: '', label: 'Lleida' },
      temporalCoverage: { startDate: '2024-01-01' }
    })
    expect(result['dct:spatial']).toBeUndefined()
    expect(result['dct:temporal']).toEqual({
      '@type': 'dct:PeriodOfTime',
      'dcat:startDate': { '@type': 'xsd:date', '@value': '2024-01-01' }
    })
  })

  it('clears stale coverage when spread over existing information', () => {
    const existing = {
      termsAndConditions: true,
      ...transformGeoMetadata({
        boundingBox: { wkt: boundsToWkt(lleida) },
        temporalCoverage: { startDate: '2024-01-01' }
      })
    }
    const updated = JSON.parse(
      JSON.stringify({
        ...existing,
        ...transformGeoMetadata(emptyGeoMetadata)
      })
    )
    expect(updated).toEqual({ termsAndConditions: true })
  })
})

describe('parseGeoMetadata', () => {
  it('reverses transformGeoMetadata', () => {
    const form = {
      boundingBox: { wkt: boundsToWkt(lleida), label: 'Lleida' },
      temporalCoverage: { startDate: '2024-01-01', endDate: '2024-12-31' }
    }
    expect(parseGeoMetadata(transformGeoMetadata(form))).toEqual(form)
  })

  it('returns empty values for assets without coverage', () => {
    expect(parseGeoMetadata(undefined)).toEqual(emptyGeoMetadata)
    expect(parseGeoMetadata({ termsAndConditions: true })).toEqual(
      emptyGeoMetadata
    )
  })
})

describe('validationGeoMetadata', () => {
  const withDates = (startDate: string, endDate: string) => ({
    boundingBox: { wkt: '', label: '' },
    temporalCoverage: { startDate, endDate }
  })

  it('accepts empty, open-ended and ordered periods', async () => {
    await expect(
      validationGeoMetadata.isValid(withDates('', ''))
    ).resolves.toBe(true)
    await expect(
      validationGeoMetadata.isValid(withDates('2024-01-01', ''))
    ).resolves.toBe(true)
    await expect(
      validationGeoMetadata.isValid(withDates('2024-01-01', '2024-01-01'))
    ).resolves.toBe(true)
  })

  it('rejects a period that ends before it starts', async () => {
    await expect(
      validationGeoMetadata.isValid(withDates('2024-02-01', '2024-01-31'))
    ).resolves.toBe(false)
  })
})
