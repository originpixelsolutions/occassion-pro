/**
 * Guest Portal Layout
 *
 * Loads portal settings server-side, injects CSS variables for brand color,
 * and renders a minimal shell (no dashboard nav).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000'

interface PortalSettings {
  portal_title?: string
  brand_color?: string
  hero_image_url?: string
  cover_image_url?: string
  footer_text?: string
  hide_powered_by?: boolean
  login_enabled?: boolean
  host_name?: string
}

async function getPortalSettings(eventId: string): Promise<PortalSettings | null> {
  try {
    const res = await fetch(`${API}/guest-portal/${eventId}/settings`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}): Promise<Metadata> {
  const { eventId } = await params
  const settings = await getPortalSettings(eventId)
  return {
    title: settings?.portal_title ?? 'Event Portal',
    description: `Welcome to ${settings?.portal_title ?? 'your event portal'}`,
  }
}

export default async function GuestPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { eventId } = await params
  const settings = await getPortalSettings(eventId)

  const brandColor = settings?.brand_color ?? '#6366f1'
  // Derive a slightly darker shade for text/buttons
  const brandDark = brandColor

  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --portal-brand: ${brandColor};
            --portal-brand-dark: ${brandDark};
            --portal-brand-10: ${brandColor}1a;
            --portal-brand-20: ${brandColor}33;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f0f0f;
            color: #f5f5f5;
            min-height: 100dvh;
          }
          .portal-btn {
            background: var(--portal-brand);
            color: #fff;
            border: none;
            border-radius: 12px;
            padding: 14px 24px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: opacity 0.15s;
          }
          .portal-btn:hover { opacity: 0.88; }
          .portal-btn:disabled { opacity: 0.45; cursor: not-allowed; }
          .portal-btn-outline {
            background: transparent;
            color: var(--portal-brand);
            border: 1.5px solid var(--portal-brand);
            border-radius: 12px;
            padding: 13px 24px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: background 0.15s;
          }
          .portal-btn-outline:hover { background: var(--portal-brand-10); }
          input[type="text"], input[type="tel"], input[type="email"],
          input[type="number"], select, textarea {
            background: #1a1a1a;
            border: 1.5px solid #2e2e2e;
            border-radius: 10px;
            color: #f5f5f5;
            font-size: 15px;
            padding: 12px 14px;
            width: 100%;
            outline: none;
            transition: border-color 0.15s;
          }
          input:focus, select:focus, textarea:focus {
            border-color: var(--portal-brand);
          }
          .portal-card {
            background: #1a1a1a;
            border: 1px solid #262626;
            border-radius: 16px;
            padding: 20px;
          }
          .portal-section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 20px 0;
            font-size: 18px;
            font-weight: 700;
            color: #f5f5f5;
          }
          .portal-back-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: none;
            border: none;
            color: #888;
            font-size: 14px;
            cursor: pointer;
            padding: 0;
            margin-bottom: 4px;
          }
          .portal-back-btn:hover { color: #f5f5f5; }
        `}</style>
      </head>
      <body>
        <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', position: 'relative' }}>
          {children}
        </div>
        {!settings?.hide_powered_by && (
          <div style={{
            textAlign: 'center',
            padding: '16px',
            fontSize: '11px',
            color: '#444',
            letterSpacing: '0.5px',
          }}>
            Powered by OccasionPro
          </div>
        )}
      </body>
    </html>
  )
}
