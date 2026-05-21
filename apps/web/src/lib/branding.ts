// ─────────────────────────────────────────────────────────────────────────────
// branding.ts — client-side branding token utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandingTokenSet {
  primary_hsl: string
  secondary_hsl: string
  accent_hsl: string
  danger_hsl: string
  success_hsl: string
  info_hsl: string
  background_light_hsl: string
  card_light_hsl: string
  border_light_hsl: string
  background_dark_hsl: string
  card_dark_hsl: string
  border_dark_hsl: string
  logo_url: string | null
  favicon_url: string | null
  font_family: string
  font_url: string | null
  border_radius: string
  dark_mode_default: boolean
}

export const DEFAULT_BRANDING: BrandingTokenSet = {
  primary_hsl: '263 72% 58%',
  secondary_hsl: '38 92% 50%',
  accent_hsl: '25 95% 53%',
  danger_hsl: '0 84% 60%',
  success_hsl: '160 84% 39%',
  info_hsl: '199 89% 48%',
  background_light_hsl: '0 0% 98%',
  card_light_hsl: '0 0% 100%',
  border_light_hsl: '220 13% 91%',
  background_dark_hsl: '240 14% 7%',
  card_dark_hsl: '240 13% 10%',
  border_dark_hsl: '240 10% 22%',
  logo_url: null,
  favicon_url: null,
  font_family: 'Inter',
  font_url: null,
  border_radius: 'default',
  dark_mode_default: true,
}

/** Map our border_radius token to a CSS value */
export const RADIUS_MAP: Record<string, string> = {
  sharp: '0px',
  default: '0.5rem',   // 8px
  rounded: '0.75rem',  // 12px
  pill: '9999px',
}

/**
 * Injects branding tokens as CSS custom properties on :root.
 * Safe to call on every branding change — uses a <style id="op-branding"> tag.
 */
export function applyBrandingToDOM(tokens: BrandingTokenSet) {
  if (typeof document === 'undefined') return

  const radius = RADIUS_MAP[tokens.border_radius] ?? RADIUS_MAP.default

  const css = `
:root {
  --primary: ${tokens.primary_hsl};
  --secondary: ${tokens.secondary_hsl};
  --accent: ${tokens.accent_hsl};
  --destructive: ${tokens.danger_hsl};
  --success: ${tokens.success_hsl};
  --info: ${tokens.info_hsl};
  --radius: ${radius};
  --font-sans: '${tokens.font_family}', ui-sans-serif, system-ui, sans-serif;
}

:root:not(.dark) {
  --background: ${tokens.background_light_hsl};
  --card: ${tokens.card_light_hsl};
  --popover: ${tokens.card_light_hsl};
  --border: ${tokens.border_light_hsl};
  --muted: ${tokens.border_light_hsl};
}

.dark {
  --background: ${tokens.background_dark_hsl};
  --card: ${tokens.card_dark_hsl};
  --popover: ${tokens.card_dark_hsl};
  --border: ${tokens.border_dark_hsl};
  --muted: ${tokens.border_dark_hsl};
}
`.trim()

  let el = document.getElementById('op-branding') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'op-branding'
    document.head.appendChild(el)
  }
  el.textContent = css

  // Inject Google Font if specified and different from Inter
  if (tokens.font_url) {
    let fontLink = document.getElementById('op-font') as HTMLLinkElement | null
    if (!fontLink) {
      fontLink = document.createElement('link')
      fontLink.id = 'op-font'
      fontLink.rel = 'stylesheet'
      document.head.appendChild(fontLink)
    }
    if (fontLink.href !== tokens.font_url) {
      fontLink.href = tokens.font_url
    }
  }

  // Update favicon if provided
  if (tokens.favicon_url) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) link.href = tokens.favicon_url
  }
}

/** Fetch branding from API with stale-while-revalidate pattern */
const CACHE_KEY = 'op-branding-cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function fetchBranding(
  tenantId: string | null,
  apiBase: string,
): Promise<BrandingTokenSet> {
  const cacheKey = `${CACHE_KEY}:${tenantId ?? 'default'}`

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const { tokens, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL) return tokens
    }
  } catch {}

  try {
    const id = tenantId ?? 'default'
    const res = await fetch(`${apiBase}/branding/${id}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Branding fetch failed')
    const tokens: BrandingTokenSet = await res.json()
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ tokens, ts: Date.now() }))
    } catch {}
    return tokens
  } catch {
    return DEFAULT_BRANDING
  }
}

/** Invalidate the branding cache for a tenant (call after saving in admin) */
export function invalidateBrandingCache(tenantId: string | null) {
  try {
    localStorage.removeItem(`${CACHE_KEY}:${tenantId ?? 'default'}`)
  } catch {}
}
