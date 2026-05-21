/**
 * OccasionPro Short Link Router — Cloudflare Worker
 *
 * Handles links.occasionpro.in/* → resolves via Supabase, caches 60s, 301 redirects.
 * DPDP compliant: stores SHA-256 of IP, never raw address.
 */

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ENVIRONMENT: string
}

const CACHE_TTL = 60 // seconds
const BOT_UA_PATTERN = /bot|crawler|spider|slurp|bingbot|googlebot|facebookexternalhit/i

interface ResolvedLink {
  destination_url: string
  link_type: string
  title: string | null
  is_active: boolean
  expires_at: string | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return 'mobile'
  if (/tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}

function extractCode(url: URL): string | null {
  // Path is either /:code or /r/:code (fallback)
  const parts = url.pathname.replace(/^\//, '').split('/')
  const code = parts[parts.length - 1]
  return code && code.length > 0 ? code : null
}

async function resolveFromSupabase(
  code: string,
  ipHash: string,
  userAgent: string,
  referrer: string,
  country: string,
  device: string,
  env: Env,
): Promise<ResolvedLink | null> {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/resolve_short_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_code: code,
      p_ip_hash: ipHash,
      p_user_agent: userAgent.slice(0, 512),
      p_referrer: referrer.slice(0, 512),
      p_country: country,
      p_device: device,
    }),
  })

  if (!resp.ok) return null

  const json: ResolvedLink | null = await resp.json()
  return json
}

// ── main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health / ping endpoint — useful for uptime checks
    if (url.pathname === '/__health') {
      return new Response(JSON.stringify({ status: 'ok', env: env.ENVIRONMENT }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const code = extractCode(url)
    if (!code) {
      return Response.redirect('https://occasionpro.app', 301)
    }

    // Preview mode — append ?preview=1 to see link metadata without redirect
    const isPreview = url.searchParams.get('preview') === '1'

    const userAgent = request.headers.get('User-Agent') || ''
    const referrer = request.headers.get('Referer') || ''
    const country = (request as any).cf?.country || 'unknown'
    const isBot = BOT_UA_PATTERN.test(userAgent)
    const device = detectDevice(userAgent)

    // ── Try Cloudflare Cache ──────────────────────────────────────────────
    // Only cache for non-bots and non-preview requests (clicks won't be tracked from cache)
    const cache = caches.default
    const cacheKey = new Request(`https://cache.internal/short-link/${code}`, { method: 'GET' })

    if (!isBot && !isPreview) {
      const cached = await cache.match(cacheKey)
      if (cached) {
        const cachedData: ResolvedLink = await cached.clone().json()
        // Still need to track the click — do it async so it doesn't block redirect
        if (cachedData.is_active) {
          const ipHash = await sha256Hex(
            (request as any).cf?.ip || request.headers.get('CF-Connecting-IP') || 'unknown',
          )
          ctx.waitUntil(
            resolveFromSupabase(code, ipHash, userAgent, referrer, country, device, env).catch(
              () => {},
            ),
          )
          return Response.redirect(cachedData.destination_url, 301)
        }
      }
    }

    // ── Resolve from Supabase ─────────────────────────────────────────────
    const clientIp =
      (request as any).cf?.ip ||
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0] ||
      'unknown'
    const ipHash = isBot ? 'bot' : await sha256Hex(clientIp)

    const link = await resolveFromSupabase(
      code,
      ipHash,
      userAgent,
      referrer,
      country,
      device,
      env,
    )

    if (!link) {
      // Link not found — redirect to 404 fallback on main app
      return Response.redirect(`https://occasionpro.app/not-found?code=${encodeURIComponent(code)}`, 302)
    }

    // Expired or inactive
    if (!link.is_active) {
      return Response.redirect(
        `https://occasionpro.app/link-expired?code=${encodeURIComponent(code)}`,
        302,
      )
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return Response.redirect(
        `https://occasionpro.app/link-expired?code=${encodeURIComponent(code)}`,
        302,
      )
    }

    // Preview mode — return metadata JSON
    if (isPreview) {
      return new Response(
        JSON.stringify({
          code,
          destination_url: link.destination_url,
          link_type: link.link_type,
          title: link.title,
          is_active: link.is_active,
          expires_at: link.expires_at,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // ── Cache the resolved link for 60s ──────────────────────────────────
    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(JSON.stringify(link), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CACHE_TTL}`,
          },
        }),
      ),
    )

    // 301 permanent redirect
    return Response.redirect(link.destination_url, 301)
  },
}
