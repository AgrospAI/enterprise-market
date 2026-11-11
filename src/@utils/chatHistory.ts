import {
  ChatMessage,
  ChatStep,
  parseJobResultAttachment
} from 'src/@types/Chat'
import { parseChatIntent } from 'src/@types/ChatIntent'

export const CHAT_HISTORY_LIMIT = 50
/**
 * After this long without a message, the conversation is put aside: prices,
 * balances and results in it may be out of date, and it would be sent to the
 * model with every new question.
 */
export const CHAT_HISTORY_TTL_MS = 12 * 60 * 60 * 1000
const STORAGE_PREFIX = 'chat:'

export interface SavedChat {
  messages: ChatMessage[]
  /** When it was last written. Conversations saved before it was kept have none. */
  updatedAt?: number
}

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
  const attachment =
    message.role === 'user'
      ? parseJobResultAttachment(message.attachment)
      : undefined
  const { role, content } = message
  return {
    role,
    content,
    ...(steps.length ? { steps } : {}),
    ...(intents.length ? { intents } : {}),
    ...(attachment ? { attachment } : {})
  }
}

function readMessages(value: unknown): ChatMessage[] {
  return Array.isArray(value)
    ? value.filter(isChatMessage).map(readMessage)
    : []
}

/** The saved conversation of a wallet. Storage may be blocked or hold anything. */
export function readSavedChat(address: string): SavedChat {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey(address)) ?? '[]'
    )
    // Saved before the time was kept: a plain list of messages.
    if (Array.isArray(parsed)) return { messages: readMessages(parsed) }
    const updatedAt = Number(parsed?.updatedAt)
    return {
      messages: readMessages(parsed?.messages),
      ...(Number.isFinite(updatedAt) && updatedAt > 0 ? { updatedAt } : {})
    }
  } catch {
    return { messages: [] }
  }
}

export function readChatHistory(address: string): ChatMessage[] {
  return readSavedChat(address).messages
}

/** Whether the conversation was left long enough ago to be put aside. */
export function isChatStale(saved: SavedChat, now = Date.now()): boolean {
  return (
    saved.updatedAt !== undefined && now - saved.updatedAt > CHAT_HISTORY_TTL_MS
  )
}

export function writeChatHistory(
  address: string,
  messages: ChatMessage[],
  now = Date.now()
): void {
  try {
    window.localStorage.setItem(
      storageKey(address),
      JSON.stringify({
        updatedAt: now,
        messages: messages.slice(-CHAT_HISTORY_LIMIT)
      })
    )
  } catch {}
}

export function clearChatHistory(address: string): void {
  try {
    window.localStorage.removeItem(storageKey(address))
  } catch {}
}
