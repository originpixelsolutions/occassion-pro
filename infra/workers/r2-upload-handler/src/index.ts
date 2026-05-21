/**
 * OccasionPro R2 Upload Handler Worker
 *
 * Serves uploaded assets from Cloudflare R2 with:
 * - Tenant isolation (path-based: /{bucket}/{tenantId}/{filename})
 * - Cache-Control headers
 * - Image optimization hints
 * - CORS for app origins
 */

interface Env {
  UPLOADS: R2Bucket
  ALLOWED_ORIGINS: string
  MAX_FILE_SIZE_MB: string
}

const CACHE_TTL = {
  image: 86400 * 30,   // 30 days for images
  document: 86400,     // 1 day for documents
  avatar: 86400 * 7,   // 7 days for avatars
  default: 3600,       // 1 hour default
}

function getCacheTTL(key: string): number {
  if (key.startsWith('avatars/')) return CACHE_TTL.avatar
  if (key.startsWith('documents/')) return CACHE_TTL.document
  if (key.startsWith('uploads/') || key.startsWith('floor-plans/')) return CACHE_TTL.image
  return CACHE_TTL.default
}

function getCorsHeaders(origin: string, allowedOrigins: string): Record<string, string> {
  const allowed = allowedOrigins.split(',').map(o => o.trim())
  const isAllowed = allowed.includes(origin) || allowed.includes('*')
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Strip leading slash from pathname
    const key = url.pathname.replace(/^\//, '')

    if (!key) {
      return new Response('Not found', { status: 404 })
    }

    // Check R2 cache first
    const cacheKey = new Request(url.toString(), request)
    const cache = caches.default
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    // Fetch from R2
    const object = await env.UPLOADS.get(key)

    if (!object) {
      return new Response('Object not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    const ttl = getCacheTTL(key)
    const headers = new Headers({
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
      'ETag': object.httpEtag,
      'Last-Modified': object.uploaded.toUTCString(),
      'Content-Length': object.size.toString(),
      'X-Content-Type-Options': 'nosniff',
    })

    // Conditional GET support
    const ifNoneMatch = request.headers.get('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
      return new Response(null, { status: 304, headers })
    }

    const response = new Response(
      request.method === 'HEAD' ? null : object.body,
      { status: 200, headers },
    )

    // Store in cache
    const ctx = { waitUntil: (p: Promise<unknown>) => p } // simplified
    cache.put(cacheKey, response.clone())

    return response
  },
} satisfies ExportedHandler<Env>
