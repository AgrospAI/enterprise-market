import { PostHog } from 'posthog-node'

let posthogServer: PostHog | null = null
let warnedAboutMissingKey = false

export function getPostHogServer(): PostHog | null {
  // Read through an alias so Next.js does not inline public env at build time.
  const { env } = process
  const key = env.NEXT_PUBLIC_POSTHOG_KEY

  if (!key) {
    if (process.env.NODE_ENV !== 'production' && !warnedAboutMissingKey) {
      console.warn(
        'NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured'
      )
      warnedAboutMissingKey = true
    }
    return null
  }

  posthogServer ??= new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
    enableExceptionAutocapture: process.env.NEXT_RUNTIME === 'nodejs'
  })

  return posthogServer
}
