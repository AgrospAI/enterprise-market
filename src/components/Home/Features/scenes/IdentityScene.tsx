import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { CSSProperties, ReactElement, ReactNode } from 'react'
import styles from './IdentityScene.module.css'

// the holder label cycles once per loop: organization, person, AI agent
const holders: { label: string; icon: ReactNode }[] = [
  {
    get label() {
      return i18n._('Organization')
    },
    icon: (
      <>
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </>
    )
  },
  {
    get label() {
      return i18n._('Person')
    },
    icon: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    )
  },
  {
    get label() {
      return i18n._('AI agent')
    },
    icon: (
      <>
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
      </>
    )
  }
]

const claims = [
  {
    get name() {
      return i18n._('Organization')
    },
    get value() {
      return i18n._('Verified')
    },
    width: '86%'
  },
  {
    get name() {
      return i18n._('Role')
    },
    get value() {
      return i18n._('Data consumer')
    },
    width: '74%'
  },
  {
    get name() {
      return i18n._('Country')
    },
    get value() {
      return i18n._('Germany')
    },
    width: '64%',
    match: true
  }
]

const shield = (
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>
)

function Icon({
  className,
  children
}: {
  className: string
  children: ReactNode
}): ReactElement {
  useLingui()

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export default function IdentityScene(): ReactElement {
  useLingui()

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardBadge}>
            <Icon className={styles.cardBadgeIcon}>{shield}</Icon>
          </span>
          <span className={styles.cardHeading}>
            <span className={styles.cardTitle}>
              <Trans id="Verifiable Credential" />
            </span>
            <span className={styles.holder}>
              <span className={styles.holderPrefix}>
                <Trans id="Holder ·" />
              </span>
              <span className={styles.holderLabels}>
                {holders.map((holder, i) => (
                  <span
                    key={holder.label}
                    className={styles.holderLabel}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <Icon className={styles.holderIcon}>{holder.icon}</Icon>
                    {holder.label}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </div>

        <ul className={styles.claims}>
          {claims.map((claim, i) => (
            <li
              key={claim.name}
              className={`${styles.claim} ${
                claim.match ? styles.claimMatch : ''
              }`}
              style={{ '--i': i, '--w': claim.width } as CSSProperties}
            >
              <span className={styles.claimDot} />
              <span className={styles.claimBody}>
                <span className={styles.skeleton} />
                <span className={styles.claimText}>
                  <span className={styles.claimName}>{claim.name}</span> ·{' '}
                  {claim.value}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.cardFooter}>
          <span className={styles.standard}>
            <Trans id="W3C VC" />
          </span>
          <span className={styles.proof} />
        </div>
      </div>

      <div className={styles.track}>
        <div className={styles.mover}>
          <span className={styles.token}>
            <Icon className={styles.tokenIcon}>{shield}</Icon>
            <Trans id="VC" />{' '}
          </span>
        </div>
      </div>

      <div className={styles.provider}>
        <div className={styles.node}>
          <span className={styles.ring} />
          <span className={styles.ring} style={{ '--i': 1 } as CSSProperties} />
          <span className={styles.nodeBox}>
            <span className={styles.scan} />
            <svg
              className={styles.lock}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path className={styles.shackle} d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <svg className={styles.check} viewBox="0 0 24 24" fill="none">
            <circle className={styles.checkCircle} cx="12" cy="12" r="10" />
            <path className={styles.checkMark} d="m7.5 12.5 3 3 6-6.5" />
          </svg>
        </div>
        <span className={styles.nodeLabel}>
          <Trans id="Service offering" />
        </span>
        <span className={styles.granted}>
          <Icon className={styles.grantedIcon}>
            <path d="M20 6 9 17l-5-5" />
          </Icon>
          <span className={styles.grantedPrefix}>
            <Trans id="Access" />
          </span>
          <Trans id="granted" />{' '}
        </span>
      </div>

      {/* Rego policy evaluated against the presented credential */}
      <div className={styles.policy}>
        <span className={styles.policyHeader}>
          <span className={styles.policyFile} lang="en">
            policy.rego
          </span>
          <span className={styles.verdict} lang="en">
            <Icon className={styles.verdictIcon}>
              <path d="M20 6 9 17l-5-5" />
            </Icon>
            allow{' '}
          </span>
        </span>
        <code className={styles.code} lang="en">
          <span className={styles.codeLine}>
            <span className={styles.keyword}>allow if</span> {'{'}
          </span>
          <span className={`${styles.codeLine} ${styles.condition}`}>
            {'  '}
            input.country =={' '}
            <span className={styles.string}>&quot;DE&quot;</span>
          </span>
          <span className={styles.codeLine}>{'}'}</span>
        </code>
      </div>
    </div>
  )
}
