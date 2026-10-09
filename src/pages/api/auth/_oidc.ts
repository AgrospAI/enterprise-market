import { createRemoteJWKSet } from 'jose'
import { OIDC_DISCOVERY_PATH, OIDC_REQUEST_TIMEOUT_MS } from './_constants'

const oidcMetadataCache = new Map<
  string,
  {
    issuer: string
    jwks: ReturnType<typeof createRemoteJWKSet>
  }
>()

const endSessionUrlCache = new Map<string, string>()

export type OidcEndpoints = {
  authorization: string
  token: string
  introspection: string
  revocation: string
  endSession: string
}

const oidcEndpointsCache = new Map<string, OidcEndpoints>()

export function isAuthentikIssuer(issuer: string): boolean {
  return issuer.includes('/application/o/')
}

// Authentik-style paths, used when the discovery document is unavailable
// or does not advertise an endpoint.
function getFallbackEndpoints(issuer: string): OidcEndpoints {
  const normalizedIssuer = issuer.replace(/\/$/, '')
  const base = isAuthentikIssuer(issuer)
    ? `${issuer.split('/application/o/')[0]}/application/o`
    : normalizedIssuer

  return {
    authorization: `${base}/authorize/`,
    token: `${base}/token/`,
    introspection: `${base}/introspect/`,
    revocation: `${base}/revoke/`,
    endSession: `${normalizedIssuer}/end-session/`
  }
}

function pickUrl(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

// Resolves the provider endpoints from the OIDC discovery document so that
// non-Authentik providers (e.g. Keycloak) work without extra configuration.
export async function getOidcEndpoints(issuer: string): Promise<OidcEndpoints> {
  const normalizedIssuer = issuer.replace(/\/$/, '')
  const cached = oidcEndpointsCache.get(normalizedIssuer)
  if (cached) return cached

  const fallback = getFallbackEndpoints(issuer)

  try {
    const response = await fetch(`${normalizedIssuer}${OIDC_DISCOVERY_PATH}`, {
      signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`Discovery returned status ${response.status}`)
    }

    const discovery = await response.json()
    const endpoints: OidcEndpoints = {
      authorization: pickUrl(
        discovery.authorization_endpoint,
        fallback.authorization
      ),
      token: pickUrl(discovery.token_endpoint, fallback.token),
      introspection: pickUrl(
        discovery.introspection_endpoint,
        fallback.introspection
      ),
      revocation: pickUrl(discovery.revocation_endpoint, fallback.revocation),
      endSession: pickUrl(discovery.end_session_endpoint, fallback.endSession)
    }

    oidcEndpointsCache.set(normalizedIssuer, endpoints)
    return endpoints
  } catch (error) {
    console.error(
      'Failed to load OIDC discovery document, using fallback endpoints:',
      error
    )
    return fallback
  }
}

export async function getOidcMetadata(issuer: string) {
  const normalizedIssuer = issuer.replace(/\/$/, '')
  const cached = oidcMetadataCache.get(normalizedIssuer)
  if (cached) return cached

  const discoveryUrl = `${normalizedIssuer}${OIDC_DISCOVERY_PATH}`
  const response = await fetch(discoveryUrl, {
    signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error('Unable to load OIDC discovery document')
  }

  const discovery = await response.json()
  if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery document missing jwks_uri')
  }

  const metadata = {
    issuer: typeof discovery.issuer === 'string' ? discovery.issuer : issuer,
    jwks: createRemoteJWKSet(new URL(discovery.jwks_uri))
  }
  oidcMetadataCache.set(normalizedIssuer, metadata)
  return metadata
}

export async function getEndSessionUrlFromWellKnown(
  wellKnownUrl: string
): Promise<string> {
  const cached = endSessionUrlCache.get(wellKnownUrl)
  if (cached) return cached

  try {
    const response = await fetch(wellKnownUrl, {
      signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC metadata from ${wellKnownUrl}`)
    }

    const metadata = await response.json()

    let endSessionUrl = metadata.end_session_endpoint

    if (!endSessionUrl) {
      const baseUrl = wellKnownUrl.replace(
        '/.well-known/openid-configuration',
        ''
      )
      endSessionUrl = `${baseUrl.replace(/\/$/, '')}/end-session/`
    }

    endSessionUrlCache.set(wellKnownUrl, endSessionUrl)

    return endSessionUrl
  } catch (error) {
    console.error('Failed to fetch end_session_url from well-known:', error)
    throw error
  }
}

export function clearEndSessionUrlCache() {
  endSessionUrlCache.clear()
}
