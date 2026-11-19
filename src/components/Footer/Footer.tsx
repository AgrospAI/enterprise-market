import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import styles from './Footer.module.css'
import Links from './Links'
import { useMarketMetadata } from '@context/MarketMetadata'
import Logo from '@images/agrospai_logo_horizontal.svg'

export default function Footer(): ReactElement {
  const { siteContent } = useMarketMetadata()
  const router = useRouter()
  const { footer } = siteContent
  const copyright = footer.copyright.replace(
    /\b\d{4}\b/g,
    String(new Date().getFullYear())
  )

  // The home page fits in one screen: its footer is a single line.
  if (router?.pathname === '/') {
    return (
      <footer className={`${styles.footer} ${styles.oneLine}`}>
        <div className={styles.container}>
          <span>{copyright} · Powered by Ocean Enterprise</span>
          <Links isInline />
        </div>
      </footer>
    )
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo className={styles.logo} />
          <div className={styles.taglineContainer}>
            <span className={styles.tagline}>
              Developed by Universitat de Lleida and powered by Ocean
              Enterprise. Learn more about the project!
            </span>
            <a
              className={styles.websiteLink}
              href="https://agrospai.udl.cat/en"
              target="_blank"
              rel="noopener noreferrer"
            >
              agrospai.udl.cat
            </a>
          </div>
        </div>
        <Links />
      </div>
      <p className={styles.copyright}>{copyright}</p>
    </footer>
  )
}
