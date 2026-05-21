'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Users, UserCheck, UserX, UserPlus, Search, CheckCircle } from 'lucide-react'
import { useHeadcountRecon, useMarkAttended } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', color.replace('text-', 'bg-').replace('400', '500/10'))}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  )
}

export default function PostEventHeadcountPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = useHeadcountRecon(tenant, eventId)
  const markAttended = useMarkAttended(tenant, eventId)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'attended' | 'not_attended'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const summary = data?.summary ?? {}
  const guests: any[] = data?.guests ?? []
  const byCategory: any[] = data?.by_category ?? []

  const filtered = guests.filter(g => {
    const matchSearch = !search || g.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'attended' ? g.attended :
      !g.attended
    return matchSearch && matchFilter
  })

  function toggleGuest(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(g => g.id)))
    }
  }

  function handleMarkAttended() {
    markAttended.mutate(
      { guest_ids: Array.from(selected) },
      { onSuccess: () => { setSelected(new Set()); setConfirming(false) } },
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Headcount Reconciliation</h1>
          <p className="text-white/40 text-sm mt-0.5">Confirm final attendance against the guest list</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Invited" value={summary.invited ?? 0} icon={Users} color="text-white/50" />
          <StatCard label="Confirmed" value={summary.confirmed ?? 0} icon={UserCheck} color="text-blue-400" />
          <StatCard label="Attended" value={summary.attended ?? 0} icon={CheckCircle} color="text-emerald-400" />
          <StatCard label="No-Show" value={summary.no_show ?? 0} icon={UserX} color="text-red-400" />
          <StatCard label="Walk-In" value={summary.walk_in ?? 0} icon={UserPlus} color="text-amber-400" />
        </div>

        {/* By category */}
        {byCategory.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/60 mb-3">Attendance by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {byCategory.map((cat: any) => (
                <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-sm text-white/70 capitalize">{cat.category}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{cat.attended}</span>
                    <span className="text-xs text-white/30"> / {cat.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guests…"
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
            {(['all', 'attended', 'not_attended'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-2 text-xs capitalize transition-colors',
                  filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60',
                )}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <button
              onClick={() => setConfirming(true)}
              className="px-3 py-2 rounded-lg text-xs bg-emerald-500 text-white hover:bg-emerald-400"
            >
              Mark {selected.size} Attended
            </button>
          )}
        </div>

        {/* Guest table */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="accent-indigo-500"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Guest</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">RSVP</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Attended</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(5)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">
                    No guests found
                  </td>
                </tr>
              ) : (
                filtered.map(g => (
                  <tr
                    key={g.id}
                    className={cn(
                      'border-b border-white/[0.04] transition-colors',
                      selected.has(g.id) ? 'bg-indigo-500/5' : 'hover:bg-white/[0.02]',
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={() => toggleGuest(g.id)}
                        className="accent-indigo-500"
                        disabled={g.attended}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white/80 font-medium">{g.name}</div>
                      {g.email && <div className="text-xs text-white/30">{g.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white/50 capitalize">{g.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        g.rsvp_status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400' :
                        g.rsvp_status === 'declined' ? 'bg-red-500/15 text-red-400' :
                        'bg-white/10 text-white/40',
                      )}>
                        {g.rsvp_status ?? 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {g.attended ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-white">Confirm Attendance</h3>
            <p className="text-sm text-white/50">
              Mark <strong className="text-white">{selected.size} guests</strong> as attended? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
                Cancel
              </button>
              <button
                onClick={handleMarkAttended}
                disabled={markAttended.isPending}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {markAttended.isPending ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
