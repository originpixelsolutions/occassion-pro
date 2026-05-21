import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

// Default column pool — all available fields
export const DEFAULT_COLUMNS = [
  { id: 'name',         field: 'full_name',           label: 'Guest Name',     visible: true,  width: 'wide',   frozen: true,  order: 0  },
  { id: 'category',     field: 'category',            label: 'Category',       visible: true,  width: 'normal', frozen: false, order: 1  },
  { id: 'invite',       field: 'invite_status',       label: 'Invite Status',  visible: true,  width: 'normal', frozen: false, order: 2  },
  { id: 'rsvp',         field: 'rsvp_status',         label: 'RSVP Status',    visible: true,  width: 'normal', frozen: false, order: 3  },
  { id: 'accommodation',field: 'accommodation_status',label: 'Accommodation',  visible: true,  width: 'normal', frozen: false, order: 4  },
  { id: 'transport',    field: 'transport_status',    label: 'Transport',      visible: false, width: 'normal', frozen: false, order: 5  },
  { id: 'meal',         field: 'meal_preference',     label: 'Meal',           visible: true,  width: 'narrow', frozen: false, order: 6  },
  { id: 'table',        field: 'table_number',        label: 'Table/Seat',     visible: true,  width: 'narrow', frozen: false, order: 7  },
  { id: 'checkin',      field: 'checked_in',          label: 'Check-in',       visible: true,  width: 'normal', frozen: false, order: 8  },
  { id: 'plus_ones',    field: 'plus_ones',           label: 'Plus Ones',      visible: true,  width: 'narrow', frozen: false, order: 9  },
  { id: 'company',      field: 'company',             label: 'Company',        visible: false, width: 'normal', frozen: false, order: 10 },
  { id: 'designation',  field: 'designation',         label: 'Designation',    visible: false, width: 'normal', frozen: false, order: 11 },
  { id: 'phone',        field: 'phone',               label: 'Phone',          visible: false, width: 'normal', frozen: false, order: 12 },
  { id: 'email',        field: 'email',               label: 'Email',          visible: false, width: 'normal', frozen: false, order: 13 },
  { id: 'gift',         field: 'gift_received',       label: 'Gift',           visible: false, width: 'narrow', frozen: false, order: 14 },
  { id: 'badge',        field: 'badge_printed',       label: 'Badge',          visible: false, width: 'narrow', frozen: false, order: 15 },
  { id: 'source',       field: 'source',              label: 'Source',         visible: false, width: 'narrow', frozen: false, order: 16 },
  { id: 'notes',        field: 'notes',               label: 'Notes',          visible: false, width: 'wide',   frozen: false, order: 17 },
]

@Injectable()
export class TableConfigService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Layout ────────────────────────────────────────────────────────────────

  async getLayout(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data } = await db.from('event_guest_table_layouts')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId).single()
    if (!data) {
      // Return defaults if no saved layout
      return { column_config: DEFAULT_COLUMNS, mobile_columns: ['name','rsvp','checkin'] }
    }
    return data
  }

  async saveLayout(eventId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const payload = {
      tenant_id: tenantId, event_id: eventId,
      column_config: dto.column_config,
      mobile_columns: dto.mobile_columns ?? ['name','rsvp','checkin'],
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db.from('event_guest_table_layouts')
      .upsert(payload, { onConflict: 'tenant_id,event_id' }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  async listViews(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_table_views')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createView(eventId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_table_views')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateView(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_table_views')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteView(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { error } = await db.from('event_guest_table_views')
      .delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  async getViewByToken(shareToken: string) {
    const db = this.supabase.serviceClient
    const { data, error } = await db.from('event_guest_table_views')
      .select('*').eq('share_token', shareToken).single()
    if (error || !data) throw new Error('View not found')
    return data
  }

  // ── Custom Columns ────────────────────────────────────────────────────────

  async listCustomColumns(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_custom_columns')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createCustomColumn(eventId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const fieldKey = dto.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const { data, error } = await db.from('event_guest_custom_columns')
      .insert({ ...dto, field_key: fieldKey, event_id: eventId, tenant_id: tenantId })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateCustomColumn(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_custom_columns')
      .update(dto).eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteCustomColumn(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { error } = await db.from('event_guest_custom_columns')
      .delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  /** Update a guest's custom column data (JSONB patch) */
  async updateGuestCustomData(guestId: string, tenantId: string, customData: Record<string, any>, token: string) {
    const db = this.supabase.forRequest(token)
    // Merge with existing custom_data
    const { data: existing } = await db.from('guests')
      .select('custom_data').eq('id', guestId).eq('tenant_id', tenantId).single()
    const merged = { ...(existing?.custom_data ?? {}), ...customData }
    const { data, error } = await db.from('guests')
      .update({ custom_data: merged, updated_at: new Date().toISOString() })
      .eq('id', guestId).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── Conditional Formatting ────────────────────────────────────────────────

  async listFormattingRules(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_guest_table_formatting')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async saveFormattingRules(eventId: string, tenantId: string, rules: any[], token: string) {
    if (rules.length > 5) throw new Error('Maximum 5 formatting rules per event')
    const db = this.supabase.forRequest(token)
    // Replace all rules for this event
    await db.from('event_guest_table_formatting')
      .delete().eq('event_id', eventId).eq('tenant_id', tenantId)
    if (!rules.length) return []
    const toInsert = rules.map((r, i) => ({
      ...r, event_id: eventId, tenant_id: tenantId, sort_order: i,
    }))
    const { data, error } = await db.from('event_guest_table_formatting')
      .insert(toInsert).select()
    if (error) throw new Error(error.message)
    return data ?? []
  }
}
