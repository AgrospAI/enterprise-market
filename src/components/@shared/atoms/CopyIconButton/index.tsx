import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import IconCopy from '@images/copy.svg'
import { copyTextToClipboard } from '@utils/clipboard'
import styles from './index.module.css'

interface CopyIconButtonProps {
  text: string
  variant?: 'inline' | 'pill'
  disabled?: boolean
  copyAriaLabel?: string
  copiedAriaLabel?: string
  copyTitle?: string
  copiedTitle?: string
  showStateLabel?: boolean
  copyLabel?: string
  copiedLabel?: string
  resetAfterMs?: number
  renderStatus?: (copied: boolean) => ReactNode
}

export default function CopyIconButton({
  text,
  variant = 'inline',
  disabled,
  copyAriaLabel = i18n._('Copy to clipboard'),
  copiedAriaLabel = i18n._('Copied'),
  copyTitle = i18n._('Copy to clipboard'),
  copiedTitle = i18n._('Copied'),
  showStateLabel,
  copyLabel = i18n._('Copy'),
  copiedLabel = i18n._('Copied'),
  resetAfterMs = 2000,
  renderStatus
}: CopyIconButtonProps): ReactElement {
  useLingui()

  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const resetCopyState = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      setCopied(false)
    }, resetAfterMs)
  }, [resetAfterMs])

  const handleCopy = useCallback(async () => {
    const didCopy = await copyTextToClipboard(text)
    if (!didCopy) return
    setCopied(true)
    resetCopyState()
  }, [text, resetCopyState])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const isDisabled = disabled || !text
  const classes = [
    styles.button,
    variant === 'pill' ? styles.pill : styles.inline,
    copied ? styles.copied : '',
    isDisabled ? styles.disabled : ''
  ]
    .filter(Boolean)
    .join(' ')
  const shouldShowStateLabel = showStateLabel ?? variant === 'pill'

  return (
    <button
      type="button"
      title={copied ? copiedTitle : copyTitle}
      onClick={handleCopy}
      className={classes}
      aria-label={copied ? copiedAriaLabel : copyAriaLabel}
      disabled={isDisabled}
      data-copied={copied}
    >
      <IconCopy className={styles.icon} />
      {shouldShowStateLabel && (
        <span className={styles.label}>{copied ? copiedLabel : copyLabel}</span>
      )}
      {renderStatus?.(copied)}
    </button>
  )
}
