import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class HospitalityService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  async getHospitalityDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [roomBlocks, accommodation, fnb, vips, transport] = await Promise.all([
      client.from('room_blocks').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('hotel_name'),
      client.from('guest_accommodation').select('*, room_block:room_blocks(hotel_name,room_type)').eq('event_id', eventId).eq('tenant_id', tenantId).order('guest_name'),
      client.from('fnb_plans').select('*, vendor:vendors(id,name)').eq('event_id', eventId).eq('tenant_id', tenantId).order('scheduled_time'),
      client.from('vip_hospitality').select('*, assigned_to:profiles!vip_hospitality_assigned_to_fkey(id,full_name,avatar_url)').eq('event_id', eventId).eq('tenant_id', tenantId).order('guest_type'),
      client.from('transport_bookings').select('*, vendor:vendors(id,name)').eq('event_id', eventId).eq('tenant_id', tenantId).order('pickup_time'),
    ])

    const totalRooms = roomBlocks.data?.reduce((s, b) => s + (b.total_rooms ?? 0), 0) ?? 0
    const occupiedRooms = roomBlocks.data?.reduce((s, b) => s + (b.occupied_rooms ?? 0), 0) ?? 0
    const checkedInGuests = accommodation.data?.filter(a => a.status === 'checked_in').length ?? 0
    const pendingTransport = transport.data?.filter(t => t.status === 'scheduled' || t.status === 'confirmed').length ?? 0

    return {
      room_blocks: roomBlocks.data ?? [],
      accommodation: accommodation.data ?? [],
      fnb: fnb.data ?? [],
      vips: vips.data ?? [],
      transport: transport.data ?? [],
      stats: {
        total_rooms: totalRooms,
        occupied_rooms: occupiedRooms,
        occupancy_rate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        checked_in_guests: checkedInGuests,
        vip_count: vips.data?.length ?? 0,
        pending_transport: pendingTransport,
        fnb_sessions: fnb.data?.length ?? 0,
        total_pax: fnb.data?.reduce((s, f) => s + (f.pax_count ?? 0), 0) ?? 0,
      },
    }
  }

  // ─── Room Blocks ─────────────────────────────────────────────────────────────

  async getRoomBlocks(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('room_blocks').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('hotel_name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertRoomBlock(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('room_blocks')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateRoomBlockStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('room_blocks').update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Room block not found')
    return data
  }

  // ─── Guest Accommodation ─────────────────────────────────────────────────────

  async getAccommodation(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('guest_accommodation')
      .select('*, room_block:room_blocks(hotel_name,room_type,check_in_date,check_out_date)')
      .eq('event_id', eventId).eq('tenant_id', tenantId).order('guest_name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertAccommodation(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('guest_accommodation')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('*, room_block:room_blocks(hotel_name)').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async checkInGuest(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guest_accommodation')
      .update({ status: 'checked_in', check_in_time: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Accommodation record not found')
    // increment occupied_rooms count on the block
    if (data.room_block_id) {
      // Inline increment — no RPC needed
      const { data: block } = await client
        .from('room_blocks')
        .select('occupied_rooms')
        .eq('id', data.room_block_id)
        .single()
      if (block) {
        await client
          .from('room_blocks')
          .update({ occupied_rooms: (block.occupied_rooms ?? 0) + 1 })
          .eq('id', data.room_block_id)
      }
    }
    return data
  }

  async checkOutGuest(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guest_accommodation')
      .update({ status: 'checked_out', check_out_time: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Accommodation record not found')
    return data
  }

  // ─── F&B Plans ────────────────────────────────────────────────────────────────

  async getFnbPlans(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('fnb_plans').select('*, vendor:vendors(id,name)')
      .eq('event_id', eventId).eq('tenant_id', tenantId).order('scheduled_time')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertFnbPlan(eventId: string, dto: any, tenantId: string, token: string) {
    const payload = {
      ...dto,
      event_id: eventId,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    }
    if (dto.cost_per_head && dto.pax_count) {
      payload.total_cost = dto.cost_per_head * dto.pax_count
    }
    const { data, error } = await this.supabase.forRequest(token)
      .from('fnb_plans').upsert(payload, { onConflict: 'id' }).select('*, vendor:vendors(id,name)').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateFnbStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('fnb_plans').update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('F&B plan not found')
    return data
  }

  // ─── VIP Hospitality ─────────────────────────────────────────────────────────

  async getVips(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('vip_hospitality')
      .select('*, assigned_to:profiles!vip_hospitality_assigned_to_fkey(id,full_name,avatar_url)')
      .eq('event_id', eventId).eq('tenant_id', tenantId).order('guest_type')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertVip(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('vip_hospitality')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('*, assigned_to:profiles!vip_hospitality_assigned_to_fkey(id,full_name)').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateVipStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('vip_hospitality').update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('VIP record not found')
    return data
  }

  // ─── Transport ────────────────────────────────────────────────────────────────

  async getTransport(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('transport_bookings').select('*, vendor:vendors(id,name)')
      .eq('event_id', eventId).eq('tenant_id', tenantId).order('pickup_time')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertTransport(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.forRequest(token)
      .from('transport_bookings')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('*, vendor:vendors(id,name)').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateTransportStatus(id: string, status: string, tenantId: string, token: string) {
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'completed') update.actual_pickup_time = new Date().toISOString()
    const { data, error } = await this.supabase.forRequest(token)
      .from('transport_bookings').update(update)
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Transport booking not found')
    return data
  }

  // ─── Hospitality Summary ─────────────────────────────────────────────────────

  async getHospitalityReadiness(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const [roomBlocks, vips, transport, fnb] = await Promise.all([
      client.from('room_blocks').select('id,status,total_rooms,confirmed_rooms').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('vip_hospitality').select('id,status,transport_needed,security_needed').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('transport_bookings').select('id,status,pickup_time').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('fnb_plans').select('id,status,pax_count,meal_type').eq('event_id', eventId).eq('tenant_id', tenantId),
    ])
    return {
      event_id: eventId,
      generated_at: new Date().toISOString(),
      accommodation: {
        blocks: roomBlocks.data?.length ?? 0,
        confirmed_blocks: roomBlocks.data?.filter(b => b.status === 'confirmed').length ?? 0,
        total_rooms: roomBlocks.data?.reduce((s, b) => s + (b.total_rooms ?? 0), 0) ?? 0,
      },
      vip: {
        total: vips.data?.length ?? 0,
        confirmed: vips.data?.filter(v => v.status === 'confirmed' || v.status === 'arrived').length ?? 0,
        transport_needed: vips.data?.filter(v => v.transport_needed).length ?? 0,
        security_needed: vips.data?.filter(v => v.security_needed).length ?? 0,
      },
      transport: {
        total: transport.data?.length ?? 0,
        confirmed: transport.data?.filter(t => ['confirmed','dispatched','completed'].includes(t.status)).length ?? 0,
        pending: transport.data?.filter(t => t.status === 'scheduled').length ?? 0,
      },
      fnb: {
        sessions: fnb.data?.length ?? 0,
        confirmed: fnb.data?.filter(f => f.status === 'confirmed' || f.status === 'completed').length ?? 0,
        total_pax: fnb.data?.reduce((s, f) => s + (f.pax_count ?? 0), 0) ?? 0,
      },
    }
  }
}
