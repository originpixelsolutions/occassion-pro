import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface LogEntryDto {
  tenantId: string
  eventId?: string
  actorId?: string
  actorName?: string
  actorEmail?: string
  actorRole?: string
  action: string
  resourceType: string
  resourceId?: string
  resourceName?: string
  oldValue?: Record<string, any>
  newValue?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  portal?: string
  severity?: 'info' | 'warning' | 'critical'
  tags?: string[]
}

export interface AuditQueryDto {
  eventId?: string
  actorId?: string
  resourceType?: string
  action?: string
  severity?: string
  portal?: string
  from?: string
  to?: string
  search?: string
  limit?: number
  offset?: number
}

@Injectable()
export class AuditService {
  constructor(private readonly supa: SupabaseService) {}

  private get db() { return this.supa.serviceClient }

  /** Write an audit log entry — fire-and-forget safe */
  async log(entry: LogEntryDto): Promise<void> {
    // Compute diff if both old and new provided
    let diff: Record<string, any> | undefined
    if (entry.oldValue && entry.newValue) {
      diff = {}
      const allKeys = new Set([...Object.keys(entry.oldValue), ...Object.keys(entry.newValue)])
      for (const key of allKeys) {
        if (JSON.stringify(entry.oldValue[key]) !== JSON.stringify(entry.newValue[key])) {
          diff[key] = { old: entry.oldValue[key], new: entry.newValue[key] }
        }
      }
      if (Object.keys(diff).length === 0) diff = undefined
    }

    await this.db.from('audit_logs').insert({
      tenant_id:     entry.tenantId,
      event_id:      entry.eventId ?? null,
      actor_id:      entry.actorId ?? null,
      actor_name:    entry.actorName ?? null,
      actor_email:   entry.actorEmail ?? null,
      actor_role:    entry.actorRole ?? null,
      action:        entry.action,
      resource_type: entry.resourceType,
      resource_id:   entry.resourceId ?? null,
      resource_name: entry.resourceName ?? null,
      old_value:     entry.oldValue ?? null,
      new_value:     entry.newValue ?? null,
      diff:          diff ?? null,
      ip_address:    entry.ipAddress ?? null,
      user_agent:    entry.userAgent ?? null,
      portal:        entry.portal ?? 'team',
      severity:      entry.severity ?? 'info',
      tags:          entry.tags ?? null,
    })
    // ignore errors — audit must never break main operation
  }

  /** Convenience: extract actor info from request user object */
  actorFromUser(user: any) {
    return {
      actorId:    user?.id,
      actorName:  user?.name ?? user?.full_name ?? null,
      actorEmail: user?.email ?? null,
      actorRole:  user?.role ?? null,
      tenantId:   user?.tenantId,
    }
  }

  // ── QUERY ─────────────────────────────────────────────────────────────────

  async query(tenantId: string, params: AuditQueryDto) {
    const limit  = Math.min(params.limit ?? 50, 200)
    const offset = params.offset ?? 0

    let q = this.db
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.eventId)      q = q.eq('event_id', params.eventId)
    if (params.actorId)      q = q.eq('actor_id', params.actorId)
    if (params.resourceType) q = q.eq('resource_type', params.resourceType)
    if (params.action)       q = q.eq('action', params.action)
    if (params.severity)     q = q.eq('severity', params.severity)
    if (params.portal)       q = q.eq('portal', params.portal)
    if (params.from)         q = q.gte('created_at', params.from)
    if (params.to)           q = q.lte('created_at', params.to)
    if (params.search)       q = q.or(`actor_name.ilike.%${params.search}%,resource_name.ilike.%${params.search}%,action.ilike.%${params.search}%`)

    const { data, count, error } = await q
    if (error) throw new Error(error.message)

    return { data: data ?? [], total: count ?? 0, limit, offset }
  }

  async getStats(tenantId: string, eventId?: string) {
    let q = this.db.from('audit_logs').select('action,severity,resource_type,actor_id,actor_name,created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (eventId) q = q.eq('event_id', eventId)

    const { data } = await q
    const logs = data ?? []

    const actionCounts: Record<string, number> = {}
    const resourceCounts: Record<string, number> = {}
    const actorCounts: Record<string, { name: string; count: number }> = {}
    const severityCounts: Record<string, number> = { info: 0, warning: 0, critical: 0 }

    for (const log of logs) {
      actionCounts[log.action]         = (actionCounts[log.action] ?? 0) + 1
      resourceCounts[log.resource_type] = (resourceCounts[log.resource_type] ?? 0) + 1
      severityCounts[log.severity]     = (severityCounts[log.severity] ?? 0) + 1
      if (log.actor_id) {
        if (!actorCounts[log.actor_id]) actorCounts[log.actor_id] = { name: log.actor_name ?? 'Unknown', count: 0 }
        actorCounts[log.actor_id].count++
      }
    }

    const topActors = Object.entries(actorCounts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      total_30d:       logs.length,
      by_severity:     severityCounts,
      top_actions:     Object.entries(actionCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([action,count]) => ({ action, count })),
      top_resources:   Object.entries(resourceCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([type,count]) => ({ type, count })),
      top_actors:      topActors,
    }
  }

  async exportCsv(tenantId: string, params: AuditQueryDto): Promise<string> {
    const result = await this.query(tenantId, { ...params, limit: 1000, offset: 0 })

    const headers = ['Timestamp','Actor','Role','Action','Resource','Resource Name','Severity','Portal','IP Address']
    const rows = result.data.map((log: any) => [
      new Date(log.created_at).toISOString(),
      log.actor_name ?? '',
      log.actor_role ?? '',
      log.action,
      log.resource_type,
      log.resource_name ?? '',
      log.severity,
      log.portal ?? '',
      log.ip_address ?? '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return csv
  }
}
