import type { ChatIntent } from './ChatIntent'

export type ChatRole = 'user' | 'assistant'

/** What the assistant did before answering: shown apart from the answer. */
export type ChatStep =
  | { type: 'tool'; name: string }
  | { type: 'note'; text: string }

/** One file of a job's results, as text the model can read. */
export interface JobResultFile {
  name: string
  /** Size of the file in the job's results, in bytes. */
  size: number
  /** Absent for binary files and for files left out by the size limit. */
  text?: string
  /** Only part of the file is in `text`, or none of it fit. */
  truncated: boolean
}

/**
 * The results of one of the user's Compute-to-Data jobs, read by the browser
 * with the user's signature: the node gives them to no one else.
 */
export interface JobResultAttachment {
  kind: 'jobResult'
  jobId: string
  dataset: string
  algorithm: string
  /** False when the algorithm failed: the files are then its log. */
  succeeded: boolean
  files: JobResultFile[]
}

export interface ChatMessage {
  role: ChatRole
  content: string
  /** Only for display in this browser: it is never sent to the server. */
  steps?: ChatStep[]
  /** Actions prepared for the user, shown as confirmation cards. */
  intents?: ChatIntent[]
  /** Results of a job the user asked about (user messages only). */
  attachment?: JobResultAttachment
  /**
   * The visitor asked for something that needs a wallet session: the answer
   * shows the button to sign in (assistant messages only).
   */
  asksToSignIn?: boolean
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
  /** A visitor without a session asked for more than searching. */
  | { type: 'signIn' }
  /**
   * Tokens of the model's context in the largest call of the request, as the
   * model server counted them, and its window when it is configured.
   */
  | { type: 'usage'; usage: ChatUsage }
  | { type: 'error'; message: string }
  | { type: 'done' }

export interface SiweSessionResponse {
  /** Checksummed address of the signed-in wallet, or null without a session. */
  address: string | null
  /** The chain the SIWE message must be signed for. */
  chainId: number
  /** Whether visitors without a session may chat, only to search the catalogue. */
  anonymousSearch?: boolean
}

export interface ChatUsage {
  /** System prompt, tool definitions, conversation and tool results. */
  promptTokens: number
  completionTokens: number
  /** The model's window (vLLM's --max-model-len), when it is configured. */
  contextTokens?: number
  /**
   * The model the server answered with, as it names it in its stream (vLLM's
   * --served-model-name), not the one asked for: it follows the deployment.
   */
  model?: string
}

/**
 * Characters of conversation sent with each request: the newest messages that
 * fit, and the latest job results. About 14k tokens of Qwen, so the system
 * prompt, the tool definitions and the tool results of the request still fit
 * in a 32k window (docs/market-chat-status.md, "Context budget").
 */
export const CHAT_MAX_CONTEXT_CHARS = 48_000
/** Only a guard against abuse: the budget above is the real limit. */
export const CHAT_MAX_CONTEXT_MESSAGES = 200
export const CHAT_MAX_MESSAGE_CHARS = 8000
/** Text of all the files of a job's results sent to the model. */
export const CHAT_MAX_ATTACHMENT_CHARS = 20_000
export const CHAT_MAX_ATTACHMENT_FILES = 50
const MAX_ATTACHMENT_NAME_CHARS = 300

function isShortString(value: unknown, max = MAX_ATTACHMENT_NAME_CHARS) {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

/**
 * A job result attachment, checked field by field and rebuilt without
 * anything else: it comes from the browser or from storage.
 */
export function parseJobResultAttachment(
  value: unknown
): JobResultAttachment | undefined {
  const attachment = value as JobResultAttachment
  if (
    attachment?.kind !== 'jobResult' ||
    !isShortString(attachment.jobId) ||
    !isShortString(attachment.dataset) ||
    !isShortString(attachment.algorithm) ||
    typeof attachment.succeeded !== 'boolean' ||
    !Array.isArray(attachment.files) ||
    attachment.files.length > CHAT_MAX_ATTACHMENT_FILES
  ) {
    return undefined
  }
  let chars = 0
  const files: JobResultFile[] = []
  for (const file of attachment.files) {
    if (
      !isShortString(file?.name) ||
      typeof file.size !== 'number' ||
      !Number.isFinite(file.size) ||
      file.size < 0 ||
      typeof file.truncated !== 'boolean' ||
      (file.text !== undefined && typeof file.text !== 'string')
    ) {
      return undefined
    }
    chars += file.text?.length ?? 0
    files.push({
      name: file.name,
      size: file.size,
      ...(file.text !== undefined ? { text: file.text } : {}),
      truncated: file.truncated
    })
  }
  if (chars > CHAT_MAX_ATTACHMENT_CHARS) return undefined
  const { jobId, dataset, algorithm, succeeded } = attachment
  return { kind: 'jobResult', jobId, dataset, algorithm, succeeded, files }
}

/**
 * Characters of a message counted against CHAT_MAX_CONTEXT_CHARS. Job results
 * count only when they are sent: only the latest ones are.
 */
export function contextChars(
  message: Pick<ChatMessage, 'content' | 'attachment'>,
  withAttachment = !!message.attachment
): number {
  const files = withAttachment ? message.attachment?.files ?? [] : []
  return files.reduce(
    (chars, file) => chars + file.name.length + (file.text?.length ?? 0),
    message.content.length
  )
}
