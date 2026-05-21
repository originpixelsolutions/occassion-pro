import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class InvitationService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  // ── Templates (always event-scoped — designs are per event, never global) ──

  /** List all invitation templates for a specific event */
  async listTemplates(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitation_templates')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  /** Get or create the default template for an event */
  async getOrCreateDefaultTemplate(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data: existing } = await db.from('invitation_templates')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at').limit(1).single()
    if (existing) return existing

    // Create a fresh default template for this event
    const { data, error } = await db.from('invitation_templates').insert({
      tenant_id: tenantId,
      event_id: eventId,
      name: 'Default Invitation',
      layout_template: 'elegant',
      base_theme: 'dark',
      primary_color: '#6366f1',
      background_color: '#0f172a',
      text_color: '#f8fafc',
      button_color: '#6366f1',
      button_text_color: '#ffffff',
      show_banner: true, show_event_name: true, show_tagline: true,
      show_datetime: true, show_venue: true, show_rsvp_button: true,
    }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async getTemplate(id: string, eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitation_templates')
      .select('*').eq('id', id).eq('event_id', eventId).eq('tenant_id', tenantId).single()
    if (error || !data) throw new NotFoundException(`Template ${id} not found`)
    return data
  }

  /** Create a new template scoped to a specific event */
  async createTemplate(eventId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitation_templates')
      .insert({ ...dto, tenant_id: tenantId, event_id: eventId }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateTemplate(id: string, eventId: string, tenantId: string, dto: any, token: string) {
    // Strip event_id / tenant_id from DTO — these are immutable
    const { event_id: _e, tenant_id: _t, ...safe } = dto
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitation_templates')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', id).eq('event_id', eventId).eq('tenant_id', tenantId)
      .select().single()
    if (error || !data) throw new NotFoundException(`Template ${id} not found`)
    return data
  }

  async deleteTemplate(id: string, eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { error } = await db.from('invitation_templates')
      .delete().eq('id', id).eq('event_id', eventId).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  // ── Master Template Library (global, copy-on-use) ──────────────────────────

  /** List master templates from the global library */
  async listMasterTemplates(token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('master_invitation_templates')
      .select('*').eq('is_active', true).order('sort_order')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  /**
   * Copy a master template into an event — creates a fully independent copy.
   * Future edits to the master have NO effect on the event's copy.
   */
  async copyMasterToEvent(
    masterId: string,
    eventId: string,
    tenantId: string,
    token: string,
  ) {
    const db = this.supabase.forRequest(token)
    const { data: master, error: mErr } = await db
      .from('master_invitation_templates').select('*').eq('id', masterId).single()
    if (mErr || !master) throw new NotFoundException(`Master template ${masterId} not found`)

    // Build the event-scoped copy (strip master-specific fields)
    const { id: _id, created_at: _c, updated_at: _u, is_active: _ia, sort_order: _s,
            description: _d, preview_image_url: _p, category: _cat, ...designFields } = master

    const { data, error } = await db.from('invitation_templates').insert({
      ...designFields,
      tenant_id: tenantId,
      event_id: eventId,
      name: `${master.name} (copy)`,
      copied_from_master: masterId,
    }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── Invitations ────────────────────────────────────────────────────────────

  async listInvitations(eventId: string, tenantId: string, token: string, opts: any = {}) {
    const db = this.supabase.forRequest(token)
    const { page = 1, pageSize = 50, status, channel } = opts
    const from = (page - 1) * pageSize
    let q = db.from('invitations')
      .select(`*, guests(id, full_name, email, phone)`, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .range(from, from + pageSize - 1)
    if (status) q = q.eq('status', status)
    if (channel) q = q.eq('channel', channel)
    const { data, count, error } = await q.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize }
  }

  async createInvitation(dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitations')
      .insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  /** Bulk create invitations for a list of guest IDs */
  async bulkCreate(
    eventId: string,
    tenantId: string,
    guestIds: string[],
    templateId: string,
    channel: string,
    scheduledAt: string | null,
    token: string,
  ) {
    const db = this.supabase.forRequest(token)

    // Fetch guest details for merge data
    const { data: guests, error: gErr } = await db
      .from('guests')
      .select('id, full_name, email, phone, table_number, plus_ones')
      .in('id', guestIds)
    if (gErr) throw new Error(gErr.message)

    const rows = (guests ?? []).map(g => ({
      tenant_id: tenantId,
      event_id: eventId,
      guest_id: g.id,
      template_id: templateId,
      channel,
      status: 'draft',
      scheduled_at: scheduledAt,
      merge_data: {
        guest_name: g.full_name,
        table_number: g.table_number ?? '',
        plus_one: g.plus_ones ?? 0,
      },
    }))

    const { data, error } = await db.from('invitations').insert(rows).select()
    if (error) throw new Error(error.message)
    return { created: data?.length ?? 0, data }
  }

  /** Mark invitation as sent + update guest invite_status */
  async markSent(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const now = new Date().toISOString()
    const { data: inv, error } = await db.from('invitations')
      .update({ status: 'sent', sent_at: now, updated_at: now })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error || !inv) throw new NotFoundException(`Invitation ${id} not found`)

    // Update guest invite status
    if (inv.guest_id) {
      await db.from('guests')
        .update({ invite_status: 'sent', invite_sent_at: now })
        .eq('id', inv.guest_id).eq('tenant_id', tenantId)
    }
    return inv
  }

  /** Track invitation open (called from public invite page) */
  async trackOpen(token_: string) {
    const db = this.supabase.serviceClient
    const { data: inv } = await db.from('invitations')
      .select('id, opened_count, guest_id, tenant_id')
      .eq('token', token_).single()
    if (!inv) return

    await db.from('invitations').update({
      status: 'opened',
      opened_at: inv.opened_count === 0 ? new Date().toISOString() : undefined,
      opened_count: (inv.opened_count ?? 0) + 1,
    }).eq('token', token_)

    if (inv.guest_id) {
      await db.from('guests')
        .update({ invite_status: 'opened' })
        .eq('id', inv.guest_id).eq('tenant_id', inv.tenant_id)
    }
  }

  async getByToken(token_: string) {
    const db = this.supabase.serviceClient
    const { data, error } = await db.from('invitations')
      .select(`*, invitation_templates(*), events(id, name, start_date, end_date, venue_id)`)
      .eq('token', token_).single()
    if (error || !data) throw new NotFoundException('Invitation not found')
    return data
  }

  async getStats(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('invitations')
      .select('status, channel')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const stats: Record<string, number> = {}
    const byChannel: Record<string, number> = {}
    for (const r of rows) {
      stats[r.status] = (stats[r.status] ?? 0) + 1
      byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
    }
    return { total: rows.length, by_status: stats, by_channel: byChannel }
  }
}
