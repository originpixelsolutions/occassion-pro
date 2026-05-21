/**
 * OccasionPro White-Label Router Worker
 *
 * Routes custom domains (client.eventsbyacme.com) to the correct
 * tenant microsites on OccasionPro infrastructure.
 *
 * Also injects per-tenant branding tokens into HTML responses so that
 * CSS custom properties are set before first paint — no FOUC, no extra
 * round-trip required from the browser.
 *
 * KV schema (DOMAIN_MAP):
 *   key:   hostname               (e.g. "events.acme.com")
 *   value: JSON { tenantId, tenantSlug, originHost }
 *
 * KV schema (BRANDING_CACHE):
 *   key:   "branding:<tenantId>"
 *   value: JSON BrandingTokenSet  (5-minute TTL via expirationTtl)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DOMAIN_MAP: KVNamespace
  BRANDING_CACHE: KVNamespace
  API_URL: string
  DEFAULT_ORIGIN: string
}

interface DomainMapping {
  tenantId: string
  tenantSlug: string
  originHost: string
}

interface BrandingTokenSet {
  primaryHsl: string
  secondaryHsl: string
  accentHsl: string
  dangerHsl: string
  successHsl: string
  infoHsl: string
  backgroundLightHsl: string
  cardLightHsl: string
  borderLightHsl: string
  backgroundDarkHsl: string
  cardDarkHsl: string
  borderDarkHsl: string
  fontFamily: string
  fontUrl: string | null
  borderRadius: string
  darkModeDefault: boolean
  logoUrl: string | null
  faviconUrl: string | null
}

const RADIUS_MAP: Record<string, string> = {
  sharp: '0px',
  default: '0.5rem',
  rounded: '0.75rem',
  pill: '9999px',
}

const BRANDING_TTL_SECONDS = 300 // 5 minutes

// ─── Platform defaults (mirrors globals.css / DEFAULT_BRANDING in lib/branding.ts) ──

const DEFAULT_BRANDING: BrandingTokenSet = {
  primaryHsl: '263 72% 58%',
  secondaryHsl: '38 92% 50%',
  accentHsl: '25 95% 53%',
  dangerHsl: '0 84% 60%',
  successHsl: '160 84% 39%',
  infoHsl: '199 89% 48%',
  backgroundLightHsl: '0 0% 98%',
  cardLightHsl: '0 0% 100%',
  borderLightHsl: '220 13% 91%',
  backgroundDarkHsl: '240 14% 7%',
  cardDarkHsl: '240 13% 10%',
  borderDarkHsl: '240 10% 22%',
  fontFamily: 'Inter',
  fontUrl: null,
  borderRadius: 'default',
  darkModeDefault: true,
  logoUrl: null,
  faviconUrl: null,
}

// ─── CSS generator ────────────────────────────────────────────────────────────

function buildBrandingCSS(tokens: BrandingTokenSet): string {
  const radius = RADIUS_MAP[tokens.borderRadius] ?? RADIUS_MAP.default

  return `
:root {
  --primary: ${tokens.primaryHsl};
  --primary-foreground: 0 0% 100%;
  --secondary: ${tokens.secondaryHsl};
  --secondary-foreground: 0 0% 100%;
  --accent: ${tokens.accentHsl};
  --accent-foreground: 0 0% 100%;
  --destructive: ${tokens.dangerHsl};
  --destructive-foreground: 0 0% 100%;
  --success: ${tokens.successHsl};
  --info: ${tokens.infoHsl};
  --radius: ${radius};
  --font-sans: '${tokens.fontFamily}', ui-sans-serif, system-ui, sans-serif;
}

:root:not(.dark) {
  --background: ${tokens.backgroundLightHsl};
  --foreground: 222 47% 11%;
  --card: ${tokens.cardLightHsl};
  --card-foreground: 222 47% 11%;
  --border: ${tokens.borderLightHsl};
  --input: ${tokens.borderLightHsl};
  --muted: ${tokens.backgroundLightHsl};
  --muted-foreground: 215 16% 47%;
  --popover: ${tokens.cardLightHsl};
  --popover-foreground: 222 47% 11%;
  --ring: ${tokens.primaryHsl};
}

.dark {
  --background: ${tokens.backgroundDarkHsl};
  --foreground: 210 40% 98%;
  --card: ${tokens.cardDarkHsl};
  --card-foreground: 210 40% 98%;
  --border: ${tokens.borderDarkHsl};
  --input: ${tokens.borderDarkHsl};
  --muted: ${tokens.cardDarkHsl};
  --muted-foreground: 215 20% 65%;
  --popover: ${tokens.cardDarkHsl};
  --popover-foreground: 210 40% 98%;
  --ring: ${tokens.primaryHsl};
}`.trim()
}

// ─── Build the <head> injection snippet ──────────────────────────────────────

function buildBrandingSnippet(tokens: BrandingTokenSet): string {
  const css = buildBrandingCSS(tokens)

  const fontLink = tokens.fontUrl
    ? `<link id="op-font" rel="stylesheet" href="${escapeAttr(tokens.fontUrl)}">`
    : ''

  const faviconLink = tokens.faviconUrl
    ? `<link id="op-favicon" rel="icon" href="${escapeAttr(tokens.faviconUrl)}">`
    : ''

  // Inline no-flash theme script — must run before first paint.
  // Respects darkModeDefault: if true, defaults to dark unless the user
  // has explicitly chosen light; if false, defaults to light unless the
  // user has chosen dark or their OS prefers dark.
  const themeScript = tokens.darkModeDefault
    ? `<script>(function(){try{var t=localStorage.getItem('occasion-theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){}})()</script>`
    : `<script>(function(){try{var t=localStorage.getItem('occasion-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})()</script>`

  return `${fontLink}${faviconLink}<style id="op-branding">${css}</style>${themeScript}`
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Fetch branding with KV caching ──────────────────────────────────────────

async function getBranding(tenantId: string, env: Env): Promise<BrandingTokenSet> {
  const cacheKey = `branding:${tenantId}`

  // 1. Try KV cache (fastest path — sub-millisecond on Cloudflare edge)
  try {
    const cached = await env.BRANDING_CACHE.get(cacheKey, 'json')
    if (cached) return cached as BrandingTokenSet
  } catch {
    // KV miss or parse failure — fall through
  }

  // 2. Fetch from branding API
  try {
    const res = await fetch(`${env.API_URL}/branding/${encodeURIComponent(tenantId)}`, {
      headers: { Accept: 'application/json' },
      // Cloudflare cache layer on top of KV cache
      cf: { cacheTtl: BRANDING_TTL_SECONDS, cacheEverything: false },
    })

    if (res.ok) {
      const tokens = (await res.json()) as BrandingTokenSet

      // 3. Populate KV with 5-min TTL
      await env.BRANDING_CACHE.put(cacheKey, JSON.stringify(tokens), {
        expirationTtl: BRANDING_TTL_SECONDS,
      })

      return tokens
    }
  } catch {
    // API unreachable — safe fallback to defaults
  }

  return DEFAULT_BRANDING
}

// ─── HTMLRewriter handler — prepends snippet inside <head> ───────────────────

class HeadInjector implements HTMLRewriterElementContentHandlers {
  private snippet: string
  constructor(snippet: string) { this.snippet = snippet }

  element(element: Element): void {
    // prepend = insert at the very beginning of <head> content
    element.prepend(this.snippet, { html: true })
  }
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname

    // Skip internal/default domains — pass through unchanged
    if (hostname.endsWith('.occasionpro.in') || hostname === 'occasionpro.in') {
      return fetch(request)
    }

    // ── 1. Resolve tenant from DOMAIN_MAP KV ──────────────────────────────────

    const mappingJson = await env.DOMAIN_MAP.get(hostname)

    if (!mappingJson) {
      return new Response(
        JSON.stringify({ error: 'Domain not configured' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    let mapping: DomainMapping
    try {
      mapping = JSON.parse(mappingJson) as DomainMapping
    } catch {
      return new Response('Invalid domain configuration', { status: 500 })
    }

    // ── 2. Proxy request to tenant origin ─────────────────────────────────────

    const originUrl = new URL(request.url)
    originUrl.hostname = mapping.originHost

    const proxied = new Request(originUrl.toString(), {
      method: request.method,
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        'X-Tenant-Id': mapping.tenantId,
        'X-Tenant-Slug': mapping.tenantSlug,
        'X-Forwarded-Host': hostname,
        'X-Original-Host': hostname,
      }),
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'manual',
    })

    const originResponse = await fetch(proxied)

    // ── 3. Build response headers ──────────────────────────────────────────────

    const responseHeaders = new Headers(originResponse.headers)
    responseHeaders.set('X-Powered-By', 'OccasionPro')
    responseHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    responseHeaders.delete('X-Frame-Options') // Allow embedding on custom domains

    // ── 4. Inject branding into HTML responses ─────────────────────────────────

    const contentType = originResponse.headers.get('Content-Type') ?? ''

    if (contentType.includes('text/html')) {
      // Resolve branding tokens for this tenant (KV-cached, 5-min TTL)
      const tokens = await getBranding(mapping.tenantId, env)
      const snippet = buildBrandingSnippet(tokens)

      // HTMLRewriter streams the response and injects our snippet at the top
      // of <head> — zero buffering, works on arbitrarily large HTML pages
      return new HTMLRewriter()
        .on('head', new HeadInjector(snippet))
        .transform(
          new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers: responseHeaders,
          }),
        )
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    })
  },
} satisfies ExportedHandler<Env>
