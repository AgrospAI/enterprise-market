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

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
}

export interface LlmReply {
  content: string
  toolCalls: LlmToolCall[]
  /** As the model server counted it, when it sends it. */
  usage?: LlmUsage
  /** The model the server says answered (the "model" of its stream), when it says. */
  model?: string
}

export type CallLlm = (
  messages: LlmMessage[],
  tools: LlmTool[] | undefined,
  onText: (delta: string) => void,
  /** "required" makes the model call a tool before answering. */
  toolChoice?: 'auto' | 'required'
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
  let usage: LlmUsage | undefined
  let model: string | undefined

  return {
    setModel(value?: unknown) {
      if (typeof value === 'string' && value.trim()) model = value.trim()
    },
    setUsage(value?: { prompt_tokens?: unknown; completion_tokens?: unknown }) {
      const prompt = Number(value?.prompt_tokens)
      const completion = Number(value?.completion_tokens)
      if (Number.isSafeInteger(prompt) && prompt > 0) {
        usage = {
          promptTokens: prompt,
          completionTokens: Number.isSafeInteger(completion) ? completion : 0
        }
      }
    },
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
      return {
        content,
        toolCalls,
        ...(usage ? { usage } : {}),
        ...(model ? { model } : {})
      }
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
    usage?: Parameters<typeof assembler.setUsage>[0] | null
    model?: unknown
  }
  try {
    chunk = JSON.parse(data)
  } catch {
    return
  }
  if (chunk.error) throw new Error('The language model returned an error')
  // Every chunk names the model that answered, as the server serves it.
  assembler.setModel(chunk.model)
  assembler.add(chunk.choices?.[0]?.delta)
  // vLLM sends it in a last chunk with no choices, asked for by include_usage.
  if (chunk.usage) assembler.setUsage(chunk.usage)
}

/** Asks the server for the tokens of each call: the chat shows how full it is. */
export const STREAM_USAGE = { stream_options: { include_usage: true } }

/**
 * The same question should get the same tools and the same kind of answer. This
 * makes the model much more repeatable, though not fully: the text can still
 * vary a little when the server batches requests.
 */
export const LLM_SAMPLING = { temperature: 0, seed: 42 }

/**
 * Qwen reasons before every reply unless its chat template is told not to. The
 * reasoning is never shown, and in our benchmark it made the answers slower and
 * no more often right (scripts/chat-llm-bench.mjs, docs/market-chat-status.md).
 */
export const NO_THINKING = { chat_template_kwargs: { enable_thinking: false } }

export function createLlmCaller(
  config: Pick<ChatConfig, 'llmBaseUrl' | 'llmApiKey' | 'llmModel'> &
    Partial<Pick<ChatConfig, 'llmThinking'>>,
  signal: AbortSignal
): CallLlm {
  return async (messages, tools, onText, toolChoice) => {
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
        ...STREAM_USAGE,
        ...LLM_SAMPLING,
        ...(config.llmThinking ? {} : NO_THINKING),
        ...(tools?.length
          ? { tools, ...(toolChoice ? { tool_choice: toolChoice } : {}) }
          : {})
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
