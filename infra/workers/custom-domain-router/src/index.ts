/**
 * OccasionPro — Custom Domain Router + Proxy Worker
 *
 * Responsibilities:
 *   1. If the incoming host is a custom domain (found in CUSTOM_DOMAINS_KV),
 *      transparently proxy the request to app.occasionpro.in/[tenantSlug]/[rest]
 *   2. If the incoming host is a *.occasionpro.in subdomain that matches a
 *      known tenant slug, proxy to the canonical app URL (handles direct
 *      subdomain access, e.g. acme.occasionpro.in → app.occasionpro.in/acme/…)
 *   3. Pass all other requests straight through to the origin.
 *
 * KV schema (CUSTOM_DOMAINS_KV):
 *   key   = custom domain, e.g. "events.acme.com"
 *   value = tenant slug,   e.g. "acme"
 */

export interface Env {
  CUSTOM_DOMAINS_KV:  KVNamespace
  APP_ORIGIN:         string   // e.g. "https://app.occasionpro.in"
  ALLOWED_BASE_DOMAIN:string   // e.g. "occasionpro.in"
}

// ─── Helper: strip scheme from origin ────────────────────────────────────────

function originHost(origin: string): string {
  return origin.replace(/^https?:\/\//, '')
}

// ─── Helper: build proxy URL ──────────────────────────────────────────────────

function buildProxyUrl(
  originalUrl: URL,
  appOrigin:   string,
  tenantSlug:  string,
): URL {
  const proxyUrl = new URL(originalUrl.toString())
  proxyUrl.protocol = 'https:'
  proxyUrl.host     = originHost(appOrigin)

  // Prepend /<tenantSlug> if the path doesn't already start with it
  const path = originalUrl.pathname
  if (!path.startsWith(`/${tenantSlug}`)) {
    proxyUrl.pathname = `/${tenantSlug}${path}`
  }

  return proxyUrl
}

// ─── Helper: proxy request, preserving headers ───────────────────────────────

async function proxyRequest(
  request: Request,
  targetUrl: URL,
  customHost: string,
): Promise<Response> {
  const proxyReq = new Request(targetUrl.toString(), {
    method:  request.method,
    headers: request.headers,
    body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect:'follow',
  })

  // Pass the original host so the upstream app knows the custom domain
  proxyReq.headers.set('X-Forwarded-Host', customHost)
  proxyReq.headers.set('X-Custom-Domain',  customHost)

  const response = await fetch(proxyReq)

  // Clone response and add CORS + cache headers
  const newHeaders = new Headers(response.headers)
  newHeaders.set('X-Proxied-By', 'occasionpro-router')

  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    newHeaders,
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url        = new URL(request.url)
    const host       = url.hostname.toLowerCase()
    const appOrigin  = env.APP_ORIGIN ?? 'https://app.occasionpro.in'
    const baseDomain = env.ALLOWED_BASE_DOMAIN ?? 'occasionpro.in'

    // ── 1. Check CUSTOM_DOMAINS_KV for exact domain match ────────────────────
    //    e.g. host = "events.acme.com"
    const tenantSlugFromKv = await env.CUSTOM_DOMAINS_KV.get(host)
    if (tenantSlugFromKv) {
      const targetUrl = buildProxyUrl(url, appOrigin, tenantSlugFromKv)
      return proxyRequest(request, targetUrl, host)
    }

    // ── 2. Check *.occasionpro.in subdomains ─────────────────────────────────
    //    e.g. host = "acme.occasionpro.in" → tenantSlug = "acme"
    if (host.endsWith(`.${baseDomain}`) && host !== baseDomain) {
      const sub = host.slice(0, host.length - baseDomain.length - 1)

      // Skip platform-level subdomains
      const platformSubdomains = ['app', 'api', 'www', 'cdn', 'mail', 'cname']
      if (!platformSubdomains.includes(sub)) {
        // Verify the slug exists in KV (written when tenant is created) or just proxy
        const targetUrl = buildProxyUrl(url, appOrigin, sub)
        return proxyRequest(request, targetUrl, host)
      }
    }

    // ── 3. Pass through to origin ─────────────────────────────────────────────
    return fetch(request)
  },
}
