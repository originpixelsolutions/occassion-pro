import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import { UpsertBrandingDto } from './branding.dto'

// ─── In-process cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  tokens: BrandingTokenSet
  expiresAt: number // Date.now() ms
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface BrandingTokenSet {
  // Palette HSL
  primary_hsl: string
  secondary_hsl: string
  accent_hsl: string
  danger_hsl: string
  success_hsl: string
  info_hsl: string
  // Surfaces
  background_light_hsl: string
  card_light_hsl: string
  border_light_hsl: string
  background_dark_hsl: string
  card_dark_hsl: string
  border_dark_hsl: string
  // Assets
  logo_url: string | null
  favicon_url: string | null
  // Typography
  font_family: string
  font_url: string | null
  // Shape
  border_radius: string
  dark_mode_default: boolean
}

const DEFAULTS: BrandingTokenSet = {
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

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name)

  /**
   * In-process branding cache.
   *
   * Key: tenantId string | '__platform__' for the platform default row.
   *
   * This is an L1 cache that sits in front of Supabase.  The Cloudflare
   * white-label Worker has its own KV-based L2 cache — the vast majority
   * of white-label requests never reach this service at all.
   *
   * Entries are invalidated on every upsert/reset so reads stay consistent
   * immediately after a write.
   */
  private readonly cache = new Map<string, CacheEntry>()

  constructor(private readonly supabase: SupabaseService) {}

  /** Resolve branding for a tenant, falling back to platform defaults. */
  async getBranding(tenantId: string | null): Promise<BrandingTokenSet> {
    const cacheKey = tenantId ?? '__platform__'

    // L1 in-process cache check
    const hit = this.cache.get(cacheKey)
    if (hit && hit.expiresAt > Date.now()) {
      return hit.tokens
    }

    const tokens = await this.fetchFromDb(tenantId)
    this.setCache(cacheKey, tokens)
    return tokens
  }

  private async fetchFromDb(tenantId: string | null): Promise<BrandingTokenSet> {
    const db = this.supabase.serviceClient

    // Try tenant-specific row first
    if (tenantId) {
      const { data: tenantRow, error } = await db
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) this.logger.warn(`Branding fetch error for tenant ${tenantId}: ${error.message}`)
      if (tenantRow) return this.rowToTokenSet(tenantRow)
    }

    // Fall back to platform default (tenant_id IS NULL)
    const { data: platformRow, error: platformError } = await db
      .from('tenant_branding')
      .select('*')
      .is('tenant_id', null)
      .maybeSingle()

    if (platformError) this.logger.warn(`Platform branding fetch error: ${platformError.message}`)
    if (platformRow) return this.rowToTokenSet(platformRow)

    // Hardcoded fallback — only fires if migration seed wasn't run
    this.logger.warn('No branding row found — returning hardcoded defaults')
    return DEFAULTS
  }

  async upsertBranding(tenantId: string | null, dto: UpsertBrandingDto): Promise<BrandingTokenSet> {
    const db = this.supabase.serviceClient

    const payload = {
      tenant_id: tenantId,
      ...dto,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from('tenant_branding')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select()
      .single()

    if (error) throw new Error(error.message)

    const tokens = this.rowToTokenSet(data)
    // Invalidate cache so the next read reflects the saved values
    this.invalidateCache(tenantId)
    return tokens
  }

  async resetToDefaults(tenantId: string): Promise<BrandingTokenSet> {
    const db = this.supabase.serviceClient

    const { error } = await db
      .from('tenant_branding')
      .delete()
      .eq('tenant_id', tenantId)

    if (error) throw new Error(error.message)

    this.invalidateCache(tenantId)
    return this.getBranding(tenantId)
  }

  async listAllBrandings(): Promise<Array<{ tenant_id: string | null } & BrandingTokenSet>> {
    const db = this.supabase.serviceClient
    const { data, error } = await db
      .from('tenant_branding')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(r => ({ tenant_id: r.tenant_id, ...this.rowToTokenSet(r) }))
  }

  // ─── Cache helpers ───────────────────────────────────────────────────────────

  private invalidateCache(tenantId: string | null): void {
    this.cache.delete(tenantId ?? '__platform__')
    // A platform default update affects all tenants that fall back to it —
    // clear everything so stale merged values don't linger
    if (tenantId === null) this.cache.clear()
  }

  private setCache(key: string, tokens: BrandingTokenSet): void {
    this.cache.set(key, { tokens, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  // ─── Row mapper ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToTokenSet(row: Record<string, any>): BrandingTokenSet {
    return {
      primary_hsl: row.primary_hsl ?? DEFAULTS.primary_hsl,
      secondary_hsl: row.secondary_hsl ?? DEFAULTS.secondary_hsl,
      accent_hsl: row.accent_hsl ?? DEFAULTS.accent_hsl,
      danger_hsl: row.danger_hsl ?? DEFAULTS.danger_hsl,
      success_hsl: row.success_hsl ?? DEFAULTS.success_hsl,
      info_hsl: row.info_hsl ?? DEFAULTS.info_hsl,
      background_light_hsl: row.background_light_hsl ?? DEFAULTS.background_light_hsl,
      card_light_hsl: row.card_light_hsl ?? DEFAULTS.card_light_hsl,
      border_light_hsl: row.border_light_hsl ?? DEFAULTS.border_light_hsl,
      background_dark_hsl: row.background_dark_hsl ?? DEFAULTS.background_dark_hsl,
      card_dark_hsl: row.card_dark_hsl ?? DEFAULTS.card_dark_hsl,
      border_dark_hsl: row.border_dark_hsl ?? DEFAULTS.border_dark_hsl,
      logo_url: row.logo_url ?? null,
      favicon_url: row.favicon_url ?? null,
      font_family: row.font_family ?? DEFAULTS.font_family,
      font_url: row.font_url ?? null,
      border_radius: row.border_radius ?? DEFAULTS.border_radius,
      dark_mode_default: row.dark_mode_default ?? DEFAULTS.dark_mode_default,
    }
  }
}
