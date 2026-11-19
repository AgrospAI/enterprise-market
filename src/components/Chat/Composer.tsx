import { FormEvent, ReactElement, ReactNode, RefObject, useEffect } from 'react'
import { SendIcon, SparkleIcon, StopIcon } from './icons'
import styles from './index.module.css'

/** The home page's message box, where the assistant does everything. */
export const ASSISTANT_PLACEHOLDER =
  'Ask the AI assistant: find, download or analyse data…'

/**
 * Before the text of the home page's box: tells it apart from a search field,
 * which the home page used to have in the same place.
 */
export function AssistantMark(): ReactElement {
  return (
    <span className={styles.assistantMark} aria-hidden="true">
      <SparkleIcon />
    </span>
  )
}

/** As .input's max-height: past it, the box scrolls. */
const MAX_INPUT_PX = 160

/**
 * The assistant's message box: the side panel's, and the one in the middle of
 * the home page, where it is larger and also shown before the user can send.
 */
export default function Composer({
  value,
  onChange,
  onSubmit,
  inputRef,
  isStreaming = false,
  onStop,
  isLarge = false,
  placeholder = 'Search, download or run a job…',
  leading,
  children
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  inputRef: RefObject<HTMLTextAreaElement>
  isStreaming?: boolean
  onStop?: () => void
  /** The home page's: larger. */
  isLarge?: boolean
  placeholder?: string
  /** Shown before the text, on the same line: what the box is. */
  leading?: ReactNode
  /** Shown under the box, inside its border: what is needed to send. */
  children?: ReactNode
}): ReactElement {
  // The message box grows with the text, up to a few lines. It scrolls only
  // past them: a box measured before the font loaded, or at another width,
  // would otherwise show a scrollbar for a pixel of overflow.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const fit = () => {
      input.style.height = 'auto'
      if (!input.scrollHeight) return
      input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_PX)}px`
      input.style.overflowY =
        input.scrollHeight > MAX_INPUT_PX ? 'auto' : 'hidden'
    }
    fit()
    let width = input.clientWidth
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            // Setting the height resizes it too: only a new width needs a fit.
            if (input.clientWidth === width) return
            width = input.clientWidth
            fit()
          })
    observer?.observe(input)
    let isMounted = true
    document.fonts?.ready.then(() => isMounted && fit())
    return () => {
      isMounted = false
      observer?.disconnect()
    }
  }, [value, inputRef])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim() || isStreaming) return
    onSubmit()
  }

  return (
    <form
      className={
        isLarge ? `${styles.composer} ${styles.large}` : styles.composer
      }
      onSubmit={handleSubmit}
    >
      <div className={styles.composerRow}>
        {leading}
        <textarea
          ref={inputRef}
          className={styles.input}
          aria-label="Message"
          placeholder={placeholder}
          rows={1}
          value={value}
          data-autofocus
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) handleSubmit(event)
          }}
        />
        {isStreaming ? (
          <button
            type="button"
            className={styles.sendButton}
            aria-label="Stop"
            title="Stop"
            onClick={onStop}
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="submit"
            className={styles.sendButton}
            aria-label="Send"
            title="Send"
            disabled={!value.trim()}
          >
            <SendIcon />
          </button>
        )}
      </div>
      {children}
    </form>
  )
}

/** What the user still has to do before their message can go. */
export function ComposerGate({
  text,
  children
}: {
  text: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <div className={styles.gate} role="status">
      <span>{text}</span>
      {children}
    </div>
  )
}
