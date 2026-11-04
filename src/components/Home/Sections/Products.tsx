import { CSSProperties, ReactElement, ReactNode } from 'react'
import Link from 'next/link'
import content from '../../../../content/pages/home/content.json'
import shared from './shared.module.css'
import styles from './Products.module.css'
import SectionHeader from './SectionHeader'
import { useReveal } from './useReveal'

function SmartLink({
  href,
  className,
  children
}: {
  href: string
  className: string
  children: ReactNode
}): ReactElement {
  if (href.startsWith('/'))
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

// peer-to-peer data space: no centre, every participant links to its peers
const meshNodes = [
  { x: 28, y: 42 },
  { x: 44, y: 118 },
  { x: 96, y: 76 },
  { x: 128, y: 22 },
  { x: 142, y: 128 },
  { x: 186, y: 70 },
  { x: 222, y: 124 },
  { x: 242, y: 28 },
  { x: 276, y: 88 }
]

const meshLinks = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 4],
  [2, 3],
  [2, 4],
  [2, 5],
  [3, 5],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 6],
  [5, 7],
  [5, 8],
  [6, 8],
  [7, 8]
]

function NetworkVisual(): ReactElement {
  return (
    <svg className={styles.network} viewBox="0 0 300 150">
      {meshLinks.map(([from, to], index) => (
        <line
          key={`${from}-${to}`}
          x1={meshNodes[from].x}
          y1={meshNodes[from].y}
          x2={meshNodes[to].x}
          y2={meshNodes[to].y}
          className={styles.peerLink}
          style={{ '--i': index } as CSSProperties}
        />
      ))}
      {meshNodes.map((node, index) => (
        <g key={index} style={{ '--i': index } as CSSProperties}>
          <circle cx={node.x} cy={node.y} r="11" className={styles.nodeRing} />
          <circle cx={node.x} cy={node.y} r="6" className={styles.nodeDot} />
        </g>
      ))}
    </svg>
  )
}

function ComputeVisual(): ReactElement {
  return (
    <div className={styles.compute}>
      <div className={styles.computeNode}>
        <span className={styles.computeIcon}>&lt;/&gt;</span>
        <span className={styles.computeLabel}>Algorithm</span>
      </div>
      <div className={`${styles.wire} ${styles.wireIn}`} />
      <div className={`${styles.computeNode} ${styles.vault}`}>
        <span className={styles.computeIcon}>
          <svg viewBox="0 0 24 24">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <span className={styles.computeLabel}>Private data</span>
      </div>
      <div className={`${styles.wire} ${styles.wireOut}`} />
      <div className={styles.computeNode}>
        <span className={styles.computeIcon}>
          <svg viewBox="0 0 24 24">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </span>
        <span className={styles.computeLabel}>Results</span>
      </div>
    </div>
  )
}

const marketplaceRows = ['Dataset', 'AI model', 'Compute']

function MarketplaceVisual(): ReactElement {
  return (
    <div className={styles.market}>
      {marketplaceRows.map((row, index) => (
        <div
          key={row}
          className={styles.marketRow}
          style={{ '--i': index } as CSSProperties}
        >
          <span className={styles.marketDot} />
          <span className={styles.marketName}>{row}</span>
          <span className={styles.marketBar} />
        </div>
      ))}
    </div>
  )
}

const visuals: Record<string, () => ReactElement> = {
  network: NetworkVisual,
  compute: ComputeVisual,
  marketplace: MarketplaceVisual
}

export default function Products(): ReactElement {
  const { title, titleMuted, items, cta } = content.products
  const [ref, reveal] = useReveal<HTMLElement>(0.1)

  return (
    <section
      ref={ref}
      data-reveal={reveal}
      className={styles.section}
      aria-labelledby="home-products-title"
    >
      <div className={shared.container}>
        <SectionHeader
          id="home-products-title"
          title={title}
          titleMuted={titleMuted}
        />

        <ul className={styles.grid}>
          {items.map((item, index) => {
            const Visual = visuals[item.visual]
            return (
              <li
                key={item.title}
                className={`${styles.item} ${shared.reveal}`}
                style={{ '--i': index + 1 } as CSSProperties}
              >
                <article className={styles.card}>
                  <div className={styles.visual} aria-hidden="true">
                    <Visual />
                  </div>
                  <div className={styles.body}>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    <p className={styles.cardText}>{item.text}</p>
                    {item.links.length > 0 && (
                      <div className={styles.links}>
                        {item.links.map((link) => (
                          <SmartLink
                            key={link.href}
                            href={link.href}
                            className={styles.link}
                          >
                            <span className={styles.linkLabel}>
                              {link.label}
                            </span>
                            <span className={styles.arrow} aria-hidden="true">
                              →
                            </span>
                          </SmartLink>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>

        {/* <div
          className={`${styles.cta} ${shared.reveal}`}
          style={{ '--i': items.length + 1 } as CSSProperties}
        >
          <div>
            <h2 className={styles.ctaTitle}>
              {cta.title}{' '}
              <span className={styles.ctaTitleMuted}>{cta.titleMuted}</span>
            </h2>
            <p className={styles.ctaText}>{cta.text}</p>
          </div>
          <div className={styles.ctaActions}>
            <SmartLink href={cta.contactHref} className={styles.ctaSecondary}>
              {cta.contactLabel}
            </SmartLink>
            <SmartLink href={cta.href} className={styles.ctaButton}>
              {cta.label}
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </SmartLink>
          </div>
        </div> */}
      </div>
    </section>
  )
}
