import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import * as crypto from 'crypto'

@Injectable()
export class GuestsAdvancedService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Check-in Dashboard ───────────────────────────────────────────────────────

  async getCheckInDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)

    const [guestDetails, groups, tables, recentLogs] = await Promise.all([
      client.from('guest_details')
        .select('*, guest:guests(id, first_name, last_name, email, phone)')
        .eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('guest_groups').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('name'),
      client.from('seating_tables').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('table_number'),
      client.from('checkin_log')
        .select('*, guest:guests(first_name, last_name), scanned_by:profiles(full_name)')
        .eq('event_id', eventId).eq('tenant_id', tenantId)
        .order('scanned_at', { ascending: false }).limit(20),
    ])

    const details = guestDetails.data ?? []
    const total = details.length
    const checkedIn = details.filter(g => g.checked_in).length
    const confirmed = details.filter(g => g.rsvp_status === 'confirmed').length
    const declined = details.filter(g => g.rsvp_status === 'declined').length
    const pending = details.filter(g => g.rsvp_status === 'pending').length
    const vip = details.filter(g => g.guest_type === 'vip').length
    const vegCount = details.filter(g => g.meal_preference === 'veg').length
    const nonVegCount = details.filter(g => g.meal_preference === 'non_veg').length
    const giftReceived = details.filter(g => g.gift_received).length

    return {
      stats: {
        total, checkedIn, pending_checkin: confirmed - checkedIn,
        confirmed, declined, pending_rsvp: pending,
        vip, check_in_rate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
        veg_count: vegCount, non_veg_count: nonVegCount,
        gifts_received: giftReceived,
      },
      groups: groups.data ?? [],
      tables: tables.data ?? [],
      recent_checkins: recentLogs.data ?? [],
      meal_breakdown: this._buildMealBreakdown(details),
    }
  }

  private _buildMealBreakdown(details: any[]) {
    const breakdown: Record<string, number> = {}
    for (const d of details) {
      const pref = d.meal_preference ?? 'not_specified'
      breakdown[pref] = (breakdown[pref] ?? 0) + 1
    }
    return breakdown
  }

  // ─── Guest Details ────────────────────────────────────────────────────────────

  async getGuestsWithDetails(eventId: string, tenantId: string, token: string, filters?: {
    search?: string; rsvp?: string; checked_in?: boolean; table?: string; group?: string; vip?: boolean
  }) {
    let query = this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .select(`
        *,
        guest:guests(id, first_name, last_name, email, phone),
        group:guest_groups(id, name, side)
      `)
      .eq('event_id', eventId).eq('tenant_id', tenantId)

    if (filters?.rsvp) query = query.eq('rsvp_status', filters.rsvp)
    if (filters?.checked_in !== undefined) query = query.eq('checked_in', filters.checked_in)
    if (filters?.table) query = query.eq('table_number', filters.table)
    if (filters?.group) query = query.eq('group_id', filters.group)
    if (filters?.vip) query = query.eq('guest_type', 'vip')

    const { data, error } = await query.order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertGuestDetails(guestId: string, eventId: string, dto: any, tenantId: string, token: string) {
    // Auto-generate QR code if not present
    if (!dto.qr_code) {
      dto.qr_code = crypto.createHash('sha256')
        .update(`${guestId}-${eventId}-${Date.now()}`)
        .digest('hex')
        .substring(0, 16).toUpperCase()
    }
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .upsert(
        { ...dto, guest_id: guestId, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() },
        { onConflict: 'guest_id,event_id' },
      )
      .select('*, guest:guests(id, first_name, last_name, email, phone)')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── QR Check-in ─────────────────────────────────────────────────────────────

  async checkInByQR(dto: { qr_code: string; event_id: string; gate_name?: string; device_id?: string }, tenantId: string, token: string, userId: string) {
    const client = this.supabase.getAuthenticatedClient(token)

    // Find guest by QR
    const { data: detail, error: findError } = await client
      .from('guest_details')
      .select('*, guest:guests(id, first_name, last_name)')
      .eq('qr_code', dto.qr_code)
      .eq('event_id', dto.event_id)
      .eq('tenant_id', tenantId)
      .single()

    if (findError || !detail) {
      // Log failed scan
      await client.from('checkin_log').insert({
        tenant_id: tenantId, event_id: dto.event_id,
        qr_code: dto.qr_code, scan_result: 'invalid_code',
        gate_name: dto.gate_name, scanned_by: userId, device_id: dto.device_id,
      })
      throw new BadRequestException('Invalid QR code — guest not found')
    }

    if (detail.checked_in) {
      await client.from('checkin_log').insert({
        tenant_id: tenantId, event_id: dto.event_id, guest_id: (detail.guest as any)?.id,
        qr_code: dto.qr_code, scan_result: 'already_checked_in',
        gate_name: dto.gate_name, scanned_by: userId, device_id: dto.device_id,
      })
      return { success: false, reason: 'already_checked_in', guest: detail }
    }

    // Mark as checked in
    const [updateResult] = await Promise.all([
      client.from('guest_details').update({
        checked_in: true,
        check_in_time: new Date().toISOString(),
        check_in_gate: dto.gate_name,
        checked_in_by: userId,
        updated_at: new Date().toISOString(),
      }).eq('id', detail.id).eq('tenant_id', tenantId).select().single(),
      client.from('checkin_log').insert({
        tenant_id: tenantId, event_id: dto.event_id, guest_id: (detail.guest as any)?.id,
        qr_code: dto.qr_code, scan_result: 'success',
        gate_name: dto.gate_name, scanned_by: userId, device_id: dto.device_id,
      }),
    ])

    return {
      success: true,
      guest: detail.guest,
      table_number: detail.table_number,
      seating_zone: detail.seating_zone,
      meal_preference: detail.meal_preference,
      guest_type: detail.guest_type,
    }
  }

  async checkInManual(guestDetailId: string, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ checked_in: true, check_in_time: new Date().toISOString(), checked_in_by: userId, updated_at: new Date().toISOString() })
      .eq('id', guestDetailId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async checkOut(guestDetailId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ checked_in: false, check_in_time: null, updated_at: new Date().toISOString() })
      .eq('id', guestDetailId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── RSVP Management ─────────────────────────────────────────────────────────

  async updateRsvp(guestDetailId: string, dto: { status: string; notes?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({
        rsvp_status: dto.status,
        rsvp_notes: dto.notes,
        rsvp_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', guestDetailId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async bulkUpdateRsvp(ids: string[], status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ rsvp_status: status, rsvp_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in('id', ids).eq('tenant_id', tenantId)
      .select()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Seating Management ───────────────────────────────────────────────────────

  async getTables(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const [tables, assignments] = await Promise.all([
      client.from('seating_tables').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('table_number'),
      client.from('guest_details')
        .select('table_number, seat_number, guest:guests(first_name, last_name), checked_in, guest_type')
        .eq('event_id', eventId).eq('tenant_id', tenantId).not('table_number', 'is', null),
    ])
    if (tables.error) throw new BadRequestException(tables.error.message)

    // Enrich tables with assigned guests
    const assigned = assignments.data ?? []
    const tableMap = (tables.data ?? []).map(t => ({
      ...t,
      guests: assigned.filter(a => a.table_number === t.table_number),
    }))
    return tableMap
  }

  async upsertTable(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('seating_tables')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId }, { onConflict: 'event_id,table_number' })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async assignSeat(guestDetailId: string, dto: { table_number: string; seat_number?: string; seating_zone?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ ...dto, seating_confirmed: true, updated_at: new Date().toISOString() })
      .eq('id', guestDetailId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async bulkAssignTable(guestDetailIds: string[], tableNumber: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ table_number: tableNumber, seating_confirmed: true, updated_at: new Date().toISOString() })
      .in('id', guestDetailIds).eq('tenant_id', tenantId)
      .select()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Groups ───────────────────────────────────────────────────────────────────

  async getGroups(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_groups').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertGroup(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_groups')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId }, { onConflict: 'id' })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Gifting ─────────────────────────────────────────────────────────────────

  async recordGift(guestDetailId: string, dto: { description?: string; amount?: number }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ gift_received: true, gift_description: dto.description, gift_amount: dto.amount, updated_at: new Date().toISOString() })
      .eq('id', guestDetailId).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async acknowledgeGift(guestDetailId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ gift_acknowledged: true, gift_acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', guestDetailId).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Gift Registry ────────────────────────────────────────────────────────────

  async getGiftRegistry(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('gift_registry_items').select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertGiftRegistryItem(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('gift_registry_items')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId }, { onConflict: 'id' })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Check-in Log ─────────────────────────────────────────────────────────────

  async getCheckinLog(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('checkin_log')
      .select('*, guest:guests(first_name, last_name), scanned_by:profiles(full_name)')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('scanned_at', { ascending: false })
      .limit(100)
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ─── Invite Tracking ─────────────────────────────────────────────────────────

  async markInviteSent(ids: string[], channel: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .update({ invite_sent: true, invite_sent_at: new Date().toISOString(), invite_channel: channel, updated_at: new Date().toISOString() })
      .in('id', ids).eq('tenant_id', tenantId).select()
    if (error) throw new BadRequestException(error.message)
    return { updated: data?.length ?? 0 }
  }

  // ─── QR Code generation ───────────────────────────────────────────────────────

  async generateQRCodes(eventId: string, tenantId: string, token: string) {
    // Fetch guests without QR codes
    const { data: guests, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .select('id, guest_id')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .is('qr_code', null)

    if (error) throw new BadRequestException(error.message)
    if (!guests?.length) return { generated: 0 }

    const updates = guests.map(g => ({
      id: g.id,
      qr_code: crypto.createHash('sha256')
        .update(`${g.guest_id}-${eventId}-${Date.now()}-${Math.random()}`)
        .digest('hex').substring(0, 16).toUpperCase(),
    }))

    let generated = 0
    for (const u of updates) {
      await this.supabase.getAuthenticatedClient(token)
        .from('guest_details').update({ qr_code: u.qr_code }).eq('id', u.id).eq('tenant_id', tenantId)
      generated++
    }
    return { generated }
  }

  // ─── Stats for real-time dashboard ───────────────────────────────────────────

  async getLiveStats(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('guest_details')
      .select('checked_in, rsvp_status, guest_type, meal_preference, gift_received, table_number')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    const d = data ?? []
    return {
      total: d.length,
      checked_in: d.filter(g => g.checked_in).length,
      confirmed: d.filter(g => g.rsvp_status === 'confirmed').length,
      declined: d.filter(g => g.rsvp_status === 'declined').length,
      pending: d.filter(g => g.rsvp_status === 'pending').length,
      vip: d.filter(g => g.guest_type === 'vip').length,
      gifts: d.filter(g => g.gift_received).length,
      meal_veg: d.filter(g => g.meal_preference === 'veg').length,
      meal_non_veg: d.filter(g => g.meal_preference === 'non_veg').length,
      meal_vegan: d.filter(g => g.meal_preference === 'vegan').length,
    }
  }
}
