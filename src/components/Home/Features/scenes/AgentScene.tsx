import { i18n } from '../../../../i18n/index'
import { Trans, useLingui } from '@lingui/react'
import { CSSProperties, ReactElement } from 'react'
import styles from './AgentScene.module.css'

// Agent position (percent of the scene), shared by lines and packets
const AGENT = { x: '50%', y: '44%' }
const LOG = { x: '81%', y: '68%' }

// Order = animation order (step index drives the stagger)
const NODES = [
  {
    get org() {
      return i18n._('Org A')
    },
    get kind() {
      return i18n._('Dataset')
    },
    get action() {
      return i18n._('discover')
    },
    x: '21%',
    y: '24%',
    dot: 'var(--deck-blue)'
  },
  {
    get org() {
      return i18n._('Org C')
    },
    get kind() {
      return i18n._('Compute')
    },
    get action() {
      return i18n._('compute')
    },
    x: '79%',
    y: '24%',
    dot: 'var(--deck-cyan)'
  },
  {
    get org() {
      return i18n._('Org B')
    },
    get kind() {
      return i18n._('Model')
    },
    get action() {
      return i18n._('pay')
    },
    x: '21%',
    y: '70%',
    dot: 'var(--brand-highlight)'
  }
]

// 25 dashes over pathLength 100, then a 100-long gap: offset 100 -> 0 draws the dashed line in
const DASHES = `${Array(25).fill('2 2').join(' ')} 0 100`

const stepClass = [styles.s1, styles.s2, styles.s3]

function Check(): ReactElement {
  useLingui()

  return (
    <svg className={styles.icon} viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export default function AgentScene(): ReactElement {
  useLingui()

  return (
    <div
      className={styles.scene}
      aria-hidden="true"
      style={{ '--ax': AGENT.x, '--ay': AGENT.y } as CSSProperties}
    >
      <svg className={styles.lines}>
        {[...NODES, LOG].map((target, i) => (
          <line
            key={i}
            className={i === NODES.length ? styles.logLine : styles.line}
            style={{ '--i': i } as CSSProperties}
            x1={AGENT.x}
            y1={AGENT.y}
            x2={target.x}
            y2={target.y}
            pathLength={100}
            strokeDasharray={DASHES}
          />
        ))}
      </svg>

      {NODES.map((node, i) => (
        <span
          key={node.org}
          className={styles.packet}
          style={{ '--i': i, '--x': node.x, '--y': node.y } as CSSProperties}
        />
      ))}

      {NODES.map((node, i) => (
        <div
          key={node.org}
          className={styles.node}
          style={
            {
              '--i': i,
              '--x': node.x,
              '--y': node.y,
              '--dot': node.dot
            } as CSSProperties
          }
        >
          <span className={styles.dot} />
          <span className={styles.nodeText}>
            <span className={styles.org}>{node.org}</span>
            <span className={styles.kind}>{node.kind}</span>
          </span>
          <span className={`${styles.tick} ${stepClass[i]}`}>
            <Check />
          </span>
        </div>
      ))}

      <div className={styles.agent}>
        <span className={styles.agentCore}>
          <svg className={styles.bot} viewBox="0 0 24 24">
            <path d="M12 8V4H8" />
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </span>
        <span className={styles.badge}>
          <svg className={styles.shield} viewBox="0 0 24 24">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
        <span className={styles.agentLabel}>
          <Trans id="AI agent" />
        </span>
      </div>

      <div
        className={styles.log}
        style={{ '--x': LOG.x, '--y': LOG.y } as CSSProperties}
      >
        <span className={styles.logTitle}>
          <span className={styles.live} />
          <Trans id="Activity log" />{' '}
        </span>
        <ul className={styles.rows}>
          {NODES.map((node, i) => (
            <li key={node.action} className={`${styles.row} ${stepClass[i]}`}>
              <span className={styles.rowCheck}>
                <Check />
              </span>
              <span className={styles.rowAction}>{node.action}</span>
              <span className={styles.rowOrg}>{node.org}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
