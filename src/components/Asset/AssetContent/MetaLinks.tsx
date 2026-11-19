import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import useSWR from 'swr'
import MetaItem from './MetaItem'
import External from '@images/external.svg'
import { safeExternalWebUrl } from '@utils/url'
import styles from './MetaLinks.module.css'

function LinkLabel({ title, url }: { title: string; url: string }) {
  const needsTitle = !title.trim() || /^link-\d+$/i.test(title.trim())
  const href = safeExternalWebUrl(url)
  const { data } = useSWR<string | null>(
    needsTitle && href !== 'about:blank'
      ? `/api/link-title?url=${encodeURIComponent(href)}`
      : null,
    async (endpoint: string) => {
      const response = await fetch(endpoint)
      if (!response.ok) return null
      const { title: pageTitle } = await response.json()
      return typeof pageTitle === 'string'
        ? new DOMParser()
            .parseFromString(`<title>${pageTitle}</title>`, 'text/html')
            .querySelector('title')
            ?.textContent?.trim() || null
        : null
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  return <>{needsTitle ? data || url : title}</>
}

export default function MetaLinks({
  links
}: {
  links?: Record<string, string>
}): ReactElement | null {
  useLingui()

  // `metadata.links` is a title -> URL map of related links (website, demo, ...)
  const entries = Object.entries(links || {}).filter(([, url]) => url?.trim())

  if (entries.length === 0) return null

  return (
    <div className={styles.section}>
      <MetaItem
        title={i18n._('Links')}
        content={
          <ul className={styles.list}>
            {entries.map(([title, url]) => (
              <li key={title}>
                <a
                  className={styles.chip}
                  href={safeExternalWebUrl(url)}
                  target="_blank"
                  rel="noreferrer"
                  title={url}
                >
                  <span className={styles.text}>
                    <LinkLabel title={title} url={url} />
                  </span>
                  <External className={styles.icon} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  )
}
