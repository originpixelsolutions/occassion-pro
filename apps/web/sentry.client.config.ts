/**
 * OccasionPro — Sentry browser (client) initialisation
 *
 * This file is loaded automatically by Next.js when @sentry/nextjs is installed.
 * It must live at the project root (next to next.config.ts).
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10 % of transactions for performance monitoring in production.
  // 100 % in development so every slow page is visible while you're building.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session-replay: 1 % of normal sessions, 100 % of sessions with an error.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content and block all media by default (DPDP / GDPR).
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Only send events in production; silence Sentry noise locally.
  enabled: process.env.NODE_ENV === 'production',

  // Strip credentials from URLs before they reach Sentry.
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/[?&]token=[^&]*/gi, '')
    }
    return event
  },
})
