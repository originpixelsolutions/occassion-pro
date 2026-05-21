import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name)

  constructor(private readonly supabase: SupabaseService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [ticketsRes, slaBreachedRes, resolvedTodayRes, categoriesRes, agentLoadRes] = await Promise.all([
      // Tickets by status
      client
        .from('support_tickets')
        .select('id, status, priority, created_at, first_response_due, resolution_due, sla_breached, assigned_to')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '(closed,cancelled)'),

      // SLA breached open tickets
      client
        .from('support_tickets')
        .select('id, title, ticket_number, priority, sla_breached, response_sla_breached, resolution_due')
        .eq('tenant_id', tenantId)
        .or('sla_breached.eq.true,response_sla_breached.eq.true')
        .not('status', 'in', '(resolved,closed,cancelled)')
        .limit(10),

      // Resolved today
      client
        .from('support_tickets')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'resolved')
        .gte('resolved_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      // Tickets by category
      client
        .from('support_tickets')
        .select('category_id, ticket_categories(name, color)')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '(closed,cancelled)'),

      // Agent load (open tickets per assignee)
      client
        .from('support_tickets')
        .select('assigned_to, profiles(full_name, avatar_url)')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '(resolved,closed,cancelled)')
        .not('assigned_to', 'is', null),
    ])

    const tickets = ticketsRes.data ?? []
    const byStatus = tickets.reduce((acc: Record<string, number>, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    }, {})
    const byPriority = tickets.reduce((acc: Record<string, number>, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1
      return acc
    }, {})

    // Agent workload
    const agentMap: Record<string, { name: string; count: number; avatar?: string }> = {}
    ;(agentLoadRes.data ?? []).forEach((t: any) => {
      const id = t.assigned_to
      if (!agentMap[id]) agentMap[id] = { name: t.profiles?.full_name ?? 'Unknown', count: 0, avatar: t.profiles?.avatar_url }
      agentMap[id].count++
    })

    // By category
    const catMap: Record<string, { name: string; color: string; count: number }> = {}
    ;(categoriesRes.data ?? []).forEach((t: any) => {
      const catId = t.category_id ?? 'uncategorised'
      const catName = (t.ticket_categories as any)?.name ?? 'Uncategorised'
      const catColor = (t.ticket_categories as any)?.color ?? '#64748b'
      if (!catMap[catId]) catMap[catId] = { name: catName, color: catColor, count: 0 }
      catMap[catId].count++
    })

    // Average resolution time (closed/resolved tickets last 30d)
    const { data: closedTickets } = await client
      .from('support_tickets')
      .select('created_at, resolved_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .limit(100)

    const avgResolutionHrs = closedTickets && closedTickets.length > 0
      ? closedTickets.reduce((s, t) => {
          const diff = new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()
          return s + diff / 3600000
        }, 0) / closedTickets.length
      : 0

    return {
      summary: {
        total: tickets.length,
        open: byStatus['open'] ?? 0,
        inProgress: byStatus['in_progress'] ?? 0,
        pendingClient: byStatus['pending_client'] ?? 0,
        resolvedToday: resolvedTodayRes.data?.length ?? 0,
        slaBreached: (slaBreachedRes.data ?? []).length,
        avgResolutionHrs: Math.round(avgResolutionHrs * 10) / 10,
      },
      byStatus,
      byPriority,
      byCategory: Object.values(catMap).sort((a, b) => b.count - a.count),
      slaBreachedTickets: slaBreachedRes.data ?? [],
      agentWorkload: Object.values(agentMap).sort((a, b) => b.count - a.count),
    }
  }

  // ── Tickets CRUD ──────────────────────────────────────────────────────────

  async listTickets(
    tenantId: string,
    token: string,
    filters: {
      status?: string
      priority?: string
      category_id?: string
      assigned_to?: string
      event_id?: string
      sla_breached?: boolean
      search?: string
      limit?: number
      offset?: number
    } = {},
  ) {
    const client = this.supabase.forRequest(token)
    let query = client
      .from('support_tickets')
      .select(`
        *,
        ticket_categories(name, color),
        assignee:assigned_to(full_name, avatar_url),
        escalated_user:escalated_to(full_name),
        _comment_count:ticket_comments(count)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.category_id) query = query.eq('category_id', filters.category_id)
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
    if (filters.event_id) query = query.eq('event_id', filters.event_id)
    if (filters.sla_breached !== undefined) query = query.eq('sla_breached', filters.sla_breached)
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.limit) query = query.limit(filters.limit)
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getTicket(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('support_tickets')
      .select(`
        *,
        ticket_categories(name, color, sla_hours),
        assignee:assigned_to(id, full_name, avatar_url, role),
        escalated_user:escalated_to(id, full_name),
        resolved_by_user:resolved_by(full_name),
        reporter:reporter_id(full_name, avatar_url),
        ticket_comments(*, author:author_id(full_name, avatar_url)),
        ticket_activities(*, actor:actor_id(full_name)),
        ticket_kb_links(*, article:article_id(id, title, slug, summary))
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Ticket not found')
    return data
  }

  async createTicket(dto: any, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    // Generate ticket number
    const { data: numData } = await client.rpc('generate_ticket_number', { p_tenant_id: tenantId })
    const ticketNumber = numData ?? `TKT-${Date.now()}`

    // Look up SLA policy for priority
    const { data: sla } = await client
      .from('sla_policies')
      .select('first_response_hrs, resolution_hrs')
      .eq('tenant_id', tenantId)
      .eq('priority', dto.priority ?? 'medium')
      .single()

    const now = new Date()
    const firstResponseDue = sla
      ? new Date(now.getTime() + sla.first_response_hrs * 3600000).toISOString()
      : null
    const resolutionDue = sla
      ? new Date(now.getTime() + sla.resolution_hrs * 3600000).toISOString()
      : null

    const { data, error } = await client
      .from('support_tickets')
      .insert({
        tenant_id: tenantId,
        ticket_number: ticketNumber,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'open',
        priority: dto.priority ?? 'medium',
        category_id: dto.category_id ?? null,
        reporter_type: dto.reporter_type ?? 'internal',
        reporter_id: dto.reporter_id ?? userId,
        reporter_name: dto.reporter_name,
        reporter_email: dto.reporter_email,
        assigned_to: dto.assigned_to ?? null,
        assigned_team: dto.assigned_team ?? null,
        event_id: dto.event_id ?? null,
        vendor_id: dto.vendor_id ?? null,
        related_entity_type: dto.related_entity_type ?? null,
        related_entity_id: dto.related_entity_id ?? null,
        tags: dto.tags ?? [],
        first_response_due: firstResponseDue,
        resolution_due: resolutionDue,
        metadata: dto.metadata ?? {},
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Log creation activity
    await client.from('ticket_activities').insert({
      tenant_id: tenantId,
      ticket_id: data.id,
      actor_id: userId,
      action: 'created',
      new_value: dto.title,
    })

    return data
  }

  async updateTicket(id: string, dto: any, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    // Check exists
    const { data: existing } = await client
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (!existing) throw new NotFoundException('Ticket not found')

    const payload: any = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.category_id !== undefined && { category_id: dto.category_id }),
      ...(dto.assigned_to !== undefined && { assigned_to: dto.assigned_to }),
      ...(dto.assigned_team !== undefined && { assigned_team: dto.assigned_team }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.event_id !== undefined && { event_id: dto.event_id }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    }

    const { data, error } = await client
      .from('support_tickets')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Log actor for activity trigger context
    await client.from('ticket_activities').insert({
      tenant_id: tenantId,
      ticket_id: id,
      actor_id: userId,
      action: 'updated',
      metadata: { fields: Object.keys(payload) },
    })

    return data
  }

  async updateStatus(id: string, status: string, resolution_note: string | undefined, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    const payload: any = { status }
    if (status === 'resolved') {
      payload.resolved_at = new Date().toISOString()
      payload.resolved_by = userId
      if (resolution_note) payload.resolution_note = resolution_note
    }
    if (status === 'closed') {
      payload.closed_at = new Date().toISOString()
    }

    const { data, error } = await client
      .from('support_tickets')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async escalateTicket(id: string, escalatedTo: string, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    const { data, error } = await client
      .from('support_tickets')
      .update({ escalated_to: escalatedTo, priority: 'high' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await client.from('ticket_activities').insert({
      tenant_id: tenantId,
      ticket_id: id,
      actor_id: userId,
      action: 'escalated',
      new_value: escalatedTo,
    })

    return data
  }

  async submitSatisfaction(id: string, score: number, note: string | undefined, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('support_tickets')
      .update({
        satisfaction_score: score,
        satisfaction_note: note,
        satisfaction_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, satisfaction_score')
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async addComment(ticketId: string, dto: any, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    const { data: profile } = await client
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const { data, error } = await client
      .from('ticket_comments')
      .insert({
        tenant_id: tenantId,
        ticket_id: ticketId,
        author_id: userId,
        author_name: profile?.full_name ?? 'Agent',
        author_type: dto.author_type ?? 'agent',
        body: dto.body,
        is_internal: dto.is_internal ?? false,
        attachments: dto.attachments ?? [],
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // If first comment, record first_response_at
    const { data: existing } = await client
      .from('support_tickets')
      .select('first_response_at')
      .eq('id', ticketId)
      .single()

    if (!existing?.first_response_at) {
      await client
        .from('support_tickets')
        .update({ first_response_at: new Date().toISOString() })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
    }

    return data
  }

  // ── Knowledge Base ────────────────────────────────────────────────────────

  async listArticles(tenantId: string, token: string, status?: string, search?: string) {
    const client = this.supabase.forRequest(token)
    let query = client
      .from('kb_articles')
      .select('*, ticket_categories(name, color), author:author_id(full_name)')
      .eq('tenant_id', tenantId)
      .order('view_count', { ascending: false })

    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data } = await query
    return data ?? []
  }

  async getArticle(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('kb_articles')
      .select('*, ticket_categories(name, color), author:author_id(full_name, avatar_url)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Article not found')

    // Increment view count
    await client.from('kb_articles').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id)

    return data
  }

  async upsertArticle(dto: any, tenantId: string, token: string, userId: string) {
    const client = this.supabase.forRequest(token)

    // Auto-generate slug if new
    if (!dto.id && !dto.slug) {
      const base = (dto.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      const ts = Date.now().toString(36)
      dto.slug = `${base}-${ts}`
    }

    const payload = {
      tenant_id: tenantId,
      category_id: dto.category_id ?? null,
      title: dto.title,
      slug: dto.slug,
      content: dto.content,
      summary: dto.summary ?? null,
      status: dto.status ?? 'draft',
      is_public: dto.is_public ?? false,
      tags: dto.tags ?? [],
      author_id: userId,
      published_at: dto.status === 'published' ? (dto.published_at ?? new Date().toISOString()) : null,
    }

    const { data, error } = dto.id
      ? await client.from('kb_articles').update(payload).eq('id', dto.id).eq('tenant_id', tenantId).select().single()
      : await client.from('kb_articles').insert(payload).select().single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async rateArticle(id: string, helpful: boolean, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: article } = await client
      .from('kb_articles')
      .select('helpful_count, not_helpful_count')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!article) throw new NotFoundException('Article not found')

    const { data } = await client
      .from('kb_articles')
      .update({
        helpful_count: helpful ? (article.helpful_count ?? 0) + 1 : article.helpful_count,
        not_helpful_count: !helpful ? (article.not_helpful_count ?? 0) + 1 : article.not_helpful_count,
      })
      .eq('id', id)
      .select('id, helpful_count, not_helpful_count')
      .single()

    return data
  }

  // ── Categories & SLA ──────────────────────────────────────────────────────

  async listCategories(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data } = await client
      .from('ticket_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  }

  async listSlaPolicies(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data } = await client
      .from('sla_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('first_response_hrs')
    return data ?? []
  }

  // ── Bulk operations ───────────────────────────────────────────────────────

  async bulkUpdateStatus(ids: string[], status: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const payload: any = { status }
    if (status === 'resolved') payload.resolved_at = new Date().toISOString()
    if (status === 'closed') payload.closed_at = new Date().toISOString()

    const { data, error } = await client
      .from('support_tickets')
      .update(payload)
      .in('id', ids)
      .eq('tenant_id', tenantId)
      .select('id, status')

    if (error) throw new BadRequestException(error.message)
    return { updated: data?.length ?? 0 }
  }

  async bulkAssign(ids: string[], assignedTo: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('support_tickets')
      .update({ assigned_to: assignedTo })
      .in('id', ids)
      .eq('tenant_id', tenantId)
      .select('id, assigned_to')

    if (error) throw new BadRequestException(error.message)
    return { updated: data?.length ?? 0 }
  }

  // ── Agent performance stats ───────────────────────────────────────────────

  async getAgentStats(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [openRes, resolvedRes] = await Promise.all([
      client
        .from('support_tickets')
        .select('assigned_to, priority, profiles(full_name, avatar_url)')
        .eq('tenant_id', tenantId)
        .not('assigned_to', 'is', null)
        .not('status', 'in', '(resolved,closed,cancelled)'),
      client
        .from('support_tickets')
        .select('assigned_to, satisfaction_score, resolved_at, created_at, profiles(full_name)')
        .eq('tenant_id', tenantId)
        .not('assigned_to', 'is', null)
        .eq('status', 'resolved')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString()),
    ])

    const agentMap: Record<string, any> = {}

    const track = (id: string, name: string, avatar?: string) => {
      if (!agentMap[id]) agentMap[id] = {
        id, name, avatar,
        open: 0, critical: 0, high: 0, resolved: 0,
        totalSatScore: 0, satCount: 0, avgResolutionHrs: 0, resolutionTotal: 0,
      }
    }

    ;(openRes.data ?? []).forEach((t: any) => {
      track(t.assigned_to, t.profiles?.full_name, t.profiles?.avatar_url)
      agentMap[t.assigned_to].open++
      if (t.priority === 'critical') agentMap[t.assigned_to].critical++
      if (t.priority === 'high') agentMap[t.assigned_to].high++
    })

    ;(resolvedRes.data ?? []).forEach((t: any) => {
      track(t.assigned_to, t.profiles?.full_name)
      agentMap[t.assigned_to].resolved++
      if (t.satisfaction_score) {
        agentMap[t.assigned_to].totalSatScore += t.satisfaction_score
        agentMap[t.assigned_to].satCount++
      }
      if (t.resolved_at) {
        const hrs = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000
        agentMap[t.assigned_to].resolutionTotal += hrs
      }
    })

    return Object.values(agentMap).map(a => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      openTickets: a.open,
      criticalTickets: a.critical,
      resolvedThisMonth: a.resolved,
      avgSatisfaction: a.satCount > 0 ? Math.round((a.totalSatScore / a.satCount) * 10) / 10 : null,
      avgResolutionHrs: a.resolved > 0 ? Math.round((a.resolutionTotal / a.resolved) * 10) / 10 : null,
    })).sort((a, b) => b.openTickets - a.openTickets)
  }
}
