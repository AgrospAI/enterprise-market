// https://data.agroportal.eu/documentation

export interface AgroPortalSearchResult {
  page: number
  pageCount: number
  totalCount: number
  prevPage: number | null
  nextPage: number | null
  links: {
    nextPage: string | null
    prevPage: string | null
  }
  collection: AgroPortalClass[]
}

export interface AgroPortalClass {
  prefLabel: string
  synonym?: string[]
  definition?: string[]
  obsolete: boolean
  matchType: string
  ontologyType: string
  '@id': string
  '@type': string
  links: {
    self: string
    ontology: string
    children: string
    parents: string
    descendants: string
    ancestors: string
    instances: string
    tree: string
    notes: string
    mappings: string
    ui: string
  }
}

// Stored in metadata.additionalInformation['dcat:theme']
export type OntologyTerm = {
  '@id': string
  '@type': string
  'skos:prefLabel': {
    '@value': string
    '@language': string
  }
  'skos:inScheme': {
    '@id': string
    'rdfs:label': string
  }
  'dct:source': {
    '@id': string
  }
}
