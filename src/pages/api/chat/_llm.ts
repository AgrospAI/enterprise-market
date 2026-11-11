import type { ChatConfig } from './_config'

export interface LlmTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: unknown
  }
}

export interface LlmToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface LlmReply {
  content: string
  toolCalls: LlmToolCall[]
}

export type CallLlm = (
  messages: LlmMessage[],
  tools: LlmTool[] | undefined,
  onText: (delta: string) => void
) => Promise<LlmReply>

interface ToolCallDelta {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
}

/** Assembles a reply from the deltas of an OpenAI-compatible stream. */
export function createReplyAssembler(onText: (delta: string) => void) {
  let content = ''
  const calls = new Map<number, LlmToolCall>()

  return {
    add(delta?: { content?: string | null; tool_calls?: ToolCallDelta[] }) {
      if (delta?.content) {
        content += delta.content
        onText(delta.content)
      }
      delta?.tool_calls?.forEach((part, position) => {
        const index = part.index ?? position
        const call = calls.get(index) ?? {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' }
        }
        call.id = part.id || call.id
        call.function.name += part.function?.name ?? ''
        call.function.arguments += part.function?.arguments ?? ''
        calls.set(index, call)
      })
    },
    reply(): LlmReply {
      const toolCalls = [...calls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, call]) => ({
          ...call,
          id: call.id || `call_${index}`
        }))
      return { content, toolCalls }
    }
  }
}

/** Parses one server-sent event line into the assembler. */
export function readStreamLine(
  line: string,
  assembler: ReturnType<typeof createReplyAssembler>
): void {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return
  const data = trimmed.slice('data:'.length).trim()
  if (!data || data === '[DONE]') return

  let chunk: {
    error?: { message?: string } | string
    choices?: { delta?: Parameters<typeof assembler.add>[0] }[]
  }
  try {
    chunk = JSON.parse(data)
  } catch {
    return
  }
  if (chunk.error) throw new Error('The language model returned an error')
  assembler.add(chunk.choices?.[0]?.delta)
}

/**
 * The same question should get the same tools and the same kind of answer. This
 * makes the model much more repeatable, though not fully: the text can still
 * vary a little when the server batches requests.
 */
export const LLM_SAMPLING = { temperature: 0, seed: 42 }

export function createLlmCaller(
  config: Pick<ChatConfig, 'llmBaseUrl' | 'llmApiKey' | 'llmModel'>,
  signal: AbortSignal
): CallLlm {
  return async (messages, tools, onText) => {
    const response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llmApiKey}`
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages,
        stream: true,
        ...LLM_SAMPLING,
        ...(tools?.length ? { tools } : {})
      }),
      signal
    })
    if (!response.ok || !response.body) {
      throw new Error(`The language model answered HTTP ${response.status}`)
    }

    const assembler = createReplyAssembler(onText)
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach((line) => readStreamLine(line, assembler))
    }
    readStreamLine(buffer, assembler)
    return assembler.reply()
  }
}
