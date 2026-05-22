import withPWAInit from '@ducanh2912/next-pwa'

// ── Content Security Policy ────────────────────────────────────────────────
// Adjust 'connect-src' / 'img-src' when adding new third-party integrations.
// Keep 'unsafe-inline' for scripts/styles as Next.js requires it for its
// runtime until nonce-based CSP is fully implemented.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next.js requires unsafe-eval for hot reloading in dev
  // and unsafe-inline for its runtime script injection
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Images: self + CDN + data URIs (for avatars/previews) + blob (for canvas exports)
  "img-src 'self' data: blob: https://cdn.occasionpro.in https://*.supabase.co https://*.r2.cloudflarestorage.com https://lh3.googleusercontent.com",
  // API connections + Supabase realtime WebSockets + pusher/socket.io if used
  "connect-src 'self' https://api.occasionpro.in https://*.supabase.co wss://*.supabase.co https://app.occasionpro.in",
  // Media for audio/video in presentations or uploads
  "media-src 'self' blob: https://cdn.occasionpro.in",
  // Workers for PDF generation (pdfjs, etc.)
  "worker-src 'self' blob:",
  // No framing — prevents clickjacking (belt + suspenders with X-Frame-Options)
  "frame-ancestors 'none'",
  // Forms only submit to self
  "form-action 'self'",
  // Upgrade insecure requests in production
  "upgrade-insecure-requests",
].join('; ')

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.occasionpro.in' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // ── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent embedding in iframes (clickjacking protection)
          { key: 'X-Frame-Options', value: 'DENY' },

          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // Restrict powerful browser features
          {
            // camera=() blocks camera globally; overridden per-route below for check-in PWA
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'bluetooth=()',
              'accelerometer=()',
              'gyroscope=()',
              'magnetometer=()',
              'interest-cohort=()', // Disable FLoC
            ].join(', '),
          },

          // Content Security Policy
          { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },

          // HSTS — Only enable in production (enforced via server/CDN)
          // Set in production via Cloudflare or reverse proxy for proper
          // preload list submission. Here as defense-in-depth.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },

          // Prevent XSS filter bypass in older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },

          // Control cross-origin resource sharing at the browser level
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        // Public assets: allow cross-origin embedding for guest portals
        source: '/public/(.*)',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        // Check-in PWA: allow camera for QR scanning, override global deny
        source: '/checkin-pwa/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(self)',   // Allow camera for QR scanning
              'microphone=()',
              'geolocation=()',
              'payment=()',
            ].join(', '),
          },
          // PWA shell pages should not be cached at CDN level — let SW handle it
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // API routes: strict no-cache for dynamic data
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ]
  },
}

// ── PWA (check-in offline shell only) ─────────────────────────────────────
// We use a custom hand-written sw.js in public/ rather than a generated one,
// so disable Workbox generation entirely. next-pwa's job here is to inject
// the SW registration snippet and add the manifest link into <head>.
// For full precache control see apps/web/public/sw.js.
const withPWA = withPWAInit({
  dest: 'public',
  // Only activate for the check-in sub-path — leaves the main app unaffected
  scope: '/checkin-pwa',
  sw: 'sw.js',
  // Don't auto-generate Workbox manifest — we handle caching in sw.js manually
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/checkin-pwa',
  },
  workboxOptions: {
    // Skip Workbox asset injection — our sw.js is self-contained
    swSrc: 'public/sw.js',
    swDest: 'public/sw.js',
  },
  // Runtime caching rules (applied by next-pwa for auto-generated workers only;
  // included here for reference — actual logic is in public/sw.js)
  runtimeCaching: [
    {
      // Static assets — cache-first
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'op-checkin-static-v1',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // API responses — network-first, 24h fallback cache
      urlPattern: /\/api\/v1\/guests\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'op-checkin-api-v1',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

// PWA temporarily disabled during deploy fix
export default nextConfig
