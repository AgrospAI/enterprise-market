import posthog from 'posthog-js'
import appConfig from 'app.config.cjs'
import Cookies from 'js-cookie'
import { getRuntimeConfig } from './runtimeConfig'
import { getCookieValue } from './cookies'

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com'
const DEFAULT_POSTHOG_PERSISTENCE = 'localStorage+cookie'

export const ANALYTICS_CONSENT_COOKIE = 'AnalyticsCookieConsent'

let initialized = false
// Tracked separately from `initialized`: PostHog's init is idempotent behind
// that flag, but Plausible's is not, and either provider can be configured
// without the other.
let plausibleInitialized = false

function isPostHogKey(name: string): boolean {
  return name.startsWith('ph_') || name.startsWith('__ph')
}

function removePostHogStorageKeys(
  storageName: 'localStorage' | 'sessionStorage'
): void {
  try {
    const storage = window[storageName]
    Object.keys(storage)
      .filter(isPostHogKey)
      .forEach((name) => storage.removeItem(name))
  } catch {
    // Web Storage can be unavailable when the browser blocks site data.
  }
}

function removePostHogStorage(): void {
  if (typeof window === 'undefined') return

  try {
    const hostnameLabels = window.location.hostname.split('.')
    const cookieDomains = hostnameLabels
      .slice(0, -1)
      .map((_, index) => hostnameLabels.slice(index).join('.'))

    Object.keys(Cookies.get())
      .filter(isPostHogKey)
      .forEach((name) => {
        Cookies.remove(name, { path: '/' })
        cookieDomains.forEach((domain) =>
          Cookies.remove(name, { path: '/', domain })
        )
      })
  } catch {
    // Cookie access can be unavailable in restricted browser contexts.
  }

  removePostHogStorageKeys('localStorage')
  removePostHogStorageKeys('sessionStorage')
}

export function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  return getCookieValue(ANALYTICS_CONSENT_COOKIE) === 'true'
}

/**
 * Whether analytics is configured for this deployment. False on self-hosted
 * instances that have set neither NEXT_PUBLIC_POSTHOG_KEY nor
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN, so the UI can avoid claiming analytics is
 * active when it is not.
 */
export function isAnalyticsConfigured(): boolean {
  const { NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_PLAUSIBLE_DOMAIN } =
    getRuntimeConfig()
  return Boolean(NEXT_PUBLIC_POSTHOG_KEY || NEXT_PUBLIC_PLAUSIBLE_DOMAIN)
}

/**
 * Initialise product analytics. Runs once, client-side only, and fires on load.
 *
 * The provider is selected by which credentials are present: PostHog via
 * NEXT_PUBLIC_POSTHOG_KEY (mirroring the snippet used on oceanenterprise.io),
 * Plausible via NEXT_PUBLIC_PLAUSIBLE_DOMAIN. Setting both enables both.
 *
 * No-ops when neither is set — the default for self-hosted deployments, so a
 * self-hoster sends nothing unless they explicitly opt in. Values are read from
 * the runtime config so they work on both the Vercel build and the self-hosted
 * Docker image (env injected at boot).
 */
export function initAnalytics({
  posthog: enablePostHog = true,
  plausible: enablePlausible = true
}: { posthog?: boolean; plausible?: boolean } = {}): void {
  if (typeof window === 'undefined') return

  const {
    NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  } = getRuntimeConfig()

  if (!NEXT_PUBLIC_POSTHOG_KEY && !NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return

  if (enablePostHog && NEXT_PUBLIC_POSTHOG_KEY) {
    if (!initialized) {
      posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
        // Matches the marketing site. Enables SPA-aware pageviews
        // (capture_pageview: 'history_change') and injects external scripts into
        // <head> to avoid Next.js SSR hydration errors.
        defaults: '2026-01-30',
        capture_exceptions: true
      })
      initialized = true
    }

    // Re-callable so the user can opt back in without a reload.
    const wasOptedOut = posthog.has_opted_out_capturing()
    posthog.set_config({
      persistence: DEFAULT_POSTHOG_PERSISTENCE,
      opt_out_capturing_by_default: false
    })

    if (wasOptedOut) posthog.opt_in_capturing({ captureEventName: false })
  }

  if (
    enablePlausible &&
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN &&
    !plausibleInitialized
  ) {
    plausibleInitialized = true
    import('@plausible-analytics/tracker').then(({ init }) =>
      init({ domain: NEXT_PUBLIC_PLAUSIBLE_DOMAIN })
    )
  }
}

export function disableAnalytics(): void {
  if (initialized) {
    posthog.opt_out_capturing()
    posthog.set_config({
      persistence: 'memory',
      opt_out_capturing_by_default: true
    })
    posthog.reset(true)
  }

  removePostHogStorage()

  // Plausible is cookieless and persists nothing, so there is no storage to
  // purge. It also exposes no stop API, so consent is enforced by never
  // initialising it without consent (see maybeInitAnalytics). Withdrawing
  // consent mid-session leaves the already-loaded tracker running until the
  // next page load.
}

export function maybeInitAnalytics(): void {
  if (!isAnalyticsConfigured()) {
    disableAnalytics()
    return
  }

  const hasConsent = hasAnalyticsConsent()
  // PostHog persists to cookies and localStorage, so it always needs consent,
  // whether or not the privacy preference center is enabled. With the banner
  // off there is no way to give it, so PostHog stays off. Plausible is
  // cookieless and only needs consent when the banner asks for it.
  const allowPostHog = hasConsent
  const allowPlausible =
    hasConsent || appConfig?.privacyPreferenceCenter !== 'true'

  if (!allowPostHog) disableAnalytics()
  if (!allowPostHog && !allowPlausible) return

  initAnalytics({ posthog: allowPostHog, plausible: allowPlausible })
}
