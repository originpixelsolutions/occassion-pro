/**
 * OccasionPro — Sentry Node (server / edge) initialisation
 *
 * Used by Next.js server components, API route handlers, and middleware.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture all server-side transactions; they are cheaper than browser ones.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Only send events in production.
  enabled: process.env.NODE_ENV === 'production',

  // Attach request headers for better debugging (strips Authorization).
  includeLocalVariables: true,

  beforeSend(event) {
    // Redact Authorization header so JWTs never reach Sentry.
    if (event.request?.headers) {
      delete (event.request.headers as Record<string, unknown>)['authorization']
      delete (event.request.headers as Record<string, unknown>)['cookie']
    }
    return event
  },
})
