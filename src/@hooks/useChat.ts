import { useCallback, useEffect, useRef, useState } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import {
  clearChatHistory,
  readChatHistory,
  writeChatHistory
} from '@utils/chatHistory'
import { readChatStream } from '@utils/chatStream'
import {
  CHAT_MAX_CONTEXT_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  ChatMessage,
  ChatStep
} from 'src/@types/Chat'
import type { ChatIntent } from 'src/@types/ChatIntent'

function requestErrorMessage(status: number): string {
  if (status === 429) return 'Too many messages. Please wait a moment.'
  if (status === 409) return 'Your previous message is still being answered.'
  return 'The assistant is unavailable right now. Please try again.'
}

export function useChat(
  address: string | undefined,
  onSessionLost: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string>()
  const [error, setError] = useState<string>()
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
    setMessages(address ? readChatHistory(address) : [])
  }, [address, cancelRequest])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!address || !content || isStreaming) return
      if (content.length > CHAT_MAX_MESSAGE_CHARS) {
        setError('That message is too long.')
        return
      }

      const history: ChatMessage[] = [...messages, { role: 'user', content }]
      setMessages(history)
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
          body: JSON.stringify({
            messages: history
              .filter((message) => message.content.trim())
              .slice(-CHAT_MAX_CONTEXT_MESSAGES)
              .map(({ role, content }) => ({
                role,
                content: content.slice(0, CHAT_MAX_MESSAGE_CHARS)
              }))
          }),
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

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const clear = useCallback(() => {
    cancelRequest()
    setMessages([])
    setError(undefined)
    if (address) clearChatHistory(address)
  }, [address, cancelRequest])

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
    stop,
    clear,
    isLiveIntent
  }
}
