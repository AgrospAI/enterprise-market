import type { NextApiRequest, NextApiResponse } from 'next'
import {
  CHAT_MAX_CONTEXT_CHARS,
  CHAT_MAX_CONTEXT_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  ChatMessage,
  ChatStreamEvent,
  contextChars,
  parseJobResultAttachment
} from 'src/@types/Chat'
import {
  getSiweConfig,
  getVerifiedSiweAddress,
  isTrustedOrigin,
  methodNotAllowed
} from '../siwe/_session'
import { getChatConfig } from './_config'
import { createLlmCaller } from './_llm'
import { runChatLoop } from './_loop'
import { connectMcp } from './_mcp'
import { createRateLimiter } from './_rateLimit'

export const config = {
  api: { bodyParser: { sizeLimit: '256kb' }, responseLimit: false }
}

const REQUEST_TIMEOUT_MS = 180_000

let takeRateLimit: ReturnType<typeof createRateLimiter> | undefined
let takeAnonymousRateLimit: ReturnType<typeof createRateLimiter> | undefined
// Wallets, and network addresses of visitors without a session, with a request running.
const activeKeys = new Set<string>()

/**
 * The network address of a visitor without a session, for their rate limit.
 * Behind the market's proxy it is the first X-Forwarded-For entry; a client can
 * forge that header where no proxy overwrites it.
 */
export function clientAddress(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim()
  const real = req.headers['x-real-ip']
  return (
    first ||
    (typeof real === 'string' ? real.trim() : '') ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * Accepts only user and assistant text, and the results of one job on a user
 * message: the client cannot set a system prompt. All of it must fit in the
 * context budget, which the browser fills with the newest messages.
 */
export function parseMessages(body: unknown): ChatMessage[] | undefined {
  const messages = (body as { messages?: unknown })?.messages
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > CHAT_MAX_CONTEXT_MESSAGES
  ) {
    return undefined
  }

  const parsed: ChatMessage[] = []
  let attachments = 0
  let chars = 0
  for (const message of messages) {
    const { role, content } = message ?? {}
    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > CHAT_MAX_MESSAGE_CHARS
    ) {
      return undefined
    }
    if (message.attachment === undefined) {
      parsed.push({ role, content })
    } else {
      // One set of results per request keeps the model's context bounded.
      const attachment = parseJobResultAttachment(message.attachment)
      if (role !== 'user' || !attachment || ++attachments > 1) return undefined
      parsed.push({ role, content, attachment })
    }
    chars += contextChars(parsed[parsed.length - 1])
    if (chars > CHAT_MAX_CONTEXT_CHARS) return undefined
  }
  return parsed[parsed.length - 1].role === 'user' ? parsed : undefined
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  res.setHeader('Cache-Control', 'no-store, no-transform')

  const siwe = getSiweConfig()
  const chat = getChatConfig()
  if (!siwe || !chat) return res.status(404).json({ error: 'Not found' })
  if (!isTrustedOrigin(req, siwe)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Without a session the visitor may only search the catalogue (see _loop.ts).
  const address = await getVerifiedSiweAddress(req, siwe)
  if (!address && chat.anonymousRateLimitPerMinute === 0) {
    return res.status(401).json({ error: 'No session' })
  }

  const key = address ?? `ip:${clientAddress(req)}`
  const takeLimit = address
    ? (takeRateLimit ??= createRateLimiter(chat.rateLimitPerMinute))
    : (takeAnonymousRateLimit ??= createRateLimiter(
        chat.anonymousRateLimitPerMinute
      ))
  const { allowed, retryAfterSeconds } = takeLimit(key)
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Too many requests' })
  }
  if (activeKeys.has(key)) {
    return res.status(409).json({ error: 'A request is already in progress' })
  }

  const messages = parseMessages(req.body)
  // Job results are read with a wallet: a visitor without a session has none.
  if (!messages || (!address && messages.some((m) => m.attachment))) {
    return res.status(400).json({ error: 'Invalid messages' })
  }

  activeKeys.add(key)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'X-Accel-Buffering': 'no'
  })
  const emit = (event: ChatStreamEvent) => {
    if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`)
  }

  let mcp: Awaited<ReturnType<typeof connectMcp>> | undefined
  try {
    mcp = await connectMcp(chat, address, controller.signal)
    await runChatLoop({
      messages,
      address,
      mcp,
      callLlm: createLlmCaller(chat, controller.signal),
      emit,
      contextTokens: chat.llmContextTokens
    })
  } catch (error) {
    // Conversation content is never logged, and upstream details stay here.
    if (!controller.signal.aborted || !res.destroyed) {
      console.error('Chat request failed:', (error as Error)?.message)
    }
    emit({
      type: 'error',
      message: controller.signal.aborted
        ? 'The request took too long. Please try again.'
        : 'The assistant is unavailable right now. Please try again.'
    })
  } finally {
    clearTimeout(timeout)
    activeKeys.delete(key)
    await mcp?.close().catch(() => undefined)
    emit({ type: 'done' })
    res.end()
  }
}
