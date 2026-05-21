import type { Metadata } from 'next'
import '../../../globals-client.css'

export const metadata: Metadata = {
  title: 'Client Portal — OccasionPro',
  description: 'Your event client portal',
}

/**
 * Root layout for the client portal route group.
 * Tenant branding is injected at the page level (server components fetch it).
 * No sidebar or app shell — the portal has its own minimal chrome.
 */
export default function ClientPortalRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#0a0a0f] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
