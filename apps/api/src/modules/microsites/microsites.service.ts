import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class MicrositesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByEvent(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .select(`*, ticket_tiers(*)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()
    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return data ?? null
  }

  async findBySlug(slug: string) {
    // Public — no token, use service client
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('microsites')
      .select(`
        *,
        ticket_tiers(*),
        events(id, name, start_date, end_date, venue_name, city, cover_image_url)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
    if (error) throw new Error('Microsite not found')
    return data
  }

  async upsert(eventId: string, dto: any, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .upsert(
        {
          ...dto,
          event_id: eventId,
          tenant_id: tenantId,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id' },
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async publish(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async unpublish(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .update({ status: 'draft' })
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // Ticket Tiers
  async getTicketTiers(micrositeId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('ticket_tiers')
      .select('*')
      .eq('microsite_id', micrositeId)
      .eq('tenant_id', tenantId)
      .order('price')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async upsertTicketTier(micrositeId: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('ticket_tiers')
      .upsert(
        { ...dto, microsite_id: micrositeId, tenant_id: tenantId },
        { onConflict: 'id' },
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async findAll(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: data ?? [] }
  }

  async createStandalone(dto: any, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const slug = dto.slug ?? (dto.title ?? 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
    const { data, error } = await client
      .from('microsites')
      .insert({ ...dto, slug, tenant_id: tenantId, created_by: userId, status: 'draft' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateStandalone(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('microsites')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error || !data) throw new Error('Microsite not found')
    return data
  }

  async removeStandalone(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('microsites').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }
}
