import type {
  AdditionalInformation,
  DcatSpatial,
  DcatTemporal
} from 'src/@types/ddo/Metadata'

export interface FormGeoMetadata {
  boundingBox: {
    wkt: string
    label?: string
  }
  temporalCoverage: {
    startDate?: string
    endDate?: string
  }
}

// [[south, west], [north, east]], the order Leaflet expects for bounds
export type LatLngBoundsTuple = [[number, number], [number, number]]

export const emptyGeoMetadata: FormGeoMetadata = {
  boundingBox: { wkt: '', label: '' },
  temporalCoverage: { startDate: '', endDate: '' }
}

const geoContext = {
  dcat: 'http://www.w3.org/ns/dcat#',
  dct: 'http://purl.org/dc/terms/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  geo: 'http://www.opengis.net/ont/geosparql#',
  xsd: 'http://www.w3.org/2001/XMLSchema#'
}

export function boundsToWkt([[south, west], [north, east]]: LatLngBoundsTuple) {
  return `POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`
}

// Envelope of any WKT polygon, so hand-edited DDOs still render
export function wktToBounds(wkt?: string): LatLngBoundsTuple | null {
  const coordinates = wkt?.match(/POLYGON\s*\(\(([^)]+)\)\)/i)?.[1]
  if (!coordinates) return null

  const points = coordinates
    .split(',')
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
  if (points.length < 3) return null

  const lngs = points.map(([lng]) => lng)
  const lats = points.map(([, lat]) => lat)
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ]
}

// Geographic form fields as DCAT JSON-LD, stored at the root of
// `metadata.additionalInformation`. Every key is always returned so that
// spreading the result over existing additionalInformation clears removed
// values (undefined is dropped when the DDO is serialized).
export function transformGeoMetadata(geoMetadata?: FormGeoMetadata): Pick<
  AdditionalInformation,
  'dct:spatial' | 'dct:temporal'
> & {
  '@context'?: typeof geoContext
} {
  const wkt = geoMetadata?.boundingBox?.wkt
  const label = geoMetadata?.boundingBox?.label?.trim()
  const { startDate, endDate } = geoMetadata?.temporalCoverage || {}

  const spatial: DcatSpatial = wkt
    ? {
        '@type': ['dct:Location', 'skos:Concept'],
        'dcat:bbox': { '@type': 'geo:wktLiteral', '@value': wkt },
        ...(label && { 'skos:prefLabel': label })
      }
    : undefined

  const temporal: DcatTemporal =
    startDate || endDate
      ? {
          '@type': 'dct:PeriodOfTime',
          ...(startDate && {
            'dcat:startDate': { '@type': 'xsd:date', '@value': startDate }
          }),
          ...(endDate && {
            'dcat:endDate': { '@type': 'xsd:date', '@value': endDate }
          })
        }
      : undefined

  return {
    '@context': spatial || temporal ? geoContext : undefined,
    'dct:spatial': spatial,
    'dct:temporal': temporal
  }
}

export function parseGeoMetadata(
  additionalInformation?: AdditionalInformation
): FormGeoMetadata {
  const spatial = additionalInformation?.['dct:spatial']
  const temporal = additionalInformation?.['dct:temporal']

  return {
    boundingBox: {
      wkt: spatial?.['dcat:bbox']?.['@value'] || '',
      label: spatial?.['skos:prefLabel'] || ''
    },
    temporalCoverage: {
      startDate: temporal?.['dcat:startDate']?.['@value'] || '',
      endDate: temporal?.['dcat:endDate']?.['@value'] || ''
    }
  }
}
