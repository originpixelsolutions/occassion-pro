/**
 * OccasionPro — Guest Portal Service
 * OTP generation/verification, session management, portal data assembly
 */

import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger,
} from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { SMSService } from './sms.service'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

const OTP_TTL_MIN = 10
const MAX_OTP_PER_WINDOW = 3
const OTP_WINDOW_MIN = 15

@Injectable()
export class GuestPortalService {
  private readonly logger = new Logger(GuestPortalService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SMSService,
  ) {}

  async requestOTP(eventId: string, mobile: string): Promise<{ sent: boolean; channel: string }> {
    const settings = await this.getPortalSettings(eventId)
    if (!settings.login_enabled) throw new ForbiddenException('Guest portal login is not enabled for this event')

    const windowStart = new Date(Date.now() - OTP_WINDOW_MIN * 60 * 1000).toISOString()
    const { count } = await this.supabase.serviceClient
      .from('guest_otp_requests').select('id', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('mobile', mobile).gte('created_at', windowStart)

    if ((count ?? 0) >= MAX_OTP_PER_WINDOW)
      throw new BadRequestException('Too many OTP requests. Please try again in 15 minutes.')

    const { data: guest } = await this.supabase.serviceClient
      .from('guests').select('id').eq('event_id', eventId)
      .or('mobile.eq.' + mobile + ',mobile.eq.+91' + mobile).single()

    if (!guest && !settings.allow_self_register)
      throw new ForbiddenException(settings.not_on_list_message ?? "You're not on the guest list for this event.")

    const otp = crypto.randomInt(100000, 999999).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000)

    await this.supabase.serviceClient.from('guest_otp_requests').insert({
      event_id: eventId, mobile, otp_hash: otpHash, expires_at: expiresAt.toISOString(),
    })

    const { data: event } = await this.supabase.serviceClient.from('events').select('title').eq('id', eventId).single()
    await this.sms.sendOTP(mobile, otp, event?.title)
    return { sent: true, channel: 'sms' }
  }

  async verifyOTP(eventId: string, mobile: string, otp: string) {
    const { data: rec } = await this.supabase.serviceClient
      .from('guest_otp_requests').select('id, otp_hash, attempts')
      .eq('event_id', eventId).eq('mobile', mobile).eq('verified', false)
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
      .limit(1).single()

    if (!rec) throw new BadRequestException('OTP expired or not found.')
    if (rec.attempts >= 5) throw new BadRequestException('Too many incorrect attempts.')

    const valid = await bcrypt.compare(otp, rec.otp_hash)
    if (!valid) {
      await this.supabase.serviceClient.from('guest_otp_requests').update({ attempts: rec.attempts + 1 }).eq('id', rec.id)
      throw new BadRequestException('Incorrect OTP. Please try again.')
    }
    await this.supabase.serviceClient.from('guest_otp_requests').update({ verified: true }).eq('id', rec.id)

    const { data: guest } = await this.supabase.serviceClient.from('guests').select('id, full_name')
      .eq('event_id', eventId).or('mobile.eq.' + mobile + ',mobile.eq.+91' + mobile).single()

    const settings = await this.getPortalSettings(eventId)
    const durMap: Record<string, string> = { event_day: '24h', '7d': '7d', '30d': '30d' }
    const duration = durMap[settings.session_duration] ?? '7d'
    const expiresAt = new Date()
    if (duration === '24h') expiresAt.setHours(expiresAt.getHours() + 24)
    else if (duration === '7d') expiresAt.setDate(expiresAt.getDate() + 7)
    else expiresAt.setDate(expiresAt.getDate() + 30)

    const accessToken = this.jwtService.sign(
      { sub: guest?.id ?? mobile, type: 'guest_portal', event_id: eventId, guest_id: guest?.id ?? null, mobile },
      { expiresIn: duration }
    )
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex')
    await this.supabase.serviceClient.from('guest_portal_sessions').insert({
      event_id: eventId, guest_id: guest?.id ?? null, mobile,
      session_token_hash: tokenHash, expires_at: expiresAt.toISOString(),
    })
    return { access_token: accessToken, guest_id: guest?.id ?? null, guest_name: guest?.full_name ?? null, expires_at: expiresAt.toISOString() }
  }

  async getPortalData(eventId: string, guestId: string | null) {
    const settings = await this.getPortalSettings(eventId)
    const [{ data: event }, { data: guest }] = await Promise.all([
      this.supabase.serviceClient.from('events').select('id, title, start_date, end_date, venue_name, venue_address, status').eq('id', eventId).single(),
      guestId ? this.supabase.serviceClient.from('guests').select('id, full_name, rsvp_status, check_in_status, table_number, meal_preference, portal_access_code, accommodation_room_id').eq('id', guestId).single() : { data: null },
    ])
    if (!event) throw new NotFoundException('Event not found')
    const isEventDay = event.start_date ? new Date(event.start_date).toDateString() === new Date().toDateString() : false
    const isPostEvent = ['completed', 'archived'].includes(event.status ?? '')
    return {
      event: { id: event.id, title: event.title, start_date: event.start_date, end_date: event.end_date, venue_name: event.venue_name, venue_address: event.venue_address, status: event.status },
      guest: guest ? { id: guest.id, name: guest.full_name, rsvp_status: guest.rsvp_status, check_in_status: guest.check_in_status, table_number: guest.table_number, meal_preference: guest.meal_preference, portal_code: guest.portal_access_code, has_accommodation: !!guest.accommodation_room_id } : null,
      settings: {
        portal_title: settings.portal_title ?? event.title + ' — Guest Portal',
        hero_image_url: settings.hero_image_url, brand_color: settings.brand_color ?? '#7c3aed',
        welcome_message: (settings.welcome_message ?? 'Welcome, {{guest_name}}!').replace('{{guest_name}}', guest?.full_name?.split(' ')[0] ?? 'Guest'),
        footer_text: settings.footer_text, hide_powered_by: settings.hide_powered_by,
      },
      sections: {
        invitation: settings.section_invitation && !isPostEvent,
        rsvp: settings.section_rsvp && !isPostEvent && guest?.rsvp_status === 'pending',
        event_details: settings.section_event_details,
        accommodation: settings.section_accommodation && !!guest?.accommodation_room_id,
        transport: settings.section_transport, meal: settings.section_meal && !isPostEvent,
        qr_code: settings.section_qr_code && !isPostEvent,
        seating: settings.section_seating && !!guest?.table_number,
        schedule: settings.section_schedule, gallery: settings.section_gallery && isPostEvent,
        contact: settings.section_contact, survey: settings.section_survey && isPostEvent,
        gift_registry: settings.section_gift_registry, sessions: settings.section_sessions,
      },
      meta: { is_event_day: isEventDay, is_post_event: isPostEvent },
    }
  }

  async getPortalSettings(eventId: string) {
    const { data } = await this.supabase.serviceClient.from('guest_portal_settings').select('*').eq('event_id', eventId).single()
    return data ?? {
      login_enabled: false, allow_self_register: false, otp_delivery: 'sms', session_duration: '7d',
      not_on_list_message: "You're not on the guest list for this event.", portal_title: null,
      hero_image_url: null, brand_color: '#7c3aed', welcome_message: 'Welcome, {{guest_name}}!',
      footer_text: null, hide_powered_by: false, section_invitation: true, section_rsvp: true,
      section_event_details: true, section_accommodation: true, section_transport: true,
      section_meal: true, section_qr_code: true, section_seating: false, section_schedule: true,
      section_gallery: false, section_contact: true, section_survey: false,
      section_gift_registry: false, section_sessions: false,
    }
  }

  async upsertPortalSettings(tenantId: string, eventId: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase.serviceClient.from('guest_portal_settings')
      .upsert({ tenant_id: tenantId, event_id: eventId, ...updates, updated_at: new Date().toISOString() })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async sendMessage(eventId: string, guestId: string | null, mobile: string, message: string) {
    const { data: event } = await this.supabase.serviceClient.from('events').select('tenant_id').eq('id', eventId).single()
    if (!event) throw new NotFoundException('Event not found')
    await this.supabase.serviceClient.from('guest_portal_messages').insert({ tenant_id: event.tenant_id, event_id: eventId, guest_id: guestId, mobile, message })
    return { sent: true }
  }
}

  // ── Section Data Methods ─────────────────────────────────────────────────────

  async getItinerary(eventId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('runsheet_items')
      .select('id, time_from, time_to, title, description, location, category, is_public')
      .eq('event_id', eventId)
      .eq('is_public', true)
      .order('time_from', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async getVenueInfo(eventId: string) {
    const { data: event } = await this.supabase.serviceClient
      .from('events')
      .select('venue_name, venue_address, venue_city, venue_state, venue_country, venue_pincode, venue_maps_link, venue_parking_info, dress_code, venue_id')
      .eq('id', eventId)
      .single()
    if (!event) return null
    let venueDetails = null
    if (event.venue_id) {
      const { data: v } = await this.supabase.serviceClient
        .from('venues')
        .select('name, address, city, nearby_hotels, facilities, images, parking_instructions, website_url')
        .eq('id', event.venue_id)
        .single()
      venueDetails = v
    }
    return { ...event, venue_details: venueDetails }
  }

  async getGiftsInfo(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('gift_registry_items')
      .select('id, name, description, price, priority, image_url, purchase_link, is_fulfilled, category')
      .eq('event_id', eventId)
      .order('priority', { ascending: true })
    return data ?? []
  }

  async getGallery(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('event_media')
      .select('id, url, thumbnail_url, type, caption, taken_at')
      .eq('event_id', eventId)
      .eq('is_public', true)
      .order('taken_at', { ascending: false })
      .limit(100)
    return data ?? []
  }

  async getFoodMenu(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('fnb_menus')
      .select('id, name, description, serving_type, items:fnb_menu_items(id, name, description, is_vegetarian, is_vegan, is_gluten_free, allergens, image_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    return data ?? []
  }

  async getFaqs(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('guest_portal_faqs')
      .select('id, question, answer, sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
    return data ?? []
  }

  async getAnnouncements(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('guest_portal_announcements')
      .select('id, title, body, is_pinned, emoji, created_at')
      .eq('event_id', eventId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    return data ?? []
  }

  async getContacts(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('guest_portal_contacts')
      .select('id, name, role, phone, email, whatsapp, avatar_url, sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
    return data ?? []
  }

  async getAccommodationInfo(eventId: string, guestId: string | null) {
    const base: any = { hotels: [], guest_booking: null }
    const { data: hotels } = await this.supabase.serviceClient
      .from('accommodation_bookings')
      .select('id, hotel_name, address, star_rating, check_in_date, check_out_date, contact_phone, website_url, booking_instructions, distance_km, image_url')
      .eq('event_id', eventId)
      .order('star_rating', { ascending: false })
    base.hotels = hotels ?? []
    if (guestId) {
      const { data: booking } = await this.supabase.serviceClient
        .from('accommodation_bookings')
        .select('hotel_name, room_type, room_number, check_in_date, check_out_date, confirmation_code, notes')
        .eq('guest_id', guestId)
        .single()
      base.guest_booking = booking
    }
    return base
  }

  async getTransportInfo(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('events')
      .select('transport_instructions, shuttle_schedule, parking_info, nearest_metro, nearest_airport')
      .eq('id', eventId)
      .single()
    return data ?? {}
  }

  async getSurveyForGuest(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('event_surveys')
      .select('id, title, description, questions:survey_questions(id, type, question_text, options, is_required, sort_order)')
      .eq('event_id', eventId)
      .eq('is_post_event', true)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data
  }

  async submitSurveyResponse(guestId: string, eventId: string, surveyId: string, answers: Record<string, any>) {
    const { data, error } = await this.supabase.serviceClient
      .from('survey_responses')
      .insert({
        survey_id: surveyId,
        event_id: eventId,
        guest_id: guestId,
        answers,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async submitRsvp(guestId: string, eventId: string, dto: { rsvp_status: string; guest_count?: number; dietary_notes?: string; message?: string }) {
    const { error } = await this.supabase.serviceClient
      .from('guests')
      .update({
        rsvp_status: dto.rsvp_status,
        dietary_requirements: dto.dietary_notes,
        notes: dto.message,
        rsvp_responded_at: new Date().toISOString(),
      })
      .eq('id', guestId)
      .eq('event_id', eventId)
    if (error) throw new Error(error.message)
    return { success: true }
  }

  async updateGuestProfile(guestId: string, dto: { full_name?: string; meal_preference?: string; dietary_requirements?: string; special_requests?: string }) {
    const allowed: any = {}
    if (dto.full_name) allowed.full_name = dto.full_name
    if (dto.meal_preference) allowed.meal_preference = dto.meal_preference
    if (dto.dietary_requirements !== undefined) allowed.dietary_requirements = dto.dietary_requirements
    if (dto.special_requests !== undefined) allowed.notes = dto.special_requests
    const { data, error } = await this.supabase.serviceClient
      .from('guests')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', guestId)
      .select('id, full_name, meal_preference, dietary_requirements, notes')
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getMessages(eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('guest_portal_messages')
      .select('id, guest_id, mobile, message, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(100)
    return data ?? []
  }
}
