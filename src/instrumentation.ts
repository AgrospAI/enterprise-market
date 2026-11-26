import { createOnRequestError } from '@posthog/next'
import { getPostHogServer } from './@utils/posthogServer'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    getPostHogServer()
    const { logServer, SeverityNumber } = await import('./@utils/posthogLogs')
    await logServer({
      body: 'Server logging initialized',
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO'
    })
  }
}

// Resolve capture settings at runtime, after Docker environment injection.
export async function onRequestError(
  ...args: Parameters<ReturnType<typeof createOnRequestError>>
): Promise<void> {
  const { env } = process
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return

  const capture = createOnRequestError({
    apiKey: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
  })(...args)

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logServer, SeverityNumber } = await import('./@utils/posthogLogs')
    await logServer({
      body: 'Unhandled server request error',
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      attributes: {
        'http.request.method': args[1].method,
        'next.route': args[2].routePath,
        'next.router': args[2].routerKind
      }
    })
  }
  await capture
}
