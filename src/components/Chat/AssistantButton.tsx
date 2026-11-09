import { ReactElement } from 'react'
import { useChatPanel } from '@context/ChatPanel'
import { SparkleIcon } from './icons'
import { shortcutLabel } from './shortcut'
import styles from './AssistantButton.module.css'

/** The header's way into the market assistant, shown while it can be used. */
export default function AssistantButton(): ReactElement | null {
  const { isAvailable, isOpen, toggle } = useChatPanel()
  if (!isAvailable) return null

  return (
    <button
      type="button"
      className={styles.button}
      aria-expanded={isOpen}
      aria-controls="market-assistant"
      aria-label="Ask AI"
      title={`Ask the AgrospAI Assistant (${shortcutLabel()})`}
      onClick={toggle}
    >
      <SparkleIcon className={styles.icon} />
      <span className={styles.text}>Ask AI</span>
    </button>
  )
}
