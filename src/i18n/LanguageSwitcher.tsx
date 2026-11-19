import { useLingui } from '@lingui/react'
import inputStyles from '@shared/FormInput/InputElement/index.module.css'
import { useLocale } from './Provider'
import { isLocale } from './index'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher() {
  const { i18n } = useLingui()
  const { locale, setLocale } = useLocale()
  return (
    <div className={styles.container}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={styles.globe}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
      <select
        id="language"
        name="language"
        className={`${inputStyles.select} ${styles.select}`}
        aria-label={i18n._('Language')}
        translate="no"
        value={locale}
        onPointerDown={(event) => {
          // Focus before the browser's default pointer action can scroll the page.
          event.currentTarget.focus({ preventScroll: true })
        }}
        onChange={(event) => {
          const { value } = event.target as HTMLSelectElement
          if (isLocale(value)) setLocale(value)
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="es" lang="es">
          Español
        </option>
        <option value="de" lang="de">
          Deutsch
        </option>
      </select>
    </div>
  )
}
