import { i18n } from '@lingui/core'
import { messages as en } from '../locales/en/messages'
import { messages as es } from '../locales/es/messages'
import { messages as de } from '../locales/de/messages'

export const locales = ['en', 'es', 'de'] as const
export type Locale = (typeof locales)[number]
export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale)
}
i18n.load({ en, es, de })
i18n.activate('en')
export { i18n }
