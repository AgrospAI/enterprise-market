import { i18n } from '../i18n/index'
import { contentGdpr as gdprContent } from '../i18n/content'
import { useMemo } from 'react'
import {
  ANALYTICS_CONSENT_COOKIE,
  isAnalyticsConfigured
} from '@utils/analytics'

export interface UseGdprMetadata {
  title: string
  text: string
  analyticsText?: string
  accept: string
  reject: string
  close: string
  save?: string
  configure: string
  manageIntro?: string
  essential?: {
    title: string
    desc: string
  }
  placeholder?: string
  optionalCookies?: {
    title: string
    desc: string
    cookieName: string
  }[]
}

export function useGdprMetadata(): UseGdprMetadata {
  const analyticsConfigured = isAnalyticsConfigured()
  const optionalCookies = useMemo(
    () =>
      (gdprContent.optionalCookies || []).filter(
        (cookie) =>
          cookie.cookieName !== ANALYTICS_CONSENT_COOKIE || analyticsConfigured
      ),
    [analyticsConfigured, i18n.locale]
  )

  return { ...gdprContent, optionalCookies }
}
