import { i18n } from '../../../../i18n/index'
import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Link from 'next/link'
import styles from './index.module.css'

interface TagsProps {
  items: string[]
  max?: number
  showMore?: boolean
  className?: string
  noLinks?: boolean
}

const Tag = ({ tag, noLinks }: { tag: string; noLinks?: boolean }) => {
  useLingui()

  const urlEncodedTag = encodeURIComponent(tag)
  return noLinks ? (
    <span className={styles.tag}>{tag}</span>
  ) : (
    <Link
      href={`/search?tags=${urlEncodedTag}&sort=credentialSubject.nft.created&sortOrder=desc`}
      className={styles.tag}
      title={tag}
    >
      {tag}
    </Link>
  )
}

export default function Tags({
  items,
  max,
  showMore,
  className,
  noLinks
}: TagsProps): ReactElement {
  useLingui()

  // safeguard against faults in the metadata
  if (!(items instanceof Array)) return null

  max = max || items.length
  const remainder = items.length - max
  // filter out empty array items, and restrict to `max`
  const tags = items?.filter((tag) => tag !== '').slice(0, max)
  const shouldShowMore = showMore && remainder > 0
  const classes = className ? `${styles.tags} ${className}` : styles.tags

  return (
    <div className={classes}>
      <span className={styles.title}>
        <Trans id="Tags:" />
      </span>
      {tags?.map((tag, i) => (
        <span key={tag + i}>
          <Tag tag={tag} noLinks={noLinks} />
          {i < tags.length - 1 && <span>, </span>}
        </span>
      ))}
      {shouldShowMore && (
        <span className={styles.more}>
          {i18n._('+ {value0} more', { value0: items.length - max })}
        </span>
      )}
    </div>
  )
}
