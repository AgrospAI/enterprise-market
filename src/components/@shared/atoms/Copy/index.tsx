import { i18n } from '../../../../i18n/index'
import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import styles from './index.module.css'
import CopyIconButton from '@shared/atoms/CopyIconButton'

interface CopyProps {
  text: string
}

export default function Copy({ text }: CopyProps): ReactElement {
  useLingui()

  return (
    <CopyIconButton
      text={text}
      copyTitle={i18n._('Copy to clipboard')}
      copiedTitle={i18n._('Copied!')}
      copyAriaLabel={i18n._('Copy to clipboard')}
      copiedAriaLabel={i18n._('Copied')}
      resetAfterMs={5000}
      renderStatus={(copied) =>
        copied ? (
          <span className={styles.feedback}>
            <Trans id="Copied!" />
          </span>
        ) : null
      }
    />
  )
}
