# Server logs

Server logs use the existing `NEXT_PUBLIC_POSTHOG_KEY` project token (`phc_`,
never a personal API key) and `NEXT_PUBLIC_POSTHOG_HOST` ingestion host, which
defaults to `https://eu.i.posthog.com`. These values are read at server startup,
including when injected into Docker at runtime. With no project token, logging
is disabled. Set `POSTHOG_LOGS_ENABLED=false` to disable it independently.

Node.js instrumentation sends a startup entry and logs unhandled request
failures with the HTTP method and route pattern. Browser console messages and
existing server console messages are not forwarded. Server operational logging
is independent of browser analytics consent. Do not include credentials,
cookies, request bodies, query strings, or personal data in log records.

For additional server-side logs, await the helper before completing a request:

```ts
import { logServer, SeverityNumber } from '@utils/posthogLogs'

await logServer({
  body: 'Background job completed',
  severityNumber: SeverityNumber.INFO,
  severityText: 'INFO',
  attributes: { 'job.name': 'catalog-refresh' }
})
```

The helper flushes the batch before resolving so Pages API handlers work in
serverless deployments. Export failures are contained and do not fail requests.
Use this helper only in Node.js server code.

To verify delivery, start the application with the project token configured,
then find `Server logging initialized` in PostHog Logs with
`service.name=enterprise-market`. A production deployment must be restarted
after changing the environment settings.

Reference: [PostHog Next.js logs installation](https://posthog.com/docs/logs/installation/nextjs).
