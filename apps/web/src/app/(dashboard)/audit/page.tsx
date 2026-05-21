'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Download, Filter, Search, RefreshCw, ChevronLeft, ChevronRight,
  User, Shield, AlertTriangle, Info, AlertOctagon, Calendar,
  Edit, Trash2, Plus, Eye, LogIn, Settings, Globe, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string
  actor_name: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  severity: 'info' | 'warning' | 'critical'
  portal: string
  ip_address: string | null
  diff: Record<string, any> | null
  created_at: string
}

interface AuditStats {
  total_30d: number
  by_severity: { info: number; warning: number; critical: number }
  top_actions: Array<{ action: string; count: number }>
  top_resources: Array<{ type: string; count: number }>
  top_actors: Array<{ id: string; name: string; count: number }>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, any> = {
  created: Plus, updated: Edit, deleted: Trash2,
  viewed: Eye, login: LogIn, logout: LogIn,
  approved: Shield, rejected: AlertTriangle,
  exported: Download, settings_changed: Settings,
  default: Zap,
}

const SEVERITY_CONFIG = {
  info:     { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: Info },
  warning:  { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',     icon: AlertOctagon },
}

const PORTALS = ['team','client','vendor','guest','super_admin','api']
const RESOURCE_TYPES = [
  'events','guests','invoices','event_team_members','payments','documents',
  'vendors','venues','short_links','event_types','users','tenants',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const api = useApi()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [portal, setPortal] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const buildParams = useCallback(() => {
    const p: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }
    if (search)       p.search = search
    if (severity)     p.severity = severity
    if (resourceType) p.resourceType = resourceType
    if (portal)       p.portal = portal
    if (from)         p.from = new Date(from).toISOString()
    if (to)           p.to = new Date(to + 'T23:59:59').toISOString()
    return new URLSearchParams(p).toString()
  }, [search, severity, resourceType, portal, from, to, page])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const [res, statsRes] = await Promise.all([
        api.get(`/audit?${buildParams()}`),
        stats ? null : api.get('/audit/stats'),
      ])
      setLogs(res?.data ?? [])
      setTotal(res?.total ?? 0)
      if (statsRes) setStats(statsRes)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleExport = () => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    const token = document.cookie.match(/auth_token=([^;]+)/)?.[1] ?? ''
    const params = buildParams()
    window.open(`${base}/audit/export.csv?${params}`, '_blank')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-400" /> Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete immutable activity log for your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total (30 days)', value: stats.total_30d, color: 'text-foreground' },
            { label: 'Info', value: stats.by_severity.info, color: 'text-blue-400' },
            { label: 'Warnings', value: stats.by_severity.warning, color: 'text-amber-400' },
            { label: 'Critical', value: stats.by_severity.critical, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="relative col-span-2 sm:col-span-1 lg:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search actor, resource…"
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <select
            value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(0) }}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={resourceType}
            onChange={e => { setResourceType(e.target.value); setPage(0) }}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">All Resources</option>
            {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          <select
            value={portal}
            onChange={e => { setPortal(e.target.value); setPage(0) }}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">All Portals</option>
            {PORTALS.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="date" value={from}
              onChange={e => { setFrom(e.target.value); setPage(0) }}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground">{total.toLocaleString()} entries</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-background border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No audit logs found</p>
            <p className="text-xs mt-1">Actions in your workspace appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map(log => {
              const sev = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.info
              const SevIcon = sev.icon
              const ActionIcon = ACTION_ICONS[log.action] ?? ACTION_ICONS.default
              const isExpanded = expanded === log.id
              const hasDiff = log.diff && Object.keys(log.diff).length > 0

              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                  >
                    {/* Severity dot */}
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0', sev.bg)}>
                      <SevIcon className={cn('w-3 h-3', sev.color)} />
                    </div>

                    {/* Action icon */}
                    <div className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                      <ActionIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold capitalize">{log.action}</span>
                        <span className="text-xs text-muted-foreground capitalize">{log.resource_type.replace(/_/g, ' ')}</span>
                        {log.resource_name && (
                          <span className="text-xs text-foreground truncate max-w-[180px]">"{log.resource_name}"</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.actor_name ?? 'System'}
                          {log.actor_role && ` (${log.actor_role})`}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 capitalize">
                          <Globe className="w-3 h-3" />{log.portal}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>

                  {/* Expanded diff view */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-background/50 border-t border-border">
                      <div className="grid grid-cols-2 gap-4 pt-3 text-xs">
                        {log.ip_address && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">IP Address</p>
                            <p className="font-mono">{log.ip_address}</p>
                          </div>
                        )}
                        {log.actor_email && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">Actor Email</p>
                            <p>{log.actor_email}</p>
                          </div>
                        )}
                        {log.resource_id && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">Resource ID</p>
                            <p className="font-mono text-[10px] truncate">{log.resource_id}</p>
                          </div>
                        )}
                      </div>
                      {hasDiff && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Changes</p>
                          <div className="space-y-1">
                            {Object.entries(log.diff!).map(([key, val]: [string, any]) => (
                              <div key={key} className="flex items-start gap-2 text-xs">
                                <span className="text-muted-foreground w-32 shrink-0 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="text-red-400 line-through truncate max-w-[150px]">
                                  {JSON.stringify(val.old)}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-green-400 truncate max-w-[150px]">
                                  {JSON.stringify(val.new)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(0)} disabled={page === 0}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-accent disabled:opacity-40">First</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-accent disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-accent disabled:opacity-40">Last</button>
            </div>
          </div>
        )}
      </div>

      {/* Top Actors / Actions breakdown */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3">Top Actions (30d)</h3>
            <div className="space-y-2">
              {stats.top_actions.slice(0, 6).map(({ action, count }) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-xs capitalize">{action}</span>
                  <span className="text-xs font-bold text-violet-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3">Top Resources (30d)</h3>
            <div className="space-y-2">
              {stats.top_resources.slice(0, 6).map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-bold text-blue-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3">Most Active Users (30d)</h3>
            <div className="space-y-2">
              {stats.top_actors.map(({ id, name, count }) => (
                <div key={id} className="flex items-center justify-between">
                  <span className="text-xs truncate max-w-[140px]">{name}</span>
                  <span className="text-xs font-bold text-green-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
