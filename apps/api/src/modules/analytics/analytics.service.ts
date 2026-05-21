import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Executive KPI Summary ────────────────────────────────────────────────

  async getExecutiveSummary(
    tenantId: string,
    token: string,
    period: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time' = 'this_month',
  ) {
    const client = this.supabase.forRequest(token)
    const { from, to } = this.getDateRange(period)

    const [eventsRes, revenueRes, leadsRes, expensesRes] = await Promise.all([
      // Event counts by status
      client
        .from('events')
        .select('id, status, start_date, expected_guests')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),

      // Revenue from paid invoices
      client
        .from('invoices')
        .select('total_amount, paid_amount, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),

      // Lead pipeline
      client
        .from('leads')
        .select('id, status, budget, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),

      // Total expenses
      client
        .from('expenses')
        .select('amount, category')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),
    ])

    const events = eventsRes.data ?? []
    const invoices = revenueRes.data ?? []
    const leads = leadsRes.data ?? []
    const expenses = expensesRes.data ?? []

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
    const grossProfit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    const wonLeads = leads.filter(l => l.status === 'won')
    const totalLeadPipeline = leads.reduce((s, l) => s + Number(l.budget ?? 0), 0)

    return {
      period,
      dateRange: { from, to },
      events: {
        total: events.length,
        byStatus: this.groupBy(events, 'status'),
        totalGuests: events.reduce((s, e) => s + (e.expected_guests ?? 0), 0),
      },
      revenue: {
        totalRevenue,
        totalInvoiced,
        collectionRate: totalInvoiced > 0 ? (totalRevenue / totalInvoiced) * 100 : 0,
        outstandingAmount: totalInvoiced - totalRevenue,
        invoicesByStatus: this.groupBy(invoices, 'status'),
      },
      profitability: {
        totalExpenses,
        grossProfit,
        marginPercent: Math.round(margin * 10) / 10,
      },
      leads: {
        total: leads.length,
        won: wonLeads.length,
        conversionRate: leads.length > 0 ? (wonLeads.length / leads.length) * 100 : 0,
        pipelineValue: totalLeadPipeline,
        wonValue: wonLeads.reduce((s, l) => s + Number(l.budget ?? 0), 0),
        byStatus: this.groupBy(leads, 'status'),
      },
    }
  }

  // ─── Revenue Trends (monthly breakdown) ──────────────────────────────────

  async getRevenueTrends(tenantId: string, token: string, months = 12) {
    const client = this.supabase.forRequest(token)
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    const [invoicesRes, expensesRes] = await Promise.all([
      client
        .from('invoices')
        .select('total_amount, paid_amount, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString()),
      client
        .from('expenses')
        .select('amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString()),
    ])

    const invoices = invoicesRes.data ?? []
    const expenses = expensesRes.data ?? []

    // Build month buckets
    const buckets: Record<string, { month: string; revenue: number; expenses: number; invoiced: number; profit: number }> = {}
    for (let i = 0; i < months; i++) {
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { month: key, revenue: 0, expenses: 0, invoiced: 0, profit: 0 }
    }

    invoices.forEach(inv => {
      const key = inv.created_at.slice(0, 7)
      if (buckets[key]) {
        buckets[key].invoiced += Number(inv.total_amount ?? 0)
        buckets[key].revenue += Number(inv.paid_amount ?? 0)
      }
    })

    expenses.forEach(exp => {
      const key = exp.created_at.slice(0, 7)
      if (buckets[key]) {
        buckets[key].expenses += Number(exp.amount ?? 0)
      }
    })

    return Object.values(buckets).map(b => ({
      ...b,
      profit: b.revenue - b.expenses,
    }))
  }

  // ─── Event Performance Matrix ────────────────────────────────────────────

  async getEventPerformance(tenantId: string, token: string, limit = 20) {
    const client = this.supabase.forRequest(token)

    const { data: events } = await client
      .from('events')
      .select('id, name, event_type, status, start_date, expected_guests')
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
      .order('start_date', { ascending: false })
      .limit(limit)

    if (!events || events.length === 0) return []

    const eventIds = events.map(e => e.id)

    const [invoicesRes, expensesRes, guestsRes, tasksRes] = await Promise.all([
      client
        .from('invoices')
        .select('event_id, total_amount, paid_amount, status')
        .in('event_id', eventIds)
        .eq('tenant_id', tenantId),
      client
        .from('expenses')
        .select('event_id, amount')
        .in('event_id', eventIds)
        .eq('tenant_id', tenantId),
      client
        .from('guests')
        .select('event_id, rsvp_status, check_in_status')
        .in('event_id', eventIds)
        .eq('tenant_id', tenantId),
      client
        .from('event_tasks')
        .select('event_id, status')
        .in('event_id', eventIds)
        .eq('tenant_id', tenantId),
    ])

    const invoicesByEvent = this.groupByKey(invoicesRes.data ?? [], 'event_id')
    const expensesByEvent = this.groupByKey(expensesRes.data ?? [], 'event_id')
    const guestsByEvent = this.groupByKey(guestsRes.data ?? [], 'event_id')
    const tasksByEvent = this.groupByKey(tasksRes.data ?? [], 'event_id')

    return events.map(event => {
      const invs = invoicesByEvent[event.id] ?? []
      const exps = expensesByEvent[event.id] ?? []
      const guests = guestsByEvent[event.id] ?? []
      const tasks = tasksByEvent[event.id] ?? []

      const revenue = invs.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
      const expenses = exps.reduce((s, e) => s + Number(e.amount ?? 0), 0)
      const totalTasks = tasks.length
      const completedTasks = tasks.filter(t => t.status === 'completed').length
      const checkedIn = guests.filter(g => g.check_in_status === 'checked_in').length

      return {
        id: event.id,
        name: event.name,
        eventType: event.event_type,
        status: event.status,
        startDate: event.start_date,
        expectedGuests: event.expected_guests ?? 0,
        actualGuests: checkedIn,
        revenue,
        expenses,
        profit: revenue - expenses,
        margin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
        taskCompletion: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        guestAttendance: event.expected_guests > 0 ? Math.round((checkedIn / event.expected_guests) * 100) : 0,
      }
    })
  }

  // ─── Lead Funnel & Conversion Analytics ──────────────────────────────────

  async getLeadFunnel(tenantId: string, token: string, months = 6) {
    const client = this.supabase.forRequest(token)
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const { data: leads } = await client
      .from('leads')
      .select('id, status, budget, source, event_type, created_at, won_at, lost_reason')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString())

    const all = leads ?? []

    const stages = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'on_hold']
    const funnel = stages.map(stage => ({
      stage,
      count: all.filter(l => l.status === stage).length,
      value: all.filter(l => l.status === stage).reduce((s, l) => s + Number(l.budget ?? 0), 0),
    }))

    const bySource = this.groupCount(all, 'source')
    const byEventType = this.groupCount(all, 'event_type')
    const lostReasons = this.groupCount(all.filter(l => l.lost_reason), 'lost_reason')

    const wonLeads = all.filter(l => l.status === 'won')
    const avgDealSize = wonLeads.length > 0
      ? wonLeads.reduce((s, l) => s + Number(l.budget ?? 0), 0) / wonLeads.length
      : 0

    return { funnel, bySource, byEventType, lostReasons, avgDealSize, totalLeads: all.length }
  }

  // ─── Vendor & Expense Breakdown ───────────────────────────────────────────

  async getExpenseBreakdown(tenantId: string, token: string, eventId?: string) {
    const client = this.supabase.forRequest(token)

    let query = client
      .from('expenses')
      .select('category, amount, is_approved, created_at, event_id')
      .eq('tenant_id', tenantId)

    if (eventId) query = query.eq('event_id', eventId)

    const { data: expenses } = await query

    const all = expenses ?? []
    const byCategory = all.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount)
      return acc
    }, {})

    const total = all.reduce((s, e) => s + Number(e.amount), 0)
    const approved = all.filter(e => e.is_approved).reduce((s, e) => s + Number(e.amount), 0)

    return {
      total,
      approved,
      pending: total - approved,
      byCategory: Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount),
      count: all.length,
    }
  }

  // ─── Guest Analytics ──────────────────────────────────────────────────────

  async getGuestAnalytics(tenantId: string, token: string, eventId?: string) {
    const client = this.supabase.forRequest(token)

    let query = client
      .from('guests')
      .select('category, rsvp_status, check_in_status, is_vip, meal_preference, plus_ones')
      .eq('tenant_id', tenantId)

    if (eventId) query = query.eq('event_id', eventId)

    const { data: guests } = await query
    const all = guests ?? []

    const total = all.length
    const totalWithPlusOnes = all.reduce((s, g) => s + 1 + (g.plus_ones ?? 0), 0)
    const checkedIn = all.filter(g => g.check_in_status === 'checked_in').length
    const confirmed = all.filter(g => g.rsvp_status === 'confirmed').length
    const vipCount = all.filter(g => g.is_vip).length

    const mealCounts = this.groupCount(all.filter(g => g.meal_preference), 'meal_preference')
    const byCategory = this.groupCount(all, 'category')
    const rsvpBreakdown = this.groupCount(all, 'rsvp_status')
    const checkInBreakdown = this.groupCount(all, 'check_in_status')

    return {
      total,
      totalWithPlusOnes,
      checkedIn,
      checkInRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
      confirmed,
      confirmationRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      vipCount,
      byCategory,
      rsvpBreakdown,
      checkInBreakdown,
      mealPreferences: mealCounts,
    }
  }

  // ─── Team Performance ─────────────────────────────────────────────────────

  async getTeamPerformance(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [tasksRes, profilesRes, leadsRes] = await Promise.all([
      client
        .from('event_tasks')
        .select('assigned_to, status, priority, due_date')
        .eq('tenant_id', tenantId),
      client
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('tenant_id', tenantId),
      client
        .from('leads')
        .select('assigned_to, status, budget')
        .eq('tenant_id', tenantId),
    ])

    const tasks = tasksRes.data ?? []
    const profiles = profilesRes.data ?? []
    const leads = leadsRes.data ?? []

    return profiles.map(profile => {
      const userTasks = tasks.filter(t => t.assigned_to === profile.id)
      const userLeads = leads.filter(l => l.assigned_to === profile.id)
      const completed = userTasks.filter(t => t.status === 'completed').length
      const overdue = userTasks.filter(t =>
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed',
      ).length
      const wonLeads = userLeads.filter(l => l.status === 'won')

      return {
        userId: profile.id,
        name: profile.full_name,
        role: profile.role,
        avatarUrl: profile.avatar_url,
        tasks: {
          total: userTasks.length,
          completed,
          overdue,
          completionRate: userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0,
        },
        leads: {
          total: userLeads.length,
          won: wonLeads.length,
          pipelineValue: wonLeads.reduce((s, l) => s + Number(l.budget ?? 0), 0),
        },
      }
    }).filter(p => p.tasks.total > 0 || p.leads.total > 0)
  }

  // ─── Cross-Event BI Dashboard (date-range driven) ─────────────────────────

  async getCrossEventSummary(tenantId: string, token: string, from: string, to: string) {
    const client = this.supabase.forRequest(token)

    const [eventsRes, invoicesRes, expensesRes, guestsRes, tasksRes] = await Promise.all([
      client.from('events').select('id, name, event_type, status, start_date, expected_guests').eq('tenant_id', tenantId).gte('start_date', from).lte('start_date', to),
      client.from('invoices').select('event_id, total_amount, paid_amount, status').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
      client.from('expenses').select('event_id, amount, category').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
      client.from('guests').select('event_id, rsvp_status, check_in_status').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
      client.from('event_tasks').select('event_id, status').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
    ])

    const events = eventsRes.data ?? []
    const invoices = invoicesRes.data ?? []
    const expenses = expensesRes.data ?? []
    const guests = guestsRes.data ?? []
    const tasks = tasksRes.data ?? []

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
    const grossProfit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const totalGuests = guests.length
    const checkedIn = guests.filter(g => g.check_in_status === 'checked_in').length
    const confirmedGuests = guests.filter(g => g.rsvp_status === 'confirmed').length
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

    return {
      dateRange: { from, to },
      kpis: {
        totalEvents: events.length,
        totalRevenue,
        totalExpenses,
        grossProfit,
        marginPercent: Math.round(margin * 10) / 10,
        totalGuests,
        checkedIn,
        confirmationRate: totalGuests > 0 ? Math.round((confirmedGuests / totalGuests) * 100) : 0,
        checkInRate: totalGuests > 0 ? Math.round((checkedIn / totalGuests) * 100) : 0,
        taskCompletionRate,
        avgRevenuePerEvent: events.length > 0 ? Math.round(totalRevenue / events.length) : 0,
        avgGuestsPerEvent: events.length > 0 ? Math.round(totalGuests / events.length) : 0,
      },
      eventsByType: this.groupCount(events, 'event_type'),
      eventsByStatus: this.groupCount(events, 'status'),
    }
  }

  async getVendorSpendByCategory(tenantId: string, token: string, from: string, to: string) {
    const client = this.supabase.forRequest(token)

    // Try vendor_bookings first, fall back to expenses by category
    const [vendorRes, expenseRes] = await Promise.all([
      client.from('vendor_bookings')
        .select('service_type, quoted_amount, final_amount, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),
      client.from('expenses')
        .select('category, amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', from)
        .lte('created_at', to),
    ])

    const vendorBookings = vendorRes.data ?? []
    const expenses = expenseRes.data ?? []

    // Vendor spend by service type
    const byServiceType: Record<string, { count: number; total: number; confirmed: number }> = {}
    for (const v of vendorBookings) {
      const key = v.service_type ?? 'Other'
      if (!byServiceType[key]) byServiceType[key] = { count: 0, total: 0, confirmed: 0 }
      byServiceType[key].count++
      byServiceType[key].total += Number(v.final_amount ?? v.quoted_amount ?? 0)
      if (v.status === 'confirmed' || v.status === 'completed') byServiceType[key].confirmed++
    }

    // Expense spend by category
    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      const key = e.category ?? 'Other'
      byCategory[key] = (byCategory[key] ?? 0) + Number(e.amount ?? 0)
    }

    const totalVendorSpend = vendorBookings.reduce((s, v) => s + Number(v.final_amount ?? v.quoted_amount ?? 0), 0)
    const totalExpenseSpend = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)

    return {
      totalVendorSpend,
      totalExpenseSpend,
      vendorByServiceType: Object.entries(byServiceType)
        .map(([serviceType, d]) => ({ serviceType, ...d, percentage: totalVendorSpend > 0 ? Math.round((d.total / totalVendorSpend) * 100) : 0 }))
        .sort((a, b) => b.total - a.total),
      expenseByCategory: Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount, percentage: totalExpenseSpend > 0 ? Math.round((amount / totalExpenseSpend) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount),
    }
  }

  async getGuestHeadcountTrend(tenantId: string, token: string, months = 24) {
    const client = this.supabase.forRequest(token)
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    const { data: guests } = await client
      .from('guests')
      .select('check_in_status, rsvp_status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString())

    const all = guests ?? []

    const buckets: Record<string, { month: string; invited: number; confirmed: number; checkedIn: number }> = {}
    for (let i = 0; i < months; i++) {
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { month: key, invited: 0, confirmed: 0, checkedIn: 0 }
    }

    for (const g of all) {
      const key = g.created_at.slice(0, 7)
      if (buckets[key]) {
        buckets[key].invited++
        if (g.rsvp_status === 'confirmed') buckets[key].confirmed++
        if (g.check_in_status === 'checked_in') buckets[key].checkedIn++
      }
    }

    const series = Object.values(buckets)

    // YoY comparison: group by month-of-year across 2 years
    const yoy: Record<string, { month: string; thisYear: number; lastYear: number }> = {}
    const thisYear = new Date().getFullYear()
    for (let m = 1; m <= 12; m++) {
      const key = String(m).padStart(2, '0')
      yoy[key] = { month: key, thisYear: 0, lastYear: 0 }
    }
    for (const b of series) {
      const [yr, mo] = b.month.split('-')
      if (yoy[mo]) {
        if (Number(yr) === thisYear) yoy[mo].thisYear += b.checkedIn
        else if (Number(yr) === thisYear - 1) yoy[mo].lastYear += b.checkedIn
      }
    }

    return {
      monthly: series,
      yoyComparison: Object.values(yoy),
    }
  }

  async getTopEventTypes(tenantId: string, token: string, from: string, to: string) {
    const client = this.supabase.forRequest(token)

    const [eventsRes, invoicesRes, guestsRes] = await Promise.all([
      client.from('events').select('id, event_type, expected_guests').eq('tenant_id', tenantId).gte('start_date', from).lte('start_date', to),
      client.from('invoices').select('event_id, paid_amount').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
      client.from('guests').select('event_id').eq('tenant_id', tenantId).gte('created_at', from).lte('created_at', to),
    ])

    const events = eventsRes.data ?? []
    const invoices = invoicesRes.data ?? []
    const guests = guestsRes.data ?? []

    const revenueByEvent = this.groupByKey(invoices, 'event_id')
    const guestsByEvent = this.groupByKey(guests, 'event_id')

    const typeStats: Record<string, { count: number; totalRevenue: number; totalGuests: number }> = {}
    for (const event of events) {
      const t = event.event_type ?? 'Other'
      if (!typeStats[t]) typeStats[t] = { count: 0, totalRevenue: 0, totalGuests: 0 }
      typeStats[t].count++
      const evRevenue = (revenueByEvent[event.id] ?? []).reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
      const evGuests = (guestsByEvent[event.id] ?? []).length
      typeStats[t].totalRevenue += evRevenue
      typeStats[t].totalGuests += evGuests
    }

    return Object.entries(typeStats)
      .map(([eventType, d]) => ({
        eventType,
        ...d,
        avgRevenue: d.count > 0 ? Math.round(d.totalRevenue / d.count) : 0,
        avgGuests: d.count > 0 ? Math.round(d.totalGuests / d.count) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
  }

  async exportCrossEventCSV(tenantId: string, token: string, from: string, to: string): Promise<string> {
    const rows = await this.getEventPerformanceRange(tenantId, token, from, to)

    const headers = ['Event Name', 'Type', 'Status', 'Start Date', 'Expected Guests', 'Actual Guests', 'Revenue (₹)', 'Expenses (₹)', 'Profit (₹)', 'Margin %', 'Task Completion %', 'Attendance %']
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.name}"`, r.eventType ?? '', r.status ?? '', r.startDate ?? '',
        r.expectedGuests, r.actualGuests, r.revenue, r.expenses, r.profit,
        r.margin, r.taskCompletion, r.guestAttendance,
      ].join(',')),
    ]
    return lines.join('\n')
  }

  private async getEventPerformanceRange(tenantId: string, token: string, from: string, to: string) {
    const client = this.supabase.forRequest(token)
    const { data: events } = await client.from('events').select('id, name, event_type, status, start_date, expected_guests').eq('tenant_id', tenantId).gte('start_date', from).lte('start_date', to).order('start_date', { ascending: false })

    if (!events?.length) return []
    const eventIds = events.map(e => e.id)

    const [invoicesRes, expensesRes, guestsRes, tasksRes] = await Promise.all([
      client.from('invoices').select('event_id, paid_amount').in('event_id', eventIds).eq('tenant_id', tenantId),
      client.from('expenses').select('event_id, amount').in('event_id', eventIds).eq('tenant_id', tenantId),
      client.from('guests').select('event_id, check_in_status').in('event_id', eventIds).eq('tenant_id', tenantId),
      client.from('event_tasks').select('event_id, status').in('event_id', eventIds).eq('tenant_id', tenantId),
    ])

    const invByEvent = this.groupByKey(invoicesRes.data ?? [], 'event_id')
    const expByEvent = this.groupByKey(expensesRes.data ?? [], 'event_id')
    const gstByEvent = this.groupByKey(guestsRes.data ?? [], 'event_id')
    const tskByEvent = this.groupByKey(tasksRes.data ?? [], 'event_id')

    return events.map(event => {
      const revenue = (invByEvent[event.id] ?? []).reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
      const expenses = (expByEvent[event.id] ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)
      const guests = gstByEvent[event.id] ?? []
      const tasks = tskByEvent[event.id] ?? []
      const checkedIn = guests.filter(g => g.check_in_status === 'checked_in').length
      const completedTasks = tasks.filter(t => t.status === 'completed').length
      return {
        id: event.id, name: event.name, eventType: event.event_type, status: event.status,
        startDate: event.start_date, expectedGuests: event.expected_guests ?? 0,
        actualGuests: checkedIn, revenue, expenses, profit: revenue - expenses,
        margin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
        taskCompletion: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
        guestAttendance: (event.expected_guests ?? 0) > 0 ? Math.round((checkedIn / event.expected_guests) * 100) : 0,
      }
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getDateRange(period: string): { from: string; to: string } {
    const now = new Date()
    const to = now.toISOString()

    switch (period) {
      case 'this_month': {
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        return { from, to }
      }
      case 'last_month': {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
        const toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
        return { from, to: toDate }
      }
      case 'this_quarter': {
        const qStart = Math.floor(now.getMonth() / 3) * 3
        const from = new Date(now.getFullYear(), qStart, 1).toISOString()
        return { from, to }
      }
      case 'this_year': {
        const from = new Date(now.getFullYear(), 0, 1).toISOString()
        return { from, to }
      }
      default: // all_time
        return { from: '2020-01-01T00:00:00Z', to }
    }
  }

  private groupBy(arr: any[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      const val = item[key] ?? 'unknown'
      acc[val] = (acc[val] ?? 0) + 1
      return acc
    }, {})
  }

  private groupCount(arr: any[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      const val = item[key] ?? 'other'
      acc[val] = (acc[val] ?? 0) + 1
      return acc
    }, {})
  }

  private groupByKey<T extends Record<string, any>>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce((acc: Record<string, T[]>, item) => {
      const val = item[key]
      if (!acc[val]) acc[val] = []
      acc[val].push(item)
      return acc
    }, {})
  }
}
