import { ReactElement, useEffect, useState } from 'react'
import { useChatPanel } from '@context/ChatPanel'
import { CloseIcon, SparkleIcon } from './icons'
import { shortcutLabel } from './shortcut'
import styles from './AssistantButton.module.css'

/** Set once the user has seen what the assistant can do, or opened it. */
export const INTRO_SEEN_KEY = 'assistant:intro-seen'

function readIntroSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    // Blocked storage: better not to show it on every page.
    return true
  }
}

function markIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {}
}

/** The header's way into the market assistant, shown while it can be used. */
export default function AssistantButton(): ReactElement | null {
  const { isAvailable, isOpen, toggle } = useChatPanel()
  // Read after mounting, so the server and the first render agree.
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (isAvailable && !isOpen) setShowIntro(!readIntroSeen())
  }, [isAvailable, isOpen])

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(false)
    markIntroSeen()
  }, [isOpen])

  if (!isAvailable) return null

  function dismissIntro() {
    setShowIntro(false)
    markIntroSeen()
  }

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={isOpen}
        aria-controls="market-assistant"
        aria-label="AI Assistant"
        aria-describedby={showIntro ? 'assistant-intro' : undefined}
        title={`Open the AgrospAI Assistant (${shortcutLabel()})`}
        onClick={toggle}
      >
        <SparkleIcon className={styles.icon} />
        <span className={styles.text}>AI Assistant</span>
      </button>
      {showIntro && (
        <span id="assistant-intro" className={styles.intro} role="note">
          <span>
            <strong>New:</strong> find, buy and download data, or run
            Compute-to-Data jobs, by chat.
          </span>
          <button
            type="button"
            className={styles.introClose}
            aria-label="Dismiss"
            onClick={dismissIntro}
          >
            <CloseIcon />
          </button>
        </span>
      )}
    </span>
  )
}
