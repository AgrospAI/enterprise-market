import { ReactElement } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import styles from './Links.module.css'
import { useMarketMetadata } from '@context/MarketMetadata'
import Link from 'next/link'

interface CookieSettingsButtonProps {
  onClick: () => void
}

function CookieSettingsButton({
  onClick
}: CookieSettingsButtonProps): ReactElement {
  return (
    <button type="button" className={styles.linkButton} onClick={onClick}>
      Cookie Settings
    </button>
  )
}

/**
 * Footer links are driven entirely by content/site.json — this portal varies
 * its footer there rather than hardcoding a privacy column, so upstream's
 * hardcoded block and its /privacy/* href overrides are deliberately not
 * adopted (they would override the legal links configured in site.json).
 *
 * From upstream v1.5.0: "Cookie Settings" opens the preference centre and
 * "Cookie Policy" is a plain link to the policy page. They used to be the same
 * entry, which meant the policy page could not be reached without also opening
 * the preference centre.
 */
export default function Links(): ReactElement {
  const { appConfig, siteContent } = useMarketMetadata()
  const { setShowPPC } = useUserPreferences()

  const { content } = siteContent.footer
  const showCookieSettings = appConfig.privacyPreferenceCenter === 'true'
  const openCookieSettings = () => setShowPPC(true)

  return (
    <div className={styles.container}>
      {content?.map((section) => (
        <div key={section.title} className={styles.section}>
          <p className={styles.title}>{section.title}</p>
          <div className={styles.links}>
            {section.links.map((e) => {
              const key = `${e.name}-${e.link}`

              if (e.name === 'Cookie Settings') {
                return showCookieSettings ? (
                  <CookieSettingsButton
                    key={key}
                    onClick={openCookieSettings}
                  />
                ) : null
              }

              const isInternalLink = e.link.startsWith('/')
              if (isInternalLink) {
                return (
                  <Link key={key} className={styles.link} href={e.link}>
                    {e.name}
                  </Link>
                )
              }

              return (
                <a
                  key={key}
                  className={styles.link}
                  href={e.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.name}
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
