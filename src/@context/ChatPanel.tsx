import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'

/**
 * Where the market assistant is shown and what is being written to it, shared
 * by the header button that opens it, the panel itself, the layout that makes
 * room for it, and the home page, which shows it in the middle of the page.
 */
export interface ChatPanelValue {
  /** The panel reports it: the chat enabled, with a wallet or for searching. */
  isAvailable: boolean
  /** The side panel is open. Never while the assistant is on the home page. */
  isOpen: boolean
  isExpanded: boolean
  /** The home page's place for the assistant, while the home page is shown. */
  inlineHost: HTMLElement | null
  /** The conversation has messages: the home page makes room for them. */
  isChatting: boolean
  /** The message being written, kept while the user connects and signs in. */
  draft: string
  /** The user sent the draft before signing in: it goes once they have. */
  isSendPending: boolean
  /** A visitor without a session: the assistant only searches the catalogue. */
  isSearchOnly: boolean
  setAvailable: (value: boolean) => void
  setOpen: (value: boolean) => void
  toggle: () => void
  setExpanded: (value: boolean) => void
  setInlineHost: (host: HTMLElement | null) => void
  setChatting: (value: boolean) => void
  setDraft: (value: string) => void
  setSendPending: (value: boolean) => void
  setSearchOnly: (value: boolean) => void
}

const noop = (): void => undefined

const ChatPanelContext = createContext<ChatPanelValue>({
  isAvailable: false,
  isOpen: false,
  isExpanded: false,
  inlineHost: null,
  isChatting: false,
  draft: '',
  isSendPending: false,
  isSearchOnly: false,
  setAvailable: noop,
  setOpen: noop,
  toggle: noop,
  setExpanded: noop,
  setInlineHost: noop,
  setChatting: noop,
  setDraft: noop,
  setSendPending: noop,
  setSearchOnly: noop
})

/** Puts the cursor in the assistant's message box on the home page. */
function focusInlineInput(host: HTMLElement): void {
  host.querySelector<HTMLTextAreaElement>('textarea')?.focus()
}

function ChatPanelProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [isAvailable, setAvailable] = useState(false)
  const [isOpen, setOpen] = useState(false)
  const [isExpanded, setExpanded] = useState(false)
  const [inlineHost, setInlineHost] = useState<HTMLElement | null>(null)
  const [isChatting, setChatting] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSendPending, setSendPending] = useState(false)
  const [isSearchOnly, setSearchOnly] = useState(false)

  // On the home page the assistant is already in front of the user: opening it
  // means going to its message box.
  const toggle = useCallback(() => {
    if (inlineHost) focusInlineInput(inlineHost)
    else setOpen((open) => !open)
  }, [inlineHost])

  const value = useMemo(
    () => ({
      isAvailable,
      isOpen: isAvailable && isOpen && !inlineHost,
      isExpanded,
      inlineHost,
      isChatting,
      draft,
      isSendPending,
      isSearchOnly,
      setAvailable,
      setOpen,
      toggle,
      setExpanded,
      setInlineHost,
      setChatting,
      setDraft,
      setSendPending,
      setSearchOnly
    }),
    [
      isAvailable,
      isOpen,
      isExpanded,
      inlineHost,
      isChatting,
      draft,
      isSendPending,
      isSearchOnly,
      toggle
    ]
  )

  return (
    <ChatPanelContext.Provider value={value}>
      {children}
    </ChatPanelContext.Provider>
  )
}

const useChatPanel = (): ChatPanelValue => useContext(ChatPanelContext)

export { ChatPanelProvider, useChatPanel }
