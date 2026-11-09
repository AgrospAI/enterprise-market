import {
  FormEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/router'
import { useAccount, useSwitchChain } from 'wagmi'
import Alert from '@shared/atoms/Alert'
import Button from '@shared/atoms/Button'
import Loader from '@shared/atoms/Loader'
import { PreviousChat, useChat } from '@hooks/useChat'
import { useChatPanel } from '@context/ChatPanel'
import { useSiweSession } from '@hooks/useSiweSession'
import { markdownToChatHtml } from '@utils/markdown'
import type { ChatMessage, ChatStep } from 'src/@types/Chat'
import type { ChatIntent } from 'src/@types/ChatIntent'
import IntentCard from './IntentCard'
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  MoreIcon,
  NewChatIcon,
  SendIcon,
  SparkleIcon,
  StopIcon
} from './icons'
import { isToggleShortcut } from './shortcut'
import styles from './index.module.css'

const TOOL_LABELS: Record<string, string> = {
  search_assets: 'Searched the catalogue',
  get_asset: 'Read the details of an asset',
  get_compatible_algorithms: 'Checked compatible algorithms',
  get_compatible_datasets: 'Checked compatible datasets',
  list_compute_environments: 'Listed the compute environments',
  prepare_compute_job: 'Prepared a job',
  prepare_download: 'Prepared a download'
}

function Steps({ steps }: { steps: ChatStep[] }): ReactElement {
  const toolCount = steps.filter((step) => step.type === 'tool').length
  return (
    <details className={styles.steps}>
      <summary>
        {toolCount === 1
          ? 'Checked the market'
          : `Checked the market (${toolCount})`}
      </summary>
      <ul>
        {steps.map((step, index) => (
          <li key={index}>
            {step.type === 'tool'
              ? TOOL_LABELS[step.name] ?? 'Consulted the market'
              : step.text}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Message({
  message,
  isLiveIntent,
  onRunningChange
}: {
  message: ChatMessage
  isLiveIntent: (intent: ChatIntent) => boolean
  onRunningChange: (running: boolean) => void
}): ReactElement {
  if (message.role === 'user') {
    return <p className={styles.userMessage}>{message.content}</p>
  }
  return (
    <div>
      {message.steps?.length > 0 && <Steps steps={message.steps} />}
      <div
        className={styles.assistantMessage}
        // markdownToChatHtml drops embedded HTML and images, and only keeps https
        // links: this text comes from the model and, through it, from publishers.
        dangerouslySetInnerHTML={{
          __html: markdownToChatHtml(message.content)
        }}
      />
      {message.intents?.map((intent, index) => (
        <IntentCard
          key={index}
          intent={intent}
          live={isLiveIntent(intent)}
          onRunningChange={onRunningChange}
        />
      ))}
    </div>
  )
}

interface Suggestion {
  label: string
  prompt: string
}

const DOWNLOAD_PROMPT =
  'Find a free dataset I can download, and prepare the download for me.'
const COMPUTE_PROMPT =
  'Help me run a Compute-to-Data job: suggest a dataset and a compatible algorithm, then prepare the job.'

/**
 * What to start with, for the page the user is on. They mix searching with
 * doing, because the examples are how users learn what the assistant can do.
 */
export function suggestionsFor(pathname: string, did?: string): Suggestion[] {
  const ask = (label: string, prompt = label): Suggestion => ({ label, prompt })
  if (pathname === '/asset/[did]' && did) {
    return [
      ask(
        'What is this asset and what does it cost?',
        `What is the asset ${did} and what does it cost?`
      ),
      ask(
        'Get this asset for me',
        `Prepare what I need to use the asset ${did}: a download if it can be downloaded, otherwise a Compute-to-Data job with a compatible algorithm or dataset.`
      ),
      ask(
        'What can I run with this asset?',
        `What can I run with the asset ${did}? Show what it is compatible with.`
      )
    ]
  }
  if (pathname === '/search') {
    return [
      ask('Find algorithms for satellite images'),
      ask('Download a free dataset', DOWNLOAD_PROMPT),
      ask('Run an algorithm without downloading the data', COMPUTE_PROMPT)
    ]
  }
  return [
    ask('Find datasets about soil or crops'),
    ask('Download a free dataset', DOWNLOAD_PROMPT),
    ask('Run an algorithm on a dataset', COMPUTE_PROMPT)
  ]
}

// What gets the focus when the panel opens: the message box, or the sign-in.
const AUTOFOCUS = '[data-autofocus], [data-autofocus-within] button'

function IconButton({
  label,
  className,
  children,
  ...props
}: {
  label: string
  className?: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}): ReactElement {
  return (
    <button
      type="button"
      className={
        className ? `${styles.iconButton} ${className}` : styles.iconButton
      }
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  )
}

function PanelHeader({
  isExpanded,
  onToggleExpanded,
  onClose,
  children
}: {
  isExpanded: boolean
  onToggleExpanded: () => void
  onClose: () => void
  children?: ReactNode
}): ReactElement {
  return (
    <header className={styles.header}>
      <h2 className={styles.title}>
        <SparkleIcon className={styles.titleIcon} />
        <span>
          {/* Only on a wide panel: next to "New chat", it would wrap. */}
          <span className={styles.titleBrand}>AgrospAI </span>
          Assistant
        </span>
      </h2>
      <div className={styles.headerActions}>
        {children}
        <IconButton
          label={isExpanded ? 'Make narrower' : 'Make wider'}
          className={styles.expandButton}
          onClick={onToggleExpanded}
        >
          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
        <IconButton label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
    </header>
  )
}

const BUSY_REASON = 'Wait until the action in progress finishes'

function formatSavedAt(updatedAt?: number): string {
  if (!updatedAt) return 'an earlier visit'
  return new Date(updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

/** Brings back a conversation that was put aside or just deleted. */
function PreviousNotice({
  previous,
  onRestore
}: {
  previous: PreviousChat
  onRestore: () => void
}): ReactElement {
  return (
    <p className={styles.previous}>
      <span>
        {previous.reason === 'deleted'
          ? 'Conversation deleted.'
          : `Your last conversation is from ${formatSavedAt(
              previous.updatedAt
            )}. A new one starts here.`}
      </span>
      <button type="button" className={styles.linkButton} onClick={onRestore}>
        {previous.reason === 'deleted' ? 'Undo' : 'Continue it'}
      </button>
    </p>
  )
}

function MoreMenu({
  onSignOut,
  isBusy
}: {
  onSignOut: () => void
  isBusy: boolean
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [isOpen])

  return (
    <div
      ref={ref}
      className={styles.more}
      onKeyDown={(event) => {
        // Escape closes this menu first, and the panel only the next time.
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation()
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={styles.iconButton}
        aria-label="More options"
        title="More options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreIcon />
      </button>
      {isOpen && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            disabled={isBusy}
            title={isBusy ? BUSY_REASON : undefined}
            onClick={() => {
              setIsOpen(false)
              onSignOut()
            }}
          >
            Sign out and delete conversation
          </button>
        </div>
      )}
    </div>
  )
}

function Conversation({
  address,
  suggestions,
  header,
  onSessionLost,
  onSignOut
}: {
  address: string
  suggestions: Suggestion[]
  header: (actions: ReactNode) => ReactElement
  onSessionLost: () => void
  onSignOut: () => void
}): ReactElement {
  const {
    messages,
    isStreaming,
    activeTool,
    error,
    send,
    stop,
    clear,
    previous,
    restorePrevious,
    isLiveIntent
  } = useChat(address, onSessionLost)
  const [draft, setDraft] = useState('')
  // Cards sending orders, payments or a job: the conversation must stay.
  const [runningCards, setRunningCards] = useState(0)
  const isBusy = runningCards > 0
  const onRunningChange = useCallback((running: boolean) => {
    setRunningCards((count) => Math.max(0, count + (running ? 1 : -1)))
  }, [])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, activeTool])

  // The message box grows with the text, up to a few lines.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    if (input.scrollHeight) {
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`
    }
  }, [draft])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || isStreaming) return
    send(draft)
    setDraft('')
  }

  function startOver() {
    if (isBusy) return
    clear()
    inputRef.current?.focus()
  }

  function signOutAndDelete() {
    if (isBusy) return
    // On a shared computer, signing out should not leave the conversation behind.
    clear()
    onSignOut()
  }

  return (
    <>
      {header(
        <>
          <button
            type="button"
            className={styles.newChat}
            aria-label="New chat"
            title={isBusy ? BUSY_REASON : 'Start a new conversation'}
            disabled={isBusy || (messages.length === 0 && !isStreaming)}
            onClick={startOver}
          >
            <NewChatIcon />
            <span className={styles.newChatLabel}>New chat</span>
          </button>
          <MoreMenu onSignOut={signOutAndDelete} isBusy={isBusy} />
        </>
      )}

      <div className={styles.messages} aria-live="polite">
        {messages.length === 0 && previous && (
          <PreviousNotice previous={previous} onRestore={restorePrevious} />
        )}
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <p className={styles.welcomeTitle}>
              Find, buy and use data by chat
            </p>
            <p className={styles.hint}>
              Search the catalogue, download datasets or run Compute-to-Data
              jobs: just say what you need. I prepare each action, and you check
              it and sign it in your wallet.
            </p>
            <ul className={styles.capabilities} aria-label="What I can do">
              <li>Search the catalogue</li>
              <li>Buy and download</li>
              <li>Run Compute-to-Data jobs</li>
            </ul>
            <ul className={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.label}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => send(suggestion.prompt)}
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((message, index) => (
          <Message
            key={index}
            message={message}
            isLiveIntent={isLiveIntent}
            onRunningChange={onRunningChange}
          />
        ))}
        {isStreaming && (
          <div className={styles.status}>
            <Loader />
            <span>{activeTool ? 'Searching the market…' : 'Thinking…'}</span>
          </div>
        )}
        {error && <Alert state="error" text={error} />}
        <div ref={endRef} />
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            aria-label="Message"
            placeholder="Search, download or run a job…"
            rows={1}
            value={draft}
            data-autofocus
            onChange={(event) => setDraft(event.target.value)}
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
              onClick={stop}
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              className={styles.sendButton}
              aria-label="Send"
              title="Send"
              disabled={!draft.trim()}
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className={styles.disclaimer}>
          AI answers can be wrong. Nothing is paid without your confirmation.
        </p>
      </form>
    </>
  )
}

export default function Chat(): ReactElement | null {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const {
    status,
    sessionAddress,
    requiredChainId,
    isOnRequiredChain,
    canSign,
    error,
    signIn,
    signOut,
    markSignedOut
  } = useSiweSession()
  const {
    isAvailable,
    isOpen,
    isExpanded,
    setAvailable,
    setOpen,
    toggle,
    setExpanded
  } = useChatPanel()
  const panelRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  const usedPointer = useRef(false)
  const openedWithPointer = useRef(false)

  const pathname = router?.pathname ?? ''
  const isUsable = isConnected && status !== 'loading' && status !== 'disabled'
  // Publishing has its own steps and signatures: the assistant stays out of it.
  const isAllowedHere = !pathname.startsWith('/publish')

  useEffect(() => {
    setAvailable(isUsable && isAllowedHere)
  }, [isUsable, isAllowedHere, setAvailable])

  useEffect(() => () => setAvailable(false), [setAvailable])

  useEffect(() => {
    if (!isAvailable) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isToggleShortcut(event)) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAvailable, toggle])

  // Whether the last input was the mouse (or touch) or the keyboard.
  useEffect(() => {
    const pointer = () => {
      usedPointer.current = true
    }
    const keyboard = () => {
      usedPointer.current = false
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', keyboard, true)
    }
  }, [])

  // Focus moves into the panel when it opens. When it closes, a keyboard user
  // gets it back where they came from, as for a dialog; after a mouse click it
  // is only let go, so the header button is not left with a focus ring.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      returnFocus.current = document.activeElement as HTMLElement
      openedWithPointer.current = usedPointer.current
      const panel = panelRef.current
      ;(panel?.querySelector<HTMLElement>(AUTOFOCUS) ?? panel)?.focus()
    } else if (!isOpen && wasOpen.current) {
      const focused = document.activeElement as HTMLElement
      if (panelRef.current?.contains(focused)) {
        const previous = returnFocus.current
        const target =
          previous && previous !== document.body && previous.isConnected
            ? previous
            : document.querySelector<HTMLElement>(
                '[aria-controls="market-assistant"]'
              )
        if (openedWithPointer.current) focused.blur()
        else target?.focus()
      }
    }
    wasOpen.current = isOpen
  }, [isOpen])

  if (!isUsable) return null

  const did = typeof router?.query?.did === 'string' ? router.query.did : null
  const close = () => setOpen(false)
  const header = (actions?: ReactNode) => (
    <PanelHeader
      isExpanded={isExpanded}
      onToggleExpanded={() => setExpanded(!isExpanded)}
      onClose={close}
    >
      {actions}
    </PanelHeader>
  )

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  return (
    // Only hidden when closed, so an answer in progress is not interrupted.
    <section
      id="market-assistant"
      ref={panelRef}
      tabIndex={-1}
      className={[
        styles.panel,
        isOpen ? styles.open : '',
        isExpanded ? styles.expanded : ''
      ].join(' ')}
      aria-label="AgrospAI Assistant"
      aria-hidden={!isOpen}
      onKeyDown={handleKeyDown}
    >
      {status === 'signedIn' && sessionAddress ? (
        <Conversation
          address={sessionAddress}
          suggestions={suggestionsFor(pathname, did)}
          header={header}
          onSessionLost={markSignedOut}
          onSignOut={signOut}
        />
      ) : (
        <>
          {header()}
          <div className={styles.signIn} data-autofocus-within>
            <p>
              Sign a message with your wallet to use the assistant. It costs no
              gas and authorizes no transaction.
            </p>
            {error && <Alert state="error" text={error} />}
            {isOnRequiredChain ? (
              <Button
                type="button"
                style="primary"
                disabled={!canSign || status === 'signingIn'}
                onClick={signIn}
              >
                {status === 'signingIn' ? 'Waiting for signature…' : 'Sign in'}
              </Button>
            ) : (
              <Button
                type="button"
                style="primary"
                disabled={isSwitching}
                onClick={() => switchChain({ chainId: requiredChainId })}
              >
                Switch network
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
