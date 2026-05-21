import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { SubscriptionService } from '../subscription/subscription.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../common/supabase/supabase.service'
import type { EventInsert, EventUpdate, PaginatedResult, QueryOptions } from '@occasionpro/database'

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: EventEmitter2,
    private readonly subscriptionSvc: SubscriptionService,
  ) {}

  async findAll(
    tenantId: string,
    token: string,
    options: QueryOptions & {
      status?: string
      category?: string
      search?: string
    } = {},
  ): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 25, status, category, search } = options
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const client = this.supabase.forRequest(token)
    let query = client
      .from('events')
      .select(`
        *,
        venues(id, name, city),
        profiles!events_created_by_fkey(id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('start_date', { ascending: true })
      .range(from, to)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (search) query = query.ilike('name', `%${search}%`)

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
      .from('events')
      .select(`
        *,
        venues(*),
        event_phases(*),
        budgets(id, total_budget, total_actual_spend, currency),
        microsites(id, status, subdomain, custom_domain),
        profiles!events_created_by_fkey(id, full_name, avatar_url)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single()

    if (error || !data) throw new NotFoundException(`Event ${id} not found`)
    return data
  }

  async create(dto: EventInsert, token: string) {
    const client = this.supabase.forRequest(token)

    const { count } = await client
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', dto.tenant_id as string)
      .is('deleted_at', null)
    await this.subscriptionSvc.checkLimit(dto.tenant_id as string, 'events', count ?? 0)

    const { data, error } = await client
      .from('events')
      .insert(dto)
      .select()
      .single()

    if (error) throw new Error(error.message)
    this.emitter.emit('event.created', data)
    return data
  }

  async update(id: string, tenantId: string, dto: EventUpdate, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new NotFoundException(`Event ${id} not found`)
    this.emitter.emit('event.updated', data)
    return data
  }

  async archive(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error || !data) throw new NotFoundException(`Event ${id} not found`)
    this.emitter.emit('event.archived', data)
    return { message: 'Event archived' }
  }

  // ─── Soft Delete (30-day grace period) ─────────────────────────────────────

  async softDelete(id: string, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const { data: existing } = await client
      .from('events')
      .select('id, name, deleted_at')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!existing) throw new NotFoundException(`Event ${id} not found`)
    if (existing.deleted_at) return { message: 'Event already in trash' }

    const now = new Date()
    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { error } = await client
      .from('events')
      .update({
        deleted_at:                  now.toISOString(),
        deletion_scheduled_purge_at: purgeAt.toISOString(),
        deleted_by:                  userId,
        updated_at:                  now.toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(error.message)

    this.emitter.emit('event.soft_deleted', { id, tenantId, userId, purgeAt: purgeAt.toISOString() })
    return { message: 'Event moved to trash', purge_at: purgeAt.toISOString() }
  }

  // ─── Dashboard Stats ────────────────────────────────────────────────────────

  async getDashboardStats(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [allEvents, upcomingEvents, activeEvents] = await Promise.all([
      client.from('events').select('id, status', { count: 'exact', head: false })
        .eq('tenant_id', tenantId).is('deleted_at', null),
      client.from('events').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).is('deleted_at', null)
        .gte('start_date', new Date().toISOString()),
      client.from('events').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).is('deleted_at', null)
        .eq('status', 'published'),
    ])

    const statusBreakdown: Record<string, number> = {}
    for (const row of allEvents.data ?? []) {
      statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1
    }

    return {
      total: allEvents.count ?? 0,
      upcoming: upcomingEvents.count ?? 0,
      active: activeEvents.count ?? 0,
      status_breakdown: statusBreakdown,
    }
  }

  // ─── Trash Management ───────────────────────────────────────────────────────

  async getDeleted(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .select('id, name, status, deleted_at, deletion_scheduled_purge_at, deleted_by')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }

  async restore(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .update({
        deleted_at: null,
        deletion_scheduled_purge_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .select('id, name, status')
      .single()

    if (error || !data) throw new NotFoundException(`Event ${id} not found in trash`)
    this.emitter.emit('event.restored', data)
    return { message: 'Event restored', event: data }
  }

  async permanentDelete(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const { data: existing } = await client
      .from('events')
      .select('id, deleted_at')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!existing) throw new NotFoundException(`Event ${id} not found`)
    if (!existing.deleted_at) {
      throw new ForbiddenException('Event must be soft-deleted before permanent deletion.')
    }

    const { error } = await client.from('events').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    this.emitter.emit('event.permanently_deleted', { id, tenantId })
    return { message: 'Event permanently deleted' }
  }
}
