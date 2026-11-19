import { useLingui } from '@lingui/react'
import { ReactElement, RefObject, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { useChatPanel } from '@context/ChatPanel'
import Composer, {
  ASSISTANT_PLACEHOLDER,
  AssistantMark,
  ComposerGate
} from '@components/Chat/Composer'
import { openWalletMenu } from '@components/Chat/openWalletMenu'
import { searchSuggestions, suggestionsFor } from '@components/Chat/suggestions'
import { SparkleIcon } from '@components/Chat/icons'
import styles from './index.module.css'
import { contentPagesHomeContent as content } from '../../i18n/content'

const CATALOGUE_URL = '/search?sort=indexedMetadata.event.block&sortOrder=desc'

/**
 * The message box shown while the assistant itself cannot be: before a wallet
 * is connected, it keeps the message and asks for one; with a wallet but the
 * assistant turned off, it searches the catalogue instead.
 */
function StandInComposer({
  inputRef
}: {
  inputRef: RefObject<HTMLTextAreaElement>
}): ReactElement {
  useLingui()

  const router = useRouter()
  const { isConnected } = useAccount()
  const { draft, setDraft, isSendPending, setSendPending } = useChatPanel()

  function handleSubmit() {
    if (!isConnected) {
      setSendPending(true)
      return
    }
    router.push(`${CATALOGUE_URL}&text=${encodeURIComponent(draft.trim())}`)
  }

  return (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={handleSubmit}
      inputRef={inputRef}
      isLarge
      leading={isConnected ? undefined : <AssistantMark />}
      placeholder={
        isConnected ? content.hero.searchPlaceholder : ASSISTANT_PLACEHOLDER
      }
    >
      {!isConnected && isSendPending && (
        <ComposerGate text="Connect your wallet to send. Your message stays here.">
          <button
            type="button"
            className={styles.gateButton}
            onClick={openWalletMenu}
          >
            Connect wallet
          </button>
        </ComposerGate>
      )}
    </Composer>
  )
}

function HeroSection(): ReactElement {
  useLingui()

  const { isAvailable, isChatting, isSearchOnly, setDraft, setInlineHost } =
    useChatPanel()
  // Without a session it only searches: the examples are searches too.
  const suggestions = isSearchOnly ? searchSuggestions() : suggestionsFor('/')
  const assistantRef = useRef<HTMLDivElement>(null)
  const standInRef = useRef<HTMLTextAreaElement>(null)
  // The assistant (Chat/index.tsx) draws itself here while this page is shown.
  const hostRef = useCallback(
    (node: HTMLDivElement | null) => setInlineHost(node),
    [setInlineHost]
  )

  function fill(prompt: string) {
    setDraft(prompt)
    assistantRef.current?.querySelector('textarea')?.focus()
  }

  return (
    <section
      className={isChatting ? `${styles.hero} ${styles.chatting}` : styles.hero}
    >
      <div className={styles.content}>
        <h1 className={styles.title}>{content.hero.title}</h1>

        {!isChatting && (
          <div className={styles.intro}>
            <p className={styles.badge}>
              <SparkleIcon className={styles.badgeIcon} />
              AI Assistant
            </p>
            <p className={styles.lead}>
              Ask in your own words. The assistant finds datasets and algorithms
              for you, and prepares downloads and Compute-to-Data jobs for you
              to confirm.
            </p>
          </div>
        )}

        <div className={styles.assistant} ref={assistantRef}>
          <div ref={hostRef} />
          {!isAvailable && <StandInComposer inputRef={standInRef} />}
        </div>

        {!isChatting && (
          <>
            <ul className={styles.suggestions} aria-label="Try asking">
              {suggestions.map((suggestion) => (
                <li key={suggestion.label}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => fill(suggestion.prompt)}
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
            <nav className={styles.links} aria-label="Without the assistant">
              <Link href={CATALOGUE_URL}>Browse the catalogue</Link>
              <Link href="/publish/1">Publish an asset</Link>
            </nav>
          </>
        )}

        <p className={styles.fine}>
          AI answers can be wrong. Nothing is paid without your confirmation.
        </p>
      </div>
    </section>
  )
}

export default function HomePage(): ReactElement {
  return <HeroSection />
}
