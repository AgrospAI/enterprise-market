import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { CSSProperties, ReactElement } from 'react'
import styles from './SovereigntyScene.module.css'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

const cloudIcon = (
  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
)

// Generic providers only: compute is deployed to them, the data never moves
const targets: { label: string; icon: ReactElement }[] = [
  {
    get label() {
      return i18n._('Cloud A')
    },
    icon: cloudIcon
  },
  {
    get label() {
      return i18n._('Cloud B')
    },
    icon: cloudIcon
  },
  {
    label: 'On-premise',
    icon: (
      <>
        <rect width="20" height="8" x="2" y="2" rx="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" />
        <path d="M6 6h.01M6 18h.01" />
      </>
    )
  },
  {
    label: 'Edge',
    icon: (
      <>
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
      </>
    )
  }
]

// Peer nodes on the access-control ring (r = 47, at 45° steps)
const peers = [
  [83.23, 83.23],
  [16.77, 83.23],
  [16.77, 16.77],
  [83.23, 16.77]
]

function cx(...names: (string | false)[]): string {
  return names.filter(Boolean).join(' ')
}

export default function SovereigntyScene(): ReactElement {
  useLingui()

  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.stage}>
        <span className={styles.busTrack} />
        <span className={styles.stemTrack} />
        <span className={styles.stem} />
        {targets.map((target, i) => (
          <span
            key={target.label}
            className={styles.route}
            style={{ '--i': i } as CSSProperties}
          >
            <span className={styles.dropTrack} />
            <span
              className={cx(
                styles.wireH,
                i < 2 ? styles.toLeft : styles.toRight,
                i === 0 && styles.first
              )}
            />
            <span className={cx(styles.wireV, i === 0 && styles.first)} />
          </span>
        ))}
        <span className={styles.junction} />

        <span className={styles.halo} />
        <div className={styles.ring}>
          <svg viewBox="0 0 100 100">
            <circle
              className={styles.ringPath}
              cx="50"
              cy="50"
              r="47"
              pathLength="96"
            />
            {peers.map(([x, y], i) => (
              <circle
                key={`${x}-${y}`}
                className={cx(styles.peer, i === 1 && styles.peerOn)}
                cx={x}
                cy={y}
                r="4.5"
              />
            ))}
          </svg>
        </div>

        <div className={styles.vault}>
          <svg {...iconProps}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
        </div>

        <div className={styles.seal}>
          <span className={styles.sealKey}>
            <svg {...iconProps} strokeWidth={2.5}>
              <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <Trans id="Stays with you" />{' '}
        </div>

        {targets.map((target, i) => (
          <span
            key={`chip-${target.label}`}
            className={cx(styles.chip, i === 0 && styles.first)}
            style={{ '--i': i } as CSSProperties}
          >
            <span className={styles.chipLabel}>
              <Trans id="deployed" />
            </span>
            {target.label}
          </span>
        ))}

        <div className={styles.tiles}>
          {targets.map((target, i) => (
            <span
              key={target.label}
              className={cx(styles.tile, i === 0 && styles.first)}
              style={{ '--i': i } as CSSProperties}
            >
              <span className={styles.port} />
              <svg className={styles.tileIcon} {...iconProps}>
                {target.icon}
              </svg>
              <span className={styles.tileLabel}>{target.label}</span>
            </span>
          ))}
          <span className={styles.slider} />
        </div>
      </div>
    </div>
  )
}
