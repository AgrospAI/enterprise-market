import type { LlmTool } from './_llm'

/** Tools that prepare an action: their result is an intent, not an action. */
export const INTENT_TOOLS: readonly string[] = [
  'prepare_compute_job',
  'prepare_download'
]

/**
 * The only MCP tools the chat may use. The model is offered these and nothing
 * else, and a call to any other name is refused, whatever the server lists: a
 * server in shared mode also exposes tools that act with its service wallet.
 */
export const ALLOWED_TOOLS: readonly string[] = [
  'search_assets',
  'get_asset',
  'get_compatible_algorithms',
  'get_compatible_datasets',
  'list_compute_environments',
  ...INTENT_TOOLS
]

/** Arguments the model may not set: a raw DDO would flood its context. */
const BLOCKED_ARGUMENTS = ['includeRawDdo']

/**
 * Answered by the chat itself, not the MCP server: the browser then shows the
 * visitor the button to sign in, only when they asked for more than searching.
 */
export const SIGN_IN_TOOL = 'request_sign_in'

export const SIGN_IN_TOOL_DEFINITION: LlmTool = {
  type: 'function',
  function: {
    name: SIGN_IN_TOOL,
    description:
      'Shows the user the button to connect a wallet and sign in. Call it when the user asks to download, buy, run a Compute-to-Data job, check which algorithms run on a dataset or read job results.',
    parameters: { type: 'object', properties: {} }
  }
}

/**
 * What a visitor without a wallet session may use: searching the catalogue,
 * and asking them to sign in. Anything more needs signing in with a wallet.
 */
export const ANONYMOUS_TOOLS: readonly string[] = [
  'search_assets',
  SIGN_IN_TOOL
]

/** The tools of a request: all of them, or only searching without a session. */
export function toolsFor(isAnonymous: boolean): readonly string[] {
  return isAnonymous ? ANONYMOUS_TOOLS : ALLOWED_TOOLS
}

export function isAllowedTool(
  name: string,
  allowed: readonly string[] = ALLOWED_TOOLS
): boolean {
  return allowed.includes(name)
}

export function isIntentTool(name: string): boolean {
  return INTENT_TOOLS.includes(name)
}

/** Parses the arguments the model wrote; throws if they are not a JSON object. */
export function parseToolArguments(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw.trim() || '{}')
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object')
  }
  const args = { ...(parsed as Record<string, unknown>) }
  BLOCKED_ARGUMENTS.forEach((name) => delete args[name])
  return args
}
