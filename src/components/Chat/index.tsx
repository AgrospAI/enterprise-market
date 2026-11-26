import {
  Fragment,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { useAccount, useSwitchChain } from 'wagmi'
import Alert from '@shared/atoms/Alert'
import Button from '@shared/atoms/Button'
import Loader from '@shared/atoms/Loader'
import { ChatContext, PreviousChat, useChat } from '@hooks/useChat'
import { useChatPanel } from '@context/ChatPanel'
import { useSiweSession } from '@hooks/useSiweSession'
import { markdownToChatHtml } from '@utils/markdown'
import type { JobReport } from '@utils/chat/jobResults'
import {
  CHAT_MAX_CONTEXT_CHARS,
  ChatMessage,
  ChatStep,
  ChatUsage,
  JobResultAttachment
} from 'src/@types/Chat'
import type { ChatIntent } from 'src/@types/ChatIntent'
import IntentCard from './IntentCard'
import { Suggestion, searchSuggestions, suggestionsFor } from './suggestions'
import Composer, {
  ASSISTANT_PLACEHOLDER,
  AssistantMark,
  ComposerGate
} from './Composer'
import { ANONYMOUS_CHAT } from '@utils/chatHistory'
import {
  ArrowDownIcon,
  CheckIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  MoreIcon,
  NewChatIcon,
  SparkleIcon
} from './icons'
import { isToggleShortcut } from './shortcut'
import { openWalletMenu } from './openWalletMenu'
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

function Steps({
  steps,
  isRunning
}: {
  steps: ChatStep[]
  /** The answer they belong to is still being written. */
  isRunning: boolean
}): ReactElement {
  const toolCount = steps.filter((step) => step.type === 'tool').length
  return (
    <details className={styles.steps}>
      <summary>
        {isRunning ? (
          <span className={styles.stepsSpinner} aria-hidden="true" />
        ) : (
          <CheckIcon className={styles.stepsDone} />
        )}
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
  isRunning,
  isLiveIntent,
  onRunningChange,
  onAskAboutResults,
  canAsk,
  reportsOf
}: {
  message: ChatMessage
  /** The answer is still being written. */
  isRunning: boolean
  isLiveIntent: (intent: ChatIntent) => boolean
  onRunningChange: (running: boolean) => void
  onAskAboutResults: (
    attachment: JobResultAttachment,
    reports: JobReport[]
  ) => void
  canAsk: boolean
  /** Links to the reports of a job read in this page; none after a reload. */
  reportsOf: (jobId: string) => JobReport[]
}): ReactElement {
  if (message.role === 'user') {
    const { attachment } = message
    return (
      <div className={styles.userMessage}>
        <p>{message.content}</p>
        {attachment && (
          <p className={styles.attachment}>
            {attachment.succeeded ? 'Results' : 'Log'} of {attachment.algorithm}{' '}
            on {attachment.dataset}
            {reportsOf(attachment.jobId).map((report) => (
              <Fragment key={report.url}>
                {' · '}
                <a href={report.url} target="_blank" rel="noopener noreferrer">
                  Open {report.name}
                </a>
              </Fragment>
            ))}
          </p>
        )}
      </div>
    )
  }
  return (
    <div>
      {message.steps?.length > 0 && (
        <Steps steps={message.steps} isRunning={isRunning} />
      )}
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
          onAskAboutResults={onAskAboutResults}
          canAsk={canAsk}
        />
      ))}
    </div>
  )
}

export { suggestionsFor }

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
  /** Neither on the home page, where the assistant is part of the page. */
  onToggleExpanded?: () => void
  onClose?: () => void
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
        {onToggleExpanded && (
          <IconButton
            label={isExpanded ? 'Make narrower' : 'Make wider'}
            className={styles.expandButton}
            onClick={onToggleExpanded}
          >
            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        )}
        {onClose && (
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </div>
    </header>
  )
}

const BUSY_REASON = 'Wait until the action in progress finishes'
/** Under the home page's box, while the assistant can only search. */
export const SIGN_IN_FOR_MORE =
  'Searching is open to everyone. Sign in with your wallet to download data or run jobs.'
// How far from the end still counts as reading the latest message.
const BOTTOM_SLACK_PX = 32

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

const formatTokens = (tokens: number) =>
  tokens >= 1000 ? `${Math.round(tokens / 100) / 10}k` : String(tokens)

/** At this share of the budget, the meter warns that the chat will forget. */
const CONTEXT_WARNING = 0.8

/**
 * How much of the conversation the assistant still reads: the share of the
 * context budget the next message takes, full once older messages are left
 * out. The tokens of the last answer, when the model server gives them, are in
 * its description.
 */
export function ContextMeter({
  context,
  usage
}: {
  context: ChatContext
  usage?: ChatUsage
}): ReactElement {
  const forgets = context.firstSent > 0
  const share = forgets
    ? 1
    : Math.min(1, context.chars / CHAT_MAX_CONTEXT_CHARS)
  const percent = Math.round(share * 100)
  const memory = forgets
    ? `Memory full: the assistant reads only the last ${context.messages.length} messages. Start a new chat to begin fresh.`
    : `Memory ${percent}% used. Past 100%, the assistant stops reading the oldest messages.`
  const tokens = usage
    ? ` Last answer: ${formatTokens(
        usage.promptTokens + usage.completionTokens
      )}${
        usage.contextTokens ? ` of ${formatTokens(usage.contextTokens)}` : ''
      } tokens.`
    : ''
  const label = `${memory}${tokens}`
  // A circle of circumference 100, so the dash is the percentage.
  const radius = 100 / (2 * Math.PI)
  return (
    <span
      className={`${styles.contextMeter} ${
        share >= CONTEXT_WARNING ? styles.contextMeterFull : ''
      }`}
      role="img"
      aria-label={label}
      title={label}
      tabIndex={0}
      data-testid="context-meter"
    >
      <svg viewBox="0 0 36 36" width="18" height="18" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} className={styles.contextTrack} />
        <circle
          cx="18"
          cy="18"
          r={radius}
          className={styles.contextFill}
          strokeDasharray={`${percent} 100`}
          transform="rotate(-90 18 18)"
        />
      </svg>
    </span>
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
  isInline,
  onSessionLost,
  onSignOut,
  signInGate
}: {
  /** The session's wallet, or ANONYMOUS_CHAT for a visitor without one. */
  address: string
  suggestions: Suggestion[]
  header: (actions: ReactNode) => ReactElement
  /** On the home page, which shows its own suggestions around it. */
  isInline: boolean
  onSessionLost: () => void
  onSignOut: () => void
  /** Without a session: how to sign in for more than searching. */
  signInGate?: ReactNode
}): ReactElement {
  const isSearchOnly = address === ANONYMOUS_CHAT
  const {
    messages,
    context,
    usage,
    isStreaming,
    activeTool,
    error,
    send,
    askAboutResults,
    stop,
    clear,
    previous,
    restorePrevious,
    isLiveIntent
  } = useChat(address, onSessionLost)
  const { draft, setDraft, isSendPending, setSendPending, setChatting } =
    useChatPanel()
  // Cards sending orders, payments or a job: the conversation must stay.
  const [runningCards, setRunningCards] = useState(0)
  const isBusy = runningCards > 0
  const onRunningChange = useCallback((running: boolean) => {
    setRunningCards((count) => Math.max(0, count + (running ? 1 : -1)))
  }, [])
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Follow new text only while the user is at the bottom: scrolling up to read
  // must not be undone by every piece of the answer.
  const followsLatest = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  useEffect(() => {
    if (followsLatest.current)
      endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, activeTool, isStreaming])

  function handleScroll() {
    const list = listRef.current
    if (!list) return
    const atBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight <= BOTTOM_SLACK_PX
    followsLatest.current = atBottom
    setIsAtBottom(atBottom)
  }

  function jumpToLatest() {
    followsLatest.current = true
    setIsAtBottom(true)
    // Not smooth: the frames of the animation would read as scrolling up.
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }

  /** Sends a message and follows the answer, wherever the user had scrolled. */
  function sendAndFollow(text: string) {
    followsLatest.current = true
    setIsAtBottom(true)
    send(text)
  }

  // Links to the reports of the jobs read in this page, for the messages that sent them.
  const [reportsByJob, setReportsByJob] = useState<Record<string, JobReport[]>>(
    {}
  )
  const reportsOf = useCallback(
    (jobId: string) => reportsByJob[jobId] ?? [],
    [reportsByJob]
  )

  const askAndFollow = useCallback(
    (attachment: JobResultAttachment, reports: JobReport[]) => {
      if (reports.length) {
        setReportsByJob((known) => ({ ...known, [attachment.jobId]: reports }))
      }
      followsLatest.current = true
      setIsAtBottom(true)
      askAboutResults(attachment)
    },
    [askAboutResults]
  )

  const hasConversation = messages.length > 0 || isStreaming
  useEffect(() => setChatting(hasConversation), [hasConversation, setChatting])
  useEffect(() => () => setChatting(false), [setChatting])

  // A message sent before signing in goes now. Not in the first render: the
  // saved conversation it continues is only loaded by then.
  const [isLoaded, setLoaded] = useState(false)
  useEffect(() => setLoaded(true), [])
  useEffect(() => {
    if (!isLoaded || !isSendPending) return
    setSendPending(false)
    if (!draft.trim()) return
    sendAndFollow(draft)
    setDraft('')
    // Only when it is asked for: the draft changes with every key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSendPending])

  function handleSubmit() {
    sendAndFollow(draft)
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

  // On the home page, an empty conversation is only its message box.
  const showsLog = !isInline || hasConversation || !!previous || !!error

  return (
    <>
      {showsLog &&
        header(
          <>
            {messages.length > 0 && (
              <ContextMeter context={context} usage={usage} />
            )}
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
            {!isSearchOnly && (
              <MoreMenu onSignOut={signOutAndDelete} isBusy={isBusy} />
            )}
          </>
        )}

      <div
        ref={listRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        hidden={!showsLog}
        onScroll={handleScroll}
      >
        {messages.length === 0 && previous && (
          <PreviousNotice previous={previous} onRestore={restorePrevious} />
        )}
        {messages.length === 0 && !isInline && (
          <div className={styles.welcome}>
            {isSearchOnly ? (
              <>
                <p className={styles.welcomeTitle}>Find data by chat</p>
                <p className={styles.hint}>
                  Say what you are looking for, in your own words, and I search
                  the catalogue. Sign in with your wallet to also download
                  datasets or run Compute-to-Data jobs.
                </p>
              </>
            ) : (
              <>
                <p className={styles.welcomeTitle}>
                  Find, buy and use data by chat
                </p>
                <p className={styles.hint}>
                  Search the catalogue, download datasets or run Compute-to-Data
                  jobs: just say what you need. I prepare each action, and you
                  check it and sign it in your wallet.
                </p>
                <ul className={styles.capabilities} aria-label="What I can do">
                  <li>Search the catalogue</li>
                  <li>Buy and download</li>
                  <li>Run Compute-to-Data jobs</li>
                </ul>
              </>
            )}
            <ul className={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.label}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => sendAndFollow(suggestion.prompt)}
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((message, index) => (
          <Fragment key={index}>
            {index > 0 && index === context.firstSent && (
              <p className={styles.contextCut} role="note">
                The assistant no longer reads the messages above.
              </p>
            )}
            <Message
              message={message}
              isRunning={isStreaming && index === messages.length - 1}
              isLiveIntent={isLiveIntent}
              onRunningChange={onRunningChange}
              onAskAboutResults={askAndFollow}
              canAsk={!isStreaming}
              reportsOf={reportsOf}
            />
          </Fragment>
        ))}
        {isStreaming && (
          <div className={styles.status}>
            <Loader />
            <span>{activeTool ? 'Searching the market…' : 'Thinking…'}</span>
          </div>
        )}
        {error && <Alert state="error" text={error} />}
        {!isAtBottom && messages.length > 0 && (
          <button
            type="button"
            className={styles.jumpToLatest}
            onClick={jumpToLatest}
          >
            <ArrowDownIcon />
            {isStreaming ? 'Follow the answer' : 'Jump to latest'}
          </button>
        )}
        <div ref={endRef} />
      </div>

      <div className={styles.form}>
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          inputRef={inputRef}
          isStreaming={isStreaming}
          onStop={stop}
          isLarge={isInline}
          leading={isInline ? <AssistantMark /> : undefined}
          placeholder={isInline ? ASSISTANT_PLACEHOLDER : undefined}
        >
          {signInGate}
        </Composer>
        <p className={styles.disclaimer}>
          AI answers can be wrong. Nothing is paid without your confirmation.
        </p>
      </div>
    </>
  )
}

/** Sign in first: on the home page, under the message the user is writing. */
function InlineSignIn({
  gate
}: {
  gate: (text: string) => ReactElement
}): ReactElement {
  const { draft, setDraft, isSendPending, setSendPending } = useChatPanel()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  return (
    <div className={styles.form}>
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={() => setSendPending(true)}
        inputRef={inputRef}
        isLarge
        leading={<AssistantMark />}
        placeholder={ASSISTANT_PLACEHOLDER}
      >
        {isSendPending &&
          gate('Sign a message with your wallet to send. It costs no gas.')}
      </Composer>
    </div>
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
    anonymousSearch,
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
    inlineHost,
    isChatting,
    setAvailable,
    setOpen,
    toggle,
    setExpanded,
    setSearchOnly
  } = useChatPanel()
  const panelRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  const usedPointer = useRef(false)
  const openedWithPointer = useRef(false)
  // The assistant is drawn in a node of its own, which is moved between the
  // side panel's place and the home page's: React keeps it mounted, so an
  // answer in progress goes on when the user leaves the home page.
  const [portalNode] = useState(() => document.createElement('div'))
  const anchorRef = useRef<HTMLDivElement>(null)
  const isInline = isAvailable && Boolean(inlineHost)
  const wasInline = useRef(false)

  const pathname = router?.pathname ?? ''
  const isConfigured = status !== 'loading' && status !== 'disabled'
  // A visitor without a session can already search by chat: anything more
  // needs signing in.
  const isSearchOnly = isConfigured && status !== 'signedIn' && anonymousSearch
  const isUsable = isConfigured && (isConnected || isSearchOnly)
  // Publishing has its own steps and signatures: the assistant stays out of it.
  const isAllowedHere = !pathname.startsWith('/publish')

  useEffect(() => {
    setAvailable(isUsable && isAllowedHere)
  }, [isUsable, isAllowedHere, setAvailable])

  useEffect(() => setSearchOnly(isSearchOnly), [isSearchOnly, setSearchOnly])

  useEffect(
    () => () => {
      setAvailable(false)
      setSearchOnly(false)
    },
    [setAvailable, setSearchOnly]
  )

  useLayoutEffect(() => {
    const parent = isInline ? inlineHost : anchorRef.current
    if (parent && portalNode.parentNode !== parent) {
      parent.appendChild(portalNode)
    }
  }, [isInline, inlineHost, portalNode])

  useEffect(() => () => portalNode.remove(), [portalNode])

  // Leaving the home page in the middle of a conversation: it goes on in the panel.
  useEffect(() => {
    if (wasInline.current && !isInline && isChatting) setOpen(true)
    wasInline.current = isInline
  }, [isInline, isChatting, setOpen])

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
      if (!isInline && panelRef.current?.contains(focused)) {
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
  }, [isOpen, isInline])

  const did = typeof router?.query?.did === 'string' ? router.query.did : null
  const close = () => setOpen(false)
  const header = (actions?: ReactNode) =>
    isInline ? (
      <PanelHeader isExpanded={false}>{actions}</PanelHeader>
    ) : (
      <PanelHeader
        isExpanded={isExpanded}
        onToggleExpanded={() => setExpanded(!isExpanded)}
        onClose={close}
      >
        {actions}
      </PanelHeader>
    )

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isInline) close()
  }

  const signInButton = (isSmall: boolean) =>
    !isConnected ? (
      <Button
        type="button"
        style="primary"
        size={isSmall ? 'small' : undefined}
        onClick={openWalletMenu}
      >
        Connect wallet
      </Button>
    ) : isOnRequiredChain ? (
      <Button
        type="button"
        style="primary"
        size={isSmall ? 'small' : undefined}
        disabled={!canSign || status === 'signingIn'}
        onClick={signIn}
      >
        {status === 'signingIn' ? 'Waiting for signature…' : 'Sign in'}
      </Button>
    ) : (
      <Button
        type="button"
        style="primary"
        size={isSmall ? 'small' : undefined}
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: requiredChainId })}
      >
        Switch network
      </Button>
    )
  const signInAction = signInButton(isInline)

  function signedOut(): ReactNode {
    if (isInline) {
      return (
        <>
          <InlineSignIn
            gate={(text) => (
              <ComposerGate text={text}>{signInAction}</ComposerGate>
            )}
          />
          {error && <Alert state="error" text={error} />}
        </>
      )
    }
    return (
      <>
        {header()}
        <div className={styles.signIn} data-autofocus-within>
          <p>
            Sign a message with your wallet to use the assistant. It costs no
            gas and authorizes no transaction.
          </p>
          {error && <Alert state="error" text={error} />}
          {signInAction}
        </div>
      </>
    )
  }

  const section = (
    // Only hidden when closed, so an answer in progress is not interrupted.
    <section
      id="market-assistant"
      ref={panelRef}
      tabIndex={-1}
      className={
        isInline
          ? `${styles.inline} ${isChatting ? styles.chatting : ''}`
          : [
              styles.panel,
              isOpen ? styles.open : '',
              isExpanded ? styles.expanded : ''
            ].join(' ')
      }
      aria-label="AgrospAI Assistant"
      aria-hidden={!isInline && !isOpen}
      onKeyDown={handleKeyDown}
    >
      {status === 'signedIn' && sessionAddress ? (
        <Conversation
          address={sessionAddress}
          suggestions={suggestionsFor(pathname, did)}
          header={header}
          isInline={isInline}
          onSessionLost={markSignedOut}
          onSignOut={signOut}
        />
      ) : isSearchOnly ? (
        <>
          <Conversation
            address={ANONYMOUS_CHAT}
            suggestions={searchSuggestions()}
            header={header}
            isInline={isInline}
            onSessionLost={markSignedOut}
            onSignOut={markSignedOut}
            signInGate={
              <ComposerGate text={SIGN_IN_FOR_MORE}>
                {signInButton(true)}
              </ComposerGate>
            }
          />
          {error && <Alert state="error" text={error} />}
        </>
      ) : (
        signedOut()
      )}
    </section>
  )

  return (
    <>
      <div ref={anchorRef} className={styles.anchor} />
      {isUsable && createPortal(section, portalNode)}
    </>
  )
}
