'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, ChevronDown, ChevronUp, ExternalLink, Loader2,
  RefreshCw, Search, Shield, TrendingDown, UserX, Zap,
  CheckCircle2, AlertTriangle, MoreHorizontal, LogIn,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

interface Tenant {
  id: string; name: string; plan: string; status: string
  created_at: string; country?: string
  eventCount: number; userCount: number; revenue: number
  health_score?: number; churn_risk?: string
  suspended_at?: string; suspended_reason?: string
  trial_ends_at?: string; storage_used_bytes?: number; storage_quota_bytes?: number
}

const PLAN_COLOR: Record<string, string> = {
  starter: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  growth: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  professional: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  enterprise: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  custom: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  suspended: 'text-red-400 bg-red-400/10 border-red-400/20',
  trial: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  churned: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
}
const CHURN_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
  none: 'text-zinc-600',
}

function HealthBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-border/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-semibold ${color.replace('bg-', 'text-')}`}>{pct}</span>
    </div>
  )
}

function StorageBar({ used, quota }: { used: number; quota: number }) {
  if (!quota) return <span className="text-[10px] text-zinc-600">—</span>
  const pct = Math.min(100, (used / quota) * 100)
  const gb = (n: number) => `${(n / 1e9).toFixed(1)}GB`
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div>
      <div className="w-16 h-1 bg-border/50 rounded-full overflow-hidden mb-0.5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-600">{gb(used)}/{gb(quota)}</span>
    </div>
  )
}

type SortKey = 'name' | 'plan' | 'status' | 'eventCount' | 'revenue' | 'health_score' | 'created_at'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterChurn, setFilterChurn] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [planOverrideVal, setPlanOverrideVal] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/tenants`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setTenants(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = tenants
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPlan !== 'all' && t.plan !== filterPlan) return false
      if (filterChurn !== 'all' && t.churn_risk !== filterChurn) return false
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <span className="w-3 h-3" />

  const doSuspend = async () => {
    if (!selected) return
    setActionLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${selected.id}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason }),
      })
      await load()
      setShowSuspend(false)
      setSuspendReason('')
    } finally {
      setActionLoading(false)
    }
  }

  const doReactivate = async (t: Tenant) => {
    setActionLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${t.id}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const doDelete = async () => {
    if (!selected || deleteConfirm !== 'DELETE') return
    setActionLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${selected.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })
      await load()
      setShowDelete(false)
      setSelected(null)
      setDeleteConfirm('')
    } finally {
      setActionLoading(false)
    }
  }

  const doPlanOverride = async () => {
    if (!selected || !planOverrideVal) return
    setActionLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${selected.id}/plan-override`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planOverrideVal, reason: 'Manual override by super admin' }),
      })
      await load()
      setPlanOverrideVal('')
    } finally {
      setActionLoading(false)
    }
  }

  const plans  = [...new Set(tenants.map(t => t.plan))]
  const statuses = [...new Set(tenants.map(t => t.status))]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Tenant Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">{tenants.length} total workspaces</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="pl-8 pr-3 py-1.5 text-xs bg-card/60 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-48"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs bg-card/60 border border-border/50 rounded-lg px-2.5 py-1.5 focus:outline-none">
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="text-xs bg-card/60 border border-border/50 rounded-lg px-2.5 py-1.5 focus:outline-none">
          <option value="all">All Plans</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterChurn} onChange={e => setFilterChurn(e.target.value)} className="text-xs bg-card/60 border border-border/50 rounded-lg px-2.5 py-1.5 focus:outline-none">
          <option value="all">All Churn Risk</option>
          {['critical','high','medium','low','none'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-background/30">
                {[
                  { key: 'name', label: 'Tenant' },
                  { key: 'plan', label: 'Plan' },
                  { key: 'status', label: 'Status' },
                  { key: 'health_score', label: 'Health' },
                  { key: 'eventCount', label: 'Events' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'created_at', label: 'Joined' },
                  { key: null, label: 'Actions' },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={() => col.key && sort(col.key as SortKey)}
                    className={`text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ${col.key ? 'cursor-pointer hover:text-foreground' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon k={col.key as SortKey} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-4 bg-muted/30 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length ? (
                filtered.map(tenant => (
                  <tr
                    key={tenant.id}
                    onClick={() => setSelected(selected?.id === tenant.id ? null : tenant)}
                    className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-white/5 ${selected?.id === tenant.id ? 'bg-violet-500/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{tenant.name}</p>
                      <p className="text-[10px] text-muted-foreground">{tenant.country ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PLAN_COLOR[tenant.plan] ?? PLAN_COLOR.starter}`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLOR[tenant.status] ?? STATUS_COLOR.active}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.health_score != null
                        ? <HealthBar score={tenant.health_score} />
                        : <span className="text-[10px] text-zinc-600">—</span>
                      }
                      {tenant.churn_risk && tenant.churn_risk !== 'none' && (
                        <p className={`text-[9px] font-semibold uppercase ${CHURN_COLOR[tenant.churn_risk]}`}>
                          <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />
                          {tenant.churn_risk} risk
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tenant.eventCount}</td>
                    <td className="px-4 py-3 text-xs text-foreground font-medium">{fmtCurrency(tenant.revenue)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(tenant.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(tenant) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-card transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No tenants found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="mt-5 bg-card/60 border border-violet-500/20 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">ID: {selected.id}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Plan</p>
              <p className="text-sm font-semibold capitalize">{selected.plan}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Health</p>
              <p className="text-sm font-semibold">{selected.health_score ?? '—'}/100</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Churn Risk</p>
              <p className={`text-sm font-semibold capitalize ${CHURN_COLOR[selected.churn_risk ?? 'none']}`}>{selected.churn_risk ?? 'none'}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Storage</p>
              <StorageBar used={selected.storage_used_bytes ?? 0} quota={selected.storage_quota_bytes ?? 0} />
            </div>
          </div>

          {selected.suspended_at && (
            <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-xs text-red-400">
              <strong>Suspended:</strong> {fmtDate(selected.suspended_at)} — {selected.suspended_reason ?? 'No reason given'}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {/* Plan Override */}
            <div className="flex items-center gap-1.5">
              <select
                value={planOverrideVal}
                onChange={e => setPlanOverrideVal(e.target.value)}
                className="text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">Override Plan…</option>
                {['starter','growth','professional','enterprise','custom'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {planOverrideVal && (
                <button
                  onClick={doPlanOverride}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-all"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Suspend / Reactivate */}
            {selected.status !== 'suspended' ? (
              <button
                onClick={() => setShowSuspend(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg hover:bg-red-400/20 transition-all"
              >
                <UserX className="w-3.5 h-3.5" /> Suspend
              </button>
            ) : (
              <button
                onClick={() => doReactivate(selected)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
              </button>
            )}

            {/* Impersonate */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-lg hover:bg-blue-400/20 transition-all">
              <LogIn className="w-3.5 h-3.5" /> Impersonate
            </button>

            {/* View */}
            <a
              href={`/dashboard?tenant=${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-card border border-border/50 rounded-lg hover:bg-card/80 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View
            </a>

            {/* Delete */}
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all ml-auto"
            >
              Delete Tenant
            </button>
          </div>
        </div>
      )}

      {/* Suspend modal */}
      {showSuspend && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold">Suspend Tenant</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Suspending <strong className="text-foreground">{selected.name}</strong> will immediately block all user logins.
            </p>
            <input
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension*"
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSuspend(false)} className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all">Cancel</button>
              <button onClick={doSuspend} disabled={!suspendReason || actionLoading} className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-all disabled:opacity-40">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-red-500" />
              <h3 className="text-base font-semibold text-red-400">Delete Tenant</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              This is <strong className="text-red-400">permanent and irreversible</strong>.
              All data for <strong className="text-foreground">{selected.name}</strong> will be deleted.
            </p>
            <p className="text-xs text-muted-foreground mb-3">Type <strong className="text-foreground font-mono">DELETE</strong> to confirm:</p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full text-sm bg-background border border-red-500/30 rounded-lg px-3 py-2 mb-4 font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowDelete(false); setDeleteConfirm('') }} className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all">Cancel</button>
              <button onClick={doDelete} disabled={deleteConfirm !== 'DELETE' || actionLoading} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-all disabled:opacity-40">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
