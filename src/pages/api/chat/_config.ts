const DEFAULT_RATE_LIMIT_PER_MINUTE = 10
const DEFAULT_ANONYMOUS_RATE_LIMIT_PER_MINUTE = 5

export interface ChatConfig {
  mcpUrl: string
  mcpAuthToken: string
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  /** Whether the model reasons before each reply: slower, and off by default. */
  llmThinking: boolean
  /**
   * The model's window in tokens (vLLM's --max-model-len), if known. The chat
   * then shows how full it got, and stops calling tools before it overflows.
   */
  llmContextTokens?: number
  rateLimitPerMinute: number
  /**
   * Requests per minute and network address of visitors without a wallet
   * session, who may only search the catalogue. 0 turns it off: the chat then
   * needs signing in.
   */
  anonymousRateLimitPerMinute: number
}

function readRateLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const limit = Number(value)
  return Number.isSafeInteger(limit) && limit >= 0 ? limit : fallback
}

/** The chat configuration, or undefined when any required value is missing. */
export function getChatConfig(): ChatConfig | undefined {
  const {
    MCP_URL: mcpUrl,
    MCP_AUTH_TOKEN: mcpAuthToken,
    CHAT_LLM_BASE_URL: llmBaseUrl,
    CHAT_LLM_API_KEY: llmApiKey,
    CHAT_LLM_MODEL: llmModel,
    CHAT_LLM_THINKING: llmThinking,
    CHAT_LLM_CONTEXT_TOKENS: contextTokens,
    CHAT_RATE_LIMIT_PER_MINUTE: rateLimit,
    CHAT_ANONYMOUS_RATE_LIMIT_PER_MINUTE: anonymousRateLimit
  } = process.env
  if (!mcpUrl || !mcpAuthToken || !llmBaseUrl || !llmApiKey || !llmModel) {
    return undefined
  }

  const rateLimitPerMinute = Number(rateLimit)
  const llmContextTokens = Number(contextTokens)
  return {
    mcpUrl,
    mcpAuthToken,
    llmBaseUrl: llmBaseUrl.replace(/\/+$/, ''),
    llmApiKey,
    llmModel,
    llmThinking: llmThinking?.trim().toLowerCase() === 'on',
    ...(Number.isSafeInteger(llmContextTokens) && llmContextTokens > 0
      ? { llmContextTokens }
      : {}),
    rateLimitPerMinute:
      Number.isSafeInteger(rateLimitPerMinute) && rateLimitPerMinute > 0
        ? rateLimitPerMinute
        : DEFAULT_RATE_LIMIT_PER_MINUTE,
    anonymousRateLimitPerMinute: readRateLimit(
      anonymousRateLimit,
      DEFAULT_ANONYMOUS_RATE_LIMIT_PER_MINUTE
    )
  }
}
