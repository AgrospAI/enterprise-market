import { useCallback, useEffect, useRef, useState } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import {
  clearChatHistory,
  isChatStale,
  readSavedChat,
  writeChatHistory
} from '@utils/chatHistory'
import { readChatStream } from '@utils/chatStream'
import {
  CHAT_MAX_CONTEXT_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  ChatMessage,
  ChatStep,
  JobResultAttachment
} from 'src/@types/Chat'
import type { ChatIntent } from 'src/@types/ChatIntent'

/** What the user asks when they send a job's results from its card. */
export const RESULTS_QUESTION = 'What do the results of this job show?'

/**
 * The messages sent to the server. Only the latest job results go with them:
 * older ones would fill the model's context, and the server takes one.
 */
export function toRequestMessages(history: ChatMessage[]) {
  const recent = history
    .filter((message) => message.content.trim())
    .slice(-CHAT_MAX_CONTEXT_MESSAGES)
  const withResults = recent.map((message) => !!message.attachment)
  const latest = withResults.lastIndexOf(true)
  return recent.map(({ role, content, attachment }, index) => ({
    role,
    content: content.slice(0, CHAT_MAX_MESSAGE_CHARS),
    ...(attachment && index === latest ? { attachment } : {})
  }))
}

function requestErrorMessage(status: number): string {
  if (status === 429) return 'Too many messages. Please wait a moment.'
  if (status === 409) return 'Your previous message is still being answered.'
  return 'The assistant is unavailable right now. Please try again.'
}

/**
 * A conversation that is not shown but can be brought back: one left too long
 * ago, or one the user has just deleted.
 */
export interface PreviousChat {
  reason: 'stale' | 'deleted'
  messages: ChatMessage[]
  updatedAt?: number
}

export function useChat(
  address: string | undefined,
  onSessionLost: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string>()
  const [error, setError] = useState<string>()
  const [previous, setPrevious] = useState<PreviousChat>()
  const abortRef = useRef<AbortController>()
  // Intents received in this page. Saved ones are shown, but cannot run again.
  const liveIntents = useRef(new WeakSet<ChatIntent>())

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = undefined
  }, [])

  useEffect(() => {
    cancelRequest()
    setError(undefined)
    const saved = address ? readSavedChat(address) : { messages: [] }
    // It stays saved until a new message replaces it, so it can be continued.
    if (saved.messages.length && isChatStale(saved)) {
      setMessages([])
      setPrevious({ reason: 'stale', ...saved })
    } else {
      setMessages(saved.messages)
      setPrevious(undefined)
    }
  }, [address, cancelRequest])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (text: string, attachment?: JobResultAttachment) => {
      const content = text.trim()
      if (!address || !content || isStreaming) return
      if (content.length > CHAT_MAX_MESSAGE_CHARS) {
        setError('That message is too long.')
        return
      }

      const history: ChatMessage[] = [
        ...messages,
        { role: 'user', content, ...(attachment ? { attachment } : {}) }
      ]
      setMessages(history)
      // A new conversation replaces the one put aside when it is saved.
      setPrevious(undefined)
      setError(undefined)
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      let answer = ''
      const steps: ChatStep[] = []
      const intents: ChatIntent[] = []
      const withAnswer = (): ChatMessage[] => {
        const content = answer.trim()
        return content || steps.length || intents.length
          ? [
              ...history,
              {
                role: 'assistant',
                content,
                ...(steps.length ? { steps: [...steps] } : {}),
                ...(intents.length ? { intents: [...intents] } : {})
              }
            ]
          : history
      }

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: toRequestMessages(history) }),
          signal: controller.signal
        })
        if (response.status === 401) {
          onSessionLost()
          return
        }
        if (!response.ok || !response.body) {
          setError(requestErrorMessage(response.status))
          return
        }

        await readChatStream(response.body, (event) => {
          if (event.type === 'text') {
            answer += event.delta
            setMessages(withAnswer())
          }
          if (event.type === 'narration') {
            const text = answer.trim()
            if (text) steps.push({ type: 'note', text })
            answer = ''
            setMessages(withAnswer())
          }
          if (event.type === 'tool') {
            if (event.status === 'running') {
              steps.push({ type: 'tool', name: event.name })
            }
            setActiveTool(event.status === 'running' ? event.name : undefined)
            setMessages(withAnswer())
          }
          if (event.type === 'intent') {
            liveIntents.current.add(event.intent)
            intents.push(event.intent)
            setMessages(withAnswer())
          }
          if (event.type === 'error') setError(event.message)
        })
      } catch (err) {
        if (!controller.signal.aborted) {
          LoggerInstance.error('[chat] Request failed', err)
          setError(requestErrorMessage(0))
        }
      } finally {
        setActiveTool(undefined)
        setIsStreaming(false)
        // A partial answer is kept, so stopping does not lose what was written.
        // Steps without an answer are dropped: there is nothing to send back. A
        // request cancelled by deleting the conversation must not bring it back.
        if (abortRef.current === controller) {
          const final = answer.trim() || intents.length ? withAnswer() : history
          setMessages(final)
          writeChatHistory(address, final)
        }
      }
    },
    [address, isStreaming, messages, onSessionLost]
  )

  /** Asks the assistant about the results of a job, read by its card. */
  const askAboutResults = useCallback(
    (attachment: JobResultAttachment) => send(RESULTS_QUESTION, attachment),
    [send]
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  /** Deletes the conversation. It can be brought back until a new message. */
  const clear = useCallback(() => {
    cancelRequest()
    setPrevious(messages.length ? { reason: 'deleted', messages } : undefined)
    setMessages([])
    setError(undefined)
    if (address) clearChatHistory(address)
  }, [address, cancelRequest, messages])

  const restorePrevious = useCallback(() => {
    if (!previous || !address) return
    setMessages(previous.messages)
    setPrevious(undefined)
    setError(undefined)
    writeChatHistory(address, previous.messages)
  }, [address, previous])

  const isLiveIntent = useCallback(
    (intent: ChatIntent) => liveIntents.current.has(intent),
    []
  )

  return {
    messages,
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
  }
}
