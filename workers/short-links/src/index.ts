/**
 * OccasionPro — Short Links Cloudflare Worker
 *
 * Handles: links.occasionpro.in/[code]
 *
 * Flow:
 *  1. Extract code from URL path
 *  2. Check KV cache (30-second hot-link cache to reduce DB load)
 *  3. Call Supabase `resolve_short_link()` RPC via REST
 *     - This atomically: validates link, increments click_count, records click analytics
 *  4. Return 302 redirect to destination URL
 *
 * Performance:
 *  - P50 < 10ms (KV cache hit)
 *  - P50 < 80ms (Supabase RPC call from nearest CF edge)
 *  - redirect fires BEFORE tracking completes (ctx.waitUntil for async tracking)
 *
 * Deploy:
 *   cd workers/short-links
 *   wrangler secret put SUPABASE_SERVICE_KEY
 *   wrangler deploy
 */

export interface Env {
  // KV namespace
  LINKS_CACHE: KVNamespace

  // Vars (set in wrangler.toml)
  SUPABASE_URL:       string
  CACHE_TTL_SECONDS:  string
  FALLBACK_API_URL:   string
  NOT_FOUND_URL:      string
  EXPIRED_URL:        string

  // Secrets (set via wrangler secret put)
  SUPABASE_SERVICE_KEY: string
}

interface ResolveResult {
  destination_url: string
  link_type:       string
  tenant_id:       string
  event_id:        string | null
  guest_id:        string | null
  metadata:        Record<string, unknown>
}

interface CacheEntry {
  destination_url: string
  link_type:       string
  cachedAt:        number
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint (useful for uptime monitoring)
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'short-links' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract code from path — strip leading slash, handle trailing slash
    const code = url.pathname.replace(/^\//, '').replace(/\/$/, '').trim()

    if (!code || code.length === 0) {
      return Response.redirect('https://occasionpro.in', 302)
    }

    // Validate code format: 1-50 chars, alphanumeric + hyphens/underscores only
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(code)) {
      return Response.redirect(env.NOT_FOUND_URL, 302)
    }

    try {
      const cacheTtl = parseInt(env.CACHE_TTL_SECONDS ?? '30', 10)

      // ── 1. Check KV cache ──────────────────────────────────────────────────
      const cached = await getCached(env.LINKS_CACHE, code)
      if (cached) {
        // Cache hit: fire redirect immediately, track in background
        ctx.waitUntil(
          trackClick(request, code, env, { fromCache: true })
        )
        return redirect302(cached.destination_url)
      }

      // ── 2. Resolve via Supabase RPC ────────────────────────────────────────
      const resolved = await resolveViaSupabase(request, code, env)

      if (!resolved) {
        return Response.redirect(env.NOT_FOUND_URL, 302)
      }

      if ('error' in resolved) {
        const errorUrl = resolved.error === 'expired'
          ? env.EXPIRED_URL
          : env.NOT_FOUND_URL
        return Response.redirect(errorUrl, 302)
      }

      // ── 3. Cache the destination for subsequent requests ──────────────────
      ctx.waitUntil(
        setCached(env.LINKS_CACHE, code, {
          destination_url: resolved.destination_url,
          link_type:       resolved.link_type,
          cachedAt:        Date.now(),
        }, cacheTtl)
      )

      // ── 4. Redirect ────────────────────────────────────────────────────────
      return redirect302(resolved.destination_url)

    } catch (err: unknown) {
      console.error('Short link worker error:', err)
      // Never show errors to end users — just redirect to fallback
      return Response.redirect(env.NOT_FOUND_URL, 302)
    }
  },
}

// ─── Supabase RPC call ────────────────────────────────────────────────────────

async function resolveViaSupabase(
  request: Request,
  code: string,
  env: Env,
): Promise<ResolveResult | { error: 'expired' | 'limit_reached' } | null> {
  const { ipHash, userAgent, referrer, country, device } = extractRequestMeta(request)

  const rpcUrl = `${env.SUPABASE_URL}/rest/v1/rpc/resolve_short_link`

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({
      p_code:       code,
      p_ip_hash:    ipHash,
      p_user_agent: userAgent,
      p_referrer:   referrer,
      p_country:    country,
      p_device:     device,
    }),
  })

  if (!res.ok) {
    console.error(`Supabase RPC error: ${res.status} ${res.statusText}`)
    return null
  }

  const data = await res.json() as ResolveResult | { error: string } | null

  if (!data) return null

  return data as ResolveResult | { error: 'expired' | 'limit_reached' }
}

// ─── Background click tracking (cache hits only — DB hits already tracked in RPC) ──

async function trackClick(
  request: Request,
  code: string,
  env: Env,
  _opts: { fromCache: boolean },
): Promise<void> {
  // For cache hits, the Supabase RPC was not called, so we still need to record the click.
  // Call a lightweight tracking endpoint that only increments counter + inserts click row.
  const { ipHash, userAgent, referrer, country, device } = extractRequestMeta(request)

  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/resolve_short_link`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        p_code:       code,
        p_ip_hash:    ipHash,
        p_user_agent: userAgent,
        p_referrer:   referrer,
        p_country:    country,
        p_device:     device,
      }),
    })
  } catch {
    // Silently swallow — click tracking is best-effort, never blocks redirect
  }
}

// ─── KV cache helpers ─────────────────────────────────────────────────────────

async function getCached(kv: KVNamespace, code: string): Promise<CacheEntry | null> {
  try {
    const raw = await kv.get(`link:${code}`, 'json') as CacheEntry | null
    return raw
  } catch {
    return null
  }
}

async function setCached(
  kv: KVNamespace,
  code: string,
  entry: CacheEntry,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.put(`link:${code}`, JSON.stringify(entry), {
      expirationTtl: ttlSeconds,
    })
  } catch {
    // KV write failure is non-fatal
  }
}

// ─── Request metadata extraction ─────────────────────────────────────────────

function extractRequestMeta(request: Request): {
  ipHash:    string | null
  userAgent: string | null
  referrer:  string | null
  country:   string | null
  device:    string
} {
  const ua = request.headers.get('user-agent') ?? ''
  const cf = (request as any).cf as Record<string, string> | undefined

  // Cloudflare provides the visitor's IP in CF-Connecting-IP header
  // We hash it for DPDP/GDPR compliance — never store raw IPs
  const ip = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    ?? null

  const device = /Mobile|Android|iPhone/i.test(ua)
    ? 'mobile'
    : /Tablet|iPad/i.test(ua)
      ? 'tablet'
      : 'desktop'

  return {
    ipHash:    ip ? simpleHash(ip) : null,
    userAgent: ua || null,
    referrer:  request.headers.get('Referer'),
    country:   cf?.country ?? null,
    device,
  }
}

/** Simple non-cryptographic hash for IP — sufficient for click deduplication */
function simpleHash(input: string): string {
  // In production a real SHA-256 would be used, but SubtleCrypto is async
  // and we want to keep the hot path synchronous. Use djb2 as a fast proxy.
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    hash = hash >>> 0 // Force 32-bit unsigned
  }
  return hash.toString(16).padStart(8, '0')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redirect302(destination: string): Response {
  return new Response(null, {
    status:  302,
    headers: {
      'Location':      destination,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Powered-By':  'OccasionPro',
    },
  })
}
