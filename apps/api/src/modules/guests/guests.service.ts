import { Injectable, NotFoundException } from '@nestjs/common'
import { SubscriptionService } from '../subscription/subscription.service'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class GuestsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly subscriptionSvc: SubscriptionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(eventId: string, tenantId: string, token: string, options: any = {}) {
    const { page = 1, pageSize = 50, rsvpStatus, categoryId, search } = options
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const client = this.supabase.forRequest(token)

    let query = client
      .from('guests')
      .select(`*, guest_categories(id, name, color, badge_color)`, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('full_name')
      .range(from, to)

    if (rsvpStatus) query = query.eq('rsvp_status', rsvpStatus)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (search) query = query.ilike('full_name', `%${search}%`)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return {
      data: data ?? [],
      count: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    }
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guests')
      .select(`*, guest_categories(*), checkin_logs(*)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error || !data) throw new NotFoundException(`Guest ${id} not found`)
    return data
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)

    // Check guests-per-event limit
    if (dto.event_id && dto.tenant_id) {
      const { count } = await client
        .from('guests')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', dto.event_id)
        .eq('tenant_id', dto.tenant_id)
      await this.subscriptionSvc.checkLimit(dto.tenant_id, 'guests_per_event', count ?? 0)
    }

    const { data, error } = await client.from('guests').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async bulkImport(guests: any[], eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const enriched = guests.map((g) => ({ ...g, event_id: eventId, tenant_id: tenantId, source: 'imported' }))
    const { data, error } = await client.from('guests').insert(enriched).select()
    if (error) throw new Error(error.message)
    return { imported: data?.length ?? 0, data }
  }

  async update(id: string, tenantId: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guests').update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error || !data) throw new NotFoundException(`Guest ${id} not found`)
    return data
  }

  async getRsvpStats(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guests')
      .select('rsvp_status')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(error.message)
    const stats = (data ?? []).reduce<Record<string, number>>((acc, g) => {
      acc[g.rsvp_status] = (acc[g.rsvp_status] ?? 0) + 1
      return acc
    }, {})
    return { total: data?.length ?? 0, breakdown: stats }
  }

  async remove(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('guests').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  async checkIn(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guests')
      .update({ checked_in: true, check_in_time: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    // Fire-and-forget: notify event team that a guest has checked in
    if (data?.event_id) {
      this.resolveEventManagerIds(data.event_id, tenantId).then(managerIds => {
        for (const managerId of managerIds) {
          this.notificationsService.sendNotification({
            tenantId,
            recipientId: managerId,
            recipientType: 'team',
            templateKey: 'guest_checkin_welcome',
            variables: { guestName: data.full_name ?? 'A guest', eventId: data.event_id },
            eventId: data.event_id,
          }).catch(() => {})
        }
      }).catch(() => {})
    }
    return data
  }

  private async resolveEventManagerIds(eventId: string, tenantId: string): Promise<string[]> {
    const db = this.supabase.serviceClient
    const { data: event } = await db.from('events').select('assigned_manager_id').eq('id', eventId).single()
    if (event?.assigned_manager_id) return [event.assigned_manager_id]
    const { data } = await db.from('user_roles').select('user_id')
      .eq('tenant_id', tenantId).eq('role', 'event_manager')
    return (data ?? []).map((r: any) => r.user_id)
  }

  async findAllTenant(tenantId: string, token: string, options: any = {}) {
    const { search, rsvpStatus } = options
    const client = this.supabase.forRequest(token)
    let query = client.from('guests').select('*', { count: 'exact' })
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (rsvpStatus) query = query.eq('rsvp_status', rsvpStatus)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0 }
  }

  // ── Copy between events ──────────────────────────────────────────────────────

  async previewCopy(
    sourceEventId: string,
    targetEventId: string,
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)

    // Fetch source guests
    const { data: sourceGuests, error: srcErr } = await client
      .from('guests')
      .select('id, full_name, email, phone, rsvp_status, category_id, table_no, dietary_requirements, guest_categories(name, color)')
      .eq('event_id', sourceEventId)
      .eq('tenant_id', tenantId)
      .order('full_name')
    if (srcErr) throw new Error(srcErr.message)

    // Fetch existing target guest emails + phones for duplicate detection
    const { data: targetGuests, error: tgtErr } = await client
      .from('guests')
      .select('id, full_name, email, phone')
      .eq('event_id', targetEventId)
      .eq('tenant_id', tenantId)
    if (tgtErr) throw new Error(tgtErr.message)

    const targetEmails = new Set((targetGuests ?? []).map((g: any) => g.email?.toLowerCase()).filter(Boolean))
    const targetPhones = new Set((targetGuests ?? []).map((g: any) => g.phone?.replace(/\s/g, '')).filter(Boolean))

    const preview = (sourceGuests ?? []).map((g: any) => {
      const emailMatch = g.email && targetEmails.has(g.email.toLowerCase())
      const phoneMatch = g.phone && targetPhones.has(g.phone.replace(/\s/g, ''))
      const isDuplicate = emailMatch || phoneMatch
      return {
        ...g,
        is_duplicate: isDuplicate,
        duplicate_reason: emailMatch ? 'email' : phoneMatch ? 'phone' : null,
      }
    })

    const duplicateCount = preview.filter((g: any) => g.is_duplicate).length
    return {
      total: preview.length,
      duplicates: duplicateCount,
      new: preview.length - duplicateCount,
      guests: preview,
    }
  }

  async copyGuests(
    sourceEventId: string,
    targetEventId: string,
    tenantId: string,
    requestedBy: string,
    duplicateStrategy: 'skip' | 'overwrite' | 'add_anyway',
    token: string,
  ) {
    const client = this.supabase.forRequest(token)

    // Create job record
    const { data: job, error: jobErr } = await client
      .from('guest_copy_jobs')
      .insert({
        tenant_id: tenantId,
        source_event_id: sourceEventId,
        target_event_id: targetEventId,
        requested_by: requestedBy,
        duplicate_strategy: duplicateStrategy,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (jobErr) throw new Error(jobErr.message)

    try {
      // Fetch source guests (all fields we want to copy)
      const { data: sourceGuests, error: srcErr } = await client
        .from('guests')
        .select('full_name, email, phone, rsvp_status, category_id, table_no, meal_preference, dietary_requirements, notes, tags, plus_one_allowed, is_vip')
        .eq('event_id', sourceEventId)
        .eq('tenant_id', tenantId)
      if (srcErr) throw new Error(srcErr.message)

      // Fetch existing targets for duplicate check
      const { data: targetGuests } = await client
        .from('guests')
        .select('id, email, phone')
        .eq('event_id', targetEventId)
        .eq('tenant_id', tenantId)

      const targetByEmail = new Map((targetGuests ?? [])
        .filter((g: any) => g.email)
        .map((g: any) => [g.email.toLowerCase(), g.id]))
      const targetByPhone = new Map((targetGuests ?? [])
        .filter((g: any) => g.phone)
        .map((g: any) => [g.phone.replace(/\s/g, ''), g.id]))

      let copied = 0, skipped = 0, overwritten = 0

      for (const g of (sourceGuests ?? [])) {
        const emailDup = g.email ? targetByEmail.get(g.email.toLowerCase()) : null
        const phoneDup = g.phone ? targetByPhone.get(g.phone?.replace(/\s/g, '')) : null
        const existingId = emailDup || phoneDup

        if (existingId && duplicateStrategy === 'skip') {
          skipped++
          continue
        }

        const payload = {
          ...g,
          event_id: targetEventId,
          tenant_id: tenantId,
          source: 'copied',
          copied_from_event_id: sourceEventId,
          copy_job_id: job.id,
          // Reset check-in state for the new event
          checked_in: false,
          check_in_time: null,
          rsvp_status: 'pending',
          rsvp_token: null,
          rsvp_responded_at: null,
          invited_at: null,
        }

        if (existingId && duplicateStrategy === 'overwrite') {
          const { error } = await client
            .from('guests')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', existingId)
          if (!error) overwritten++
        } else {
          const { error } = await client.from('guests').insert(payload)
          if (!error) copied++
        }
      }

      // Update job with outcome
      await client
        .from('guest_copy_jobs')
        .update({
          status: 'completed',
          total_guests: (sourceGuests ?? []).length,
          copied_count: copied,
          skipped_count: skipped,
          overwritten_count: overwritten,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      return { jobId: job.id, total: (sourceGuests ?? []).length, copied, skipped, overwritten }
    } catch (err: any) {
      await client
        .from('guest_copy_jobs')
        .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
        .eq('id', job.id)
      throw err
    }
  }

  async getCopyJobs(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('guest_copy_jobs')
      .select(`*, source_event:events!source_event_id(id, name), target_event:events!target_event_id(id, name)`)
      .or(`source_event_id.eq.${eventId},target_event_id.eq.${eventId}`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)
    return data ?? []
  }
}
