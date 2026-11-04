import type { NextApiRequest, NextApiResponse } from 'next'
import { LoggerInstance } from '@oceanprotocol/lib'

const AGROPORTAL_API_URL = 'https://data.agroportal.eu'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.AGROPORTAL_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'AGROPORTAL_API_KEY not configured' })
  }

  try {
    const response = await fetch(
      `${AGROPORTAL_API_URL}/ontologies?display=acronym&display_links=false&display_context=false`,
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

    const data: { acronym: string }[] = await response.json()
    const acronyms = data
      .map((ontology) => ontology.acronym)
      .sort((a, b) => a.localeCompare(b))

    // The ontology list changes rarely
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(acronyms)
  } catch (error) {
    LoggerInstance.error('AgroPortal ontologies error:', error.message)
    return res.status(502).json({ error: 'Failed to fetch from AgroPortal' })
  }
}
