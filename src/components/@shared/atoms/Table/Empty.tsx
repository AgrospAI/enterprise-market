import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { markdownToHtml } from '@utils/markdown'
import { ReactElement, ReactNode } from 'react'
import styles from './Empty.module.css'

export default function Empty({
  message
}: {
  message?: string | ReactNode
}): ReactElement {
  useLingui()

  if (typeof message === 'string') {
    return (
      <div
        className={styles.empty}
        dangerouslySetInnerHTML={{
          __html: message ? markdownToHtml(message) : i18n._('No results found')
        }}
      />
    )
  }

  return (
    <div className={styles.empty}>{message || i18n._('No results found')}</div>
  )
}
