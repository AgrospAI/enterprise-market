import { i18n } from '../../i18n/index'
import { useLingui } from '@lingui/react'
import { useRequestNotifications } from '@hooks/useRequestNotifications'
import styles from './NotificationBadge.module.css'

export function CountBadge({ count }: { count: number }) {
  useLingui()
  return count > 0 ? (
    <span
      className={styles.badge}
      aria-label={i18n._(
        '{count, plural, one {# unread notification} other {# unread notifications}}',
        { count }
      )}
    >
      {count}
    </span>
  ) : null
}

export default function NotificationBadge({
  direction
}: {
  direction?: 'received' | 'sent'
}) {
  const { data } = useRequestNotifications(direction)
  return <CountBadge count={Object.keys(data || {}).length} />
}
