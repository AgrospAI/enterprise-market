// Compares the market chat with and without the model's thinking: success, time,
// rounds and tool calls over a set of questions. It replays the loop of
// /api/chat (src/pages/api/chat/_loop.ts) against the real model and MCP server,
// with a test address. The chat's tools only read or prepare, so nothing is
// signed, paid or started. The keys are never printed.
//
//   node --env-file=.env scripts/chat-llm-bench.mjs [--thinking on,off] [--reps 3]
//     [--max-rounds 10] [--scenarios ndvi-direct,search-wine] [--mcp-url <url>]
//     [--out results.json] [--verbose]
//
// Needs Node 22 and the MCP server in WALLET_MODE=user.

import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const { values: options } = parseArgs({
  options: {
    thinking: { type: 'string', default: 'on,off' },
    reps: { type: 'string', default: '3' },
    'max-rounds': { type: 'string' },
    scenarios: { type: 'string' },
    'mcp-url': { type: 'string', default: process.env.MCP_URL },
    out: { type: 'string' },
    verbose: { type: 'boolean', default: false }
  }
})

const { CHAT_LLM_BASE_URL, CHAT_LLM_API_KEY, CHAT_LLM_MODEL, MCP_AUTH_TOKEN } =
  process.env
if (
  !CHAT_LLM_BASE_URL ||
  !CHAT_LLM_API_KEY ||
  !CHAT_LLM_MODEL ||
  !MCP_AUTH_TOKEN ||
  !options['mcp-url']
) {
  console.error(
    'Set CHAT_LLM_BASE_URL, CHAT_LLM_API_KEY, CHAT_LLM_MODEL, MCP_URL and MCP_AUTH_TOKEN.'
  )
  process.exit(2)
}

// The prompt and the limits come from the chat's own source, so the benchmark
// measures what the market runs.
const root = new URL('../src/pages/api/chat/', import.meta.url)
const loopSource = readFileSync(new URL('_loop.ts', root), 'utf8')
const toolsSource = readFileSync(new URL('_tools.ts', root), 'utf8')
const template = (name) =>
  loopSource.match(new RegExp(`export const ${name} =\\s*\`([\\s\\S]*?)\`\\n`))
const constant = (name) =>
  Number(
    loopSource
      .match(new RegExp(`export const ${name} = ([\\d_]+)`))[1]
      .replaceAll('_', '')
  )

const SYSTEM_PROMPT = template('SYSTEM_PROMPT')[1]
const FINAL_ROUND_NOTE = template('FINAL_ROUND_NOTE')?.[1]
const MAX_ROUNDS = Number(options['max-rounds'] ?? constant('MAX_ROUNDS'))
const MAX_TOOL_CALLS_PER_ROUND = constant('MAX_TOOL_CALLS_PER_ROUND')
const MAX_TOOL_RESULT_CHARS = constant('MAX_TOOL_RESULT_CHARS')
const ALLOWED_TOOLS = [...toolsSource.matchAll(/^ {2}'([a-z_]+)',?$/gm)].map(
  (match) => match[1]
)
const REQUEST_TIMEOUT_MS = 180000
const TEST_ADDRESS = '0x000000000000000000000000000000000000dEaD'

const SIGPAC =
  'did:ope:e28c61585df6c3b1636a0c019b35a58fa56cb0e8fcab0aca75ea27cbc34f1cb3'
const CLIP_RASTER =
  'did:ope:61bca61ad408ffde872e1af43c1712476db8cc104941de1b2719406b2dac45af'

/** An asset is given by its DID, or by its name when the market has several. */
const matches = (asset, wanted) =>
  typeof wanted === 'string'
    ? asset?.did === wanted
    : wanted.test(asset?.name ?? '')

const compute = (run, dataset, algorithm) =>
  run.intents.find(
    (intent) =>
      intent.kind === 'compute' &&
      matches(intent.dataset, dataset) &&
      matches(intent.algorithm, algorithm)
  )

/** Each check returns a problem, or undefined when the run did what was asked. */
const SCENARIOS = {
  'ndvi-direct': {
    question:
      'dame los indices ndvi a partir de las imagenes satelite para la parcela de provincia 7 municipio 10 poligono 5 parcela 12 y recinto 25',
    check(run) {
      const intent = compute(run, SIGPAC, CLIP_RASTER)
      if (!intent) return 'no SIGPAC → Clip Raster job was prepared'
      const expected = {
        province: 7,
        municipality: 10,
        polygon: 5,
        parcel: 12,
        precint: 25
      }
      const wrong = Object.entries(expected).filter(
        ([name, value]) => Number(intent.dataset.parameters?.[name]) !== value
      )
      return wrong.length
        ? `wrong parcel values: ${wrong.map(([name]) => name).join(', ')}`
        : undefined
    }
  },
  'sigpac-explicit': {
    question: 'ejecuta el dataset sigpac contra el algoritmo clip-raster',
    check: (run) =>
      compute(run, SIGPAC, CLIP_RASTER)
        ? undefined
        : 'no SIGPAC → Clip Raster job was prepared'
  },
  'ndvi-no-parcel': {
    question:
      'quiero los índices NDVI de mi parcela a partir de imágenes de satélite',
    check: (run) =>
      run.intents.length
        ? 'prepared a job without knowing the parcel'
        : run.answer.includes('?')
        ? undefined
        : 'did not ask for the parcel'
  },
  'search-wine': {
    question: '¿Qué datasets hay sobre vino?',
    check: (run) =>
      run.intents.length
        ? 'prepared an action nobody asked for'
        : /Red Wine/i.test(run.answer)
        ? undefined
        : 'the answer does not name the Red Wine Dataset'
  },
  'compatible-red-wine': {
    question: 'Which algorithms can I run on the Red Wine Dataset?',
    check: (run) =>
      run.intents.length
        ? 'prepared an action nobody asked for'
        : !run.calls.includes('get_compatible_algorithms')
        ? 'did not look up the compatible algorithms'
        : /\]\(https?:\/\//.test(run.answer)
        ? undefined
        : 'the answer links no algorithm'
  },
  download: {
    question: "Baixa'm el dataset Valoración de activos agrícolas",
    check: (run) =>
      run.intents.some(
        (intent) =>
          intent.kind === 'download' && /Valoraci/i.test(intent.asset?.name)
      )
        ? undefined
        : 'no download of the dataset was prepared'
  },
  'eda-red-wine': {
    question:
      'Run the Enhanced Exploratory Data Analysis on the Red Wine Dataset',
    check: (run) =>
      compute(run, /Red Wine/i, /Exploratory/i)
        ? undefined
        : 'no Red Wine → Exploratory Data Analysis job was prepared'
  },
  'not-in-catalogue': {
    question: '¿Hay datasets sobre producción de café en Colombia?',
    check: (run) =>
      run.intents.length ? 'prepared an action nobody asked for' : undefined
  }
}

async function callLlm(messages, tools, thinking, signal) {
  const response = await fetch(
    `${CHAT_LLM_BASE_URL.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CHAT_LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: CHAT_LLM_MODEL,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0,
        seed: 42,
        ...(tools ? { tools } : {}),
        ...(thinking
          ? {}
          : { chat_template_kwargs: { enable_thinking: false } })
      }),
      signal
    }
  )
  if (!response.ok)
    throw new Error(`the model answered HTTP ${response.status}`)

  let content = ''
  let reasoning = 0
  let tokens = 0
  const calls = new Map()
  for (const line of (await response.text()).split('\n')) {
    const data = line.trim().replace(/^data:\s*/, '')
    if (!line.trim().startsWith('data:') || !data || data === '[DONE]') continue
    let chunk
    try {
      chunk = JSON.parse(data)
    } catch {
      continue
    }
    // The last chunk, asked for by include_usage: what the context held.
    if (chunk.usage?.prompt_tokens) {
      tokens = chunk.usage.prompt_tokens + (chunk.usage.completion_tokens ?? 0)
    }
    const delta = chunk.choices?.[0]?.delta
    content += delta?.content ?? ''
    reasoning += (delta?.reasoning ?? delta?.reasoning_content ?? '').length
    delta?.tool_calls?.forEach((part, position) => {
      const index = part.index ?? position
      const call = calls.get(index) ?? {
        id: '',
        type: 'function',
        function: { name: '', arguments: '' }
      }
      call.id = part.id || call.id
      call.function.name += part.function?.name ?? ''
      call.function.arguments += part.function?.arguments ?? ''
      calls.set(index, call)
    })
  }
  return { content, reasoning, tokens, toolCalls: [...calls.values()] }
}

/** As the chat does: the model server refuses a call whose arguments are not JSON. */
function withValidArguments(call) {
  try {
    JSON.parse(call.function.arguments.trim() || '{}')
    return call
  } catch {
    return { ...call, function: { ...call.function, arguments: '{}' } }
  }
}

async function runTool(mcp, call, run) {
  const { name } = call.function
  if (!ALLOWED_TOOLS.includes(name)) {
    return `Error: the tool ${name} is not available`
  }
  run.calls.push(name)
  try {
    const args = JSON.parse(call.function.arguments.trim() || '{}')
    delete args.includeRawDdo
    const result = await mcp.callTool({ name, arguments: args })
    const text = (result.content ?? [])
      .map((item) => (item.type === 'text' ? item.text : ''))
      .join('\n')
    run.seen += text
    if (result.isError) return `Error: ${text}`
    if (result.structuredContent?.intent) {
      run.intents.push(result.structuredContent.intent)
    }
    return text.length > MAX_TOOL_RESULT_CHARS
      ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated]`
      : text
  } catch {
    return `Error: the tool ${name} failed`
  }
}

async function runQuestion(mcp, tools, question, thinking) {
  const run = {
    answer: '',
    intents: [],
    calls: [],
    seen: '',
    rounds: 0,
    reasoning: 0,
    // The fullest the model's context got in the question, in tokens.
    tokens: 0,
    exhausted: false
  }
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const started = Date.now()
  const conversation = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ]
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const last = round === MAX_ROUNDS
      if (last && FINAL_ROUND_NOTE) {
        conversation.push({ role: 'user', content: FINAL_ROUND_NOTE })
      }
      const reply = await callLlm(
        conversation,
        last ? undefined : tools,
        thinking,
        signal
      )
      run.rounds = round
      run.reasoning += reply.reasoning
      run.tokens = Math.max(run.tokens, reply.tokens)
      if (last || reply.toolCalls.length === 0) {
        run.answer = reply.content.trim()
        run.exhausted = last
        break
      }
      conversation.push({
        role: 'assistant',
        content: reply.content,
        tool_calls: reply.toolCalls.map(withValidArguments)
      })
      for (const [index, call] of reply.toolCalls.entries()) {
        conversation.push({
          role: 'tool',
          tool_call_id: call.id || `call_${index}`,
          content:
            index < MAX_TOOL_CALLS_PER_ROUND
              ? await runTool(mcp, call, run)
              : 'Error: too many tool calls at once'
        })
      }
    }
  } catch (error) {
    run.error = signal.aborted ? 'timed out after 180 s' : error.message
  }
  run.seconds = Math.round((Date.now() - started) / 100) / 10
  return run
}

/** A market link in the answer that no tool returned was made up by the model. */
function inventedLinks(run) {
  return [...run.answer.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((url) => /\/asset\//.test(url) && !run.seen.includes(url))
}

function judge(scenario, run) {
  if (run.error) return run.error
  if (!run.answer) {
    return run.exhausted ? 'no answer: out of rounds' : 'no answer'
  }
  const invented = inventedLinks(run)
  if (invented.length) return `invented ${invented.length} asset link(s)`
  return scenario.check(run)
}

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0
}
const mean = (numbers) =>
  numbers.length
    ? Math.round(
        (numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10
      ) / 10
    : 0

async function main() {
  const names = options.scenarios?.split(',') ?? Object.keys(SCENARIOS)
  const unknown = names.filter((name) => !SCENARIOS[name])
  if (unknown.length)
    throw new Error(`Unknown scenarios: ${unknown.join(', ')}`)
  const modes = options.thinking.split(',').map((mode) => mode.trim() === 'on')
  const reps = Number(options.reps)

  const mcp = new Client({
    name: 'agrospai-market-chat-bench',
    version: '1.0.0'
  })
  await mcp.connect(
    new StreamableHTTPClientTransport(new URL(options['mcp-url']), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
          'X-AgrospAI-User-Address': TEST_ADDRESS
        }
      }
    })
  )
  const tools = (await mcp.listTools()).tools
    .filter((tool) => ALLOWED_TOOLS.includes(tool.name))
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))

  console.log(
    `Model ${CHAT_LLM_MODEL}, ${MAX_ROUNDS} rounds, ${reps} repetition(s), ` +
      `${tools.length} tools, final-round note ${
        FINAL_ROUND_NOTE ? 'on' : 'off'
      }`
  )

  const results = []
  try {
    for (const name of names) {
      for (let rep = 1; rep <= reps; rep++) {
        for (const thinking of modes) {
          const run = await runQuestion(
            mcp,
            tools,
            SCENARIOS[name].question,
            thinking
          )
          const problem = judge(SCENARIOS[name], run)
          results.push({
            scenario: name,
            rep,
            thinking,
            problem,
            ...run,
            seen: undefined
          })
          console.log(
            `${problem ? 'FAIL' : 'PASS'}  ${name} #${rep} thinking ${
              thinking ? 'on ' : 'off'
            }  ${run.seconds} s, ${run.rounds} rounds, ${
              run.calls.length
            } tools, ${run.tokens || '?'} tokens${
              problem ? `: ${problem}` : ''
            }`
          )
          if (options.verbose) {
            console.log(`      tools: ${run.calls.join(' → ')}`)
            console.log(`      answer: ${run.answer.slice(0, 300)}`)
          }
        }
      }
    }
  } finally {
    await mcp.close().catch(() => undefined)
  }

  console.log('\nSummary')
  for (const thinking of modes) {
    const runs = results.filter((result) => result.thinking === thinking)
    const seconds = runs.map((run) => run.seconds)
    console.log(
      `thinking ${thinking ? 'on ' : 'off'}  passed ${
        runs.filter((run) => !run.problem).length
      }/${runs.length}, median ${median(seconds)} s, max ${Math.max(
        ...seconds
      )} s, mean rounds ${mean(
        runs.map((run) => run.rounds)
      )}, mean tools ${mean(
        runs.map((run) => run.calls.length)
      )}, out of rounds ${
        runs.filter((run) => run.exhausted).length
      }, max tokens ${Math.max(0, ...runs.map((run) => run.tokens)) || '?'}`
    )
  }
  if (options.out) {
    writeFileSync(options.out, JSON.stringify(results, null, 2))
    console.log(`Results written to ${options.out}`)
  }
  return results.some((result) => result.problem) ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`FAIL  ${error.message}`)
    process.exit(1)
  })
