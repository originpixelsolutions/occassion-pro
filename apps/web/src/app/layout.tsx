import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from 'sonner'
import { BrandingProvider } from '@/components/providers/branding-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'OccasionPro',
    template: '%s | OccasionPro',
  },
  description: 'AI-powered enterprise event operating system',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://app.occasionpro.in'),
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1117' },
  ],
}

/** Inline script injected before page paint — prevents FOUC on theme load */
const noFlashScript = `
(function(){
  try {
    var t = localStorage.getItem('occasion-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      document.documentElement.classList.remove('dark');
    }
  } catch(e){}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Anti-FOUC theme initialisation — must run before first paint */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <BrandingProvider>
          <ThemeProvider>
            <QueryProvider>
              {children}
              <Toaster richColors position="top-right" />
            </QueryProvider>
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  )
}
