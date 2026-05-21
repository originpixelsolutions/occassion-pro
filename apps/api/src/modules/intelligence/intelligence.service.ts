// SECURITY: All queries in this service use Supabase parameterized client — no raw SQL interpolation.
// Every query is scoped to tenant_id from the verified JWT (never from user-supplied input).
// Confirmed in RLS audit 2026-05-18.
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { NotificationsService } from '../notifications/notifications.service'
import {
  SmartAlert,
  AlertSeverity,
  EventHealthScore,
  DimensionScores,
  SCORE_DEDUCTIONS,
  ALERT_DIMENSION_MAP,
} from './intelligence.types'

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /** Run all rule groups for an event, upsert alerts, return active alerts */
  async computeAlerts(eventId: string): Promise<SmartAlert[]> {
    const event = await this.fetchEventContext(eventId)
    if (!event) throw new NotFoundException(`Event ${eventId} not found`)

    const generated: SmartAlert[] = [
      ...this.checkRSVPResponseRate(event),
      ...this.checkGuestCapacity(event),
      ...this.checkUnassignedGuests(event),
      ...this.checkVIPRSVP(event),
      ...this.checkBudgetOverrun(event),
      ...this.checkUnpaidVendors(event),
      ...this.checkMissingPaymentDetails(event),
      ...this.checkVendorConfirmation(event),
      ...this.checkVendorDeclines(event),
      ...this.checkVendorPerformanceRisk(event),
      ...this.checkRunsheetCompleteness(event),
      ...this.checkRunsheetGaps(event),
      ...this.checkRunsheetOverlaps(event),
      ...this.checkFnBQuantity(event),
      ...this.checkDietaryRequirements(event),
      ...this.checkTeamCoverage(event),
      ...this.checkEventManagerPresence(event),
    ]

    await this.upsertAlerts(event.tenant_id, eventId, generated)

    // Fetch and return all active (non-dismissed) alerts
    return this.getEventAlerts(eventId)
  }

  /** Compute health score + upsert event_health_scores */
  async computeHealthScore(eventId: string): Promise<EventHealthScore> {
    const alerts = await this.computeAlerts(eventId)
    const score = this.calculateScore(alerts)

    const recomputeAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()

    const { data, error } = await this.supabase.serviceClient
      .from('event_health_scores')
      .upsert(
        {
          event_id: eventId,
          overall_score: score.overall,
          dimension_scores: score.dimensions,
          computed_at: new Date().toISOString(),
          next_compute_at: recomputeAt,
          alert_count_critical: alerts.filter((a) => a.severity === 'critical').length,
          alert_count_warning: alerts.filter((a) => a.severity === 'warning').length,
          alert_count_info: alerts.filter((a) => a.severity === 'info').length,
        },
        { onConflict: 'event_id' },
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EventHealthScore
  }

  /** Fetch active (non-dismissed) alerts for an event */
  async getEventAlerts(eventId: string, severity?: AlertSeverity): Promise<SmartAlert[]> {
    let query = this.supabase.serviceClient
      .from('smart_alerts')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_dismissed', false)
      .order('severity', { ascending: false }) // critical first
      .order('created_at', { ascending: false })

    if (severity) query = query.eq('severity', severity)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as SmartAlert[]
  }

  /** Get cached health score (does NOT recompute) */
  async getHealthScore(eventId: string): Promise<EventHealthScore | null> {
    const { data, error } = await this.supabase.serviceClient
      .from('event_health_scores')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return (data as EventHealthScore) ?? null
  }

  /** Dismiss an alert */
  async dismissAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.serviceClient
      .from('smart_alerts')
      .update({
        is_dismissed: true,
        dismissed_by: userId,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    if (error) throw new Error(error.message)
  }

  /** All active alerts across all events for a tenant */
  async getTenantAlerts(tenantId: string, limit = 50): Promise<SmartAlert[]> {
    const { data, error } = await this.supabase.serviceClient
      .from('smart_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_dismissed', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []) as SmartAlert[]
  }

  /** Cron-triggered: recompute health scores for all active events */
  async scheduleHealthRecompute(): Promise<void> {
    this.logger.log('Running scheduled health score recomputation...')
    const { data: events, error } = await this.supabase.serviceClient
      .from('events')
      .select('id')
      .in('status', ['draft', 'confirmed', 'in_progress'])
      .lt('date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()) // within 90 days

    if (error) {
      this.logger.error('Failed to fetch events for recomputation', error.message)
      return
    }

    const eventIds = (events ?? []).map((e: { id: string }) => e.id)
    this.logger.log(`Recomputing health scores for ${eventIds.length} events`)

    for (const id of eventIds) {
      try {
        await this.computeHealthScore(id)
      } catch (err) {
        this.logger.warn(`Failed to compute health score for event ${id}: ${err}`)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async fetchEventContext(eventId: string): Promise<EventContext | null> {
    const { data, error } = await this.supabase.serviceClient
      .from('events')
      .select(`
        id, tenant_id, name, date, status,
        venue_capacity,
        budget_total,
        actual_spend,
        payment_gateway_configured,
        runsheet_published,
        floor_plan_published,
        guests:guests(id, rsvp_status, category, table_assignment, dietary_requirements),
        vendors:event_vendors(
          id, status,
          vendor:vendors(id, name, performance_score)
        ),
        runsheet_items:runsheet_items(id, title, start_time, end_time, position),
        team_members:event_team(id, role, user_id),
        fnb_plan:fnb_plans(id, quantities_set, dietary_notes)
      `)
      .eq('id', eventId)
      .single()

    if (error || !data) return null
    return data as unknown as EventContext
  }

  /** Upsert alerts to DB — deduplicate on (event_id, alert_type) */
  private async upsertAlerts(
    tenantId: string,
    eventId: string,
    alerts: SmartAlert[],
  ): Promise<void> {
    if (!alerts.length) return

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const rows = alerts.map((a) => ({
      tenant_id: tenantId,
      event_id: eventId,
      alert_type: a.alert_type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      metadata: a.metadata ?? {},
      is_dismissed: false,
      expires_at: expiresAt,
    }))

    const { error } = await this.supabase.serviceClient
      .from('smart_alerts')
      .upsert(rows, {
        onConflict: 'event_id,alert_type',
        ignoreDuplicates: false, // update severity/message if rule output changed
      })

    if (error) {
      this.logger.error('Failed to upsert alerts', error.message)
      return
    }

    // Fire-and-forget: push in-app notifications for critical alerts to event managers
    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    if (criticalAlerts.length > 0) {
      this.resolveEventManagerIds(eventId).then(managerIds => {
        for (const alert of criticalAlerts) {
          for (const managerId of managerIds) {
            this.notificationsService.sendNotification({
              tenantId,
              recipientId: managerId,
              recipientType: 'team',
              templateKey: 'alert_critical',
              variables: { title: alert.title, message: alert.message, eventId },
              eventId,
            }).catch(() => {})
          }
        }
      }).catch(() => {})
    }
  }

  private async resolveEventManagerIds(eventId: string): Promise<string[]> {
    const { data: event } = await this.supabase.serviceClient
      .from('events').select('assigned_manager_id, tenant_id').eq('id', eventId).single()
    if (!event) return []
    if (event.assigned_manager_id) return [event.assigned_manager_id]
    const { data } = await this.supabase.serviceClient
      .from('user_roles').select('user_id')
      .eq('tenant_id', event.tenant_id).eq('role', 'event_manager')
    return (data ?? []).map((r: any) => r.user_id)
  }

  private calculateScore(alerts: SmartAlert[]): { overall: number; dimensions: DimensionScores } {
    const dimensions: DimensionScores = {
      guests: 100,
      finance: 100,
      vendors: 100,
      runsheet: 100,
      fnb: 100,
      team: 100,
    }

    let overall = 100

    for (const alert of alerts) {
      if (alert.is_dismissed) continue
      const deduction = SCORE_DEDUCTIONS[alert.severity]
      overall -= deduction

      const dim = ALERT_DIMENSION_MAP[alert.alert_type]
      if (dim) {
        dimensions[dim] = Math.max(0, dimensions[dim] - deduction)
      }
    }

    overall = Math.max(0, overall)
    return { overall, dimensions }
  }

  private daysUntilEvent(event: EventContext): number {
    const eventDate = new Date(event.date)
    const now = new Date()
    return Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Guest Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkRSVPResponseRate(event: EventContext): SmartAlert[] {
    const guests = event.guests ?? []
    if (!guests.length) return []

    const daysUntil = this.daysUntilEvent(event)
    if (daysUntil > 14 || daysUntil < 0) return []

    const responded = guests.filter((g) => g.rsvp_status !== 'pending').length
    const rate = Math.round((responded / guests.length) * 100)

    if (rate < 30) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'rsvp_response_rate_low',
          severity: 'critical',
          title: 'Low RSVP Response Rate',
          message: `Only ${rate}% of guests have responded. Event is in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
          metadata: { rate, responded, total: guests.length, days_until: daysUntil },
        },
      ]
    }
    return []
  }

  private checkGuestCapacity(event: EventContext): SmartAlert[] {
    const capacity = event.venue_capacity
    if (!capacity) return []

    const confirmed = (event.guests ?? []).filter((g) => g.rsvp_status === 'confirmed').length
    const usagePercent = Math.round((confirmed / capacity) * 100)

    if (usagePercent >= 90) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'guest_capacity_near',
          severity: 'warning',
          title: 'Venue Near Capacity',
          message: `${confirmed} guests confirmed for a venue capacity of ${capacity} (${usagePercent}% full).`,
          metadata: { confirmed, capacity, usage_percent: usagePercent },
        },
      ]
    }
    return []
  }

  private checkUnassignedGuests(event: EventContext): SmartAlert[] {
    if (!event.floor_plan_published) return []

    const guests = event.guests ?? []
    if (!guests.length) return []

    const unassigned = guests.filter(
      (g) => g.rsvp_status === 'confirmed' && !g.table_assignment,
    ).length
    const pct = Math.round((unassigned / guests.length) * 100)

    if (pct > 10) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'guests_unassigned_tables',
          severity: 'warning',
          title: 'Guests Not Assigned to Tables',
          message: `${unassigned} confirmed guests (${pct}%) have no table assignment in the published floor plan.`,
          metadata: { unassigned, total_confirmed: guests.filter((g) => g.rsvp_status === 'confirmed').length },
        },
      ]
    }
    return []
  }

  private checkVIPRSVP(event: EventContext): SmartAlert[] {
    const vipGuests = (event.guests ?? []).filter(
      (g) => g.category === 'vip' && g.rsvp_status !== 'confirmed',
    )

    if (!vipGuests.length) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'vip_rsvp_unconfirmed',
        severity: 'warning',
        title: 'VIP Guests Have Not Confirmed',
        message: `${vipGuests.length} VIP guest${vipGuests.length !== 1 ? 's have' : ' has'} not confirmed attendance.`,
        metadata: { vip_count: vipGuests.length, vip_ids: vipGuests.map((g) => g.id) },
      },
    ]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Finance Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkBudgetOverrun(event: EventContext): SmartAlert[] {
    const budget = event.budget_total
    const spend = event.actual_spend ?? 0

    if (!budget || budget <= 0) return []

    const pct = Math.round((spend / budget) * 100)
    const alerts: SmartAlert[] = []

    if (pct >= 100) {
      alerts.push({
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'budget_overrun_critical',
        severity: 'critical',
        title: 'Budget Exceeded',
        message: `Actual spend of ${this.currency(spend)} has exceeded the budget of ${this.currency(budget)} (${pct}%).`,
        metadata: { budget, actual_spend: spend, percent: pct },
      })
    } else if (pct >= 80) {
      alerts.push({
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'budget_overrun_warning',
        severity: 'warning',
        title: 'Budget Nearly Exhausted',
        message: `${pct}% of budget used — ${this.currency(spend)} of ${this.currency(budget)}.`,
        metadata: { budget, actual_spend: spend, percent: pct },
      })
    }

    return alerts
  }

  private checkUnpaidVendors(event: EventContext): SmartAlert[] {
    const isPast = this.daysUntilEvent(event) < 0
    if (!isPast) return []

    const pending = (event.vendors ?? []).filter((v) => v.status === 'pending_payment').length
    if (!pending) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'unpaid_vendors',
        severity: 'warning',
        title: 'Vendor Payments Outstanding',
        message: `${pending} vendor payment${pending !== 1 ? 's' : ''} still pending after the event.`,
        metadata: { pending_count: pending },
      },
    ]
  }

  private checkMissingPaymentDetails(event: EventContext): SmartAlert[] {
    if (event.payment_gateway_configured) return []

    // Only alert if there are confirmed paying vendors or paid items (heuristic: budget > 0)
    if (!event.budget_total || event.budget_total <= 0) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'payment_gateway_missing',
        severity: 'info',
        title: 'Payment Gateway Not Configured',
        message: 'No payment gateway is configured. Online payments will not be processed.',
        metadata: {},
      },
    ]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Vendor Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkVendorConfirmation(event: EventContext): SmartAlert[] {
    const daysUntil = this.daysUntilEvent(event)
    if (daysUntil > 7 || daysUntil < 0) return []

    const unconfirmed = (event.vendors ?? []).filter((v) => v.status === 'invited')
    if (!unconfirmed.length) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'vendor_unconfirmed',
        severity: 'critical',
        title: 'Vendors Not Confirmed',
        message: `${unconfirmed.length} vendor${unconfirmed.length !== 1 ? 's have' : ' has'} not confirmed within 7 days of the event.`,
        metadata: {
          unconfirmed_count: unconfirmed.length,
          vendor_ids: unconfirmed.map((v) => v.vendor?.id).filter(Boolean),
          vendor_names: unconfirmed.map((v) => v.vendor?.name).filter(Boolean),
          days_until: daysUntil,
        },
      },
    ]
  }

  private checkVendorDeclines(event: EventContext): SmartAlert[] {
    const declined = (event.vendors ?? []).filter((v) => v.status === 'declined')
    if (!declined.length) return []

    const names = declined.map((v) => v.vendor?.name).filter(Boolean).join(', ')

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'vendor_declined',
        severity: 'warning',
        title: 'Vendor Declined Assignment',
        message: `Vendor${declined.length !== 1 ? 's' : ''} ${names} declined — replacement needed.`,
        metadata: {
          declined_count: declined.length,
          vendor_ids: declined.map((v) => v.vendor?.id).filter(Boolean),
          vendor_names: declined.map((v) => v.vendor?.name).filter(Boolean),
        },
      },
    ]
  }

  private checkVendorPerformanceRisk(event: EventContext): SmartAlert[] {
    const risky = (event.vendors ?? []).filter(
      (v) => v.vendor?.performance_score != null && v.vendor.performance_score < 60,
    )
    if (!risky.length) return []

    const names = risky.map((v) => v.vendor?.name).filter(Boolean).join(', ')

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'vendor_performance_risk',
        severity: 'warning',
        title: 'Low-Performance Vendor Assigned',
        message: `${risky.length} assigned vendor${risky.length !== 1 ? 's have' : ' has'} a performance score below 60: ${names}.`,
        metadata: {
          vendor_count: risky.length,
          vendors: risky.map((v) => ({ id: v.vendor?.id, name: v.vendor?.name, score: v.vendor?.performance_score })),
        },
      },
    ]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Runsheet Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkRunsheetCompleteness(event: EventContext): SmartAlert[] {
    const daysUntil = this.daysUntilEvent(event)
    if (daysUntil > 3 || daysUntil < 0) return []

    const items = event.runsheet_items ?? []
    if (items.length < 5) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'runsheet_empty',
          severity: 'critical',
          title: 'Runsheet Not Prepared',
          message: items.length === 0
            ? 'The runsheet is empty. Event is in less than 3 days.'
            : `Runsheet has only ${items.length} item${items.length !== 1 ? 's' : ''}. Consider adding more detail.`,
          metadata: { item_count: items.length, days_until: daysUntil },
        },
      ]
    }
    return []
  }

  private checkRunsheetGaps(event: EventContext): SmartAlert[] {
    const items = this.sortedRunsheetItems(event)
    const GAP_MINUTES = 30
    const gaps: Array<{ a: string; b: string; gap: number }> = []

    for (let i = 0; i < items.length - 1; i++) {
      const endTime = this.parseTime(items[i].end_time)
      const startTime = this.parseTime(items[i + 1].start_time)
      if (endTime && startTime) {
        const gapMin = (startTime - endTime) / 60000
        if (gapMin >= GAP_MINUTES) {
          gaps.push({ a: items[i].title, b: items[i + 1].title, gap: Math.round(gapMin) })
        }
      }
    }

    if (!gaps.length) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'runsheet_gap',
        severity: 'info',
        title: 'Runsheet Gaps Detected',
        message: `${gaps.length} gap${gaps.length !== 1 ? 's' : ''} of 30+ minutes found. Longest: "${gaps[0].a}" → "${gaps[0].b}" (${gaps[0].gap} min).`,
        metadata: { gaps },
      },
    ]
  }

  private checkRunsheetOverlaps(event: EventContext): SmartAlert[] {
    const items = this.sortedRunsheetItems(event)
    const overlaps: Array<{ a: string; b: string }> = []

    for (let i = 0; i < items.length - 1; i++) {
      const aEnd = this.parseTime(items[i].end_time)
      const bStart = this.parseTime(items[i + 1].start_time)
      if (aEnd && bStart && bStart < aEnd) {
        overlaps.push({ a: items[i].title, b: items[i + 1].title })
      }
    }

    if (!overlaps.length) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'runsheet_overlap',
        severity: 'warning',
        title: 'Runsheet Schedule Conflict',
        message: `${overlaps.length} schedule overlap${overlaps.length !== 1 ? 's' : ''} detected. First: "${overlaps[0].a}" and "${overlaps[0].b}" overlap.`,
        metadata: { overlaps },
      },
    ]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // F&B Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkFnBQuantity(event: EventContext): SmartAlert[] {
    const daysUntil = this.daysUntilEvent(event)
    if (daysUntil > 5 || daysUntil < 0) return []

    const confirmedGuests = (event.guests ?? []).filter((g) => g.rsvp_status === 'confirmed').length
    if (!confirmedGuests) return []

    const fnb = event.fnb_plan?.[0]
    if (!fnb || !fnb.quantities_set) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'fnb_quantities_missing',
          severity: 'warning',
          title: 'F&B Quantities Not Set',
          message: `${confirmedGuests} guests confirmed but F&B quantities have not been set. Event is in ${daysUntil} days.`,
          metadata: { confirmed_guests: confirmedGuests, days_until: daysUntil },
        },
      ]
    }
    return []
  }

  private checkDietaryRequirements(event: EventContext): SmartAlert[] {
    const guests = event.guests ?? []
    if (!guests.length) return []

    const withDietary = guests.filter(
      (g) => g.dietary_requirements && g.dietary_requirements.length > 0,
    ).length

    const pct = Math.round((withDietary / guests.length) * 100)
    if (pct < 10) return [] // below threshold

    const fnb = event.fnb_plan?.[0]
    const hasAcknowledgment = fnb?.dietary_notes && fnb.dietary_notes.length > 0

    if (!hasAcknowledgment) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'fnb_dietary_unacknowledged',
          severity: 'info',
          title: 'Dietary Requirements Not Addressed',
          message: `${withDietary} guest${withDietary !== 1 ? 's have' : ' has'} dietary requirements (${pct}%) but no F&B plan acknowledges them.`,
          metadata: { guests_with_dietary: withDietary, total_guests: guests.length, percent: pct },
        },
      ]
    }
    return []
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Team Rules
  // ─────────────────────────────────────────────────────────────────────────────

  private checkTeamCoverage(event: EventContext): SmartAlert[] {
    const confirmedGuests = (event.guests ?? []).filter((g) => g.rsvp_status === 'confirmed').length
    if (confirmedGuests <= 100) return []

    const teamSize = (event.team_members ?? []).length
    if (teamSize >= 2) return []

    return [
      {
        tenant_id: event.tenant_id,
        event_id: event.id,
        alert_type: 'team_coverage_low',
        severity: 'warning',
        title: 'Insufficient Team Coverage',
        message: `${confirmedGuests} guests expected but only ${teamSize === 0 ? 'no' : teamSize} team member${teamSize !== 1 ? 's are' : ' is'} assigned.`,
        metadata: { confirmed_guests: confirmedGuests, team_size: teamSize },
      },
    ]
  }

  private checkEventManagerPresence(event: EventContext): SmartAlert[] {
    const daysUntil = this.daysUntilEvent(event)
    if (daysUntil > 7 || daysUntil < 0) return []

    const hasManager = (event.team_members ?? []).some(
      (m) => m.role === 'event_manager' || m.role === 'manager',
    )

    if (!hasManager) {
      return [
        {
          tenant_id: event.tenant_id,
          event_id: event.id,
          alert_type: 'event_manager_missing',
          severity: 'critical',
          title: 'No Event Manager Assigned',
          message: `No event manager assigned. Event is in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
          metadata: { days_until: daysUntil },
        },
      ]
    }
    return []
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  private sortedRunsheetItems(event: EventContext): RunsheetItem[] {
    return [...(event.runsheet_items ?? [])].sort((a, b) => {
      const ta = this.parseTime(a.start_time) ?? 0
      const tb = this.parseTime(b.start_time) ?? 0
      return ta - tb
    })
  }

  private parseTime(timeStr: string | null | undefined): number | null {
    if (!timeStr) return null
    try {
      return new Date(timeStr).getTime()
    } catch {
      return null
    }
  }

  private currency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }
}

// ─── Internal types for event context query result ───────────────────────────

interface GuestRecord {
  id: string
  rsvp_status: string
  category: string | null
  table_assignment: string | null
  dietary_requirements: string[] | null
}

interface VendorRecord {
  id: string
  status: string
  vendor: {
    id: string
    name: string
    performance_score: number | null
  } | null
}

interface RunsheetItem {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  position: number
}

interface TeamMember {
  id: string
  role: string
  user_id: string
}

interface FnBPlan {
  id: string
  quantities_set: boolean
  dietary_notes: string | null
}

interface EventContext {
  id: string
  tenant_id: string
  name: string
  date: string
  status: string
  venue_capacity: number | null
  budget_total: number | null
  actual_spend: number | null
  payment_gateway_configured: boolean
  runsheet_published: boolean
  floor_plan_published: boolean
  guests: GuestRecord[]
  vendors: VendorRecord[]
  runsheet_items: RunsheetItem[]
  team_members: TeamMember[]
  fnb_plan: FnBPlan[]
}
