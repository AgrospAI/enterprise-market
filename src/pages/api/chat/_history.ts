/**
 * Re-checks the assets earlier answers named, before the model answers again.
 *
 * Tool results are not kept between messages: the browser sends the
 * conversation back as text. On a follow-up the model therefore reads its own
 * earlier answers as if they were facts, and when one of them named an asset
 * that does not exist (or gave a wrong price) it repeated it. The server looks
 * up every asset those answers linked or named, with get_asset, and tells the
 * model what the catalogue says now: which exist, with their real name, price
 * and access, and which do not exist at all.
 */
import type { ChatMessage } from 'src/@types/Chat'
import type { McpSession } from './_mcp'

const MAX_CHECKED = 8
const DID_RE = /did:[a-z0-9]+:[A-Za-z0-9._:-]+/gi
const VALID_DID_RE = /^did:ope:[0-9a-f]{64}$/

/** DIDs earlier assistant answers named, the most recent first. */
export function didsInHistory(messages: ChatMessage[]): string[] {
  const seen = new Set<string>()
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant') continue
    for (const did of message.content.match(DID_RE) ?? []) {
      seen.add(did.toLowerCase().replace(/[.,;:]+$/, ''))
    }
  }
  return [...seen].slice(0, MAX_CHECKED)
}

interface Service {
  type?: string
  price?: { type?: string; amount?: string }
}

function describe(asset: Record<string, unknown>) {
  const services = (asset.services as Service[] | undefined) ?? []
  return {
    did: asset.did,
    name: asset.name,
    type: asset.type,
    description:
      typeof asset.description === 'string'
        ? asset.description.slice(0, 300)
        : undefined,
    published: asset.published,
    services: services.map((service) => ({
      access: service.type === 'compute' ? 'Compute-to-Data' : 'download',
      price:
        service.price?.type === 'free' || service.price?.amount === '0'
          ? 'free'
          : service.price?.type === 'fixed'
          ? `${service.price.amount} (paid)`
          : 'unknown'
    })),
    marketUrl: asset.marketUrl
  }
}

/**
 * What the model is told about the assets earlier answers named, or nothing
 * when they named none.
 */
export async function checkHistory(
  messages: ChatMessage[],
  mcp: Pick<McpSession, 'callTool'>
): Promise<string | undefined> {
  const dids = didsInHistory(messages)
  if (!dids.length) return undefined
  const lines = await Promise.all(
    dids.map(async (did) => {
      if (!VALID_DID_RE.test(did)) return { did, exists: false }
      try {
        const { text, isError, structured } = await mcp.callTool('get_asset', {
          did
        })
        if (isError) return { did, exists: false }
        const data = (structured ?? JSON.parse(text)) as {
          asset?: Record<string, unknown>
        }
        const asset = data?.asset ?? (data as Record<string, unknown>)
        return asset?.did
          ? { exists: true, ...describe(asset) }
          : { did, exists: false }
      } catch {
        // Unknown, not missing: the server may be slow. Say nothing about it.
        return undefined
      }
    })
  )
  const checked = lines.filter(Boolean)
  if (!checked.length) return undefined
  return JSON.stringify({ checkedNow: checked })
}

/** How the model reads the check, appended to the system prompt. */
export function historyNote(result: string): string {
  // The DIDs that do not exist are left out: given them, the model links them again.
  const { checkedNow } = JSON.parse(result) as { checkedNow: Checked[] }
  const real = checkedNow.filter((asset) => asset.exists)
  const missing = checkedNow.length - real.length
  result = JSON.stringify({
    exist: real,
    ...(missing ? { removedNonexistent: missing } : {})
  })
  return `

Earlier answers in this conversation named the assets below. The server has just looked each one up in the catalogue; this is what the catalogue says now, and it overrides anything an earlier answer said:
- "removedNonexistent" counts assets earlier answers named that do not exist in the catalogue. The server removed those lines from the earlier answers. An asset not listed under "exist" is not real: never link, describe or repeat it. If the user asks about it, say plainly that it is not in the catalogue and that the earlier answer was a mistake.
- The assets under "exist" are real. If the user says one does not exist, it does: give its link again. Use the names, prices and access types below, and correct an earlier answer that said otherwise.
<history_check>
${result}
</history_check>`
}

interface Checked {
  did: string
  exists: boolean
  name?: string
  services?: { access: string; price: string }[]
}

/**
 * Earlier answers as the model reads them again: a line that named an asset
 * that does not exist is replaced by a note saying so, and each asset that
 * exists gets what the catalogue says about it next to its first mention. The
 * model copies earlier answers closely, so the correction has to be in them.
 */
export function rewriteHistory(
  messages: ChatMessage[],
  result: string
): ChatMessage[] {
  const { checkedNow } = JSON.parse(result) as { checkedNow: Checked[] }
  const byDid = new Map(checkedNow.map((c) => [c.did.toLowerCase(), c]))
  return messages.map((message) => {
    if (message.role !== 'assistant') return message
    const annotated = new Set<string>()
    const content = message.content
      .split('\n')
      .map((line) => {
        const dids = (line.match(DID_RE) ?? []).map((d) =>
          d.toLowerCase().replace(/[.,;:]+$/, '')
        )
        if (dids.some((did) => byDid.get(did)?.exists === false)) {
          return '- [removed by the server: this line named an asset that does not exist in the catalogue]'
        }
        let out = line
        for (const did of dids) {
          const asset = byDid.get(did)
          if (!asset?.exists || annotated.has(did)) continue
          annotated.add(did)
          const facts = (asset.services ?? [])
            .map((s) => `${s.price}, ${s.access}`)
            .join('; ')
          out += ` [checked now: "${asset.name}" — ${facts || 'no services'}]`
        }
        return out
      })
      .join('\n')
    return { ...message, content }
  })
}
