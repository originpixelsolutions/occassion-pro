import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { SupportBotService } from './support-bot.service'

@Injectable()
export class PlatformSupportService {
  private readonly logger = new Logger(PlatformSupportService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly bot: SupportBotService,
  ) {}

  // ── Create platform support ticket + run bot auto-response ────────────────

  async createTicket(
    tenantId: string,
    userId: string,
    dto: { subject: string; description: string; category: string },
    token: string,
  ) {
    const client = this.supabase.forRequest(token)
    const admin  = this.supabase.serviceClient

    // Generate ticket number (reuse existing function)
    const { data: numData } = await admin.rpc('generate_ticket_number', { p_tenant_id: tenantId })
    const ticketNumber = numData ?? `TKT-${Date.now()}`

    // Insert ticket
    const { data: ticket, error } = await client
      .from('support_tickets')
      .insert({
        tenant_id:    tenantId,
        ticket_number: ticketNumber,
        title:        dto.subject,
        subject:      dto.subject,
        description:  dto.description,
        status:       'open',
        priority:     'medium',
        reporter_type: 'internal',
        reporter_id:  userId,
        submitted_by: userId,
        // category from the new constraint-safe column (stored in the platform category field)
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Run bot matcher against subject + description
    const query    = `${dto.subject} ${dto.description}`
    const faqMatch = await this.bot.findFaqAnswer(query)

    if (faqMatch) {
      // Bot found an answer — post bot message and mark bot_handled
      await admin.from('support_messages').insert({
        ticket_id:   ticket.id,
        sender_type: 'bot',
        sender_id:   null,
        message:     faqMatch.answer,
      })

      await admin
        .from('support_tickets')
        .update({ status: 'bot_handled', bot_faq_id: faqMatch.id })
        .eq('id', ticket.id)

      return { ...ticket, status: 'bot_handled', bot_answer: faqMatch }
    } else {
      // No bot answer — post system message
      await admin.from('support_messages').insert({
        ticket_id:   ticket.id,
        sender_type: 'bot',
        sender_id:   null,
        message:     'Thanks for reaching out! Our support team will review your request and get back to you shortly. Usual response time is within 24 hours.',
      })

      return { ...ticket, status: 'open', bot_answer: null }
    }
  }

  // ── My tickets (tenant user) ──────────────────────────────────────────────

  async getMyTickets(tenantId: string, userId: string, token: string, status?: string) {
    const client = this.supabase.forRequest(token)

    let query = client
      .from('support_tickets')
      .select(`
        id, ticket_number, title, subject, description, status, priority,
        bot_faq_id, escalated_at, resolution_notes, created_at, updated_at,
        _msg_count:support_messages(count)
      `)
      .eq('tenant_id', tenantId)
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── Get single ticket + message thread ───────────────────────────────────

  async getTicket(ticketId: string, requesterId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const { data: ticket, error } = await client
      .from('support_tickets')
      .select(`
        id, ticket_number, title, subject, description, status, priority,
        bot_faq_id, escalated_at, resolution_notes, super_admin_notes,
        created_at, updated_at,
        support_messages(id, sender_type, sender_id, message, created_at)
      `)
      .eq('id', ticketId)
      .single()

    if (error || !ticket) throw new NotFoundException('Ticket not found')

    // Requester must own the ticket OR be super_admin
    if (ticket['submitted_by'] && ticket['submitted_by'] !== requesterId) {
      const { data: profile } = await client
        .from('profiles')
        .select('role')
        .eq('id', requesterId)
        .single()
      if (profile?.role !== 'super_admin') throw new ForbiddenException()
    }

    return ticket
  }

  // ── User adds a message to their ticket ───────────────────────────────────

  async addMessage(ticketId: string, userId: string, message: string, token: string) {
    const client = this.supabase.forRequest(token)
    const admin  = this.supabase.serviceClient

    // Verify ticket exists and belongs to user
    const { data: ticket } = await client
      .from('support_tickets')
      .select('id, status, tenant_id, submitted_by')
      .eq('id', ticketId)
      .single()

    if (!ticket) throw new NotFoundException('Ticket not found')
    if (ticket.submitted_by !== userId) throw new ForbiddenException()

    // Add user message
    const { data: msg, error } = await admin.from('support_messages').insert({
      ticket_id:   ticketId,
      sender_type: 'user',
      sender_id:   userId,
      message,
    }).select().single()

    if (error) throw new BadRequestException(error.message)

    // If ticket was bot_handled and user replies → auto-escalate
    if (ticket.status === 'bot_handled') {
      await admin.from('support_tickets')
        .update({ status: 'escalated', escalated_at: new Date().toISOString() })
        .eq('id', ticketId)

      // Add a system acknowledgment
      await admin.from('support_messages').insert({
        ticket_id:   ticketId,
        sender_type: 'bot',
        sender_id:   null,
        message:     'Your query has been escalated to our support team. We\'ll get back to you within 24 hours.',
      })
    }

    return msg
  }

  // ── Manual escalation ─────────────────────────────────────────────────────

  async escalateTicket(ticketId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const admin  = this.supabase.serviceClient

    const { data: ticket } = await client
      .from('support_tickets')
      .select('id, status, submitted_by')
      .eq('id', ticketId)
      .single()

    if (!ticket) throw new NotFoundException('Ticket not found')
    if (ticket.submitted_by !== userId) throw new ForbiddenException()
    if (['escalated', 'in_progress', 'resolved', 'closed'].includes(ticket.status)) {
      throw new BadRequestException('Ticket is already escalated or resolved')
    }

    await admin.from('support_tickets')
      .update({ status: 'escalated', escalated_at: new Date().toISOString() })
      .eq('id', ticketId)

    await admin.from('support_messages').insert({
      ticket_id:   ticketId,
      sender_type: 'bot',
      sender_id:   null,
      message:     'This ticket has been escalated to our support team. We\'ll respond within 24 hours.',
    })

    return { escalated: true }
  }

  // ── User resolves own ticket ───────────────────────────────────────────────

  async resolveTicket(ticketId: string, userId: string, resolutionNotes: string | undefined, token: string) {
    const client = this.supabase.forRequest(token)

    const { data: ticket } = await client
      .from('support_tickets')
      .select('id, submitted_by, tenant_id')
      .eq('id', ticketId)
      .single()

    if (!ticket) throw new NotFoundException()

    // Only ticket owner or super_admin can resolve
    if (ticket.submitted_by !== userId) {
      const { data: profile } = await client.from('profiles').select('role').eq('id', userId).single()
      if (profile?.role !== 'super_admin') throw new ForbiddenException()
    }

    const { data, error } = await this.supabase.serviceClient
      .from('support_tickets')
      .update({
        status:           'resolved',
        resolved_at:      new Date().toISOString(),
        resolution_notes: resolutionNotes ?? null,
      })
      .eq('id', ticketId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async closeTicket(ticketId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const { data: ticket } = await client
      .from('support_tickets')
      .select('id, submitted_by, status')
      .eq('id', ticketId)
      .single()

    if (!ticket) throw new NotFoundException()
    if (ticket.submitted_by !== userId) throw new ForbiddenException()
    if (ticket.status !== 'resolved') throw new BadRequestException('Ticket must be resolved before closing')

    const { data } = await this.supabase.serviceClient
      .from('support_tickets')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select('id, status')
      .single()

    return data
  }

  // ── Super Admin: all tickets ───────────────────────────────────────────────

  async getAllTickets(filters: {
    status?: string
    priority?: string
    tenant?: string
    limit?: number
    offset?: number
  } = {}) {
    let query = this.supabase.serviceClient
      .from('support_tickets')
      .select(`
        id, ticket_number, title, subject, description, status, priority,
        tenant_id, submitted_by, escalated_at, bot_faq_id,
        created_at, updated_at,
        tenant:tenant_id(name),
        submitter:submitted_by(full_name, email),
        _msg_count:support_messages(count)
      `)
      .not('submitted_by', 'is', null)   // only platform tickets (have submitted_by set)
      .order('created_at', { ascending: false })

    if (filters.status)   query = query.eq('status', filters.status)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.tenant)   query = query.eq('tenant_id', filters.tenant)
    if (filters.limit)    query = query.limit(filters.limit)
    if (filters.offset)   query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── Super Admin: reply to ticket ──────────────────────────────────────────

  async superAdminReply(ticketId: string, message: string, superAdminId: string) {
    const admin = this.supabase.serviceClient

    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .single()

    if (!ticket) throw new NotFoundException('Ticket not found')

    // Add super_admin message
    const { data: msg, error } = await admin
      .from('support_messages')
      .insert({
        ticket_id:   ticketId,
        sender_type: 'super_admin',
        sender_id:   superAdminId,
        message,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Move to in_progress if currently escalated/open
    if (['open', 'escalated', 'bot_handled'].includes(ticket.status)) {
      await admin.from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)
    }

    return msg
  }

  // ── Super Admin: resolve ticket ───────────────────────────────────────────

  async superAdminResolve(ticketId: string, resolutionNotes: string, superAdminId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('support_tickets')
      .update({
        status:           'resolved',
        resolved_at:      new Date().toISOString(),
        resolved_by:      superAdminId,
        resolution_notes: resolutionNotes,
      })
      .eq('id', ticketId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Add resolution message visible to user
    await this.supabase.serviceClient.from('support_messages').insert({
      ticket_id:   ticketId,
      sender_type: 'super_admin',
      sender_id:   superAdminId,
      message:     resolutionNotes
        ? `✅ Resolved: ${resolutionNotes}`
        : '✅ Your support request has been resolved. Please let us know if you need further assistance.',
    })

    return data
  }
}
