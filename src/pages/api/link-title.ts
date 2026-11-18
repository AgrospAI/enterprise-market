import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { lookup } from 'node:dns'
import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'
import { BlockList, LookupFunction } from 'node:net'

const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const) {
  blocked.addSubnet(network, prefix)
}

// Validate the address used by the socket, including on redirects, to avoid
// exposing internal services through this public metadata endpoint.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { family: 4, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4)
    if (
      !addresses.length ||
      addresses.some(({ address }) => blocked.check(address))
    ) {
      return callback(new Error('Private address'), '', 4)
    }
    // Node's autoSelectFamily requests all addresses from the lookup callback.
    if (options.all) {
      callback(null, addresses as unknown as string, 4)
    } else {
      callback(null, addresses[0].address, 4)
    }
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    if (typeof req.query.url !== 'string') throw new Error('Invalid URL')
    const url = new URL(req.query.url)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      // Literal IPs bypass the custom DNS lookup.
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(':')
    ) {
      throw new Error('Invalid URL')
    }

    const response = await axios.get<string>(url.href, {
      responseType: 'text',
      timeout: 5000,
      maxContentLength: 1024 * 1024,
      maxRedirects: 3,
      proxy: false,
      httpAgent: new HttpAgent({ lookup: publicLookup }),
      httpsAgent: new HttpsAgent({ lookup: publicLookup }),
      beforeRedirect: (options) => {
        if (
          /^[\d.]+$/.test(options.hostname) ||
          options.hostname.includes(':') ||
          (options.port && !['80', '443'].includes(String(options.port)))
        ) {
          throw new Error('Invalid redirect')
        }
      }
    })
    // Some server-rendered pages append a specific title after the site default.
    const titles = Array.from(
      response.data.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)
    )
    const title = titles[titles.length - 1]?.[1]?.replace(/\s+/g, ' ').trim()
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json({ title: title || null })
  } catch {
    return res.status(200).json({ title: null })
  }
}
