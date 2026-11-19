import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import styles from './index.module.css'

// An item needs an `href` (navigate to that page, optionally to `anchor` on
// it) or an `anchor` alone (scroll to that id on the current page). Only set
// `anchor` when the target page really renders an element with that id.
interface AnchorItem {
  label: string
  anchor?: string
  href?: string
}

interface AnchorNavigationProps {
  items: AnchorItem[]
}

function isExternalUrl(href?: string): boolean {
  return /^https?:\/\//i.test(href || '')
}

export default function AnchorNavigation({
  items
}: AnchorNavigationProps): ReactElement {
  useLingui()

  const router = useRouter()

  const handleClick = (item: AnchorItem) => {
    if (item.href) {
      router.push(item.anchor ? `${item.href}#${item.anchor}` : item.href)
    } else if (item.anchor) {
      const element = document.getElementById(item.anchor)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  return (
    <div className={styles.container}>
      {items.map((item) =>
        // External pages (e.g. the imprint) open in a new tab, like the
        // footer links to them.
        isExternalUrl(item.href) ? (
          <a
            key={item.label}
            className={styles.button}
            href={item.anchor ? `${item.href}#${item.anchor}` : item.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.label}>{item.label}</span>
          </a>
        ) : (
          <button
            key={item.label}
            className={styles.button}
            onClick={() => handleClick(item)}
            type="button"
          >
            <span className={styles.label}>{item.label}</span>
          </button>
        )
      )}
    </div>
  )
}
