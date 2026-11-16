import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { contentPagesHomeContent as content } from '../../../i18n/content'
import shared from './shared.module.css'
import styles from './EcosystemStats.module.css'
import { useReveal } from './useReveal'

// rendered twice back to back so the banner can loop seamlessly
function LogoList({ hidden }: { hidden?: boolean }): ReactElement {
  useLingui()

  return (
    <ul className={styles.logos} aria-hidden={hidden || undefined}>
      {content.ecosystem.partners.map((partner) => (
        <li key={partner.name} className={styles.logo}>
          <img
            className={styles.logoWhite}
            src={partner.logo}
            alt={hidden ? '' : partner.name}
            title={partner.name}
            loading="lazy"
            decoding="async"
          />
          {/* brand colours, revealed on a white tile while hovered */}
          <span className={styles.logoTile} aria-hidden="true">
            <img
              src={partner.logoColor}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

// social proof at the foot of the navy hero: a running partner logo banner
export default function EcosystemStats(): ReactElement {
  useLingui()

  const { title, titleMuted } = content.ecosystem
  const [ref, reveal] = useReveal<HTMLElement>(0.1)

  return (
    <section
      ref={ref}
      data-reveal={reveal}
      className={styles.trust}
      aria-label={`${title} ${titleMuted}`}
    >
      <div className={`${styles.marquee} ${shared.reveal}`}>
        <div className={styles.rail}>
          <LogoList />
          <LogoList hidden />
        </div>
      </div>
    </section>
  )
}
