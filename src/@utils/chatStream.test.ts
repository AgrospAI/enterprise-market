/**
 * @jest-environment node
 */
import { readChatStream } from './chatStream'
import type { ChatStreamEvent } from 'src/@types/Chat'

function streamOf(...parts: (string | Uint8Array)[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((part) =>
        controller.enqueue(
          typeof part === 'string' ? encoder.encode(part) : part
        )
      )
      controller.close()
    }
  })
}

async function collect(body: ReadableStream<Uint8Array>) {
  const events: ChatStreamEvent[] = []
  await readChatStream(body, (event) => events.push(event))
  return events
}

describe('readChatStream', () => {
  it('reads events split across chunks', async () => {
    const events = await collect(
      streamOf('{"type":"text","de', 'lta":"a"}\n{"type":"done"}\n')
    )
    expect(events).toEqual([{ type: 'text', delta: 'a' }, { type: 'done' }])
  })

  it('reads a last line without a newline', async () => {
    expect(await collect(streamOf('{"type":"done"}'))).toEqual([
      { type: 'done' }
    ])
  })

  it('keeps a multi-byte character split across chunks', async () => {
    const bytes = new TextEncoder().encode('{"type":"text","delta":"ñ"}\n')
    const split = bytes.indexOf(0xc3) + 1
    const events = await collect(
      streamOf(bytes.slice(0, split), bytes.slice(split))
    )
    expect(events).toEqual([{ type: 'text', delta: 'ñ' }])
  })

  it('skips lines that are not JSON', async () => {
    expect(await collect(streamOf('\noops\n{"type":"done"}\n'))).toEqual([
      { type: 'done' }
    ])
  })
})
