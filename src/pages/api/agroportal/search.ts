import type { NextApiRequest, NextApiResponse } from 'next'
import { LoggerInstance } from '@oceanprotocol/lib'
import type { AgroPortalSearchResult } from 'src/@types/AgroPortal'

const AGROPORTAL_API_URL = 'https://data.agroportal.eu'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AgroPortalSearchResult | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q, ontologies, page, pagesize } = req.query

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' })
  }

  const apiKey = process.env.AGROPORTAL_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'AGROPORTAL_API_KEY not configured' })
  }

  try {
    const searchParams = new URLSearchParams({
      q,
      page: typeof page === 'string' ? page : '1',
      pagesize: typeof pagesize === 'string' ? pagesize : '10',
      display_context: 'false',
      display_links: 'true'
    })
    if (typeof ontologies === 'string' && ontologies) {
      searchParams.append('ontologies', ontologies)
    }

    const response = await fetch(
      `${AGROPORTAL_API_URL}/search?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `apikey token=${apiKey}`,
          Accept: 'application/json'
        }
      }
    )
    if (!response.ok) {
      throw new Error(`AgroPortal API error: ${response.statusText}`)
    }

    const data: AgroPortalSearchResult = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    LoggerInstance.error('AgroPortal search error:', error.message)
    return res.status(502).json({ error: 'Failed to fetch from AgroPortal' })
  }
}
