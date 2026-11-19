// Checks that the language model of the market chat can call tools through its
// OpenAI-compatible endpoint, streaming, as /api/chat needs. Sends one question;
// no market or MCP server is involved. The API key is never printed.
//
//   node --env-file=.env scripts/chat-llm-smoke.mjs
//
// Without CHAT_LLM_MODEL it lists the models the key can use.

const { CHAT_LLM_BASE_URL, CHAT_LLM_API_KEY, CHAT_LLM_MODEL } = process.env
const TIMEOUT_MS = 120_000

if (!CHAT_LLM_BASE_URL || !CHAT_LLM_API_KEY) {
  console.error('Set CHAT_LLM_BASE_URL and CHAT_LLM_API_KEY.')
  process.exit(2)
}

const baseUrl = CHAT_LLM_BASE_URL.replace(/\/+$/, '')
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${CHAT_LLM_API_KEY}`
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_assets',
      description: 'Search the catalogue of the data market.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Search terms' } }
      }
    }
  }
]

async function listModels() {
  const response = await fetch(`${baseUrl}/models`, { headers })
  if (!response.ok) throw new Error(`GET /models answered ${response.status}`)
  const { data } = await response.json()
  console.log('Models:')
  data?.forEach((model) => console.log(`  ${model.id}`))
}

async function complete(messages) {
  const started = Date.now()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: CHAT_LLM_MODEL,
      messages,
      tools,
      stream: true
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!response.ok || !response.body) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`HTTP ${response.status}: ${detail}`)
  }

  let buffer = ''
  let content = ''
  let chunks = 0
  let firstChunkMs
  const calls = new Map()
  const decoder = new TextDecoder()
  for await (const part of response.body) {
    buffer += decoder.decode(part, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '')
      if (!line.trim().startsWith('data:') || !data || data === '[DONE]') {
        continue
      }
      const chunk = JSON.parse(data)
      if (chunk.error)
        throw new Error(JSON.stringify(chunk.error).slice(0, 300))
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue
      chunks++
      firstChunkMs ??= Date.now() - started
      content += delta.content ?? ''
      delta.tool_calls?.forEach((call, position) => {
        const index = call.index ?? position
        const current = calls.get(index) ?? { id: '', name: '', arguments: '' }
        current.id = call.id || current.id
        current.name += call.function?.name ?? ''
        current.arguments += call.function?.arguments ?? ''
        calls.set(index, current)
      })
    }
  }
  return {
    content,
    calls: [...calls.values()],
    chunks,
    firstChunkMs,
    totalMs: Date.now() - started
  }
}

function report(ok, name, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`)
  return ok
}

async function main() {
  if (!CHAT_LLM_MODEL) {
    await listModels()
    return 0
  }

  const question = {
    role: 'user',
    content: 'Which datasets about wine are in the market? Use the tool.'
  }
  const first = await complete([question])
  console.log(
    `Round 1: ${first.chunks} chunks, first after ${first.firstChunkMs} ms, ${first.totalMs} ms in total`
  )

  let ok = report(first.chunks > 1, 'the answer is streamed in several chunks')
  const [call] = first.calls
  if (!report(Boolean(call), 'the model returns a tool call', first.content)) {
    return 1
  }
  ok = report(call.name === 'search_assets', 'tool name', call.name) && ok
  let args
  try {
    args = JSON.parse(call.arguments || '{}')
    report(true, 'tool arguments are JSON', call.arguments)
  } catch {
    report(false, 'tool arguments are JSON', call.arguments)
    return 1
  }
  ok = report(typeof args === 'object', 'tool arguments are an object') && ok
  ok = report(Boolean(call.id), 'the tool call has an id', call.id) && ok

  const second = await complete([
    question,
    {
      role: 'assistant',
      content: first.content,
      tool_calls: [
        {
          id: call.id || 'call_0',
          type: 'function',
          function: { name: call.name, arguments: call.arguments }
        }
      ]
    },
    {
      role: 'tool',
      tool_call_id: call.id || 'call_0',
      content: JSON.stringify({
        total: 1,
        results: [{ name: 'Red Wine Dataset', type: 'dataset' }]
      })
    }
  ])
  console.log(`Round 2: ${second.chunks} chunks, ${second.totalMs} ms in total`)
  console.log(`Answer: ${second.content.slice(0, 400)}`)
  ok =
    report(
      second.content.includes('Red Wine'),
      'the answer uses the tool result'
    ) && ok
  ok =
    report(
      !/<think|<details|<\/?[a-z]+[^>]*type="/i.test(second.content),
      'no reasoning markup in the answer'
    ) && ok

  return ok ? 0 : 1
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`FAIL  ${error.message}`)
    process.exit(1)
  })
