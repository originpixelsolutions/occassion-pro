import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name)

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Live event command dashboard ────────────────────────────────────────

  async getLiveCommandDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [eventRes, tasksRes, guestsRes, vendorsRes, crewRes, timelineRes, incidentsRes] = await Promise.all([
      client.from('events').select('*').eq('id', eventId).eq('tenant_id', tenantId).single(),
      client.from('event_tasks').select('id, title, status, priority, assignee_id, due_date, module').eq('event_id', eventId).eq('tenant_id', tenantId).order('priority'),
      client.from('guests').select('id, check_in_status, rsvp_status, meal_preference').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('vendor_contracts').select('id, service_type, status, vendor_id, vendors(name, phone)').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('team_event_assignments').select('*, profiles(id, full_name, role)').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('runsheet_items').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('scheduled_time'),
      client.from('incident_reports').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ])

    if (!eventRes.data) throw new NotFoundException('Event not found')

    const tasks = tasksRes.data ?? []
    const guests = guestsRes.data ?? []
    const vendors = vendorsRes.data ?? []
    const crew = crewRes.data ?? []
    const timeline = timelineRes.data ?? []
    const incidents = incidentsRes.data ?? []

    // Task stats
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      overdue: tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length,
    }

    // Guest stats
    const guestStats = {
      total: guests.length,
      rsvpConfirmed: guests.filter(g => g.rsvp_status === 'confirmed').length,
      checkedIn: guests.filter(g => g.check_in_status === 'checked_in').length,
      checkInRate: guests.length > 0
        ? Math.round((guests.filter(g => g.check_in_status === 'checked_in').length / guests.length) * 100)
        : 0,
    }

    // Vendor status summary
    const vendorStats = {
      total: vendors.length,
      confirmed: vendors.filter(v => v.status === 'active' || v.status === 'signed').length,
      pending: vendors.filter(v => v.status === 'pending' || v.status === 'draft').length,
    }

    // Current runsheet item
    const now = new Date()
    const currentItem = timeline.find(item => {
      if (!item.scheduled_time) return false
      const itemTime = new Date(item.scheduled_time)
      const endTime = item.duration_minutes
        ? new Date(itemTime.getTime() + item.duration_minutes * 60000)
        : new Date(itemTime.getTime() + 30 * 60000)
      return itemTime <= now && now <= endTime
    })
    const nextItem = timeline.find(item => {
      if (!item.scheduled_time) return false
      return new Date(item.scheduled_time) > now
    })

    return {
      event: eventRes.data,
      taskStats,
      guestStats,
      vendorStats,
      crew,
      currentRunsheetItem: currentItem ?? null,
      nextRunsheetItem: nextItem ?? null,
      upcomingTimeline: timeline.filter(item => item.scheduled_time && new Date(item.scheduled_time) >= now).slice(0, 10),
      recentIncidents: incidents,
      criticalTasks: tasks.filter(t => t.priority === 'critical' && t.status !== 'completed'),
      vendors,
    }
  }

  // ─── Runsheet management ──────────────────────────────────────────────────

  async getRunsheet(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('runsheet_items')
      .select('*, assignee:profiles(id, full_name)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('scheduled_time')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async upsertRunsheetItem(
    eventId: string,
    dto: {
      id?: string; title: string; description?: string; category?: string
      scheduled_time: string; duration_minutes?: number; location?: string
      assignee_id?: string; status?: string; notes?: string
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)
    const payload = {
      tenant_id: tenantId,
      event_id: eventId,
      title: dto.title,
      description: dto.description,
      category: dto.category ?? 'general',
      scheduled_time: dto.scheduled_time,
      duration_minutes: dto.duration_minutes,
      location: dto.location,
      assignee_id: dto.assignee_id,
      status: dto.status ?? 'pending',
      notes: dto.notes,
    }

    if (dto.id) {
      const { data, error } = await client.from('runsheet_items').update(payload).eq('id', dto.id).eq('tenant_id', tenantId).select().single()
      if (error) throw new Error(error.message)
      return data
    }

    const { data, error } = await client.from('runsheet_items').insert(payload).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateRunsheetItemStatus(id: string, status: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('runsheet_items')
      .update({ status, actual_start_time: status === 'in_progress' ? new Date().toISOString() : undefined, actual_end_time: status === 'completed' ? new Date().toISOString() : undefined })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // ─── Incident reports ─────────────────────────────────────────────────────

  async createIncident(
    eventId: string,
    dto: { title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; category?: string; location?: string },
    tenantId: string,
    token: string,
    reportedById: string,
  ) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('incident_reports')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        category: dto.category ?? 'general',
        location: dto.location,
        status: 'open',
        reported_by: reportedById,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    this.logger.warn(`Incident created for event ${eventId}: [${dto.severity.toUpperCase()}] ${dto.title}`)
    return data
  }

  async resolveIncident(
    incidentId: string,
    resolution: string,
    tenantId: string,
    token: string,
    resolvedById: string,
  ) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('incident_reports')
      .update({
        status: 'resolved',
        resolution,
        resolved_by: resolvedById,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', incidentId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getIncidents(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('incident_reports')
      .select('*, reported_by_profile:profiles!reported_by(full_name)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // ─── Crew check-in ────────────────────────────────────────────────────────

  async checkInCrew(assignmentId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('team_event_assignments')
      .update({ checked_in_at: new Date().toISOString(), check_in_status: 'checked_in' })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // ─── Quick task status update ─────────────────────────────────────────────

  async updateTaskStatus(taskId: string, status: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_tasks')
      .update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) })
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // ─── ORCHESTRATION: Multi-event dashboard ────────────────────────────────

  async getOrchestrationDashboard(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const now = new Date()
    const windowStart = new Date(now.getTime() - 24 * 3600000).toISOString()
    const windowEnd   = new Date(now.getTime() + 7 * 24 * 3600000).toISOString()

    // Fetch all active/upcoming events in the window
    const [eventsRes, incidentsRes] = await Promise.all([
      client.from('events')
        .select('id,name,event_date,end_date,status,venue_id,venues(name,city)')
        .eq('tenant_id', tenantId)
        .in('status', ['planning','confirmed','live','setup'])
        .gte('event_date', windowStart)
        .lte('event_date', windowEnd)
        .order('event_date'),
      client.from('incident_reports')
        .select('id,event_id,title,severity,status,created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const events = eventsRes.data ?? []
    const openIncidents = incidentsRes.data ?? []

    // Per-event stats in parallel
    const eventDetails = await Promise.all(events.map(async (ev) => {
      const [tasks, assignments, guests, vendors] = await Promise.all([
        client.from('event_tasks').select('status,priority').eq('event_id', ev.id).eq('tenant_id', tenantId),
        client.from('team_event_assignments').select('id,check_in_status').eq('event_id', ev.id).eq('tenant_id', tenantId),
        client.from('guests').select('check_in_status,rsvp_status').eq('event_id', ev.id).eq('tenant_id', tenantId),
        client.from('vendor_contracts').select('status').eq('event_id', ev.id).eq('tenant_id', tenantId),
      ])

      const t = tasks.data ?? []
      const a = assignments.data ?? []
      const g = guests.data ?? []
      const v = vendors.data ?? []

      const taskCompletion = t.length > 0 ? Math.round((t.filter((x: any) => x.status === 'completed').length / t.length) * 100) : 100
      const staffCheckin   = a.length > 0 ? Math.round((a.filter((x: any) => x.check_in_status === 'checked_in').length / a.length) * 100) : 0
      const guestCheckin   = g.length > 0 ? Math.round((g.filter((x: any) => x.check_in_status === 'checked_in').length / g.length) * 100) : 0
      const vendorConfirmed = v.length > 0 ? Math.round((v.filter((x: any) => ['active','signed'].includes(x.status)).length / v.length) * 100) : 100
      const criticalTasks  = t.filter((x: any) => x.priority === 'critical' && x.status !== 'completed').length
      const incidents      = openIncidents.filter(i => i.event_id === ev.id)

      // Health score: weighted average
      const healthScore = Math.round(
        taskCompletion * 0.30 +
        vendorConfirmed * 0.25 +
        (ev.status === 'live' ? guestCheckin * 0.20 : 80 * 0.20) +
        (staffCheckin > 0 ? staffCheckin * 0.15 : 80 * 0.15) +
        (criticalTasks === 0 ? 100 : Math.max(0, 100 - criticalTasks * 20)) * 0.10
      )

      return {
        ...ev,
        stats: { taskCompletion, staffCheckin, guestCheckin, vendorConfirmed, criticalTasks },
        health_score: healthScore,
        open_incidents: incidents.length,
        incidents,
      }
    }))

    // Cross-event resource conflict detection
    const conflicts = await this.detectResourceConflicts(tenantId, token, events.map(e => e.id))

    // Summary
    const summary = {
      total_events:    events.length,
      live_events:     events.filter(e => e.status === 'live').length,
      critical_alerts: openIncidents.filter(i => i.severity === 'critical').length,
      total_conflicts: conflicts.length,
      avg_health:      eventDetails.length > 0
        ? Math.round(eventDetails.reduce((s, e) => s + e.health_score, 0) / eventDetails.length)
        : 100,
    }

    return { events: eventDetails, conflicts, open_incidents: openIncidents, summary }
  }

  async detectResourceConflicts(
    tenantId: string,
    token: string,
    eventIds?: string[],
  ) {
    const client = this.supabase.forRequest(token)

    // Staff double-booking: same staff member assigned to overlapping events
    let assignmentsQuery = client
      .from('team_event_assignments')
      .select('id,profile_id,event_id,role,events!inner(name,event_date,end_date,status)')
      .eq('tenant_id', tenantId)
      .in('events.status', ['planning','confirmed','live','setup'])

    if (eventIds?.length) {
      assignmentsQuery = assignmentsQuery.in('event_id', eventIds)
    }

    const assignmentsRes = await assignmentsQuery

    const assignments = assignmentsRes.data ?? []
    const conflicts: Array<{
      type: string
      resource_id: string
      resource_name: string
      event_a: string
      event_b: string
      overlap_start: string
      overlap_end: string
      severity: 'warning' | 'critical'
    }> = []

    // Group by staff member
    const byStaff: Record<string, any[]> = {}
    for (const a of assignments) {
      if (!byStaff[a.profile_id]) byStaff[a.profile_id] = []
      byStaff[a.profile_id].push(a)
    }

    for (const [profileId, staffAssignments] of Object.entries(byStaff)) {
      for (let i = 0; i < staffAssignments.length; i++) {
        for (let j = i + 1; j < staffAssignments.length; j++) {
          const a = staffAssignments[i]
          const b = staffAssignments[j]
          const aStart = new Date((a.events as any).event_date).getTime()
          const aEnd   = new Date((a.events as any).end_date ?? aStart + 86400000).getTime()
          const bStart = new Date((b.events as any).event_date).getTime()
          const bEnd   = new Date((b.events as any).end_date ?? bStart + 86400000).getTime()

          if (aStart < bEnd && aEnd > bStart) {
            const overlapStart = new Date(Math.max(aStart, bStart)).toISOString()
            const overlapEnd   = new Date(Math.min(aEnd, bEnd)).toISOString()
            const live = (a.events as any).status === 'live' || (b.events as any).status === 'live'
            conflicts.push({
              type: 'staff',
              resource_id: profileId,
              resource_name: `Staff ID: ${profileId}`,
              event_a: (a.events as any).name,
              event_b: (b.events as any).name,
              overlap_start: overlapStart,
              overlap_end: overlapEnd,
              severity: live ? 'critical' : 'warning',
            })
          }
        }
      }
    }

    // Vendor double-booking
    const vendorContractsRes = await client
      .from('vendor_contracts')
      .select('id,vendor_id,event_id,vendors(name),events!inner(name,event_date,end_date,status)')
      .eq('tenant_id', tenantId)
      .in('status', ['active','signed'])
      .in('events.status', ['planning','confirmed','live','setup'])

    const contracts = vendorContractsRes.data ?? []
    const byVendor: Record<string, any[]> = {}
    for (const c of contracts) {
      if (!byVendor[c.vendor_id]) byVendor[c.vendor_id] = []
      byVendor[c.vendor_id].push(c)
    }

    for (const [vendorId, vContracts] of Object.entries(byVendor)) {
      for (let i = 0; i < vContracts.length; i++) {
        for (let j = i + 1; j < vContracts.length; j++) {
          const a = vContracts[i]
          const b = vContracts[j]
          const aStart = new Date((a.events as any).event_date).getTime()
          const aEnd   = new Date((a.events as any).end_date ?? aStart + 86400000).getTime()
          const bStart = new Date((b.events as any).event_date).getTime()
          const bEnd   = new Date((b.events as any).end_date ?? bStart + 86400000).getTime()

          if (aStart < bEnd && aEnd > bStart) {
            const live = (a.events as any).status === 'live' || (b.events as any).status === 'live'
            conflicts.push({
              type: 'vendor',
              resource_id: vendorId,
              resource_name: (a.vendors as any)?.name ?? `Vendor ${vendorId}`,
              event_a: (a.events as any).name,
              event_b: (b.events as any).name,
              overlap_start: new Date(Math.max(aStart, bStart)).toISOString(),
              overlap_end: new Date(Math.min(aEnd, bEnd)).toISOString(),
              severity: live ? 'critical' : 'warning',
            })
          }
        }
      }
    }

    return conflicts
  }

  async getOrchestrationAlerts(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()

    const [incidentsRes, overdueTasksRes, slaBreachesRes] = await Promise.all([
      client.from('incident_reports').select('id,event_id,title,severity,status,created_at,events(name)')
        .eq('tenant_id', tenantId).eq('status', 'open').order('created_at', { ascending: false }).limit(20),
      client.from('event_tasks').select('id,event_id,title,priority,due_date,events(name)')
        .eq('tenant_id', tenantId).neq('status', 'completed')
        .lt('due_date', new Date().toISOString()).order('due_date').limit(20),
      client.from('support_tickets').select('id,ticket_number,subject,priority,first_response_due,sla_breached')
        .eq('tenant_id', tenantId).eq('sla_breached', true).eq('status', 'open').limit(10),
    ])

    const incidents = (incidentsRes.data ?? []).map(i => ({
      id: i.id, type: 'incident', severity: i.severity,
      title: i.title, event: (i.events as any)?.name ?? 'Unknown', created_at: i.created_at,
    }))

    const overdueTasks = (overdueTasksRes.data ?? []).map(t => ({
      id: t.id, type: 'overdue_task', severity: t.priority === 'critical' ? 'critical' : 'warning',
      title: `Overdue: ${t.title}`, event: (t.events as any)?.name ?? 'Unknown', created_at: t.due_date,
    }))

    const slaBreaches = (slaBreachesRes.data ?? []).map(t => ({
      id: t.id, type: 'sla_breach', severity: 'critical',
      title: `SLA Breach: ${t.ticket_number} — ${t.subject}`, event: 'Support', created_at: t.first_response_due,
    }))

    const all = [...incidents, ...overdueTasks, ...slaBreaches].sort((a, b) => {
      const order = { critical: 0, high: 1, warning: 2, info: 3 }
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
    })

    return { alerts: all, counts: { critical: all.filter(a => a.severity === 'critical').length, warning: all.filter(a => a.severity === 'warning').length, total: all.length } }
  }
}
