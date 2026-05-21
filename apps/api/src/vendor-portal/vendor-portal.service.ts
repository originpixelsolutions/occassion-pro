import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'

@Injectable()
export class VendorPortalService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.serviceClient }

  // ── Profile ───────────────────────────────────────────────────────────────

  async getProfile(vendorId: string) {
    const { data, error } = await this.db
      .from('vendor_accounts')
      .select('id, email, name, business_name, phone, category, website, bio, avatar_url, gstin, bank_account_name, bank_ifsc, profile_complete, created_at')
      .eq('id', vendorId)
      .single()
    if (error || !data) throw new NotFoundException('Vendor not found.')
    return data
  }

  async updateProfile(vendorId: string, dto: {
    name?: string; business_name?: string; phone?: string; category?: string;
    website?: string; bio?: string; avatar_url?: string; gstin?: string;
  }) {
    const updates: Record<string, any> = {}
    if (dto.name !== undefined) updates.name = dto.name.trim()
    if (dto.business_name !== undefined) updates.business_name = dto.business_name.trim() || null
    if (dto.phone !== undefined) updates.phone = dto.phone.trim() || null
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.website !== undefined) updates.website = dto.website.trim() || null
    if (dto.bio !== undefined) updates.bio = dto.bio.trim() || null
    if (dto.avatar_url !== undefined) updates.avatar_url = dto.avatar_url || null
    if (dto.gstin !== undefined) updates.gstin = dto.gstin.trim() || null

    const { data, error } = await this.db
      .from('vendor_accounts')
      .update(updates)
      .eq('id', vendorId)
      .select('id, email, name, business_name, phone, category, website, bio, avatar_url, gstin, bank_account_name, bank_ifsc, profile_complete')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateBankDetails(vendorId: string, dto: { bank_account_name: string; bank_account_number: string; bank_ifsc: string }) {
    const { data, error } = await this.db
      .from('vendor_accounts')
      .update({
        bank_account_name: dto.bank_account_name.trim(),
        bank_account_number: dto.bank_account_number.trim(),
        bank_ifsc: dto.bank_ifsc.trim().toUpperCase(),
      })
      .eq('id', vendorId)
      .select('id, bank_account_name, bank_ifsc')
      .single()
    if (error) throw new BadRequestException(error.message)
    return { message: 'Bank details updated.', ...data }
  }

  // ── My Events (all assignments across all tenants) ────────────────────────

  async getMyEvents(vendorId: string, statusFilter?: string) {
    let query = this.db
      .from('vendor_event_assignments')
      .select(`
        id, status, service_description, agreed_amount, currency_code,
        invited_at, confirmed_at, completed_at, responded_at,
        event:events (
          id, name, start_date, end_date, venue_name, city, status,
          workspace:tenants ( id, name, logo_url )
        )
      `)
      .eq('vendor_id', vendorId)
      .order('invited_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)

    const now = new Date()
    const all = data || []
    const pending = all.filter((a: any) => a.status === 'invited')
    const active = all.filter((a: any) =>
      ['confirmed', 'in_progress'].includes(a.status) &&
      a.event?.start_date && new Date(a.event.start_date) <= now
    )
    const upcoming = all.filter((a: any) =>
      ['confirmed', 'in_progress'].includes(a.status) &&
      a.event?.start_date && new Date(a.event.start_date) > now
    )
    const completed = all.filter((a: any) => a.status === 'completed')
    const declined = all.filter((a: any) => ['declined', 'cancelled'].includes(a.status))

    return { assignments: all, pending, active, upcoming, completed, declined }
  }

  async getAssignmentDetail(vendorId: string, assignmentId: string) {
    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .select(`
        id, status, service_description, agreed_amount, currency_code,
        vendor_response_note, responded_at, vendor_notes,
        invited_at, confirmed_at, completed_at,
        event:events (
          id, name, description, start_date, end_date, venue_name, city, timezone,
          workspace:tenants ( id, name, logo_url )
        ),
        assigned_by_profile:profiles!vendor_event_assignments_assigned_by_fkey (
          id, full_name, avatar_url
        )
      `)
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (error || !data) throw new NotFoundException('Assignment not found.')
    return data
  }

  async respondToInvitation(vendorId: string, assignmentId: string, dto: { response: 'confirmed' | 'declined'; note?: string }) {
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, status')
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')
    if (assignment.status !== 'invited') throw new BadRequestException(`Cannot respond to assignment in status: ${assignment.status}`)

    const updates: Record<string, any> = {
      status: dto.response,
      vendor_response_note: dto.note?.trim() || null,
      responded_at: new Date().toISOString(),
    }
    if (dto.response === 'confirmed') updates.confirmed_at = new Date().toISOString()

    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select('id, status, responded_at')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async getMessages(vendorId: string, assignmentId: string) {
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id')
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data: messages, error } = await this.db
      .from('vendor_messages')
      .select('id, sender_type, sender_id, content, is_read_by_vendor, is_read_by_team, created_at')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true })
    if (error) throw new BadRequestException(error.message)

    // Mark team messages as read by vendor
    this.db
      .from('vendor_messages')
      .update({ is_read_by_vendor: true })
      .eq('assignment_id', assignmentId)
      .eq('sender_type', 'team')
      .eq('is_read_by_vendor', false)
      .then(() => {})

    return { messages: messages || [] }
  }

  async sendMessage(vendorId: string, assignmentId: string, content: string) {
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, status')
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')
    if (['cancelled', 'declined'].includes(assignment.status)) {
      throw new ForbiddenException('Cannot send messages for cancelled/declined assignments.')
    }

    const { data, error } = await this.db
      .from('vendor_messages')
      .insert({ assignment_id: assignmentId, sender_type: 'vendor', sender_id: vendorId, content: content.trim() })
      .select('id, sender_type, content, created_at')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getAggregatedMessages(vendorId: string) {
    const { data: assignments, error } = await this.db
      .from('vendor_event_assignments')
      .select(`id, status, event:events ( id, name )`)
      .eq('vendor_id', vendorId)
      .not('status', 'in', '("declined","cancelled")')
      .order('invited_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)

    const assignmentIds = (assignments || []).map((a: any) => a.id)
    if (!assignmentIds.length) return { threads: [] }

    const { data: allMessages } = await this.db
      .from('vendor_messages')
      .select('id, assignment_id, sender_type, content, created_at, is_read_by_vendor')
      .in('assignment_id', assignmentIds)
      .order('created_at', { ascending: false })

    const byAssignment: Record<string, any[]> = {}
    for (const m of allMessages || []) {
      if (!byAssignment[m.assignment_id]) byAssignment[m.assignment_id] = []
      byAssignment[m.assignment_id].push(m)
    }

    const threads = (assignments || []).map((a: any) => {
      const msgs = byAssignment[a.id] || []
      return {
        assignment_id: a.id,
        event: a.event,
        status: a.status,
        latest_message: msgs[0] || null,
        unread_count: msgs.filter((m: any) => m.sender_type === 'team' && !m.is_read_by_vendor).length,
        total_messages: msgs.length,
      }
    })

    return { threads }
  }

  // ── Performance ───────────────────────────────────────────────────────────

  async getPerformanceScore(vendorId: string) {
    const { data } = await this.db
      .from('vendor_performance_scores')
      .select('*')
      .eq('vendor_id', vendorId)
      .maybeSingle()
    return data || { vendor_id: vendorId, total_assignments: 0, completed_assignments: 0, avg_rating: null, score: 0 }
  }

  async getPaymentHistory(vendorId: string) {
    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .select(`id, agreed_amount, currency_code, status, completed_at, event:events ( id, name, start_date )`)
      .eq('vendor_id', vendorId)
      .not('agreed_amount', 'is', null)
      .order('invited_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return { payments: data || [] }
  }

  // ── Staff: vendor search + assignment management ──────────────────────────

  async searchVendors(query: string, category?: string) {
    let q = this.db
      .from('vendor_accounts')
      .select('id, name, business_name, email, category, phone, is_active, profile_complete, avatar_url')
      .eq('is_active', true)
    if (query.trim()) {
      q = q.or(`name.ilike.%${query}%,business_name.ilike.%${query}%,email.ilike.%${query}%`)
    }
    if (category) q = q.eq('category', category)
    const { data, error } = await q.limit(20)
    if (error) throw new BadRequestException(error.message)
    return { vendors: data || [] }
  }

  async getEventAssignments(tenantId: string, eventId: string) {
    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .select(`
        id, status, service_description, agreed_amount, currency_code,
        vendor_notes, tenant_rating, invited_at, confirmed_at, completed_at,
        vendor:vendor_accounts ( id, name, business_name, email, category, phone, avatar_url )
      `)
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('invited_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)

    // Attach unread counts per assignment
    const ids = (data || []).map((a: any) => a.id)
    const { data: unreadData } = ids.length
      ? await this.db
          .from('vendor_messages')
          .select('assignment_id')
          .in('assignment_id', ids)
          .eq('sender_type', 'vendor')
          .eq('is_read_by_team', false)
      : { data: [] }

    const unreadCounts: Record<string, number> = {}
    for (const m of unreadData || []) {
      unreadCounts[m.assignment_id] = (unreadCounts[m.assignment_id] || 0) + 1
    }

    return { assignments: (data || []).map((a: any) => ({ ...a, unread_messages: unreadCounts[a.id] || 0 })) }
  }

  async assignVendor(tenantId: string, eventId: string, assignedBy: string, dto: {
    vendor_id?: string; vendor_email?: string; vendor_name?: string; vendor_category?: string;
    service_description?: string; agreed_amount?: number; currency_code?: string;
  }) {
    let vendorId = dto.vendor_id
    let isNew = false

    if (!vendorId && dto.vendor_email) {
      const normalEmail = dto.vendor_email.toLowerCase().trim()
      const { data: existing } = await this.db
        .from('vendor_accounts')
        .select('id')
        .eq('email', normalEmail)
        .maybeSingle()

      if (existing) {
        vendorId = existing.id
      } else {
        const { data: newVendor, error } = await this.db
          .from('vendor_accounts')
          .insert({ email: normalEmail, name: dto.vendor_name || normalEmail, category: dto.vendor_category || 'Other' })
          .select('id')
          .single()
        if (error) throw new BadRequestException(error.message)
        vendorId = newVendor.id
        isNew = true
      }
    }

    if (!vendorId) throw new BadRequestException('vendor_id or vendor_email is required.')

    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .upsert({
        vendor_id: vendorId, event_id: eventId, tenant_id: tenantId,
        service_description: dto.service_description?.trim() || null,
        agreed_amount: dto.agreed_amount || null,
        currency_code: dto.currency_code || 'INR',
        assigned_by: assignedBy, status: 'invited',
      }, { onConflict: 'vendor_id,event_id' })
      .select(`id, status, service_description, agreed_amount, vendor:vendor_accounts ( id, name, email )`)
      .single()
    if (error) throw new BadRequestException(error.message)
    return { assignment: data, is_new_vendor: isNew, vendor_id: vendorId }
  }

  async updateAssignment(tenantId: string, assignmentId: string, dto: {
    status?: string; tenant_rating?: number; vendor_notes?: string;
    service_description?: string; agreed_amount?: number;
  }) {
    const updates: Record<string, any> = {}
    if (dto.status) {
      updates.status = dto.status
      if (dto.status === 'completed') updates.completed_at = new Date().toISOString()
    }
    if (dto.tenant_rating !== undefined) updates.tenant_rating = dto.tenant_rating
    if (dto.vendor_notes !== undefined) updates.vendor_notes = dto.vendor_notes
    if (dto.service_description !== undefined) updates.service_description = dto.service_description
    if (dto.agreed_amount !== undefined) updates.agreed_amount = dto.agreed_amount

    const { data, error } = await this.db
      .from('vendor_event_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .select('id, status, tenant_rating')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Vendor Quotes ────────────────────────────────────────────────────────

  async submitQuote(vendorId: string, assignmentId: string, dto: {
    service_description: string
    amount: number
    currency_code?: string
    notes?: string
    file_url?: string
  }) {
    // Verify the assignment belongs to this vendor
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, vendor_id, status')
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data, error } = await this.db
      .from('vendor_quotes')
      .insert({
        assignment_id: assignmentId,
        vendor_id: vendorId,
        service_description: dto.service_description.trim(),
        amount: dto.amount,
        currency_code: dto.currency_code?.trim() || 'INR',
        notes: dto.notes?.trim() || null,
        file_url: dto.file_url?.trim() || null,
        status: 'submitted',
      })
      .select('id, service_description, amount, currency_code, notes, file_url, status, created_at')
      .single()
    if (error) throw new BadRequestException(error.message)
    return { quote: data }
  }

  async getQuotes(vendorId: string, assignmentId: string) {
    // Verify the assignment belongs to this vendor
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, vendor_id')
      .eq('id', assignmentId)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data, error } = await this.db
      .from('vendor_quotes')
      .select('id, service_description, amount, currency_code, notes, file_url, status, review_note, reviewed_at, created_at')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return { quotes: data || [] }
  }

  // ── Staff: messages ───────────────────────────────────────────────────────

  async staffGetMessages(tenantId: string, assignmentId: string) {
    // Verify the assignment belongs to this tenant
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data: messages, error } = await this.db
      .from('vendor_messages')
      .select('id, sender_type, sender_id, content, is_read_by_vendor, is_read_by_team, created_at')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true })
    if (error) throw new BadRequestException(error.message)

    // Mark vendor messages as read by team
    this.db
      .from('vendor_messages')
      .update({ is_read_by_team: true })
      .eq('assignment_id', assignmentId)
      .eq('sender_type', 'vendor')
      .eq('is_read_by_team', false)
      .then(() => {})

    return { messages: messages || [] }
  }

  async staffSendMessage(tenantId: string, assignmentId: string, userId: string, content: string) {
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, status')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data, error } = await this.db
      .from('vendor_messages')
      .insert({
        assignment_id: assignmentId,
        sender_type: 'team',
        sender_id: userId,
        content: content.trim(),
      })
      .select('id, sender_type, content, created_at')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Staff: quote management ───────────────────────────────────────────────

  async staffGetAssignmentQuotes(tenantId: string, assignmentId: string) {
    // Verify the assignment belongs to this tenant
    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id, vendor_id, event_id')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!assignment) throw new NotFoundException('Assignment not found.')

    const { data, error } = await this.db
      .from('vendor_quotes')
      .select(`
        id, service_description, amount, currency_code, notes, file_url,
        status, review_note, reviewed_at, created_at, updated_at,
        vendor:vendor_accounts ( id, name, business_name, email ),
        reviewer:profiles!vendor_quotes_reviewed_by_fkey ( id, full_name, avatar_url )
      `)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return { quotes: data || [] }
  }

  async staffReviewQuote(
    tenantId: string,
    quoteId: string,
    reviewerId: string,
    dto: { status: 'approved' | 'rejected' | 'under_review'; review_note?: string },
  ) {
    // Verify the quote belongs to an assignment in this tenant
    const { data: quote } = await this.db
      .from('vendor_quotes')
      .select('id, assignment_id, status')
      .eq('id', quoteId)
      .maybeSingle()
    if (!quote) throw new NotFoundException('Quote not found.')

    const { data: assignment } = await this.db
      .from('vendor_event_assignments')
      .select('id')
      .eq('id', quote.assignment_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!assignment) throw new ForbiddenException('Access denied.')

    const { data, error } = await this.db
      .from('vendor_quotes')
      .update({
        status: dto.status,
        review_note: dto.review_note?.trim() || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select('id, status, review_note, reviewed_at')
      .single()
    if (error) throw new BadRequestException(error.message)
    return { quote: data }
  }

  async staffGetAllEventQuotes(tenantId: string, eventId: string) {
    // Get all assignments for this event
    const { data: assignments } = await this.db
      .from('vendor_event_assignments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
    if (!assignments?.length) return { quotes: [] }

    const assignmentIds = assignments.map((a: any) => a.id)
    const { data, error } = await this.db
      .from('vendor_quotes')
      .select(`
        id, assignment_id, service_description, amount, currency_code, notes, file_url,
        status, review_note, reviewed_at, created_at,
        vendor:vendor_accounts ( id, name, business_name, email )
      `)
      .in('assignment_id', assignmentIds)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return { quotes: data || [] }
  }
}