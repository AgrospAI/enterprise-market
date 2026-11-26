import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { useUserPreferences } from '@context/UserPreferences'
import { ReactElement } from 'react'
import styles from './Bookmark.module.css'
import BookmarkIcon from '@images/bookmark.svg'

export default function Bookmark({
  did,
  className
}: {
  did: string
  className?: string
}): ReactElement {
  useLingui()

  const { bookmarks, addBookmark, removeBookmark } = useUserPreferences()
  const isBookmarked = bookmarks && bookmarks?.includes(did)

  function handleBookmark() {
    isBookmarked ? removeBookmark(did) : addBookmark(did)
  }

  return (
    <button
      onClick={handleBookmark}
      aria-label={i18n._(isBookmarked ? 'Remove Bookmark' : 'Add Bookmark')}
      className={`${styles.bookmark} ${isBookmarked ? styles.active : ''} ${
        className || ''
      }`}
      data-tooltip={
        isBookmarked
          ? i18n._('Asset is Bookmarked, Click to Remove')
          : i18n._('Click to Add in Bookmarks')
      }
    >
      <BookmarkIcon />
    </button>
  )
}
