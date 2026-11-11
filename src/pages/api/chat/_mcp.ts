import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { getAddress } from 'viem'
import type { ChatConfig } from './_config'
import { isAllowedTool } from './_tools'
import type { LlmTool } from './_llm'

const CLIENT_INFO = { name: 'agrospai-market-chat', version: '1.0.0' }
const TOOL_TIMEOUT_MS = 30_000
export const USER_ADDRESS_HEADER = 'X-AgrospAI-User-Address'

export interface McpSession {
  tools: LlmTool[]
  /** Runs an allowed tool and returns its text; `isError` marks a tool failure. */
  callTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ text: string; isError: boolean; structured?: unknown }>
  close: () => Promise<void>
}

/**
 * Opens a session with the MCP server for one chat request. The bearer token and
 * the verified address are set here, on the server, and neither reaches the
 * browser or the model.
 */
export async function connectMcp(
  config: Pick<ChatConfig, 'mcpUrl' | 'mcpAuthToken'>,
  address: string,
  signal: AbortSignal
): Promise<McpSession> {
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${config.mcpAuthToken}`,
        [USER_ADDRESS_HEADER]: getAddress(address)
      }
    }
  })
  const client = new Client(CLIENT_INFO)
  const requestOptions = { signal, timeout: TOOL_TIMEOUT_MS }

  try {
    await client.connect(transport, requestOptions)
    const { tools } = await client.listTools(undefined, requestOptions)

    return {
      tools: tools
        .filter((tool) => isAllowedTool(tool.name))
        .map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        })),
      callTool: async (name, args) => {
        const result = await client.callTool(
          { name, arguments: args },
          undefined,
          requestOptions
        )
        const content = Array.isArray(result.content) ? result.content : []
        return {
          text: content
            .map((item) => (item.type === 'text' ? item.text : ''))
            .join('\n'),
          isError: result.isError === true,
          structured: result.structuredContent
        }
      },
      close: () => client.close()
    }
  } catch (error) {
    await client.close().catch(() => undefined)
    throw error
  }
}
