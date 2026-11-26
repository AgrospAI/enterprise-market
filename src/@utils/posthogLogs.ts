import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import type { LogRecord } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchLogRecordProcessor,
  LoggerProvider
} from '@opentelemetry/sdk-logs'

let loggerProvider: LoggerProvider | undefined

export function getPostHogLoggerProvider(): LoggerProvider | undefined {
  const { env } = process
  if (!env.NEXT_PUBLIC_POSTHOG_KEY || env.POSTHOG_LOGS_ENABLED === 'false') {
    return undefined
  }

  if (!loggerProvider) {
    loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': 'enterprise-market',
        'deployment.environment.name': env.NODE_ENV || 'development'
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${(
              env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
            ).replace(/\/+$/, '')}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${env.NEXT_PUBLIC_POSTHOG_KEY}`,
              'Content-Type': 'application/json'
            },
            timeoutMillis: 2000
          }),
          exportTimeoutMillis: 3000
        })
      ]
    })
    logs.setGlobalLoggerProvider(loggerProvider)
  }

  return loggerProvider
}

// Await this in Pages API handlers so serverless runtimes cannot freeze first.
// Only pass operational metadata; never tokens, cookies, or request bodies.
export async function logServer(record: LogRecord): Promise<void> {
  try {
    const provider = getPostHogLoggerProvider()
    if (!provider) return
    provider.getLogger('enterprise-market').emit(record)
    await provider.forceFlush()
  } catch {
    // Logging failures must not interrupt requests or application startup.
  }
}

export { SeverityNumber }
