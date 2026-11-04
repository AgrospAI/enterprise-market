import { LanguageValueObject } from './LanguageValueObject'
import { License } from './License'
import { RemoteObject } from './RemoteObject'
import { Option } from './Option'
import type { OntologyTerm } from '../AgroPortal'

interface Container {
  entrypoint: string
  image: string
  tag: string
  checksum: string
}

export interface Algorithm {
  container: Container
  language?: string
  version?: string
  consumerParameters?: Record<string, string | number | boolean | Option[]>[]
}

// JSON-compatible values, since additionalInformation is deserialized JSON
export type AdditionalInformationValue =
  | string
  | number
  | boolean
  | AdditionalInformationValue[]
  | { [key: string]: AdditionalInformationValue }

// type alias (not interface) so it satisfies the index signature below
export type SaasMetadata = {
  redirectUrl: string
  paymentMode: 'Subscription'
}

export interface AdditionalInformation {
  termsAndConditions?: boolean
  saas?: SaasMetadata
  'dcat:theme'?: OntologyTerm[]
  [key: string]: AdditionalInformationValue | undefined
}

export interface Metadata {
  created: string
  updated: string
  description: LanguageValueObject
  copyrightHolder: string
  name: string
  // symbol: string;
  displayTitle?: LanguageValueObject
  type: string
  author?: string
  providedBy: string
  license?: License
  links?: Record<string, string>
  attachments?: RemoteObject[]
  tags?: string[]
  categories?: string[]
  additionalInformation?: AdditionalInformation
  // Required if asset type is algorithm
  algorithm?: Algorithm
}
