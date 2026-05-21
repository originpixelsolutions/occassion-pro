import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SystemSetting, SystemSettingView } from './system-settings.entity';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);
  private supabase: SupabaseClient;

  /** In-memory cache: key → { value, expiresAt } */
  private cache = new Map<string, { value: string | null; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Get a single setting value (cached). Falls back to env var of same name. */
  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const { data, error } = await this.supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.warn(`system_settings get error for "${key}": ${error.message}`);
    }

    const value = data?.value ?? this.config.get<string>(key.toUpperCase()) ?? null;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** Get all settings (admin view — sensitive values masked unless reveal=true) */
  async findAll(reveal = false): Promise<SystemSettingView[]> {
    const { data, error } = await this.supabase
      .from('system_settings')
      .select('*')
      .order('category')
      .order('key');

    if (error) throw new Error(error.message);

    return (data as SystemSetting[]).map((s) => ({
      ...s,
      value: s.is_sensitive && !reveal ? null : s.value,
      has_value: s.value !== null && s.value !== '',
    }));
  }

  /** Update a single key (clears cache entry) */
  async update(key: string, value: string): Promise<SystemSettingView> {
    const { data, error } = await this.supabase
      .from('system_settings')
      .update({ value })
      .eq('key', key)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException(`Setting "${key}" not found`);
      throw new Error(error.message);
    }

    this.cache.delete(key); // bust cache
    this.logger.log(`system_settings updated: ${key}`);

    const s = data as SystemSetting;
    return { ...s, value: null, has_value: true };
  }

  /** Bulk-update multiple keys atomically */
  async bulkUpdate(settings: { key: string; value: string }[]): Promise<void> {
    for (const { key, value } of settings) {
      await this.update(key, value);
    }
  }

  /** Convenience helpers for common keys */
  async getRazorpayKeyId()     { return this.get('razorpay_key_id'); }
  async getRazorpayKeySecret() { return this.get('razorpay_key_secret'); }
  async getResendApiKey()      { return this.get('resend_api_key'); }
  async getOpenAiApiKey()      { return this.get('openai_api_key'); }
  async getJwtSecret()         { return this.get('jwt_secret'); }

  /** Invalidate entire cache (call after bulk ops or on-demand) */
  clearCache() {
    this.cache.clear();
  }
}
