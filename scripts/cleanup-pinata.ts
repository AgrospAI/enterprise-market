/**
 * npm run pinata:cleanup                 # preview (no changes)
 * npm run pinata:cleanup -- --execute    # unpin confirmed file wrappers
 * Reads .env through Node's --env-file; requires Node 22.
 */
import { pathToFileURL } from 'node:url'

type Pin = { ipfs_pin_hash: string; date_pinned: string }
type Config = {
  jwt: string
  gateway: string
  deleteUrl: string
  execute: boolean
  unpinEnabled: boolean
}

function configuredUrl(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Set ${name} in .env`)
  // Also accept the escaped colon in exported deployment environment files.
  const url = new URL(value.replace(/\\:/g, ':'))
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`)
  return url.toString().replace(/\/$/, '')
}

export function isAssetFile(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const document = value as Record<string, unknown>
  // Positive identification: never infer a file from its name or MIME type.
  // DDOs (including encryptedData wrappers), metadata and unknown shapes survive.
  return (
    Object.keys(document).length === 2 &&
    typeof document.filename === 'string' &&
    document.filename.trim().length > 0 &&
    typeof document.content === 'string'
  )
}

export async function cleanup(
  config: Config,
  request: typeof fetch = fetch,
  now = Date.now()
): Promise<void> {
  if (!config.jwt) throw new Error('Set IPFS_JWT in .env')
  if (config.execute && !config.unpinEnabled)
    throw new Error('Set NEXT_PUBLIC_IPFS_UNPIN_FILES=true to execute')
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const headers = { Authorization: `Bearer ${config.jwt}` }
  const pins = new Map<string, Pin>()
  let failures = 0
  const pageLimit = 1000
  console.log(
    `${config.execute ? 'Execute' : 'Dry run'}: files pinned before ${new Date(
      cutoff
    ).toISOString()}`
  )

  // Snapshot every page before deleting: unpinning during pagination shifts offsets.
  for (let offset = 0; ; ) {
    const url = new URL('/data/pinList', config.deleteUrl)
    url.search = new URLSearchParams({
      status: 'pinned',
      pageLimit: String(pageLimit),
      pageOffset: String(offset)
    }).toString()
    const response = await request(url, {
      headers,
      signal: AbortSignal.timeout(60_000)
    })
    if (!response.ok)
      throw new Error(`Listing pins failed: HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.rows))
      throw new Error('Invalid Pinata listing response')
    for (const pin of data.rows) {
      if (typeof pin.ipfs_pin_hash !== 'string' || !pin.ipfs_pin_hash)
        throw new Error('Invalid CID in Pinata listing')
      // Retain the newest timestamp if a CID appears more than once.
      const previous = pins.get(pin.ipfs_pin_hash)
      if (
        !previous ||
        !(Date.parse(previous.date_pinned) >= Date.parse(pin.date_pinned))
      )
        pins.set(pin.ipfs_pin_hash, pin)
    }
    offset += data.rows.length
    if (data.rows.length === 0 || offset >= data.count) break
  }

  let candidates = 0
  let unpinned = 0
  for (const pin of pins.values()) {
    const timestamp = Date.parse(pin.date_pinned)
    if (!Number.isFinite(timestamp) || timestamp >= cutoff) continue
    const cid = encodeURIComponent(pin.ipfs_pin_hash)
    try {
      const gateway = config.gateway.replace(/\/$/, '').replace(/\/ipfs$/, '')
      // Never send the Pinata API credential to a gateway.
      let response = await request(`${gateway}/ipfs/${cid}`, {
        signal: AbortSignal.timeout(60_000)
      })
      // Dedicated gateways can require access tokens. Read public IPFS content
      // through Pinata's public gateway when the configured gateway denies access.
      if (response.status === 401 || response.status === 403) {
        response = await request(`https://gateway.pinata.cloud/ipfs/${cid}`, {
          signal: AbortSignal.timeout(60_000)
        })
      }
      if (!response.ok) throw new Error(`Gateway HTTP ${response.status}`)
      const text = await response.text()
      let document: unknown
      try {
        document = JSON.parse(text)
      } catch {
        continue // Raw files/strings are unknown, not confirmed application uploads.
      }
      if (!isAssetFile(document)) continue
      candidates++
      console.log(
        `${config.execute ? 'Unpinning' : 'Would unpin'} ${pin.ipfs_pin_hash}`
      )
      if (config.execute) {
        const result = await request(`${config.deleteUrl}/${cid}`, {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(60_000)
        })
        if (!result.ok) throw new Error(`Unpin HTTP ${result.status}`)
        unpinned++
      }
    } catch {
      // Do not print request errors: these can include credentials or file content.
      console.error(
        `Could not inspect/unpin ${pin.ipfs_pin_hash}; preserved if not unpinned.`
      )
      failures++
    }
  }
  console.log(
    `Scanned ${pins.size} pins; ${candidates} eligible files; ${unpinned} unpinned; ${failures} failures.`
  )
  if (failures) throw new Error('Cleanup incomplete; failed pins were skipped')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--execute' && arg !== '--dry-run'))
    throw new Error('Usage: npm run pinata:cleanup -- [--dry-run | --execute]')
  if (args.includes('--execute') && args.includes('--dry-run'))
    throw new Error('Choose either --execute or --dry-run')
  const deleteUrl = configuredUrl(
    process.env.NEXT_PUBLIC_IPFS_DELETE_URL,
    'NEXT_PUBLIC_IPFS_DELETE_URL'
  )
  if (new URL(deleteUrl).origin !== 'https://api.pinata.cloud')
    throw new Error(
      'NEXT_PUBLIC_IPFS_DELETE_URL must point to api.pinata.cloud'
    )
  await cleanup({
    jwt: process.env.IPFS_JWT || '',
    gateway: configuredUrl(
      process.env.NEXT_PUBLIC_IPFS_GATEWAY,
      'NEXT_PUBLIC_IPFS_GATEWAY'
    ),
    deleteUrl,
    execute: args.includes('--execute'),
    unpinEnabled: process.env.NEXT_PUBLIC_IPFS_UNPIN_FILES === 'true'
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error(
      'Pinata cleanup failed. Check .env, API permissions, and the summary above.'
    )
    process.exitCode = 1
  })
}
