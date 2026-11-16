import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { useUserPreferences } from '@context/UserPreferences'
import { ReactElement } from 'react'
import Alert from '../atoms/Alert'
import styles from './index.module.css'

export default function ExternalContentWarning(): ReactElement {
  useLingui()

  const { setAllowExternalContent } = useUserPreferences()

  return (
    <div className={styles.externalContentAlertContainer}>
      <Alert
        state="warning"
        title={i18n._('External content not allowed')}
        text={i18n._(
          'The asset description may include content from external sources. Do you want to allow it?'
        )}
        action={{
          name: i18n._('Allow'),
          style: 'primary',
          handleAction: () => setAllowExternalContent(true)
        }}
      />
    </div>
  )
}
