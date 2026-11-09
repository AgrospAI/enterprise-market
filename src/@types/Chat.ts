import type { ChatIntent } from './ChatIntent'

export type ChatRole = 'user' | 'assistant'

/** What the assistant did before answering: shown apart from the answer. */
export type ChatStep =
  | { type: 'tool'; name: string }
  | { type: 'note'; text: string }

export interface ChatMessage {
  role: ChatRole
  content: string
  /** Only for display in this browser: it is never sent to the server. */
  steps?: ChatStep[]
  /** Actions prepared for the user, shown as confirmation cards. */
  intents?: ChatIntent[]
}

export interface ChatRequestBody {
  messages: ChatMessage[]
}

export type ChatToolStatus = 'running' | 'done' | 'error'

/** One line of the newline-delimited JSON stream returned by /api/chat. */
export type ChatStreamEvent =
  | { type: 'text'; delta: string }
  /** The text since the last tool call was the model's narration, not its answer. */
  | { type: 'narration' }
  | { type: 'tool'; name: string; status: ChatToolStatus }
  /** A prepared action, validated by the server, for a confirmation card. */
  | { type: 'intent'; intent: ChatIntent }
  | { type: 'error'; message: string }
  | { type: 'done' }

export interface SiweSessionResponse {
  /** Checksummed address of the signed-in wallet, or null without a session. */
  address: string | null
  /** The chain the SIWE message must be signed for. */
  chainId: number
}

/** Messages of a conversation sent to the server with each request. */
export const CHAT_MAX_CONTEXT_MESSAGES = 20
export const CHAT_MAX_MESSAGE_CHARS = 8000
