import {
  assetsInToolResult,
  createAnswerGuard
} from '../../pages/api/chat/_guard'

const REAL = `did:ope:${'a'.repeat(64)}`
const LATER = `did:ope:${'b'.repeat(64)}`
const MISSING = `did:ope:${'c'.repeat(64)}`
const FAKE = 'did:ope:20250612-porcine-health-welfare'
const url = (did: string) => `https://market.agrospai.udl.cat/asset/${did}`
const SEARCH = JSON.stringify({
  total: 1,
  results: [{ did: REAL, name: 'Real Pig Data', marketUrl: url(REAL) }]
})

function setup(userText = '') {
  const out: string[] = []
  const dropped: number[] = []
  const lookup = jest.fn(async (did: string) =>
    did === LATER ? { name: 'Published Later' } : undefined
  )
  const guard = createAnswerGuard({
    emitText: (delta) => out.push(delta),
    lookup,
    userText,
    onDropped: (n) => dropped.push(n)
  })
  return { guard, out, dropped, lookup, text: () => out.join('') }
}

describe('assetsInToolResult', () => {
  it('reads DIDs and names from JSON, and DIDs from truncated text', () => {
    expect(assetsInToolResult(SEARCH).get(REAL)).toBe('Real Pig Data')
    const cut = `{"results":[{"did":"${REAL}","na`
    expect(assetsInToolResult(cut).has(REAL)).toBe(true)
  })
})

describe('createAnswerGuard', () => {
  it('passes lines with assets a tool returned as they stream', async () => {
    const { guard, out, lookup } = setup()
    guard.addToolResult(SEARCH)
    guard.write(
      `Hay 1 conjunto:\n- **[Real Pig Data](${url(REAL)})** — datos\n`
    )
    expect(out.join('')).toContain('Real Pig Data')
    await guard.flush()
    expect(lookup).not.toHaveBeenCalled()
  })

  it('drops a list item that links an invented DID', async () => {
    const { guard, text, dropped } = setup()
    guard.addToolResult(SEARCH)
    guard.write(
      `Hay 2:\n- [Real Pig Data](${url(REAL)}) — real\n- [Porcine Health](${url(
        FAKE
      )}) — inventado\n¿Algo más?`
    )
    await guard.flush()
    expect(text()).toContain('Real Pig Data')
    expect(text()).not.toContain('Porcine Health')
    expect(text()).toContain('¿Algo más?')
    expect(dropped).toEqual([1])
  })

  it('drops a well-formed DID the catalogue does not have', async () => {
    const { guard, text, lookup } = setup()
    guard.write(`- [Ghost](${url(MISSING)})\n`)
    await guard.flush()
    expect(lookup).toHaveBeenCalledWith(MISSING)
    expect(text()).toBe('')
  })

  it('keeps an asset no tool returned if the catalogue has it, with its real name', async () => {
    const { guard, text } = setup()
    guard.write(`- [Some name](${url(LATER)}) — ok\n`)
    await guard.flush()
    expect(text()).toBe(`- [Published Later](${url(LATER)}) — ok\n`)
  })

  it('gives a known asset its real name', async () => {
    const { guard, text } = setup()
    guard.addToolResult(SEARCH)
    guard.write(`- **[Pig Welfare v2](${url(REAL)})**\n`)
    await guard.flush()
    expect(text()).toBe(`- **[Real Pig Data](${url(REAL)})**\n`)
  })

  it('lets the answer repeat a DID the user wrote, but not link it', async () => {
    const { guard, text } = setup(`¿Qué es ${FAKE}?`)
    guard.write(`No encuentro ${FAKE} en el catálogo.\n- [Eso](${url(FAKE)})\n`)
    await guard.flush()
    expect(text()).toBe(`No encuentro ${FAKE} en el catálogo.\n`)
  })

  it('keeps the order: lines after a held one wait for it', async () => {
    const { guard, out } = setup()
    guard.addToolResult(SEARCH)
    guard.write(`- [X](${url(LATER)})\n- [Real Pig Data](${url(REAL)})\n`)
    expect(out).toEqual([])
    await guard.flush()
    expect(out.join('')).toBe(
      `- [Published Later](${url(LATER)})\n- [Real Pig Data](${url(REAL)})\n`
    )
  })
})

describe('createAnswerGuard and made-up market pages', () => {
  it('drops a line linking a market page that is not an asset page', async () => {
    const { guard, text, lookup } = setup()
    guard.write(
      '- [Registry](https://market.agrospai.udl.cat/dataset/urn:agrospai:dataset:2026-06-11:0001)\nok\n'
    )
    await guard.flush()
    expect(text()).toBe('ok\n')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('keeps links to the market home page and to other sites', async () => {
    const { guard, text } = setup()
    guard.write(
      '[market](https://market.agrospai.udl.cat/) and [FAO](https://www.fao.org/faostat)\n'
    )
    await guard.flush()
    expect(text()).toContain('FAO')
  })
})

describe('createAnswerGuard repairs garbled DIDs', () => {
  it('points a garbled link at the one returned asset with exactly that name', async () => {
    const { guard, text, lookup } = setup()
    guard.addToolResult(SEARCH)
    guard.write(
      `- **[Real Pig Data](${url(`did:ope:${'a'.repeat(70)}`)})** — ok\n`
    )
    await guard.flush()
    expect(text()).toBe(`- **[Real Pig Data](${url(REAL)})** — ok\n`)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('still drops a garbled link whose label names no returned asset', async () => {
    const { guard, text } = setup()
    guard.addToolResult(SEARCH)
    guard.write(`- [Other](${url(`did:ope:${'a'.repeat(70)}`)})\n`)
    await guard.flush()
    expect(text()).toBe('')
  })
})
