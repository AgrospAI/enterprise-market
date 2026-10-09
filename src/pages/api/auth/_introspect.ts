/* eslint-disable camelcase */
import { getOidcEndpoints } from './_oidc'

const INTROSPECT_TIMEOUT_MS = 5000

export type AccessTokenIntrospectionResult =
  | { status: 'active'; exp?: number }
  | { status: 'inactive' }
  | { status: 'unknown'; reason: string }

/**
 * Asks the OIDC provider whether this access token is still active.
 *
 * Do not cache positive introspection responses. Session polling uses this as
 * the live source of truth for revocations, so `active: false` must be observed
 * on the next `/api/auth/session` check.
 */
export async function introspectAccessToken(
  accessToken: string,
  issuer: string,
  clientId: string,
  clientSecret: string
): Promise<AccessTokenIntrospectionResult> {
  const { introspection: introspectUrl } = await getOidcEndpoints(issuer)

  try {
    const response = await fetch(introspectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token'
      }),
      signal: AbortSignal.timeout(INTROSPECT_TIMEOUT_MS)
    })

    if (!response.ok) {
      // These statuses usually mean our OIDC setup is wrong, not that
      // the provider is temporarily down. Keep the log marker stable for alerts.
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        console.error(
          `INTROSPECT_CONFIG_ERROR status=${response.status} — check OIDC_CLIENT_SECRET, NEXT_PUBLIC_OIDC_ISSUER, and that the OIDC client is permitted to call the introspection endpoint.`
        )
      } else {
        console.error(`Introspection HTTP ${response.status}.`)
      }
      return { status: 'unknown', reason: `http_${response.status}` }
    }

    const data = (await response.json().catch(() => null)) as {
      active?: unknown
      exp?: unknown
    } | null

    if (!data || typeof data.active !== 'boolean') {
      console.error('Introspection response missing or malformed.')
      return { status: 'unknown', reason: 'malformed_response' }
    }

    if (!data.active) return { status: 'inactive' }

    const exp =
      typeof data.exp === 'number' && data.exp > 0 ? data.exp : undefined
    return { status: 'active', exp }
  } catch (error) {
    console.error('Introspection call threw:', error)
    return { status: 'unknown', reason: 'request_failed' }
  }
}
