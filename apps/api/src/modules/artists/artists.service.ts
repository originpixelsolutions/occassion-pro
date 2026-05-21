import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class ArtistsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Artist Registry ─────────────────────────────────────────────────────────

  async getArtists(tenantId: string, token: string, filters?: { category?: string; search?: string }) {
    let query = this.supabase.getAuthenticatedClient(token)
      .from('artists').select('*').eq('tenant_id', tenantId)
    if (filters?.category) query = query.eq('category', filters.category)
    if (filters?.search) query = query.ilike('name', `%${filters.search}%`)
    const { data, error } = await query.order('name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getArtist(id: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artists').select('*').eq('id', id).eq('tenant_id', tenantId).single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Artist not found')
    return data
  }

  async upsertArtist(dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artists')
      .upsert({ ...dto, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteArtist(id: string, tenantId: string, token: string) {
    const { error } = await this.supabase.getAuthenticatedClient(token)
      .from('artists').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Artist Bookings ─────────────────────────────────────────────────────────

  async getEventBookings(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_bookings')
      .select(`
        *,
        artist:artists(id, name, stage_name, category, genre, profile_image_url, agent_name, agent_phone)
      `)
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('set_order').order('start_time')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getBookingDetail(bookingId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const [booking, riders, itinerary] = await Promise.all([
      client.from('artist_bookings')
        .select('*, artist:artists(*)')
        .eq('id', bookingId).eq('tenant_id', tenantId).single(),
      client.from('artist_riders')
        .select('*, fulfilled_by:profiles!artist_riders_fulfilled_by_fkey(id, full_name)')
        .eq('booking_id', bookingId),
      client.from('artist_itinerary')
        .select('*').eq('booking_id', bookingId).order('scheduled_time'),
    ])
    if (booking.error) throw new BadRequestException(booking.error.message)
    if (!booking.data) throw new NotFoundException('Booking not found')
    return {
      ...booking.data,
      riders: riders.data ?? [],
      itinerary: itinerary.data ?? [],
    }
  }

  async upsertBooking(eventId: string, dto: any, tenantId: string, token: string) {
    const payload: any = {
      ...dto,
      event_id: eventId,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    }
    if (dto.fee && dto.advance_amount) {
      payload.balance_due = dto.fee - (dto.advance_amount ?? 0)
    }
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_bookings')
      .upsert(payload, { onConflict: 'id' })
      .select('*, artist:artists(id, name, stage_name, category)')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateBookingStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Booking not found')
    return data
  }

  async markAdvancePaid(id: string, amount: number, tenantId: string, token: string) {
    const { data: booking } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_bookings').select('fee').eq('id', id).eq('tenant_id', tenantId).single()
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_bookings')
      .update({
        advance_amount: amount,
        advance_paid_at: new Date().toISOString(),
        fee_status: 'advance_paid',
        balance_due: (booking?.fee ?? 0) - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Riders ──────────────────────────────────────────────────────────────────

  async getRiders(bookingId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_riders')
      .select('*, fulfilled_by:profiles!artist_riders_fulfilled_by_fkey(id, full_name)')
      .eq('booking_id', bookingId)
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async addRiderItem(bookingId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_riders')
      .insert({ ...dto, booking_id: bookingId, tenant_id: tenantId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async fulfillRiderItem(riderId: string, userId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_riders')
      .update({ fulfilled: true, fulfilled_by: userId, fulfilled_at: new Date().toISOString() })
      .eq('id', riderId).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Rider item not found')
    return data
  }

  async bulkAddRiderItems(bookingId: string, items: any[], tenantId: string, token: string) {
    const payload = items.map(item => ({ ...item, booking_id: bookingId, tenant_id: tenantId }))
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_riders').insert(payload).select()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Itinerary ────────────────────────────────────────────────────────────────

  async getItinerary(bookingId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_itinerary').select('*')
      .eq('booking_id', bookingId).order('scheduled_time')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async addItineraryItem(bookingId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_itinerary')
      .insert({ ...dto, booking_id: bookingId, tenant_id: tenantId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateItineraryStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('artist_itinerary').update({ status })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Itinerary item not found')
    return data
  }

  // ─── Event Artist Dashboard ───────────────────────────────────────────────────

  async getArtistEventDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const bookings = await client
      .from('artist_bookings')
      .select('*, artist:artists(id, name, stage_name, category, genre, profile_image_url)')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('start_time')

    if (bookings.error) throw new BadRequestException(bookings.error.message)

    const bookingIds = (bookings.data ?? []).map(b => b.id)
    const [riders, itinerary] = await Promise.all([
      bookingIds.length ? client.from('artist_riders').select('*').in('booking_id', bookingIds) : { data: [] },
      bookingIds.length ? client.from('artist_itinerary').select('*').in('booking_id', bookingIds).order('scheduled_time') : { data: [] },
    ])

    const totalFee = (bookings.data ?? []).reduce((s, b) => s + (b.fee ?? 0), 0)
    const advancePaid = (bookings.data ?? []).reduce((s, b) => s + (b.advance_amount ?? 0), 0)
    const riderList = riders.data ?? []
    const mandatoryRiders = riderList.filter((r: any) => r.is_mandatory)
    const fulfilledMandatory = mandatoryRiders.filter((r: any) => r.fulfilled)

    return {
      bookings: bookings.data ?? [],
      itinerary: itinerary.data ?? [],
      stats: {
        total_artists: bookings.data?.length ?? 0,
        confirmed: bookings.data?.filter(b => ['confirmed', 'on_site', 'performed'].includes(b.status)).length ?? 0,
        total_fee: totalFee,
        advance_paid: advancePaid,
        balance_outstanding: totalFee - advancePaid,
        rider_fulfillment: mandatoryRiders.length > 0
          ? Math.round((fulfilledMandatory.length / mandatoryRiders.length) * 100)
          : 100,
      },
    }
  }
}
