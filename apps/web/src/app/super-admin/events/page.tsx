'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, Search, Filter, TrendingUp,
  Users, Building2, Circle, RefreshCw, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventRow = {
  id: string
  name: string
  tenant: string
  tenant_id: string
  type: string
  status: string
  guests: number
  start: string | null
  city: string
}

type Stats = {
  total: number
  active: number
  thisMonth: number
  avgGuests: number
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  active:    { label: 'Active',     color: 'text-green-400',  dot: 'bg-green-400'  },
  published: { label: 'Published',  color: 'text-green-400',  dot: 'bg-green-400'  },
  planning:  { label: 'Planning',   color: 'text-blue-400',   dot: 'bg-blue-400'   },
  draft:     { label: 'Draft',      color: 'text-zinc-400',   dot: 'bg-zinc-500'   },
  completed: { label: 'Completed',  color: 'text-zinc-400',   dot: 'bg-zinc-500'   },
  cancelled: { label: 'Cancelled',  color: 'text-red-400',    dot: 'bg-red-400'    },
}

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, color: 'text-zinc-400', dot: 'bg-zinc-500' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminEventsPage() {
  const [events, setEvents]       = useState<EventRow[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('sa_token') ?? localStorage.getItem('access_token') ?? '')
        : ''

      const params = new URLSearchParams({ limit: '500' })
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`${API}/super-admin/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
      if (data.stats) setStats(data.stats)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = events.filter(ev => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      ev.name.toLowerCase().includes(q) ||
      ev.tenant.toLowerCase().includes(q) ||
      (ev.city ?? '').toLowerCase().includes(q)
    )
  })

  const STAT_CARDS = [
    { label: 'Total Events',  value: stats?.total     ?? '—', icon: CalendarDays, color: 'text-violet-400' },
    { label: 'Active Now',    value: stats?.active    ?? '—', icon: Circle,       color: 'text-green-400'  },
    { label: 'This Month',    value: stats?.thisMonth ?? '—', icon: TrendingUp,   color: 'text-blue-400'   },
    { label: 'Avg Guests',    value: stats?.avgGuests ?? '—', icon: Users,        color: 'text-amber-400'  },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Events</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Platform-wide event activity across all tenants</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-4 h-4', color)} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{label}</span>
            </div>
            {loading ? (
              <div className="h-7 w-16 rounded bg-white/[0.06] animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white tabular-nums">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by event, tenant, or city..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          {(['all', 'active', 'planning', 'draft', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                statusFilter === s
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent',
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.8fr] gap-4 px-4 py-2.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wide border-b border-white/[0.06]">
          <span>Event</span>
          <span>Tenant</span>
          <span>Type</span>
          <span>Status</span>
          <span className="text-right">Guests</span>
          <span className="text-right">Date</span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.8fr] gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
                <div className="h-4 rounded bg-white/[0.06]" />
                <div className="h-4 rounded bg-white/[0.06]" />
                <div className="h-4 w-16 rounded bg-white/[0.06]" />
                <div className="h-4 w-16 rounded bg-white/[0.06]" />
                <div className="h-4 w-10 rounded bg-white/[0.06] ml-auto" />
                <div className="h-4 w-14 rounded bg-white/[0.06] ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">
            {events.length === 0 ? 'No events found' : 'No events match your filters'}
          </div>
        ) : (
          filtered.map((ev, i) => {
            const sm = statusMeta(ev.status)
            return (
              <div
                key={ev.id}
                className={cn(
                  'grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.8fr] gap-4 px-4 py-3 text-sm items-center hover:bg-white/[0.03] transition-colors',
                  i < filtered.length - 1 && 'border-b border-white/[0.04]',
                )}
              >
                {/* Event */}
                <div className="min-w-0">
                  <p className="text-zinc-200 font-medium truncate">{ev.name}</p>
                  <p className="text-[10px] text-zinc-600">{ev.city}</p>
                </div>
                {/* Tenant */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3 h-3 text-zinc-600 shrink-0" />
                  <span className="text-zinc-400 text-xs truncate">{ev.tenant}</span>
                </div>
                {/* Type */}
                <span className="text-zinc-500 text-xs capitalize">{ev.type}</span>
                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sm.dot)} />
                  <span className={cn('text-xs', sm.color)}>{sm.label}</span>
                </div>
                {/* Guests */}
                <span className="text-zinc-400 text-xs text-right tabular-nums">
                  {ev.guests > 0 ? ev.guests.toLocaleString() : '—'}
                </span>
                {/* Date */}
                <span className="text-zinc-600 text-xs text-right">
                  {ev.start
                    ? new Date(ev.start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                    : '—'
                  }
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <p className="text-xs text-zinc-600 text-right">
          Showing {filtered.length} of {events.length} events
        </p>
      )}
    </div>
  )
}
