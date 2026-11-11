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
 * Whether the market assistant's panel is open, shared by the header button
 * that opens it, the panel itself, and the layout that makes room for it.
 */
export interface ChatPanelValue {
  /** The panel reports it: a connected wallet and the chat enabled. */
  isAvailable: boolean
  isOpen: boolean
  isExpanded: boolean
  setAvailable: (value: boolean) => void
  setOpen: (value: boolean) => void
  toggle: () => void
  setExpanded: (value: boolean) => void
}

const noop = (): void => undefined

const ChatPanelContext = createContext<ChatPanelValue>({
  isAvailable: false,
  isOpen: false,
  isExpanded: false,
  setAvailable: noop,
  setOpen: noop,
  toggle: noop,
  setExpanded: noop
})

function ChatPanelProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [isAvailable, setAvailable] = useState(false)
  const [isOpen, setOpen] = useState(false)
  const [isExpanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setOpen((open) => !open), [])

  const value = useMemo(
    () => ({
      isAvailable,
      isOpen: isAvailable && isOpen,
      isExpanded,
      setAvailable,
      setOpen,
      toggle,
      setExpanded
    }),
    [isAvailable, isOpen, isExpanded, toggle]
  )

  return (
    <ChatPanelContext.Provider value={value}>
      {children}
    </ChatPanelContext.Provider>
  )
}

const useChatPanel = (): ChatPanelValue => useContext(ChatPanelContext)

export { ChatPanelProvider, useChatPanel }
