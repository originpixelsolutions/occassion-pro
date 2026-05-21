import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'OccasionPro Check-in',
  description: 'Offline-capable guest check-in',
  manifest: '/checkin-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OP Check-in',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-touch-fullscreen': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#6366f1' },
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
  ],
}

export default function CheckinPwaLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      {/*
       * Standalone PWA layout — intentionally outside (dashboard) group.
       * Registers the service worker from /public/sw.js.
       */}
      <body
        className="h-full bg-[#0f0f13] text-white antialiased overflow-hidden"
        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      >
        {/* Safe area wrapper for notch/home-bar on iOS */}
        <div
          className="h-full flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>
        {/* SW registration — runs client-side only */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}

// Inline client component to register SW
function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/checkin-pwa' })
                .then(function(reg) {
                  console.log('[SW] Registered, scope:', reg.scope);
                })
                .catch(function(err) {
                  console.warn('[SW] Registration failed:', err);
                });
            });
          }
        `,
      }}
    />
  )
}
