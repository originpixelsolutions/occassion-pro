import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface CreateShortLinkDto {
  tenant_id: string
  event_id?: string
  link_type: 'invitation' | 'rsvp' | 'guest_portal' | 'client_portal' | 'vendor_portal' | 'payment' | 'document' | 'custom'
  destination_url: string
  guest_id?: string
  client_id?: string
  vendor_id?: string
  custom_alias?: string
  expires_at?: string
  max_clicks?: number
  metadata?: Record<string, unknown>
}

export interface ShortLink {
  id: string
  code: string
  tenant_id: string
  event_id: string | null
  link_type: string
  destination_url: string
  guest_id: string | null
  client_id: string | null
  vendor_id: string | null
  custom_alias: string | null
  expires_at: string | null
  max_clicks: number | null
  click_count: number
  is_active: boolean
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  /** computed full short URL */
  short_url?: string
}

const SHORT_DOMAIN = process.env.SHORT_LINK_DOMAIN || 'links.occasionpro.in'

@Injectable()
export class ShortLinksService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreateShortLinkDto, createdBy: string): Promise<ShortLink> {
    const db = this.supabase.serviceClient

    // If custom_alias provided, check uniqueness
    if (dto.custom_alias) {
      const { data: existing } = await db
        .from('short_links')
        .select('id')
        .eq('custom_alias', dto.custom_alias)
        .single()
      if (existing) throw new BadRequestException(`Custom alias "${dto.custom_alias}" is already taken`)
    }

    // Generate code via DB function
    const { data: codeData, error: codeErr } = await db.rpc('generate_short_code')
    if (codeErr || !codeData) throw new BadRequestException('Failed to generate short code')

    const { data, error } = await db
      .from('short_links')
      .insert({
        code: codeData,
        tenant_id: dto.tenant_id,
        event_id: dto.event_id ?? null,
        link_type: dto.link_type,
        destination_url: dto.destination_url,
        guest_id: dto.guest_id ?? null,
        client_id: dto.client_id ?? null,
        vendor_id: dto.vendor_id ?? null,
        custom_alias: dto.custom_alias ?? null,
        expires_at: dto.expires_at ?? null,
        max_clicks: dto.max_clicks ?? null,
        metadata: dto.metadata ?? {},
        created_by: createdBy,
      })
      .select('*')
      .single()

    if (error) throw new BadRequestException(error.message)

    return this.withShortUrl(data)
  }

  // ── Bulk create (e.g. for mass guest invitation dispatch) ──────────────────

  async createBulk(
    dtos: CreateShortLinkDto[],
    createdBy: string,
  ): Promise<ShortLink[]> {
    // Generate codes in parallel then insert in one batch
    const db = this.supabase.serviceClient
    const codes: string[] = []
    for (let i = 0; i < dtos.length; i++) {
      const { data, error } = await db.rpc('generate_short_code')
      if (error || !data) throw new BadRequestException(`Code generation failed for index ${i}`)
      codes.push(data as string)
    }

    const rows = dtos.map((dto, i) => ({
      code: codes[i],
      tenant_id: dto.tenant_id,
      event_id: dto.event_id ?? null,
      link_type: dto.link_type,
      destination_url: dto.destination_url,
      guest_id: dto.guest_id ?? null,
      client_id: dto.client_id ?? null,
      vendor_id: dto.vendor_id ?? null,
      custom_alias: dto.custom_alias ?? null,
      expires_at: dto.expires_at ?? null,
      max_clicks: dto.max_clicks ?? null,
      metadata: dto.metadata ?? {},
      created_by: createdBy,
    }))

    const { data, error } = await db.from('short_links').insert(rows).select('*')
    if (error) throw new BadRequestException(error.message)

    return (data ?? []).map(this.withShortUrl)
  }

  // ── Resolve (called by public /r/:code endpoint) ───────────────────────────

  async resolve(
    code: string,
    meta?: { ipHash?: string; userAgent?: string; referrer?: string; country?: string; device?: string },
  ): Promise<{ destination_url: string; link_type: string } | null> {
    const { data, error } = await this.supabase.serviceClient
      .rpc('resolve_short_link', {
        p_code:       code,
        p_ip_hash:    meta?.ipHash     ?? null,
        p_user_agent: meta?.userAgent  ?? null,
        p_referrer:   meta?.referrer   ?? null,
        p_country:    meta?.country    ?? null,
        p_device:     meta?.device     ?? 'unknown',
      })

    if (error || !data) return null
    if ((data as any).error) return null   // expired / limit_reached

    return data as { destination_url: string; link_type: string }
  }

  // ── List for event ─────────────────────────────────────────────────────────

  async getForEvent(
    eventId: string,
    tenantId: string,
    linkType?: string,
  ): Promise<ShortLink[]> {
    let q = this.supabase.serviceClient
      .from('short_links')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (linkType) q = q.eq('link_type', linkType)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return (data ?? []).map(this.withShortUrl)
  }

  // ── Click analytics ────────────────────────────────────────────────────────

  async getClickAnalytics(shortLinkId: string, tenantId: string) {
    // Verify ownership first
    const { data: link } = await this.supabase.serviceClient
      .from('short_links')
      .select('id, click_count')
      .eq('id', shortLinkId)
      .eq('tenant_id', tenantId)
      .single()

    if (!link) throw new NotFoundException('Short link not found')

    const { data, error } = await this.supabase.serviceClient
      .rpc('get_short_link_analytics', { p_link_id: shortLinkId })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: Partial<Pick<ShortLink, 'expires_at' | 'max_clicks' | 'custom_alias' | 'destination_url' | 'metadata'>>,
    tenantId: string,
  ): Promise<ShortLink> {
    const { data: existing } = await this.supabase.serviceClient
      .from('short_links')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!existing) throw new NotFoundException('Short link not found')

    // Check alias uniqueness if changing
    if (dto.custom_alias) {
      const { data: conflict } = await this.supabase.serviceClient
        .from('short_links')
        .select('id')
        .eq('custom_alias', dto.custom_alias)
        .neq('id', id)
        .single()
      if (conflict) throw new BadRequestException(`Alias "${dto.custom_alias}" is already taken`)
    }

    const { data, error } = await this.supabase.serviceClient
      .from('short_links')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw new BadRequestException(error.message)
    return this.withShortUrl(data)
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async deactivate(id: string, tenantId: string): Promise<{ success: true }> {
    const { error } = await this.supabase.serviceClient
      .from('short_links')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private withShortUrl = (link: any): ShortLink => ({
    ...link,
    short_url: `https://${SHORT_DOMAIN}/${link.custom_alias ?? link.code}`,
  })
}
