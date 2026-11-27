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

/**
 * Whose conversation it is, in place of an address, for a visitor who has not
 * signed in. Theirs is kept only in this tab (sessionStorage): on a shared
 * computer it must not stay for the next person.
 */
export const ANONYMOUS_CHAT = 'anonymous'

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

function storageFor(address: string): Storage {
  return address === ANONYMOUS_CHAT
    ? window.sessionStorage
    : window.localStorage
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
  const asksToSignIn = role === 'assistant' && message.asksToSignIn === true
  return {
    role,
    content,
    ...(steps.length ? { steps } : {}),
    ...(intents.length ? { intents } : {}),
    ...(attachment ? { attachment } : {}),
    ...(asksToSignIn ? { asksToSignIn } : {})
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
      storageFor(address).getItem(storageKey(address)) ?? '[]'
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
    storageFor(address).setItem(
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
    storageFor(address).removeItem(storageKey(address))
  } catch {}
}

/**
 * After signing in, the conversation the visitor had before goes on as the
 * wallet's: they were likely sent to sign in by it. It is added after the
 * wallet's own conversation, or replaces it if that one was put aside.
 */
export function adoptAnonymousChat(address: string, now = Date.now()): void {
  if (address === ANONYMOUS_CHAT) return
  const anonymous = readSavedChat(ANONYMOUS_CHAT)
  if (!anonymous.messages.length) return
  const own = readSavedChat(address)
  const kept = isChatStale(own, now) ? [] : own.messages
  writeChatHistory(address, [...kept, ...anonymous.messages], now)
  clearChatHistory(ANONYMOUS_CHAT)
}
