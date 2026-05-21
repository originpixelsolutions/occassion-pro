import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../common/supabase/supabase.service'
import {
  UpdateConferenceSettingsDto, CreateTicketDto, UpdateTicketDto,
  CreateRegistrationDto, UpdateRegistrationDto, CheckInDto,
  CreateSpeakerDto, UpdateSpeakerDto,
  CreateSessionDto, UpdateSessionDto, AddSessionSpeakerDto,
  CreateSponsorDto, UpdateSponsorDto,
  CreateExhibitorDto, UpdateExhibitorDto,
  CreateQuestionDto, UpdateQuestionDto,
  CreatePollDto, UpdatePollDto, VotePollDto,
  IssueCEUDto, CreateConnectionDto, UpdateConnectionDto,
} from './dto/conference.dto'

@Injectable()
export class ConferenceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventEmitter2,
  ) {}

  private get db() { return this.supabase.serviceClient }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getOrCreateSettings(eventId: string, tenantId: string) {
    const { data: existing } = await this.db
      .from('conference_settings')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (existing) return existing

    const { data, error } = await this.db
      .from('conference_settings')
      .insert({ event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateSettings(eventId: string, tenantId: string, dto: UpdateConferenceSettingsDto) {
    const settings = await this.getOrCreateSettings(eventId, tenantId)

    const { data, error } = await this.db
      .from('conference_settings')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Dashboard overview ────────────────────────────────────────────────────

  async getDashboard(eventId: string, tenantId: string) {
    const [settings, ticketsResult, registrationsResult, sessionsResult, speakersResult, sponsorsResult] =
      await Promise.all([
        this.getOrCreateSettings(eventId, tenantId),
        this.db.from('conference_tickets').select('id, name, quantity_total, quantity_sold, price').eq('event_id', eventId),
        this.db.from('conference_registrations').select('id, status').eq('event_id', eventId),
        this.db.from('conference_sessions').select('id, status, session_type').eq('event_id', eventId),
        this.db.from('conference_speakers').select('id, status').eq('event_id', eventId),
        this.db.from('conference_sponsors').select('id, tier, sponsorship_amount').eq('event_id', eventId),
      ])

    const registrations = registrationsResult.data ?? []
    const tickets = ticketsResult.data ?? []
    const sessions = sessionsResult.data ?? []
    const speakers = speakersResult.data ?? []
    const sponsors = sponsorsResult.data ?? []

    const totalRevenue = tickets.reduce((sum, t) => sum + (t.quantity_sold * t.price), 0)
    const totalSponsor = sponsors.reduce((sum, s) => sum + (s.sponsorship_amount ?? 0), 0)

    return {
      settings,
      stats: {
        total_registrations: registrations.length,
        confirmed_registrations: registrations.filter(r => r.status === 'confirmed').length,
        checked_in: registrations.filter(r => r.status === 'checked_in').length,
        total_sessions: sessions.length,
        live_sessions: sessions.filter(s => s.status === 'live').length,
        total_speakers: speakers.length,
        confirmed_speakers: speakers.filter(s => s.status === 'confirmed').length,
        total_sponsors: sponsors.length,
        estimated_revenue: totalRevenue,
        sponsor_revenue: totalSponsor,
      },
    }
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  async getTickets(eventId: string) {
    const { data, error } = await this.db
      .from('conference_tickets')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('created_at')

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createTicket(eventId: string, tenantId: string, dto: CreateTicketDto) {
    const { data, error } = await this.db
      .from('conference_tickets')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateTicket(eventId: string, ticketId: string, dto: UpdateTicketDto) {
    const { data, error } = await this.db
      .from('conference_tickets')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Ticket not found')
    return data
  }

  async deleteTicket(eventId: string, ticketId: string) {
    const { data: sold } = await this.db
      .from('conference_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', ticketId)
      .in('status', ['confirmed', 'checked_in'])

    if ((sold as any)?.count > 0) {
      throw new BadRequestException('Cannot delete ticket with confirmed registrations')
    }

    const { error } = await this.db
      .from('conference_tickets')
      .delete()
      .eq('id', ticketId)
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Registrations ────────────────────────────────────────────────────────

  async getRegistrations(eventId: string, params: {
    status?: string; search?: string; ticketId?: string; page?: number; limit?: number
  }) {
    const { status, search, ticketId, page = 1, limit = 50 } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = this.db
      .from('conference_registrations')
      .select('*, ticket:conference_tickets(id, name, ticket_type)', { count: 'exact' })
      .eq('event_id', eventId)
      .range(from, to)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (ticketId) query = query.eq('ticket_id', ticketId)
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,registration_number.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) throw new BadRequestException(error.message)
    return { data, total: count, page, limit }
  }

  async createRegistration(eventId: string, tenantId: string, dto: CreateRegistrationDto) {
    // Check ticket capacity
    const { data: ticket } = await this.db
      .from('conference_tickets')
      .select('*')
      .eq('id', dto.ticket_id)
      .eq('event_id', eventId)
      .single()

    if (!ticket) throw new NotFoundException('Ticket not found')
    if (!ticket.is_active) throw new BadRequestException('Ticket is not active')
    if (ticket.quantity_total !== null && ticket.quantity_sold >= ticket.quantity_total) {
      throw new BadRequestException('Ticket is sold out')
    }

    // Generate registration number
    const { data: regNumData } = await this.db.rpc('generate_registration_number', { p_event_id: eventId })
    const registration_number = regNumData as string

    // Generate QR code (simple format, can be replaced with real QR lib)
    const qr_code = `CONF-${eventId.slice(0, 8)}-${registration_number}`

    const { data, error } = await this.db
      .from('conference_registrations')
      .insert({
        ...dto,
        event_id: eventId,
        tenant_id: tenantId,
        registration_number,
        qr_code,
        status: dto.is_complimentary ? 'confirmed' : 'pending',
      })
      .select('*, ticket:conference_tickets(id, name, ticket_type)')
      .single()

    if (error) {
      if (error.code === '23505') throw new ConflictException('Registration already exists for this email and ticket')
      throw new BadRequestException(error.message)
    }

    this.events.emit('conference.registration_created', { eventId, registration: data, tenantId })
    return data
  }

  async updateRegistration(eventId: string, registrationId: string, dto: UpdateRegistrationDto) {
    const { data, error } = await this.db
      .from('conference_registrations')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Registration not found')
    return data
  }

  async checkIn(eventId: string, dto: CheckInDto) {
    const { data: reg } = await this.db
      .from('conference_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('registration_number', dto.registration_number)
      .single()

    if (!reg) throw new NotFoundException('Registration not found')
    if (reg.status === 'checked_in') throw new BadRequestException('Already checked in')
    if (reg.status === 'cancelled') throw new BadRequestException('Registration is cancelled')

    const { data, error } = await this.db
      .from('conference_registrations')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: dto.checked_in_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reg.id)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    this.events.emit('conference.checked_in', { eventId, registration: data })
    return data
  }

  async bulkImportRegistrations(eventId: string, tenantId: string, rows: any[]) {
    const results = { success: 0, failed: 0, errors: [] as any[] }

    for (const row of rows) {
      try {
        await this.createRegistration(eventId, tenantId, row)
        results.success++
      } catch (e) {
        results.failed++
        results.errors.push({ row, error: e.message })
      }
    }

    return results
  }

  // ─── Speakers ─────────────────────────────────────────────────────────────

  async getSpeakers(eventId: string, params: { status?: string; isKeynote?: boolean } = {}) {
    let query = this.db
      .from('conference_speakers')
      .select(`
        *,
        sessions:conference_session_speakers(
          session:conference_sessions(id, title, starts_at, ends_at, session_type)
        )
      `)
      .eq('event_id', eventId)
      .order('speaker_order')
      .order('last_name')

    if (params.status) query = query.eq('status', params.status)
    if (params.isKeynote) query = query.eq('is_keynote', true)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createSpeaker(eventId: string, tenantId: string, dto: CreateSpeakerDto) {
    const { data, error } = await this.db
      .from('conference_speakers')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateSpeaker(eventId: string, speakerId: string, dto: UpdateSpeakerDto) {
    const { data, error } = await this.db
      .from('conference_speakers')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', speakerId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Speaker not found')
    return data
  }

  async deleteSpeaker(eventId: string, speakerId: string) {
    await this.db
      .from('conference_session_speakers')
      .delete()
      .eq('speaker_id', speakerId)

    const { error } = await this.db
      .from('conference_speakers')
      .delete()
      .eq('id', speakerId)
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(eventId: string, params: {
    track?: string; status?: string; type?: string; dayNumber?: number
  } = {}) {
    let query = this.db
      .from('conference_sessions')
      .select(`
        *,
        speakers:conference_session_speakers(
          role, sort_order,
          speaker:conference_speakers(id, first_name, last_name, company, photo_url, is_keynote)
        )
      `)
      .eq('event_id', eventId)
      .order('starts_at')

    if (params.track) query = query.eq('track', params.track)
    if (params.status) query = query.eq('status', params.status)
    if (params.type) query = query.eq('session_type', params.type)
    if (params.dayNumber) query = query.eq('day_number', params.dayNumber)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)

    // Group by day
    const byDay: Record<number, any[]> = {}
    for (const s of data ?? []) {
      const day = s.day_number ?? 1
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(s)
    }

    return { sessions: data, byDay }
  }

  async createSession(eventId: string, tenantId: string, dto: CreateSessionDto) {
    const { speaker_ids, ...sessionData } = dto

    const { data: session, error } = await this.db
      .from('conference_sessions')
      .insert({ ...sessionData, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    if (speaker_ids?.length) {
      const links = speaker_ids.map((sid, idx) => ({
        session_id: session.id,
        speaker_id: sid,
        sort_order: idx,
      }))
      await this.db.from('conference_session_speakers').insert(links)
    }

    return this.getSessionById(session.id)
  }

  async getSessionById(sessionId: string) {
    const { data, error } = await this.db
      .from('conference_sessions')
      .select(`
        *,
        speakers:conference_session_speakers(
          role, sort_order,
          speaker:conference_speakers(id, first_name, last_name, company, photo_url, job_title)
        )
      `)
      .eq('id', sessionId)
      .single()

    if (error || !data) throw new NotFoundException('Session not found')
    return data
  }

  async updateSession(eventId: string, sessionId: string, dto: UpdateSessionDto) {
    const { speaker_ids, ...sessionData } = dto

    const { data, error } = await this.db
      .from('conference_sessions')
      .update({ ...sessionData, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Session not found')

    if (speaker_ids !== undefined) {
      await this.db.from('conference_session_speakers').delete().eq('session_id', sessionId)
      if (speaker_ids.length) {
        await this.db.from('conference_session_speakers').insert(
          speaker_ids.map((sid, idx) => ({ session_id: sessionId, speaker_id: sid, sort_order: idx }))
        )
      }
    }

    return this.getSessionById(sessionId)
  }

  async updateSessionStatus(eventId: string, sessionId: string, status: string) {
    const { data, error } = await this.db
      .from('conference_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    this.events.emit('conference.session_status_changed', { eventId, sessionId, status })
    return data
  }

  async deleteSession(eventId: string, sessionId: string) {
    const { error } = await this.db
      .from('conference_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  async addSessionSpeaker(sessionId: string, dto: AddSessionSpeakerDto) {
    const { data, error } = await this.db
      .from('conference_session_speakers')
      .insert({ session_id: sessionId, speaker_id: dto.speaker_id, role: dto.role ?? 'speaker' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async removeSessionSpeaker(sessionId: string, speakerId: string) {
    const { error } = await this.db
      .from('conference_session_speakers')
      .delete()
      .eq('session_id', sessionId)
      .eq('speaker_id', speakerId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Sponsors ─────────────────────────────────────────────────────────────

  async getSponsors(eventId: string) {
    const { data, error } = await this.db
      .from('conference_sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('sponsorship_amount', { ascending: false })

    if (error) throw new BadRequestException(error.message)

    // Group by tier
    const byTier: Record<string, any[]> = {}
    for (const s of data ?? []) {
      if (!byTier[s.tier]) byTier[s.tier] = []
      byTier[s.tier].push(s)
    }

    return { sponsors: data, byTier }
  }

  async createSponsor(eventId: string, tenantId: string, dto: CreateSponsorDto) {
    const { data, error } = await this.db
      .from('conference_sponsors')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateSponsor(eventId: string, sponsorId: string, dto: UpdateSponsorDto) {
    const { data, error } = await this.db
      .from('conference_sponsors')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', sponsorId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Sponsor not found')
    return data
  }

  async deleteSponsor(eventId: string, sponsorId: string) {
    const { error } = await this.db
      .from('conference_sponsors')
      .delete()
      .eq('id', sponsorId)
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Exhibitors ───────────────────────────────────────────────────────────

  async getExhibitors(eventId: string, params: { status?: string; hall?: string } = {}) {
    let query = this.db
      .from('conference_exhibitors')
      .select('*')
      .eq('event_id', eventId)
      .order('booth_number')

    if (params.status) query = query.eq('status', params.status)
    if (params.hall) query = query.eq('hall', params.hall)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createExhibitor(eventId: string, tenantId: string, dto: CreateExhibitorDto) {
    const { data, error } = await this.db
      .from('conference_exhibitors')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateExhibitor(eventId: string, exhibitorId: string, dto: UpdateExhibitorDto) {
    const { data, error } = await this.db
      .from('conference_exhibitors')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', exhibitorId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Exhibitor not found')
    return data
  }

  async deleteExhibitor(eventId: string, exhibitorId: string) {
    const { error } = await this.db
      .from('conference_exhibitors')
      .delete()
      .eq('id', exhibitorId)
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Live Q&A ─────────────────────────────────────────────────────────────

  async getQuestions(sessionId: string, status?: string) {
    let query = this.db
      .from('conference_live_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('upvotes', { ascending: false })
      .order('created_at')

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createQuestion(eventId: string, tenantId: string, dto: CreateQuestionDto) {
    const { data, error } = await this.db
      .from('conference_live_questions')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    this.events.emit('conference.question_created', { eventId, sessionId: dto.session_id, question: data })
    return data
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
    const { data, error } = await this.db
      .from('conference_live_questions')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Question not found')

    this.events.emit('conference.question_updated', { question: data })
    return data
  }

  async upvoteQuestion(questionId: string, registrationId: string) {
    const { error } = await this.db
      .from('conference_question_upvotes')
      .insert({ question_id: questionId, registration_id: registrationId })

    if (error?.code === '23505') throw new ConflictException('Already upvoted')
    if (error) throw new BadRequestException(error.message)

    const { data } = await this.db
      .from('conference_live_questions')
      .select('upvotes')
      .eq('id', questionId)
      .single()

    this.events.emit('conference.question_upvoted', { questionId, upvotes: data?.upvotes })
    return { upvotes: data?.upvotes }
  }

  // ─── Polls ────────────────────────────────────────────────────────────────

  async getPolls(eventId: string, sessionId?: string) {
    let query = this.db
      .from('conference_live_polls')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (sessionId) query = query.eq('session_id', sessionId)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createPoll(eventId: string, tenantId: string, userId: string, dto: CreatePollDto) {
    const options = dto.options.map(o => ({ ...o, votes_count: 0 }))

    const { data, error } = await this.db
      .from('conference_live_polls')
      .insert({ ...dto, options, event_id: eventId, tenant_id: tenantId, created_by: userId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updatePoll(pollId: string, dto: UpdatePollDto) {
    const { data, error } = await this.db
      .from('conference_live_polls')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', pollId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    if (dto.status === 'active') {
      this.events.emit('conference.poll_started', { poll: data })
    } else if (dto.status === 'closed') {
      this.events.emit('conference.poll_closed', { poll: data })
    }

    return data
  }

  async votePoll(pollId: string, dto: VotePollDto) {
    const { data: poll } = await this.db
      .from('conference_live_polls')
      .select('*')
      .eq('id', pollId)
      .single()

    if (!poll) throw new NotFoundException('Poll not found')
    if (poll.status !== 'active') throw new BadRequestException('Poll is not active')

    // Record response
    const { error: voteError } = await this.db
      .from('conference_poll_responses')
      .insert({ poll_id: pollId, registration_id: dto.registration_id, selected_options: dto.selected_options })

    if (voteError?.code === '23505') throw new ConflictException('Already voted')
    if (voteError) throw new BadRequestException(voteError.message)

    // Update option vote counts in JSONB
    const updatedOptions = poll.options.map((opt: any) => ({
      ...opt,
      votes_count: opt.votes_count + (dto.selected_options.includes(opt.id) ? 1 : 0),
    }))

    const { data, error } = await this.db
      .from('conference_live_polls')
      .update({ options: updatedOptions, updated_at: new Date().toISOString() })
      .eq('id', pollId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    this.events.emit('conference.poll_voted', { pollId, poll: data })
    return data
  }

  // ─── CEU Credits ──────────────────────────────────────────────────────────

  async getCEUCredits(eventId: string, registrationId?: string) {
    let query = this.db
      .from('conference_ceu_credits')
      .select(`
        *,
        registration:conference_registrations(id, first_name, last_name, email),
        session:conference_sessions(id, title)
      `)
      .eq('event_id', eventId)
      .order('issued_at', { ascending: false })

    if (registrationId) query = query.eq('registration_id', registrationId)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async issueCEUCredit(eventId: string, tenantId: string, userId: string, dto: IssueCEUDto) {
    const cert_number = `CEU-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await this.db
      .from('conference_ceu_credits')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId, issued_by: userId, certificate_number: cert_number })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Update total CEU on registration (inline — no RPC needed)
    this.db
      .from('conference_registrations')
      .select('ceu_credits_earned')
      .eq('id', dto.registration_id)
      .single()
      .then(({ data: reg }) => {
        if (reg) {
          return this.db
            .from('conference_registrations')
            .update({ ceu_credits_earned: (Number(reg.ceu_credits_earned) || 0) + (Number(dto.credits) || 0) })
            .eq('id', dto.registration_id)
        }
      })
      .catch(() => {}) // non-fatal

    return data
  }

  async bulkIssueCEU(eventId: string, sessionId: string, tenantId: string, userId: string) {
    // Issue CEU for all checked-in attendees of a session
    const { data: session } = await this.db
      .from('conference_sessions')
      .select('ceu_credits, ceu_type, title')
      .eq('id', sessionId)
      .single()

    if (!session || session.ceu_credits <= 0) {
      throw new BadRequestException('Session has no CEU credits configured')
    }

    const { data: attendees } = await this.db
      .from('conference_session_attendees')
      .select('registration_id')
      .eq('session_id', sessionId)
      .not('checked_in_at', 'is', null)
      .eq('ceu_issued', false)

    const results = { issued: 0, skipped: 0 }
    for (const att of attendees ?? []) {
      try {
        await this.issueCEUCredit(eventId, tenantId, userId, {
          registration_id: att.registration_id,
          session_id: sessionId,
          credit_type: session.ceu_type ?? 'General',
          credits: session.ceu_credits,
        })
        await this.db
          .from('conference_session_attendees')
          .update({ ceu_issued: true, ceu_issued_at: new Date().toISOString() })
          .eq('session_id', sessionId)
          .eq('registration_id', att.registration_id)
        results.issued++
      } catch {
        results.skipped++
      }
    }

    return results
  }

  // ─── Networking ───────────────────────────────────────────────────────────

  async getConnections(eventId: string, registrationId: string) {
    const { data, error } = await this.db
      .from('conference_networking_connections')
      .select(`
        *,
        requester:conference_registrations!requester_id(id, first_name, last_name, company, job_title),
        recipient:conference_registrations!recipient_id(id, first_name, last_name, company, job_title)
      `)
      .eq('event_id', eventId)
      .or(`requester_id.eq.${registrationId},recipient_id.eq.${registrationId}`)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createConnection(eventId: string, requesterId: string, dto: CreateConnectionDto) {
    const { data, error } = await this.db
      .from('conference_networking_connections')
      .insert({ event_id: eventId, requester_id: requesterId, ...dto })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new ConflictException('Connection request already exists')
      throw new BadRequestException(error.message)
    }

    this.events.emit('conference.connection_requested', { eventId, connection: data })
    return data
  }

  async updateConnection(connectionId: string, registrationId: string, dto: UpdateConnectionDto) {
    // Ensure the recipient is the one responding
    const { data: conn } = await this.db
      .from('conference_networking_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (!conn) throw new NotFoundException('Connection not found')
    if (conn.recipient_id !== registrationId) throw new BadRequestException('Only the recipient can respond')

    const update: any = {
      status: dto.status,
      updated_at: new Date().toISOString(),
    }
    if (dto.status === 'accepted') update.connected_at = new Date().toISOString()
    if (dto.meeting_scheduled !== undefined) update.meeting_scheduled = dto.meeting_scheduled
    if (dto.meeting_time) update.meeting_time = dto.meeting_time
    if (dto.meeting_location) update.meeting_location = dto.meeting_location

    const { data, error } = await this.db
      .from('conference_networking_connections')
      .update(update)
      .eq('id', connectionId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async exportRegistrations(eventId: string) {
    const { data, error } = await this.db
      .from('conference_registrations')
      .select('*, ticket:conference_tickets(name, ticket_type)')
      .eq('event_id', eventId)
      .order('created_at')

    if (error) throw new BadRequestException(error.message)

    const csv = [
      ['Registration #', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Job Title',
       'Ticket', 'Status', 'Badge Name', 'Dietary', 'Checked In', 'CEU Credits'].join(','),
      ...(data ?? []).map(r => [
        r.registration_number, r.first_name, r.last_name, r.email, r.phone ?? '',
        r.company ?? '', r.job_title ?? '',
        (r.ticket as any)?.name ?? '', r.status,
        r.badge_name ?? '', r.dietary_requirements ?? '',
        r.checked_in_at ? new Date(r.checked_in_at).toISOString() : '',
        r.ceu_credits_earned,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return { csv, count: data?.length ?? 0 }
  }
}
