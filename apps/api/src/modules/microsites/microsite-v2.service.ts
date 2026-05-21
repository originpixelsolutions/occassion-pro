import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateSpeakerDto {
  name: string
  title?: string
  company?: string
  bio?: string
  photo_url?: string
  linkedin_url?: string
  twitter_url?: string
  website_url?: string
  display_order?: number
  is_keynote?: boolean
  is_published?: boolean
}

export interface CreateSessionDto {
  title: string
  description?: string
  session_type?: string
  stage?: string
  session_date: string   // YYYY-MM-DD
  start_time: string     // HH:MM
  end_time: string       // HH:MM
  speaker_id?: string
  tags?: string[]
  is_published?: boolean
  display_order?: number
}

export interface CreateSponsorDto {
  name: string
  logo_url?: string
  website_url?: string
  tier: string
  tagline?: string
  display_order?: number
  is_published?: boolean
}

export interface CreateFaqDto {
  question: string
  answer: string
  display_order?: number
  is_published?: boolean
}

export interface UpdateSettingsDto {
  theme?: string
  accent_color?: string
  hero_image_url?: string
  logo_url?: string
  show_speakers?: boolean
  show_schedule?: boolean
  show_sponsors?: boolean
  show_faq?: boolean
  show_map?: boolean
  registration_enabled?: boolean
  registration_fee_paise?: number
  razorpay_key_id?: string
  max_registrations?: number
  registration_deadline?: string
  custom_domain?: string
  slug_override?: string
  meta_title?: string
  meta_description?: string
  og_image_url?: string
  twitter_handle?: string
  ga4_measurement_id?: string
  fb_pixel_id?: string
  countdown_enabled?: boolean
  hero_cta_label?: string
  hero_cta_url?: string
  is_published?: boolean
}

export interface RegistrationDto {
  name: string
  email: string
  phone?: string
  company?: string
  designation?: string
  dietary?: string
  amount_paise?: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MicrositeV2Service {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Speakers ───────────────────────────────────────────────────────────────

  async listSpeakers(tenantId: string, eventId: string) {
    const { data, error } = await this.supabase.client
      .from('microsite_speakers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('display_order')
    if (error) throw error
    return data
  }

  async createSpeaker(tenantId: string, eventId: string, dto: CreateSpeakerDto) {
    const { data, error } = await this.supabase.client
      .from('microsite_speakers')
      .insert({ tenant_id: tenantId, event_id: eventId, ...dto })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateSpeaker(tenantId: string, id: string, dto: Partial<CreateSpeakerDto>) {
    const { data, error } = await this.supabase.client
      .from('microsite_speakers')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new NotFoundException('Speaker not found')
    return data
  }

  async deleteSpeaker(tenantId: string, id: string) {
    const { error } = await this.supabase.client
      .from('microsite_speakers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw error
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async listSessions(tenantId: string, eventId: string) {
    const { data, error } = await this.supabase.client
      .from('microsite_sessions')
      .select('*, microsite_speakers(id, name, title, photo_url)')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('session_date')
      .order('start_time')
    if (error) throw error
    return data
  }

  async createSession(tenantId: string, eventId: string, dto: CreateSessionDto) {
    const { data, error } = await this.supabase.client
      .from('microsite_sessions')
      .insert({ tenant_id: tenantId, event_id: eventId, ...dto })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateSession(tenantId: string, id: string, dto: Partial<CreateSessionDto>) {
    const { data, error } = await this.supabase.client
      .from('microsite_sessions')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new NotFoundException('Session not found')
    return data
  }

  async deleteSession(tenantId: string, id: string) {
    const { error } = await this.supabase.client
      .from('microsite_sessions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw error
  }

  // ── Sponsors ───────────────────────────────────────────────────────────────

  async listSponsors(tenantId: string, eventId: string) {
    const { data, error } = await this.supabase.client
      .from('microsite_sponsors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('tier')
      .order('display_order')
    if (error) throw error
    return data
  }

  async createSponsor(tenantId: string, eventId: string, dto: CreateSponsorDto) {
    const { data, error } = await this.supabase.client
      .from('microsite_sponsors')
      .insert({ tenant_id: tenantId, event_id: eventId, ...dto })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateSponsor(tenantId: string, id: string, dto: Partial<CreateSponsorDto>) {
    const { data, error } = await this.supabase.client
      .from('microsite_sponsors')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new NotFoundException('Sponsor not found')
    return data
  }

  async deleteSponsor(tenantId: string, id: string) {
    const { error } = await this.supabase.client
      .from('microsite_sponsors')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw error
  }

  // ── FAQs ───────────────────────────────────────────────────────────────────

  async listFaqs(tenantId: string, eventId: string) {
    const { data, error } = await this.supabase.client
      .from('microsite_faqs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('display_order')
    if (error) throw error
    return data
  }

  async createFaq(tenantId: string, eventId: string, dto: CreateFaqDto) {
    const { data, error } = await this.supabase.client
      .from('microsite_faqs')
      .insert({ tenant_id: tenantId, event_id: eventId, ...dto })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateFaq(tenantId: string, id: string, dto: Partial<CreateFaqDto>) {
    const { data, error } = await this.supabase.client
      .from('microsite_faqs')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new NotFoundException('FAQ not found')
    return data
  }

  async deleteFaq(tenantId: string, id: string) {
    const { error } = await this.supabase.client
      .from('microsite_faqs')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw error
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async getSettings(tenantId: string, eventId: string) {
    const { data } = await this.supabase.client
      .from('microsite_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .single()
    return data ?? null
  }

  async upsertSettings(tenantId: string, eventId: string, dto: UpdateSettingsDto) {
    const { data, error } = await this.supabase.client
      .from('microsite_settings')
      .upsert({ tenant_id: tenantId, event_id: eventId, ...dto }, { onConflict: 'event_id' })
      .select()
      .single()
    if (error) throw error

    // Auto-set published_at
    if (dto.is_published) {
      await this.supabase.client
        .from('microsite_settings')
        .update({ published_at: new Date().toISOString() })
        .eq('id', data.id)
        .is('published_at', null)
    }

    return data
  }

  // ── Full public payload (fetched by public microsite page) ─────────────────

  async getPublicMicrosite(slug: string) {
    // Resolve event by slug (from microsites table OR microsite_settings.slug_override)
    const { data: eventData } = await this.supabase.serviceClient
      .from('microsite_settings')
      .select(`
        *,
        events!inner(
          id, name, start_date, end_date, venue_name, city, state, country,
          cover_image_url, description, status
        )
      `)
      .or(`slug_override.eq.${slug},events.slug.eq.${slug}`)
      .eq('is_published', true)
      .single()

    if (!eventData) throw new NotFoundException('Microsite not found or not published')

    const eventId = eventData.events.id
    const tenantId = eventData.tenant_id

    // Parallel fetch all sections
    const [speakers, sessions, sponsors, faqs, registrationCount] = await Promise.all([
      this.supabase.serviceClient
        .from('microsite_speakers')
        .select('id, name, title, company, bio, photo_url, linkedin_url, twitter_url, website_url, display_order, is_keynote')
        .eq('event_id', eventId)
        .eq('is_published', true)
        .order('display_order'),

      this.supabase.serviceClient
        .from('microsite_sessions')
        .select('id, title, description, session_type, stage, session_date, start_time, end_time, tags, display_order, microsite_speakers(id, name, title, photo_url)')
        .eq('event_id', eventId)
        .eq('is_published', true)
        .order('session_date')
        .order('start_time'),

      this.supabase.serviceClient
        .from('microsite_sponsors')
        .select('id, name, logo_url, website_url, tier, tagline, display_order')
        .eq('event_id', eventId)
        .eq('is_published', true)
        .order('display_order'),

      this.supabase.serviceClient
        .from('microsite_faqs')
        .select('id, question, answer, display_order')
        .eq('event_id', eventId)
        .eq('is_published', true)
        .order('display_order'),

      this.supabase.serviceClient
        .from('microsite_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed'),
    ])

    // Group sessions by date
    const sessionsByDate: Record<string, any[]> = {}
    for (const s of sessions.data ?? []) {
      const key = s.session_date
      if (!sessionsByDate[key]) sessionsByDate[key] = []
      sessionsByDate[key].push(s)
    }

    // Group sponsors by tier
    const sponsorsByTier: Record<string, any[]> = {}
    const tierOrder = ['platinum', 'gold', 'silver', 'bronze', 'community', 'media']
    for (const s of sponsors.data ?? []) {
      if (!sponsorsByTier[s.tier]) sponsorsByTier[s.tier] = []
      sponsorsByTier[s.tier].push(s)
    }

    return {
      settings: eventData,
      event: eventData.events,
      speakers: speakers.data ?? [],
      schedule: sessionsByDate,
      sponsors: sponsorsByTier,
      sponsor_tier_order: tierOrder,
      faqs: faqs.data ?? [],
      confirmed_registrations: registrationCount.count ?? 0,
    }
  }

  // ── Registrations ──────────────────────────────────────────────────────────

  async listRegistrations(tenantId: string, eventId: string) {
    const { data, error } = await this.supabase.client
      .from('microsite_registrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  }

  async createRegistration(eventId: string, tenantId: string, dto: RegistrationDto) {
    // Check capacity
    const settings = await this.supabase.serviceClient
      .from('microsite_settings')
      .select('max_registrations, registration_enabled, registration_deadline')
      .eq('event_id', eventId)
      .single()

    if (!settings.data?.registration_enabled) {
      throw new ForbiddenException('Registration is not enabled for this event')
    }

    if (settings.data.registration_deadline && new Date(settings.data.registration_deadline) < new Date()) {
      throw new ForbiddenException('Registration deadline has passed')
    }

    if (settings.data.max_registrations) {
      const { count } = await this.supabase.serviceClient
        .from('microsite_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed')
      if ((count ?? 0) >= settings.data.max_registrations) {
        throw new ForbiddenException('Event is fully booked')
      }
    }

    const qrToken = this.genToken()
    const { data, error } = await this.supabase.serviceClient
      .from('microsite_registrations')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        ...dto,
        qr_code: qrToken,
        status: dto.amount_paise ? 'pending_payment' : 'confirmed',
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async confirmRegistrationPayment(
    registrationId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const { data, error } = await this.supabase.serviceClient
      .from('microsite_registrations')
      .update({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  private genToken(): string {
    return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  }
}
