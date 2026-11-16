import { contentPagesPrivacyPolicies as privacyContent } from '../i18n/content'

export interface UsePrivacyMetadata {
  policies: {
    policy: string
    language: string
    date: string
    params: {
      languageLabel: string
      updated: string
      dateFormat: string
    }
  }[]
}

export function usePrivacyMetadata(): UsePrivacyMetadata {
  return { ...privacyContent }
}
