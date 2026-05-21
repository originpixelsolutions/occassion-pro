# Short Links Worker — Deployment Guide

## What this does
Cloudflare Worker at `links.occasionpro.in` — handles all short link redirects with edge-level performance. Calls Supabase `resolve_short_link()` RPC to atomically resolve + track each click.

## First-time setup

```bash
cd workers/short-links
npm install

# Create KV namespace for link caching
wrangler kv:namespace create LINKS_CACHE
wrangler kv:namespace create LINKS_CACHE --preview

# Copy the IDs into wrangler.toml under [[kv_namespaces]]
# Replace REPLACE_WITH_KV_NAMESPACE_ID and REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID

# Set secrets
wrangler secret put SUPABASE_SERVICE_KEY
# → paste your Supabase service role key when prompted
```

## Deploy

```bash
npm run deploy
```

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787
# Test: curl -I http://localhost:8787/[code]
```

## Tail live logs

```bash
npm run tail
```

## Environment variables (wrangler.toml)

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | `https://lndcqdnsllfcnkidhtem.supabase.co` | Supabase project URL |
| `CACHE_TTL_SECONDS` | `30` | KV cache TTL for hot links |
| `FALLBACK_API_URL` | `https://api.occasionpro.in` | NestJS API fallback |
| `NOT_FOUND_URL` | `https://occasionpro.in/link-not-found` | Redirect for invalid links |
| `EXPIRED_URL` | `https://occasionpro.in/link-expired` | Redirect for expired links |

## Secrets (set via `wrangler secret put`)

| Secret | Description |
|--------|-------------|
| `SUPABASE_SERVICE_KEY` | Supabase service role key — authorizes RPC calls |

## DNS setup (Cloudflare dashboard)

1. Add CNAME: `links` → `occasionpro.in` (proxied ✓)
2. The worker route `links.occasionpro.in/*` handles all traffic

## Architecture

```
User clicks link
      ↓
Cloudflare Edge (links.occasionpro.in)
      ↓
KV Cache? → YES → 302 Redirect (async click track)
      ↓ NO
Supabase resolve_short_link() RPC
  - Validates: is_active, expires_at, max_clicks
  - Records: short_link_clicks row
  - Increments: click_count
      ↓
302 Redirect to destination_url
```

## Performance targets
- P50 KV hit: < 10ms
- P50 DB hit: < 80ms
- P99: < 200ms
