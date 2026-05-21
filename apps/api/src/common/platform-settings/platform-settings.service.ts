import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

/**
 * PlatformSettingsService — reads/writes the global `platform_settings` table.
 * Used by guards and any module that needs platform-level config.
 */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name)
  // In-process cache (TTL: 30s) — Supabase realtime keeps it fresh
  private cache = new Map<string, { value: unknown; expiresAt: number }>()
  private readonly CACHE_TTL_MS = 30_000

  constructor(private readonly supabase: SupabaseService) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiresAt) return cached.value as T

    const { data, error } = await this.supabase.serviceClient
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) {
      this.logger.warn(`platform_settings key not found: ${key}`)
      return null
    }

    const val = data.value as T
    this.cache.set(key, { value: val, expiresAt: Date.now() + this.CACHE_TTL_MS })
    return val
  }

  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    const { error } = await this.supabase.serviceClient
      .from('platform_settings')
      .update({ value, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) throw error
    // Bust cache immediately
    this.cache.delete(key)
  }

  async getAll(): Promise<Array<{ key: string; value: unknown; description: string; updated_at: string }>> {
    const { data } = await this.supabase.serviceClient
      .from('platform_settings')
      .select('key, value, description, updated_at')
      .order('key')
    return data ?? []
  }

  /**
   * Quick helper for the ai_api_enabled check.
   * Gates only LLM API calls (OpenAI/Anthropic/LiteLLM).
   * Rule-based smart features (health scores, budget alerts, duplicate detection, etc.)
   * are NOT gated by this — they always run.
   */
  async isAiApiEnabled(): Promise<boolean> {
    const val = await this.get<boolean>('ai_api_enabled')
    return val === true
  }

  /** @deprecated use isAiApiEnabled() */
  async isAiEnabled(): Promise<boolean> { return this.isAiApiEnabled() }

  /** Invalidate cache — called by realtime listener */
  invalidate(key?: string) {
    if (key) this.cache.delete(key)
    else this.cache.clear()
  }
}
