import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import {
  UpdateChecklistItemDto, MarkAttendedDto, UpdateSettlementDto,
  MarkPaidDto, SendThankYouDto, CreateSurveyDto, SubmitSurveyResponseDto,
  CreateTestimonialDto, GenerateReportDto, ReportType,
} from './dto/post-event.dto'

@Injectable()
export class PostEventService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(tenant: string) {
    return this.supabase.forRequest(tenant)
  }

  // ─── 1. Overall Status ──────────────────────────────────────────────────────

  async getStatus(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const [event, checklist, settlements, reports] = await Promise.all([
      db.from('events').select('*').eq('id', eventId).single(),
      db.from('post_event_checklist').select('is_completed').eq('event_id', eventId),
      db.from('vendor_settlements').select('payment_status').eq('event_id', eventId),
      db.from('post_event_reports').select('report_type').eq('event_id', eventId),
    ])

    const total = checklist.data?.length ?? 0
    const done  = checklist.data?.filter(i => i.is_completed).length ?? 0
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0

    const allSettlementsPaid = settlements.data?.length > 0 &&
      settlements.data.every(s => s.payment_status === 'paid')

    return {
      event: event.data,
      checklist_completion_pct: pct,
      checklist_total: total,
      checklist_done: done,
      vendors_settled: allSettlementsPaid,
      internal_report_generated: reports.data?.some(r => r.report_type === 'internal') ?? false,
      client_report_generated: reports.data?.some(r => r.report_type === 'client') ?? false,
      is_archived: event.data?.is_archived ?? false,
    }
  }

  // ─── 2. Wrap-up Checklist ───────────────────────────────────────────────────

  async getChecklist(tenant: string, eventId: string) {
    const db = this.client(tenant)

    // Seed if not done yet
    const { data: settings } = await db.from('post_event_settings')
      .select('checklist_seeded').eq('event_id', eventId).single()

    if (settings && !settings.checklist_seeded) {
      await db.rpc('seed_post_event_checklist', { p_event_id: eventId })
      await db.from('post_event_settings').update({ checklist_seeded: true }).eq('event_id', eventId)
    }

    const { data, error } = await db.from('post_event_checklist')
      .select('*, completed_by_user:users!completed_by(id,first_name,last_name)')
      .eq('event_id', eventId)
      .order('category').order('sort_order')

    if (error) throw new BadRequestException(error.message)

    // Group by category
    const grouped = (data ?? []).reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = []
      acc[item.category].push(item)
      return acc
    }, {})

    const total = data?.length ?? 0
    const done  = data?.filter(i => i.is_completed).length ?? 0

    return { items: data ?? [], grouped, total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 }
  }

  async updateChecklistItem(tenant: string, itemId: string, dto: UpdateChecklistItemDto, userId: string) {
    const db = this.client(tenant)
    const update: any = {
      is_completed: dto.is_completed,
      notes: dto.notes,
    }
    if (dto.is_completed) {
      update.completed_by = userId
      update.completed_at = new Date().toISOString()
    } else {
      update.completed_by = null
      update.completed_at = null
    }
    const { data, error } = await db.from('post_event_checklist')
      .update(update).eq('id', itemId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async completeAllChecklist(tenant: string, eventId: string, userId: string) {
    const db = this.client(tenant)
    const { error } = await db.from('post_event_checklist').update({
      is_completed: true,
      completed_by: userId,
      completed_at: new Date().toISOString(),
    }).eq('event_id', eventId).eq('is_completed', false)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  async resetChecklist(tenant: string, eventId: string) {
    const db = this.client(tenant)
    await db.from('post_event_checklist').update({
      is_completed: false, completed_by: null, completed_at: null, notes: null,
    }).eq('event_id', eventId)
    return { success: true }
  }

  // ─── 3. Headcount Reconciliation ────────────────────────────────────────────

  async getHeadcountRecon(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data: guests, error } = await db.from('guests')
      .select('id,first_name,last_name,email,phone,status,category,table_assignment,checked_in,checked_in_at,is_vip,plus_ones_count')
      .eq('event_id', eventId)

    if (error) throw new BadRequestException(error.message)
    const all = guests ?? []

    const invited   = all.length
    const confirmed = all.filter(g => ['confirmed','attended'].includes(g.status)).length
    const attended  = all.filter(g => g.checked_in === true || g.status === 'attended').length
    const noShow    = confirmed - attended
    const walkIn    = all.filter(g => g.status === 'attended' && !g.checked_in_at).length

    // By category
    const byCategory = all.reduce((acc: any, g: any) => {
      const cat = g.category ?? 'uncategorised'
      if (!acc[cat]) acc[cat] = { invited: 0, confirmed: 0, attended: 0, no_show: 0 }
      acc[cat].invited++
      if (['confirmed','attended'].includes(g.status)) acc[cat].confirmed++
      if (g.checked_in || g.status === 'attended') acc[cat].attended++
      else if (['confirmed','attended'].includes(g.status)) acc[cat].no_show++
      return acc
    }, {})

    return { invited, confirmed, attended, no_show: noShow, walk_in: walkIn, by_category: byCategory, guests: all }
  }

  async markAttended(tenant: string, eventId: string, dto: MarkAttendedDto) {
    const db = this.client(tenant)
    const { error } = await db.from('guests')
      .update({ checked_in: true, status: 'attended', checked_in_at: new Date().toISOString() })
      .eq('event_id', eventId).in('id', dto.guest_ids)
    if (error) throw new BadRequestException(error.message)
    return { updated: dto.guest_ids.length }
  }

  // ─── 4. Budget Reconciliation ────────────────────────────────────────────────

  async getBudgetRecon(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const [budgetRes, expenseRes] = await Promise.all([
      db.from('budgets').select('*').eq('event_id', eventId).order('category'),
      db.from('expenses').select('*').eq('event_id', eventId),
    ])

    const budgets  = budgetRes.data  ?? []
    const expenses = expenseRes.data ?? []

    // Merge by category
    const categories = [...new Set([
      ...budgets.map((b: any) => b.category),
      ...expenses.map((e: any) => e.category),
    ])]

    const rows = categories.map(cat => {
      const budgeted = budgets.filter((b: any) => b.category === cat)
        .reduce((s: number, b: any) => s + (b.amount ?? 0), 0)
      const actual = expenses.filter((e: any) => e.category === cat)
        .reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
      return { category: cat, budgeted, actual, variance: budgeted - actual, variance_pct: budgeted > 0 ? ((budgeted - actual) / budgeted * 100).toFixed(1) : '0' }
    })

    const totals = rows.reduce((acc: any, r: any) => ({
      budgeted: acc.budgeted + r.budgeted,
      actual:   acc.actual   + r.actual,
    }), { budgeted: 0, actual: 0 })

    return {
      rows,
      total_budgeted: totals.budgeted,
      total_actual:   totals.actual,
      total_variance: totals.budgeted - totals.actual,
      total_variance_pct: totals.budgeted > 0 ? ((totals.budgeted - totals.actual) / totals.budgeted * 100).toFixed(1) : '0',
    }
  }

  async finalizeBudget(tenant: string, eventId: string) {
    const db = this.client(tenant)
    await db.from('events').update({ budget_finalized: true }).eq('id', eventId)
    return { success: true }
  }

  // ─── 5. Vendor Settlements ───────────────────────────────────────────────────

  async getSettlements(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data, error } = await db.from('vendor_settlements')
      .select(`*, assignment:vendor_event_assignments(id, vendor:vendors(id,name,category,phone,email))`)
      .eq('event_id', eventId)
      .order('created_at')
    if (error) throw new BadRequestException(error.message)

    const total_agreed = (data ?? []).reduce((s: number, r: any) => s + (r.agreed_amount ?? 0), 0)
    const total_final  = (data ?? []).reduce((s: number, r: any) => s + (r.final_amount  ?? 0), 0)
    const total_paid   = (data ?? []).filter(r => r.payment_status === 'paid').reduce((s: number, r: any) => s + (r.final_amount ?? 0), 0)

    return { settlements: data ?? [], total_agreed, total_final, total_paid, outstanding: total_final - total_paid }
  }

  async updateSettlement(tenant: string, settlementId: string, dto: UpdateSettlementDto) {
    const db = this.client(tenant)
    const { data, error } = await db.from('vendor_settlements')
      .update({ ...dto, updated_at: new Date().toISOString() }).eq('id', settlementId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async markPaid(tenant: string, settlementId: string, dto: MarkPaidDto) {
    const db = this.client(tenant)
    const { data, error } = await db.from('vendor_settlements')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString(), payment_method: dto.payment_method, receipt_url: dto.receipt_url, notes: dto.notes, updated_at: new Date().toISOString() })
      .eq('id', settlementId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async syncSettlementsFromAssignments(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data: assignments } = await db.from('vendor_event_assignments')
      .select('id, agreed_amount').eq('event_id', eventId)

    for (const a of assignments ?? []) {
      await db.from('vendor_settlements').upsert({
        event_id: eventId,
        vendor_assignment_id: a.id,
        agreed_amount: a.agreed_amount ?? 0,
        final_amount:  a.agreed_amount ?? 0,
        payment_status: 'pending',
      }, { onConflict: 'vendor_assignment_id', ignoreDuplicates: true })
    }
    return { synced: (assignments ?? []).length }
  }

  // ─── 6. Thank-You Communications ────────────────────────────────────────────

  async sendThankYouMessages(tenant: string, eventId: string, dto: SendThankYouDto) {
    const db = this.client(tenant)

    let query = db.from('guests').select('id,first_name,last_name,email,phone').eq('event_id', eventId)
    if (dto.guest_filter === 'attended') query = query.eq('status', 'attended')
    if (dto.guest_filter === 'vip')      query = query.eq('is_vip', true)

    const { data: guests } = await query
    const guestList = guests ?? []

    // Build personalised messages (execution would route to actual messaging service)
    const messages = guestList.map((g: any) => ({
      recipient_id:   g.id,
      recipient_name: `${g.first_name} ${g.last_name}`,
      email:          g.email,
      phone:          g.phone,
      message:        dto.message
        .replace('{guest_name}', `${g.first_name} ${g.last_name}`)
        .replace('{event_name}', ''),
      channels: dto.channels,
    }))

    // Record send activity
    await db.from('post_event_checklist')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('item_key', 'guests_thank_you')

    return { queued: messages.length, channels: dto.channels, messages }
  }

  // ─── 7. Survey Results ───────────────────────────────────────────────────────

  async createSurvey(tenant: string, eventId: string, dto: CreateSurveyDto) {
    const db = this.client(tenant)
    const { data, error } = await db.from('event_surveys').insert({ event_id: eventId, ...dto }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getSurveys(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data, error } = await db.from('event_surveys').select('*').eq('event_id', eventId).order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getSurveyResults(tenant: string, surveyId: string) {
    const db = this.client(tenant)
    const [surveyRes, responsesRes] = await Promise.all([
      db.from('event_surveys').select('*').eq('id', surveyId).single(),
      db.from('survey_responses').select('*').eq('survey_id', surveyId),
    ])

    const survey    = surveyRes.data
    const responses = responsesRes.data ?? []
    const total     = responses.length

    if (!survey) throw new NotFoundException('Survey not found')

    // Aggregate answers per question
    const questions = (survey.questions as any[]) ?? []
    const aggregated = questions.map((q: any) => {
      const answers = responses.map(r => (r.answers as any)[q.id]).filter(a => a !== undefined)

      if (q.type === 'rating') {
        const nums = answers.map(Number).filter(n => !isNaN(n))
        const avg = nums.length > 0 ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2) : null
        return { ...q, total_responses: answers.length, average: avg, distribution: this.ratingDistribution(nums) }
      }

      if (q.type === 'multiple_choice') {
        const counts: Record<string, number> = {}
        answers.forEach(a => { counts[String(a)] = (counts[String(a)] ?? 0) + 1 })
        return { ...q, total_responses: answers.length, counts }
      }

      // text
      return { ...q, total_responses: answers.length, sample_answers: answers.slice(0, 20) }
    })

    // Overall NPS / avg rating
    const ratingQs = aggregated.filter(q => q.type === 'rating' && q.average !== null)
    const overallAvg = ratingQs.length > 0
      ? (ratingQs.reduce((s, q) => s + parseFloat(q.average), 0) / ratingQs.length).toFixed(2)
      : null

    return { survey, total_responses: total, response_rate_pct: null, overall_avg_rating: overallAvg, questions: aggregated }
  }

  private ratingDistribution(nums: number[]) {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    nums.forEach(n => { if (dist[n] !== undefined) dist[n]++ })
    return dist
  }

  async submitSurveyResponse(tenant: string, surveyId: string, dto: SubmitSurveyResponseDto) {
    const db = this.client(tenant)
    const { data, error } = await db.from('survey_responses').insert({ survey_id: surveyId, ...dto }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async exportSurveyResults(tenant: string, surveyId: string): Promise<string> {
    const results = await this.getSurveyResults(tenant, surveyId)
    const lines: string[] = [`"Survey: ${results.survey.title}"`, `"Total Responses","${results.total_responses}"`, `"Overall Avg Rating","${results.overall_avg_rating ?? 'N/A'}"`, '']

    for (const q of results.questions) {
      lines.push(`"Question","${q.question}"`)
      if (q.type === 'rating') {
        lines.push(`"Average","${q.average}"`)
        for (const [k, v] of Object.entries(q.distribution ?? {})) lines.push(`"${k} Stars","${v}"`)
      } else if (q.type === 'multiple_choice') {
        for (const [k, v] of Object.entries(q.counts ?? {})) lines.push(`"${k}","${v}"`)
      } else {
        ;(q.sample_answers ?? []).forEach((a: string, i: number) => lines.push(`"Response ${i + 1}","${String(a).replace(/"/g, '""')}"`))
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // ─── 8. Post-Event Reports ───────────────────────────────────────────────────

  async generateReport(tenant: string, eventId: string, dto: GenerateReportDto, userId: string) {
    const db = this.client(tenant)

    // Compile data snapshot
    const [status, headcount, budget, settlements, surveysRes, testimonialsRes, eventRes] = await Promise.all([
      this.getStatus(tenant, eventId),
      this.getHeadcountRecon(tenant, eventId),
      this.getBudgetRecon(tenant, eventId),
      this.getSettlements(tenant, eventId),
      db.from('event_surveys').select('id,title,survey_type,response_count').eq('event_id', eventId),
      db.from('event_testimonials').select('*').eq('event_id', eventId).eq('is_approved', true),
      db.from('events').select('*').eq('id', eventId).single(),
    ])

    const snapshot = {
      event:        eventRes.data,
      generated_at: new Date().toISOString(),
      report_type:  dto.report_type,
      summary:      status,
      headcount:    { invited: headcount.invited, confirmed: headcount.confirmed, attended: headcount.attended, no_show: headcount.no_show },
      budget:       { total_budgeted: budget.total_budgeted, total_actual: budget.total_actual, variance: budget.total_variance, variance_pct: budget.total_variance_pct },
      vendor_settlement: { total_agreed: settlements.total_agreed, total_final: settlements.total_final, outstanding: settlements.outstanding },
      surveys:      surveysRes.data ?? [],
      testimonials: testimonialsRes.data ?? [],
    }

    const { data, error } = await db.from('post_event_reports').insert({
      event_id:      eventId,
      report_type:   dto.report_type,
      data_snapshot: snapshot,
      created_by:    userId,
    }).select().single()

    if (error) throw new BadRequestException(error.message)

    // Mark checklist item
    const key = dto.report_type === ReportType.Internal ? 'docs_report_internal' : 'docs_report_client'
    await db.from('post_event_checklist').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('event_id', eventId).eq('item_key', key)

    return { report: data, snapshot }
  }

  async getReports(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data, error } = await db.from('post_event_reports').select('*').eq('event_id', eventId).order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ─── 9. Client Report + Invoice ─────────────────────────────────────────────

  async generateClientReport(tenant: string, eventId: string, userId: string) {
    const db = this.client(tenant)
    const report = await this.generateReport(tenant, eventId, { report_type: ReportType.Client }, userId)

    // Get client invoices
    const { data: invoices } = await db.from('invoices').select('*').eq('event_id', eventId).order('created_at')

    return { ...report, invoices: invoices ?? [] }
  }

  // ─── 10. Testimonials ────────────────────────────────────────────────────────

  async getTestimonials(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data, error } = await db.from('event_testimonials').select('*').eq('event_id', eventId).order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    const pending  = (data ?? []).filter(t => !t.is_approved)
    const approved = (data ?? []).filter(t => t.is_approved && !t.is_featured)
    const featured = (data ?? []).filter(t => t.is_featured)
    return { all: data ?? [], pending, approved, featured }
  }

  async createTestimonial(tenant: string, eventId: string, dto: CreateTestimonialDto) {
    const db = this.client(tenant)
    const { data, error } = await db.from('event_testimonials').insert({ event_id: eventId, ...dto }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async approveTestimonial(tenant: string, id: string) {
    const db = this.client(tenant)
    const { data, error } = await db.from('event_testimonials').update({ is_approved: true }).eq('id', id).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async featureTestimonial(tenant: string, id: string, featured: boolean) {
    const db = this.client(tenant)
    const update: any = { is_featured: featured }
    if (featured) update.is_approved = true
    const { data, error } = await db.from('event_testimonials').update(update).eq('id', id).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteTestimonial(tenant: string, id: string) {
    const db = this.client(tenant)
    await db.from('event_testimonials').delete().eq('id', id)
    return { success: true }
  }

  // ─── 11. Archive ─────────────────────────────────────────────────────────────

  async archiveEvent(tenant: string, eventId: string) {
    const db = this.client(tenant)

    // Collect a full data snapshot for the archive zip (returned for client-side download)
    const [event, guests, vendors, budget, surveys, reports, testimonials, checklist] = await Promise.all([
      db.from('events').select('*').eq('id', eventId).single(),
      db.from('guests').select('*').eq('event_id', eventId),
      db.from('vendor_event_assignments').select('*, vendor:vendors(*)').eq('event_id', eventId),
      this.getBudgetRecon(tenant, eventId),
      db.from('event_surveys').select('*').eq('event_id', eventId),
      db.from('post_event_reports').select('*').eq('event_id', eventId),
      db.from('event_testimonials').select('*').eq('event_id', eventId),
      db.from('post_event_checklist').select('*').eq('event_id', eventId),
    ])

    const archiveData = {
      event: event.data,
      archived_at: new Date().toISOString(),
      guests: guests.data ?? [],
      vendors: vendors.data ?? [],
      budget,
      surveys: surveys.data ?? [],
      reports: reports.data ?? [],
      testimonials: testimonials.data ?? [],
      checklist: checklist.data ?? [],
    }

    // Mark as archived
    await db.from('events').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', eventId)

    // Mark archive checklist item
    await db.from('post_event_checklist').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('event_id', eventId).eq('item_key', 'docs_archive')

    return { success: true, archived_at: archiveData.archived_at, archive_data: archiveData }
  }

  async getArchiveStatus(tenant: string, eventId: string) {
    const db = this.client(tenant)
    const { data } = await db.from('events').select('id,name,is_archived,archived_at,end_date').eq('id', eventId).single()
    return data
  }
}
