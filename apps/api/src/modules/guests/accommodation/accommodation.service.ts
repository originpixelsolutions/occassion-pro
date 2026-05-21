import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class AccommodationService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Hotels ────────────────────────────────────────────────────────────────

  async listHotels(tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotels')
      .select(`*, hotel_rooms(id, room_number, room_type, capacity, is_available)`)
      .eq('tenant_id', tenantId)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async getHotel(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotels')
      .select(`*, hotel_rooms(*, accommodation_bookings(id, guest_id, check_in_date, check_out_date, status, guests(full_name)))`)
      .eq('id', id).eq('tenant_id', tenantId).single()
    if (error || !data) throw new NotFoundException(`Hotel ${id} not found`)
    return data
  }

  async createHotel(tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotels')
      .insert({ ...dto, tenant_id: tenantId }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateHotel(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotels')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error || !data) throw new NotFoundException(`Hotel ${id} not found`)
    return data
  }

  async deleteHotel(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    // Check for active bookings
    const { count } = await db.from('accommodation_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', id)
      .not('status', 'in', '(cancelled,no_show)')
    if ((count ?? 0) > 0) throw new ConflictException('Cannot delete hotel with active bookings')
    const { error } = await db.from('hotels').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  async listRooms(hotelId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotel_rooms')
      .select(`*, accommodation_bookings(
        id, guest_id, check_in_date, check_out_date, status,
        guests(id, full_name, phone, category)
      )`)
      .eq('hotel_id', hotelId).eq('tenant_id', tenantId)
      .order('room_number')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createRoom(hotelId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotel_rooms')
      .insert({ ...dto, hotel_id: hotelId, tenant_id: tenantId }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateRoom(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('hotel_rooms')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error || !data) throw new NotFoundException(`Room ${id} not found`)
    return data
  }

  // ── Bookings ──────────────────────────────────────────────────────────────

  async listBookings(eventId: string, tenantId: string, token: string, opts: any = {}) {
    const db = this.supabase.forRequest(token)
    const { hotelId, status, page = 1, pageSize = 50 } = opts
    const from = (page - 1) * pageSize
    let q = db.from('accommodation_bookings')
      .select(`*,
        hotels(id, name, star_rating),
        hotel_rooms(id, room_number, room_type, capacity),
        guests(id, full_name, email, phone, category)
      `, { count: 'exact' })
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .range(from, from + pageSize - 1)
    if (hotelId) q = q.eq('hotel_id', hotelId)
    if (status) q = q.eq('status', status)
    const { data, count, error } = await q.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize }
  }

  async checkAvailability(roomId: string, checkIn: string, checkOut: string, excludeBookingId?: string) {
    const db = this.supabase.serviceClient
    let q = db.from('accommodation_bookings')
      .select('id')
      .eq('room_id', roomId)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn)
    if (excludeBookingId) q = q.neq('id', excludeBookingId)
    const { count } = await q.select('id', { count: 'exact', head: true })
    return (count ?? 0) === 0 // true = available
  }

  async createBooking(eventId: string, tenantId: string, dto: any, userId: string, token: string) {
    const db = this.supabase.forRequest(token)

    // Validate dates
    if (new Date(dto.check_out_date) <= new Date(dto.check_in_date)) {
      throw new BadRequestException('Check-out date must be after check-in date')
    }

    // Check availability
    const available = await this.checkAvailability(dto.room_id, dto.check_in_date, dto.check_out_date)
    if (!available) throw new ConflictException('Room is already booked for the requested dates')

    // Check room capacity vs number of guests (if multiple assigned)
    const { data: room } = await db.from('hotel_rooms')
      .select('capacity').eq('id', dto.room_id).single()
    if (room && dto.guest_ids?.length > room.capacity) {
      throw new BadRequestException(
        `Room capacity is ${room.capacity} but ${dto.guest_ids.length} guests assigned`
      )
    }

    const { data, error } = await db.from('accommodation_bookings')
      .insert({
        ...dto,
        event_id: eventId,
        tenant_id: tenantId,
        booked_by: userId,
        status: 'confirmed',
      }).select().single()
    if (error) {
      if (error.message.includes('already booked')) {
        throw new ConflictException('Room is already booked for the requested dates')
      }
      throw new Error(error.message)
    }

    // Update guest accommodation status
    await db.from('guests')
      .update({ accommodation_status: 'allocated' })
      .eq('id', dto.guest_id).eq('tenant_id', tenantId)

    return data
  }

  async updateBooking(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)

    if (dto.check_in_date && dto.check_out_date) {
      if (new Date(dto.check_out_date) <= new Date(dto.check_in_date)) {
        throw new BadRequestException('Check-out date must be after check-in date')
      }
      if (dto.room_id) {
        const available = await this.checkAvailability(
          dto.room_id, dto.check_in_date, dto.check_out_date, id
        )
        if (!available) throw new ConflictException('Room is already booked for the requested dates')
      }
    }

    const { data, error } = await db.from('accommodation_bookings')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error || !data) throw new NotFoundException(`Booking ${id} not found`)
    return data
  }

  async cancelBooking(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data: booking } = await db.from('accommodation_bookings')
      .select('guest_id').eq('id', id).single()

    const { data, error } = await db.from('accommodation_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)

    if (booking?.guest_id) {
      await db.from('guests')
        .update({ accommodation_status: 'requested' })
        .eq('id', booking.guest_id).eq('tenant_id', tenantId)
    }
    return data
  }

  /** Bulk assign: auto-pick available rooms of a given type for multiple guests */
  async bulkAssign(
    eventId: string,
    tenantId: string,
    guestIds: string[],
    hotelId: string,
    roomType: string,
    checkIn: string,
    checkOut: string,
    userId: string,
    token: string,
  ) {
    const db = this.supabase.forRequest(token)

    // Find available rooms of the requested type
    const { data: rooms } = await db.from('hotel_rooms')
      .select('id').eq('hotel_id', hotelId)
      .eq('room_type', roomType).eq('tenant_id', tenantId)
      .eq('is_available', true)

    if (!rooms?.length) throw new ConflictException(`No available ${roomType} rooms`)

    const results: any[] = []
    const errors: any[] = []
    let roomIdx = 0

    for (const guestId of guestIds) {
      if (roomIdx >= rooms.length) {
        errors.push({ guestId, error: 'No more available rooms' })
        continue
      }
      const roomId = rooms[roomIdx].id
      const available = await this.checkAvailability(roomId, checkIn, checkOut)
      if (!available) { roomIdx++; continue }

      try {
        const booking = await this.createBooking(eventId, tenantId, {
          hotel_id: hotelId,
          room_id: roomId,
          guest_id: guestId,
          check_in_date: checkIn,
          check_out_date: checkOut,
        }, userId, token)
        results.push(booking)
        roomIdx++
      } catch (e: any) {
        errors.push({ guestId, error: e.message })
      }
    }

    return { assigned: results.length, failed: errors.length, errors, bookings: results }
  }

  async getOccupancyStats(tenantId: string, eventId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data: hotels } = await db.from('hotels')
      .select(`id, name, star_rating,
        hotel_rooms(id, room_type, is_available,
          accommodation_bookings(id, status, event_id)
        )`)
      .eq('tenant_id', tenantId)
    if (!hotels) return []

    return hotels.map(h => {
      const rooms = h.hotel_rooms ?? []
      const total = rooms.length
      const booked = rooms.filter(r =>
        (r.accommodation_bookings ?? []).some(
          (b: any) => b.event_id === eventId && !['cancelled','no_show'].includes(b.status)
        )
      ).length
      return {
        id: h.id,
        name: h.name,
        star_rating: h.star_rating,
        total_rooms: total,
        booked_rooms: booked,
        available_rooms: total - booked,
        occupancy_pct: total > 0 ? Math.round((booked / total) * 100) : 0,
      }
    })
  }

  async markVoucherSent(bookingId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const now = new Date().toISOString()
    const { data, error } = await db.from('accommodation_bookings')
      .update({ voucher_sent: true, voucher_sent_at: now, updated_at: now })
      .eq('id', bookingId).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }
}
