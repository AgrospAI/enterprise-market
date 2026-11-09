const DEFAULT_RATE_LIMIT_PER_MINUTE = 10

export interface ChatConfig {
  mcpUrl: string
  mcpAuthToken: string
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  rateLimitPerMinute: number
}

/** The chat configuration, or undefined when any required value is missing. */
export function getChatConfig(): ChatConfig | undefined {
  const {
    MCP_URL: mcpUrl,
    MCP_AUTH_TOKEN: mcpAuthToken,
    CHAT_LLM_BASE_URL: llmBaseUrl,
    CHAT_LLM_API_KEY: llmApiKey,
    CHAT_LLM_MODEL: llmModel,
    CHAT_RATE_LIMIT_PER_MINUTE: rateLimit
  } = process.env
  if (!mcpUrl || !mcpAuthToken || !llmBaseUrl || !llmApiKey || !llmModel) {
    return undefined
  }

  const rateLimitPerMinute = Number(rateLimit)
  return {
    mcpUrl,
    mcpAuthToken,
    llmBaseUrl: llmBaseUrl.replace(/\/+$/, ''),
    llmApiKey,
    llmModel,
    rateLimitPerMinute:
      Number.isSafeInteger(rateLimitPerMinute) && rateLimitPerMinute > 0
        ? rateLimitPerMinute
        : DEFAULT_RATE_LIMIT_PER_MINUTE
  }
}
