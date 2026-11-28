/**
 * Keeps invented assets out of the chat's answers.
 *
 * The model is told to name only assets from tool results, and sometimes does
 * not: it has made up titles, DIDs and links that look real. The guard sits
 * between the model's stream and the browser and passes the answer on line by
 * line. A line that links an asset, or names a DID, that no tool returned in
 * this request is held until the round ends and is then looked up with
 * get_asset: if no such asset exists, the line is dropped. A linked asset whose
 * label is not its real name gets its real name.
 *
 * Lines with only known assets, or none, pass at once, so the answer still
 * streams; only the lines after an unknown asset wait for the lookup.
 */
import type { McpSession } from './_mcp'

// Any DID method: the model has invented did:agora:… as well as did:ope:….
const DID_RE = /did:[a-z0-9]+:[A-Za-z0-9._:-]+/gi
const VALID_DID_RE = /^did:ope:[0-9a-f]{64}$/
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g
const ASSET_IN_URL_RE = /\/asset\/(did:[^/?#)\s]+)/i
/** The market's own hosts: a link there must be its home page or an asset page. */
const MARKET_HOST_RE = /(^|\.)agrospai\.udl\.cat$/i
/** A made-up page on the market (for example /dataset/urn:…): no tool ever returns one. */
const INVENTED_PAGE = 'invented-market-page'

function inventedMarketPage(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    if (!MARKET_HOST_RE.test(hostname)) return false
    if (pathname === '/' || pathname === '') return false
    return !ASSET_IN_URL_RE.test(pathname)
  } catch {
    return false
  }
}

/** The names of the assets in a tool result, by DID: from its JSON when it parses. */
export function assetsInToolResult(
  text: string
): Map<string, string | undefined> {
  const found = new Map<string, string | undefined>()
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (typeof record.did === 'string') {
      const did = record.did.toLowerCase()
      const name = typeof record.name === 'string' ? record.name : undefined
      if (!found.has(did) || name) found.set(did, name)
    }
    Object.values(record).forEach(walk)
  }
  try {
    walk(JSON.parse(text))
  } catch {
    // A truncated result: its DIDs still count as returned, without names.
  }
  for (const did of text.match(DID_RE) ?? []) {
    const key = did.toLowerCase()
    if (!found.has(key)) found.set(key, undefined)
  }
  return found
}

interface LineCheck {
  /** DIDs the line refers to that no tool returned. */
  unknown: string[]
}

export function createAnswerGuard({
  emitText,
  lookup,
  userText,
  onDropped
}: {
  emitText: (delta: string) => void
  /** The asset of a DID from the catalogue, or undefined if there is none. */
  lookup: (did: string) => Promise<{ name?: string } | undefined>
  /** What the user wrote: a DID they gave may be repeated (to say it does not exist), not linked. */
  userText: string
  onDropped?: (count: number, lines: string[]) => void
}) {
  const known = new Map<string, string | undefined>()
  const verified = new Map<string, { name?: string } | undefined>()
  const userLower = userText.toLowerCase()
  let pending = ''
  let held: string[] = []
  let dropped = 0

  function referencedDids(line: string): {
    linked: Set<string>
    bare: Set<string>
  } {
    const linked = new Set<string>()
    for (const match of line.matchAll(LINK_RE)) {
      const did = match[2].match(ASSET_IN_URL_RE)?.[1]
      if (did) linked.add(did.toLowerCase())
      else if (inventedMarketPage(match[2])) linked.add(INVENTED_PAGE)
    }
    const bare = new Set<string>()
    for (const did of line.match(DID_RE) ?? []) {
      const key = did.toLowerCase().replace(/[.,;:]+$/, '')
      if (!linked.has(key)) bare.add(key)
    }
    return { linked, bare }
  }

  function check(line: string): LineCheck {
    const { linked, bare } = referencedDids(line)
    const unknown = [
      ...[...linked].filter((did) => !known.has(did)),
      // Repeating a DID the user wrote is fine; any other must exist.
      ...[...bare].filter((did) => !known.has(did) && !userLower.includes(did))
    ]
    return {
      unknown: unknown.filter(
        (did) =>
          did === INVENTED_PAGE || !verified.has(did) || !verified.get(did)
      )
    }
  }

  /** Gives every link to a known asset its real name. */
  function relabel(line: string): string {
    return line.replace(LINK_RE, (whole, label: string, url: string) => {
      const did = url.match(ASSET_IN_URL_RE)?.[1]?.toLowerCase()
      const name = did ? known.get(did) ?? verified.get(did)?.name : undefined
      if (!name) return whole
      const bare = label.replace(/[*_`]/g, '').trim()
      return bare === name ? whole : whole.replace(`[${label}]`, `[${name}]`)
    })
  }

  /**
   * A link whose DID came out garbled (the model repeats or drops a few
   * characters of a long DID) but whose label is exactly the name of one asset
   * a tool returned: it is pointed at that asset instead of being dropped.
   */
  function repair(line: string): string {
    return line.replace(LINK_RE, (whole, label: string, url: string) => {
      const did = url.match(ASSET_IN_URL_RE)?.[1]?.toLowerCase()
      if (!did || known.has(did) || verified.get(did)) return whole
      const bare = label.replace(/[*_`]/g, '').trim().toLowerCase()
      const matches = [...known].filter(
        ([, name]) => name?.trim().toLowerCase() === bare
      )
      if (matches.length !== 1) return whole
      return whole.replace(
        url,
        url.replace(url.match(ASSET_IN_URL_RE)![1], matches[0][0])
      )
    })
  }

  function pass(line: string) {
    emitText(relabel(line))
  }

  function push(line: string) {
    line = repair(line)
    if (held.length || check(line).unknown.length) held.push(line)
    else pass(line)
  }

  return {
    /** Assets a tool returned in this request: the model may name them. */
    addToolResult(text: string) {
      for (const [did, name] of assetsInToolResult(text)) {
        if (!known.has(did) || name) known.set(did, name)
      }
    },
    /** A piece of the model's streamed text. */
    write(delta: string) {
      pending += delta
      let newline = pending.indexOf('\n')
      while (newline !== -1) {
        push(pending.slice(0, newline + 1))
        pending = pending.slice(newline + 1)
        newline = pending.indexOf('\n')
      }
    },
    /** The round's text is complete: look up what was held and pass on the rest. */
    async flush() {
      if (pending) {
        push(pending)
        pending = ''
      }
      if (!held.length) return
      const lines = held
      held = []
      const toLookUp = new Set(lines.flatMap((line) => check(line).unknown))
      await Promise.all(
        [...toLookUp].map(async (did) => {
          if (verified.has(did)) return
          verified.set(
            did,
            did !== INVENTED_PAGE && VALID_DID_RE.test(did)
              ? await lookup(did).catch(() => undefined)
              : undefined
          )
        })
      )
      const droppedNow: string[] = []
      for (const line of lines) {
        const missing = check(line).unknown.filter((did) => !verified.get(did))
        if (missing.length) droppedNow.push(line)
        else pass(line)
      }
      if (droppedNow.length) {
        dropped += droppedNow.length
        onDropped?.(droppedNow.length, droppedNow)
      }
    },
    get dropped() {
      return dropped
    }
  }
}

/** get_asset through the request's MCP session: undefined when there is no such asset. */
export function mcpLookup(mcp: Pick<McpSession, 'callTool'>) {
  return async (did: string) => {
    const { text, isError, structured } = await mcp.callTool('get_asset', {
      did
    })
    if (isError) return undefined
    const asset = (structured ??
      (() => {
        try {
          return JSON.parse(text)
        } catch {
          return undefined
        }
      })()) as
      | { did?: string; name?: string; asset?: { did?: string; name?: string } }
      | undefined
    // get_asset answers { asset: { did, name, ... } }.
    const found = asset?.asset ?? asset
    return found?.did ? { name: found.name } : undefined
  }
}
