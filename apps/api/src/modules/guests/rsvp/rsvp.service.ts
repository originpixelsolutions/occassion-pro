import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { NotificationsService } from '../../notifications/notifications.service'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class RsvpService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Form CRUD ──────────────────────────────────────────────────────────────

  async listForms(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('rsvp_forms')
      .select(`*, rsvp_custom_questions(*)`)
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async getForm(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('rsvp_forms')
      .select(`*, rsvp_custom_questions(*)`)
      .eq('id', id).eq('tenant_id', tenantId).single()
    if (error || !data) throw new NotFoundException(`RSVP form ${id} not found`)
    return data
  }

  async createForm(tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { custom_questions, password, ...rest } = dto
    const payload: any = { ...rest, tenant_id: tenantId }
    if (password) {
      payload.password_protected = true
      payload.password_hash = await bcrypt.hash(password, 10)
    }
    const { data: form, error } = await db.from('rsvp_forms').insert(payload).select().single()
    if (error) throw new Error(error.message)

    if (custom_questions?.length) {
      const questions = custom_questions.map((q: any, i: number) => ({
        ...q, form_id: form.id, tenant_id: tenantId, sort_order: i,
      }))
      await db.from('rsvp_custom_questions').insert(questions)
    }
    return this.getForm(form.id, tenantId, token)
  }

  async updateForm(id: string, tenantId: string, dto: any, token: string) {
    const db = this.supabase.forRequest(token)
    const { custom_questions, password, ...rest } = dto
    const payload: any = { ...rest, updated_at: new Date().toISOString() }
    if (password) {
      payload.password_protected = true
      payload.password_hash = await bcrypt.hash(password, 10)
    }
    const { error } = await db.from('rsvp_forms')
      .update(payload).eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)

    if (custom_questions !== undefined) {
      // Replace all questions
      await db.from('rsvp_custom_questions').delete().eq('form_id', id)
      if (custom_questions.length) {
        const questions = custom_questions.map((q: any, i: number) => ({
          ...q, form_id: id, tenant_id: tenantId, sort_order: i,
        }))
        await db.from('rsvp_custom_questions').insert(questions)
      }
    }
    return this.getForm(id, tenantId, token)
  }

  // ── Public Form Access ──────────────────────────────────────────────────────

  async getPublicForm(slug: string, password?: string) {
    const db = this.supabase.serviceClient
    const { data: form, error } = await db.from('rsvp_forms')
      .select(`*, rsvp_custom_questions(*), events(id, name, start_date, end_date, venue_id)`)
      .eq('public_slug', slug).single()

    if (error || !form) throw new NotFoundException('RSVP form not found')
    if (!form.is_active) throw new ForbiddenException('This RSVP form is closed')

    if (form.deadline && new Date(form.deadline) < new Date()) {
      throw new ForbiddenException('RSVP deadline has passed')
    }

    if (form.max_responses) {
      const { count } = await db.from('rsvp_responses')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', form.id)
      if ((count ?? 0) >= form.max_responses) {
        throw new ForbiddenException('RSVP capacity is full')
      }
    }

    if (form.password_protected) {
      if (!password) throw new ForbiddenException('Password required')
      const ok = await bcrypt.compare(password, form.password_hash)
      if (!ok) throw new ForbiddenException('Incorrect password')
    }

    // Strip sensitive fields
    const { password_hash, ...safeForm } = form
    return safeForm
  }

  // ── RSVP Submission ────────────────────────────────────────────────────────

  async submitResponse(slug: string, dto: any, meta: { ip?: string; userAgent?: string }) {
    const db = this.supabase.serviceClient
    const { data: form } = await db.from('rsvp_forms')
      .select('id, tenant_id, event_id, moderation_enabled')
      .eq('public_slug', slug).single()
    if (!form) throw new NotFoundException('Form not found')

    const approvalStatus = form.moderation_enabled ? 'pending' : 'auto_approved'

    const { data: response, error } = await db.from('rsvp_responses').insert({
      ...dto,
      form_id: form.id,
      tenant_id: form.tenant_id,
      event_id: form.event_id,
      approval_status: approvalStatus,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    }).select().single()
    if (error) throw new Error(error.message)

    // Update guest RSVP status if linked
    if (response.guest_id) {
      await db.from('guests').update({
        rsvp_status: dto.attendance === 'yes' ? 'confirmed'
          : dto.attendance === 'no' ? 'declined' : 'maybe',
        rsvp_responded_at: new Date().toISOString(),
        meal_preference: dto.meal_preference,
        accommodation_status: dto.accommodation_needed ? 'requested' : 'not_required',
        transport_status: dto.transport_needed ? 'requested' : 'not_required',
      }).eq('id', response.guest_id).eq('tenant_id', form.tenant_id)
    }

    // Notify event manager(s) when attendance confirmed
    if (dto.attendance === 'yes') {
      this.resolveEventManagerIds(form.event_id, form.tenant_id).then(managerIds => {
        const guestName = (dto.full_name as string | undefined) ?? 'A guest'
        const isVip = Boolean(dto.is_vip)
        for (const managerId of managerIds) {
          this.notificationsService.sendNotification({
            tenantId: form.tenant_id,
            recipientId: managerId,
            recipientType: 'team',
            templateKey: 'guest_rsvp_confirmed',
            variables: { guestName, eventId: form.event_id, isVip: isVip ? 'true' : 'false' },
            eventId: form.event_id,
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return response
  }

  // ── Response Management ────────────────────────────────────────────────────

  async listResponses(formId: string, tenantId: string, token: string, opts: any = {}) {
    const db = this.supabase.forRequest(token)
    const { page = 1, pageSize = 50, attendance, approvalStatus } = opts
    const from = (page - 1) * pageSize
    let q = db.from('rsvp_responses')
      .select(`*, guests(id, full_name, email)`, { count: 'exact' })
      .eq('form_id', formId).eq('tenant_id', tenantId)
      .range(from, from + pageSize - 1)
    if (attendance) q = q.eq('attendance', attendance)
    if (approvalStatus) q = q.eq('approval_status', approvalStatus)
    const { data, count, error } = await q.order('submitted_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize }
  }

  async approveResponse(id: string, tenantId: string, userId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('rsvp_responses')
      .update({ approval_status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async rejectResponse(id: string, tenantId: string, userId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('rsvp_responses')
      .update({ approval_status: 'rejected', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async getResponseStats(formId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('rsvp_responses')
      .select('attendance, meal_preference, accommodation_needed, transport_needed')
      .eq('form_id', formId).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    return {
      total: rows.length,
      attendance: rows.reduce<Record<string, number>>((a, r) => {
        a[r.attendance] = (a[r.attendance] ?? 0) + 1; return a
      }, {}),
      meal: rows.reduce<Record<string, number>>((a, r) => {
        if (r.meal_preference) a[r.meal_preference] = (a[r.meal_preference] ?? 0) + 1; return a
      }, {}),
      accommodation_needed: rows.filter(r => r.accommodation_needed).length,
      transport_needed: rows.filter(r => r.transport_needed).length,
    }
  }

  private async resolveEventManagerIds(eventId: string, tenantId: string): Promise<string[]> {
    // First check if event has a specific assigned manager, else fall back to all tenant event_managers
    const db = this.supabase.serviceClient
    const { data: event } = await db.from('events').select('assigned_manager_id').eq('id', eventId).single()
    if (event?.assigned_manager_id) return [event.assigned_manager_id]
    const { data } = await db.from('user_roles').select('user_id')
      .eq('tenant_id', tenantId).eq('role', 'event_manager')
    return (data ?? []).map((r: any) => r.user_id)
  }
}
