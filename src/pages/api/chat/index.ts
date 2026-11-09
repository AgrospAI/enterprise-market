import type { NextApiRequest, NextApiResponse } from 'next'
import {
  CHAT_MAX_CONTEXT_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  ChatMessage,
  ChatStreamEvent
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
const activeAddresses = new Set<string>()

/** Accepts only user and assistant text: the client cannot set a system prompt. */
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
    parsed.push({ role, content })
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

  const address = await getVerifiedSiweAddress(req, siwe)
  if (!address) return res.status(401).json({ error: 'No session' })

  takeRateLimit ??= createRateLimiter(chat.rateLimitPerMinute)
  const { allowed, retryAfterSeconds } = takeRateLimit(address)
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Too many requests' })
  }
  if (activeAddresses.has(address)) {
    return res.status(409).json({ error: 'A request is already in progress' })
  }

  const messages = parseMessages(req.body)
  if (!messages) return res.status(400).json({ error: 'Invalid messages' })

  activeAddresses.add(address)
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
      emit
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
    activeAddresses.delete(address)
    await mcp?.close().catch(() => undefined)
    emit({ type: 'done' })
    res.end()
  }
}
