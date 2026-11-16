import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Button from '../atoms/Button'
import styles from './HideButton.module.css'
import Tooltip from '../atoms/Tooltip'
import Markdown from '../Markdown'
// import Cross from '@images/x-cross.svg'
import { useUserPreferences } from '@context/UserPreferences'
import { contentOnboardingIndex as content } from '../../../i18n/content'

export default function HideButton(): ReactElement {
  useLingui()

  const { setShowOnboardingModule } = useUserPreferences()

  return (
    <Tooltip content={<Markdown text={content.hideHint} />} placement="top">
      <Button
        className={styles.hideButton}
        style="text"
        onClick={() => setShowOnboardingModule(false)}
      >
        {/* <Cross /> */}
        <Trans id="x" />{' '}
      </Button>
    </Tooltip>
  )
}
