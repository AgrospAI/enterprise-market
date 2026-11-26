import type { ChatStreamEvent } from 'src/@types/Chat'

function parseLine(line: string): ChatStreamEvent | undefined {
  if (!line.trim()) return undefined
  try {
    return JSON.parse(line) as ChatStreamEvent
  } catch {
    return undefined
  }
}

/** Reads the newline-delimited JSON events of a /api/chat response. */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emit = (line: string) => {
    const event = parseLine(line)
    if (event) onEvent(event)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(emit)
  }
  emit(buffer + decoder.decode())
}
