import { translate } from '../../../../i18n/translate'
import { Trans, useLingui } from '@lingui/react'
import { ReactElement, ReactNode, FormEvent } from 'react'
import classNames from 'classnames/bind'
import styles from './index.module.css'
import Button from '../Button'
import Markdown from '../../Markdown'
import WarningSVG from '@images/warning.svg'

const cx = classNames.bind(styles)

interface AlertProps {
  children?: ReactNode
  title?: string
  subtitle?: string
  description?: string
  className?: string
  warning?: boolean
  state?: 'error' | 'warning' | 'info' | 'success'
  badge?: string
  text?: string
  action?: {
    name: string
    style?: 'text' | 'primary' | 'ghost'
    disabled?: boolean
    handleAction: (e: FormEvent<HTMLButtonElement>) => void
  }
  onDismiss?: () => void
}

export default function Alert({
  children,
  title,
  subtitle,
  description,
  className,
  warning = false,
  state = 'info',
  badge,
  text,
  action,
  onDismiss
}: AlertProps): ReactElement {
  const { i18n } = useLingui()

  const finalState = state

  return (
    <div className={cx(styles.infoBox, styles[finalState], className)}>
      <div className={styles.root}>
        {warning && (
          <WarningSVG width={22} height={22} className={styles.warningIcon} />
        )}

        <div>
          {title && subtitle && (
            <div className={styles.header}>
              <strong>{i18n._(title)}</strong> —{' '}
              <strong>{i18n._(subtitle)}</strong>
              {description && (
                <>
                  <br />
                  {i18n._(description)}
                </>
              )}
            </div>
          )}

          {title && !subtitle && (
            <>
              <div>
                <strong>{i18n._(title)}</strong>
                {badge && ` — ${badge}`}
              </div>
              {text && <Markdown text={translate(text)} />}
            </>
          )}

          {!title && text && <Markdown text={translate(text)} />}

          {children}
        </div>
      </div>

      {action && (
        <Button
          className={styles.action}
          size="small"
          style={action.style || 'primary'}
          onClick={action.handleAction}
          disabled={action.disabled}
        >
          {i18n._(action.name)}
        </Button>
      )}
      {onDismiss && (
        <button className={styles.close} onClick={onDismiss}>
          <Trans id="&times;" />{' '}
        </button>
      )}
    </div>
  )
}
