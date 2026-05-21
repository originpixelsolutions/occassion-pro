'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, Download, Search, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Filter, FileSearch,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  if (typeof window === 'undefined') return ''
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('supabase') && k.includes('auth')) {
        const p = JSON.parse(localStorage.getItem(k) ?? '{}')
        return p?.access_token ?? p?.access_token ?? ''
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  created_at: string
  tenant_id: string | null
  tenant_name: string | null
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_hash: string | null
  diff_before: Record<string, unknown> | null
  diff_after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

interface AuditFilters {
  search: string
  tenant_id: string
  action: string
  resource_type: string
  date_from: string
  date_to: string
}

const ACTION_TYPES = [
  '', 'create', 'update', 'delete', 'login', 'logout',
  'plan_override', 'feature_toggle', 'tenant_suspend', 'tenant_activate',
  'api_approve', 'api_revoke', 'config_change', 'job_trigger',
]

const RESOURCE_TYPES = [
  '', 'tenant', 'user', 'subscription', 'plan', 'feature_flag',
  'ai_config', 'comms_config', 'payment_config', 'discount_code',
  'event', 'vendor', 'staff',
]

const ACTION_COLORS: Record<string, string> = {
  create:           'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  update:           'text-blue-400   bg-blue-500/10   border-blue-500/20',
  delete:           'text-red-400    bg-red-500/10    border-red-500/20',
  login:            'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',
  logout:           'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',
  plan_override:    'text-violet-400 bg-violet-500/10 border-violet-500/20',
  feature_toggle:   'text-violet-400 bg-violet-500/10 border-violet-500/20',
  tenant_suspend:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
  tenant_activate:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  api_approve:      'text-blue-400   bg-blue-500/10   border-blue-500/20',
  api_revoke:       'text-red-400    bg-red-500/10    border-red-500/20',
  config_change:    'text-amber-400  bg-amber-500/10  border-amber-500/20',
  job_trigger:      'text-blue-400   bg-blue-500/10   border-blue-500/20',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function JsonDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  return (
    <div className="font-mono text-[10px] space-y-0.5">
      {[...allKeys].map(key => {
        const bVal = JSON.stringify((before ?? {})[key] ?? undefined)
        const aVal = JSON.stringify((after ?? {})[key] ?? undefined)
        if (bVal === aVal) return null
        return (
          <div key={key}>
            {before && key in before && (
              <div className="text-red-400 bg-red-500/5 px-2 py-0.5 rounded">
                − {key}: {bVal}
              </div>
            )}
            {after && key in after && (
              <div className="text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded">
                + {key}: {aVal}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState<AuditFilters>({
    search: '', tenant_id: '', action: '', resource_type: '',
    date_from: '', date_to: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const PAGE_SIZE = 25

  const load = useCallback(async (pg = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pg),
        limit: String(PAGE_SIZE),
        ...(filters.search        && { search: filters.search }),
        ...(filters.tenant_id     && { tenant_id: filters.tenant_id }),
        ...(filters.action        && { action: filters.action }),
        ...(filters.resource_type && { resource_type: filters.resource_type }),
        ...(filters.date_from     && { date_from: filters.date_from }),
        ...(filters.date_to       && { date_to: filters.date_to }),
      })
      const data = await apiFetch(`/super-admin/audit?${params}`)
      setEntries(data.entries ?? data ?? [])
      setTotal(data.total ?? (data.entries ?? data ?? []).length)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load(1); setPage(1) }, [filters])
  useEffect(() => { load(page) }, [page])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        ...(filters.search        && { search: filters.search }),
        ...(filters.tenant_id     && { tenant_id: filters.tenant_id }),
        ...(filters.action        && { action: filters.action }),
        ...(filters.resource_type && { resource_type: filters.resource_type }),
        ...(filters.date_from     && { date_from: filters.date_from }),
        ...(filters.date_to       && { date_to: filters.date_to }),
        format: 'csv',
      })
      const res = await fetch(`${API}/super-admin/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const setFilter = (k: keyof AuditFilters, v: string) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white">Audit Log</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Complete trail of all admin and system actions
            {total > 0 && <span className="ml-2 text-zinc-600">· {total.toLocaleString()} entries</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              showFilters
                ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <input
          type="text"
          placeholder="Search by tenant, user, action, resource…"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="w-full bg-[#111118] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-violet-500/40"
        />
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 mb-4 grid grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">Action Type</label>
            <select
              value={filters.action}
              onChange={e => setFilter('action', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
            >
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a || 'All actions'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">Resource Type</label>
            <select
              value={filters.resource_type}
              onChange={e => setFilter('resource_type', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
            >
              {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r || 'All resources'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">From Date</label>
            <input
              type="datetime-local"
              value={filters.date_from}
              onChange={e => setFilter('date_from', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">To Date</label>
            <input
              type="datetime-local"
              value={filters.date_to}
              onChange={e => setFilter('date_to', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_0.8fr_28px] gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
          {['Timestamp', 'Tenant', 'User', 'Action', 'Resource', 'IP', ''].map(h => (
            <p key={h} className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">{h}</p>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <FileSearch className="w-8 h-8 text-zinc-700" />
            <p className="text-xs text-zinc-600">No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {entries.map(entry => {
              const isExpanded = expandedId === entry.id
              const hasDiff = entry.diff_before || entry.diff_after
              const actionColor = ACTION_COLORS[entry.action] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'

              return (
                <div key={entry.id}>
                  <div
                    className={`grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_0.8fr_28px] gap-3 px-4 py-2.5 items-center transition-colors ${
                      hasDiff ? 'cursor-pointer hover:bg-white/[0.02]' : ''
                    }`}
                    onClick={() => hasDiff && setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <p className="text-[10px] text-zinc-500 font-mono">{fmtDate(entry.created_at)}</p>
                    <div>
                      <p className="text-[10px] text-zinc-300 truncate">{entry.tenant_name ?? entry.tenant_id ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 truncate">{entry.user_email ?? entry.user_id ?? 'system'}</p>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${actionColor} w-fit`}>
                      {entry.action}
                    </span>
                    <div>
                      <p className="text-[10px] text-zinc-400">{entry.resource_type}</p>
                      {entry.resource_id && (
                        <p className="text-[9px] text-zinc-600 font-mono truncate">{entry.resource_id.slice(0, 8)}…</p>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-600 font-mono">{entry.ip_hash ? entry.ip_hash.slice(0, 8) + '…' : '—'}</p>
                    <div className="flex items-center justify-center">
                      {hasDiff && (
                        isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                          : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                      )}
                    </div>
                  </div>

                  {/* Expanded diff */}
                  {isExpanded && hasDiff && (
                    <div className="px-4 pb-3 bg-white/[0.01]">
                      <div className="bg-black/30 rounded-lg p-3 border border-white/[0.04]">
                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Diff</p>
                        <JsonDiff before={entry.diff_before} after={entry.diff_after} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
            <p className="text-[10px] text-zinc-600">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-1 text-[10px] text-zinc-400 font-mono">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
