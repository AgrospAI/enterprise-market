import { I18nProvider } from '@lingui/react'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react'
import { i18n, isLocale, Locale } from './index'

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
}>({ locale: 'en', setLocale: () => undefined })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>('en')
  const [ready, setReady] = useState(false)
  function setLocale(next: Locale) {
    if (!isLocale(next)) return
    i18n.activate(next)
    updateLocale(next)
    document.documentElement.lang = next
    // Language is an essential display preference, independent of analytics consent.
    document.cookie = `market-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
  }
  useEffect(() => {
    const saved = document.cookie
      .split('; ')
      .find((part) => part.startsWith('market-locale='))
      ?.split('=')[1]
    const preferred = saved || navigator.language.split('-')[0]
    setLocale(isLocale(preferred) ? preferred : 'en')
    setReady(true)
  }, [])
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <I18nProvider i18n={i18n}>{ready ? children : null}</I18nProvider>
    </LocaleContext.Provider>
  )
}
export const useLocale = () => useContext(LocaleContext)
