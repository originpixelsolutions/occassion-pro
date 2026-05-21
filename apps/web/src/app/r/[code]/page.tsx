/**
 * Frontend Fallback Short Link Redirect
 *
 * Used when the Cloudflare Worker (links.occasionpro.in) is not yet configured,
 * or as a fallback for direct app traffic.
 *
 * Route: /r/[code]
 * Server component — resolves and redirects on the server side.
 */
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'

interface Props {
  params: { code: string }
}

async function resolveLink(code: string, userAgent: string): Promise<string | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  try {
    const res = await fetch(`${apiBase}/short-links/r/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'X-Forwarded-For': '0.0.0.0', // server-side; no real IP tracking here
      },
      // No cache — we want fresh resolution each time
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()
    return data?.destination_url ?? null
  } catch {
    return null
  }
}

export default async function ShortLinkRedirectPage({ params }: Props) {
  const { code } = params
  const headersList = headers()
  const userAgent = headersList.get('user-agent') || ''

  const destination = await resolveLink(code, userAgent)

  if (!destination) {
    notFound()
  }

  redirect(destination)
}

// Static-safe metadata
export async function generateMetadata({ params }: Props) {
  return {
    title: 'Redirecting…',
    robots: 'noindex, nofollow',
  }
}
