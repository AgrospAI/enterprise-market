import { createOnRequestError } from '@posthog/next'
import { getPostHogServer } from './@utils/posthogServer'

export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    getPostHogServer()
  }
}

// Resolve capture settings at runtime, after Docker environment injection.
export const onRequestError: ReturnType<typeof createOnRequestError> = (
  ...args
) => {
  const { env } = process
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return

  return createOnRequestError({
    apiKey: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
  })(...args)
}
