import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class RegistrationService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Admin: Registration Config CRUD ───────────────────────────────────────

  async getConfig(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('event_registration_configs')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId).single()
    if (error || !data) throw new NotFoundException('Registration config not found')
    return data
  }

  async getOrCreateConfig(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data: existing } = await db.from('event_registration_configs')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId).single()
    if (existing) return existing

    const { data, error } = await db.from('event_registration_configs')
      .insert({ event_id: eventId, tenant_id: tenantId }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateConfig(eventId: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    // Strip immutable fields
    const { event_id: _e, tenant_id: _t, id: _id, public_slug: _s, created_at: _c, ...safe } = dto
    const { data, error } = await db.from('event_registration_configs')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── Admin: Registration list ───────────────────────────────────────────────

  async listRegistrations(eventId: string, tenantId: string, token: string, opts: any = {}) {
    const db = this.supabase.forRequest(token)
    const { page = 1, pageSize = 50, approvalStatus } = opts
    const from = (page - 1) * pageSize
    let q = db.from('guests')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .eq('source', 'self_registered')
      .range(from, from + pageSize - 1)
    if (approvalStatus === 'pending') q = q.is('registration_approved', null)
    else if (approvalStatus === 'approved') q = q.eq('registration_approved', true)
    else if (approvalStatus === 'rejected') q = q.eq('registration_approved', false)
    const { data, count, error } = await q.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize }
  }

  async approveRegistration(guestId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('guests')
      .update({ registration_approved: true })
      .eq('id', guestId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async rejectRegistration(guestId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('guests')
      .update({ registration_approved: false })
      .eq('id', guestId).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── Public: Registration page ──────────────────────────────────────────────

  async getPublicConfig(slug: string) {
    const db = this.supabase.serviceClient
    const { data: config, error } = await db.from('event_registration_configs')
      .select(`*, events(id, name, start_date, end_date, tagline, logo_url, venues(id, name, city))`)
      .eq('public_slug', slug).single()

    if (error || !config) throw new NotFoundException('Registration page not found')
    if (!config.is_active) throw new ForbiddenException('Registration is closed')

    if (config.deadline && new Date(config.deadline) < new Date()) {
      throw new ForbiddenException('Registration deadline has passed')
    }

    if (config.max_registrations) {
      const { count } = await db.from('guests')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', config.event_id)
        .eq('source', 'self_registered')
      if ((count ?? 0) >= config.max_registrations) {
        throw new ForbiddenException('Registration is full')
      }
    }

    // Map venue from join
    const event = config.events as any
    if (event?.venues) {
      event.venue = event.venues
      delete event.venues
    }

    return { ...config, event }
  }

  async submitRegistration(slug: string, dto: any) {
    const db = this.supabase.serviceClient

    // Fetch config
    const { data: config } = await db.from('event_registration_configs')
      .select('event_id, tenant_id, require_approval, is_active, deadline, max_registrations')
      .eq('public_slug', slug).single()
    if (!config) throw new NotFoundException('Registration not found')
    if (!config.is_active) throw new ForbiddenException('Registration is closed')

    // Check capacity
    if (config.max_registrations) {
      const { count } = await db.from('guests')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', config.event_id).eq('source', 'self_registered')
      if ((count ?? 0) >= config.max_registrations) {
        throw new ForbiddenException('Registration is full')
      }
    }

    // Check for duplicate email in this event
    const { data: existing } = await db.from('guests')
      .select('id')
      .eq('event_id', config.event_id)
      .eq('email', dto.email)
      .limit(1)
    if (existing?.length) {
      throw new BadRequestException('This email is already registered for this event')
    }

    // Create guest
    const guestPayload = {
      tenant_id: config.tenant_id,
      event_id: config.event_id,
      full_name: dto.full_name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      designation: dto.designation,
      city: dto.city,
      category: dto.category ?? 'general',
      source: 'self_registered',
      registration_approved: config.require_approval ? null : true,
      rsvp_status: 'confirmed', // Self-registration implies attendance intent
    }

    const { data: guest, error } = await db.from('guests').insert(guestPayload).select().single()
    if (error) throw new Error(error.message)

    return {
      id: guest.id,
      full_name: guest.full_name,
      email: guest.email,
      pending_approval: config.require_approval,
    }
  }
}
