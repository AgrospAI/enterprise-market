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
