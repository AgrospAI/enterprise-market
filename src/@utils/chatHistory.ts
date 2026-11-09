import type { ChatMessage, ChatStep } from 'src/@types/Chat'
import { parseChatIntent } from 'src/@types/ChatIntent'

export const CHAT_HISTORY_LIMIT = 50
const STORAGE_PREFIX = 'chat:'

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

function isChatMessage(value: unknown): value is ChatMessage {
  const message = value as ChatMessage
  return (
    (message?.role === 'user' || message?.role === 'assistant') &&
    typeof message.content === 'string'
  )
}

function isChatStep(value: unknown): value is ChatStep {
  const step = value as ChatStep
  return (
    (step?.type === 'tool' && typeof step.name === 'string') ||
    (step?.type === 'note' && typeof step.text === 'string')
  )
}

function readMessage(message: ChatMessage): ChatMessage {
  const steps = Array.isArray(message.steps)
    ? message.steps.filter(isChatStep)
    : []
  const intents = Array.isArray(message.intents)
    ? message.intents.map(parseChatIntent).filter(Boolean)
    : []
  const { role, content } = message
  return {
    role,
    content,
    ...(steps.length ? { steps } : {}),
    ...(intents.length ? { intents } : {})
  }
}

/** The saved conversation of a wallet. Storage may be blocked or hold anything. */
export function readChatHistory(address: string): ChatMessage[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(storageKey(address)) ?? '[]'
    )
    return Array.isArray(parsed)
      ? parsed.filter(isChatMessage).map(readMessage)
      : []
  } catch {
    return []
  }
}

export function writeChatHistory(
  address: string,
  messages: ChatMessage[]
): void {
  try {
    window.localStorage.setItem(
      storageKey(address),
      JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT))
    )
  } catch {}
}

export function clearChatHistory(address: string): void {
  try {
    window.localStorage.removeItem(storageKey(address))
  } catch {}
}
