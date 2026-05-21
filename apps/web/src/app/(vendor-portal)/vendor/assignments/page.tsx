'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Assignment {
  id: string
  event_id: string
  event_name: string
  event_date: string
  event_location?: string
  service_description: string
  agreed_amount: number
  currency_code: string
  status: string
  tenant_name: string
  unread_messages: number
  invited_at: string
}

const FILTERS = ['all', 'invited', 'confirmed', 'in_progress', 'completed', 'declined', 'cancelled']

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  declined: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

function fmtCurrency(amount: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AssignmentsList() {
  const params = useSearchParams()
  const initFilter = params.get('filter') ?? 'all'

  const [filter, setFilter] = useState(initFilter)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return
    const qs = filter !== 'all' ? `?status=${filter}` : ''
    fetch(`/api/v1/vendor-portal/events${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAssignments(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  const filtered = search
    ? assignments.filter(a =>
        a.event_name.toLowerCase().includes(search.toLowerCase()) ||
        a.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.service_description?.toLowerCase().includes(search.toLowerCase())
      )
    : assignments

  return (
    <div className="space-y-5">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events, organisers…"
            className="w-full pl-9 pr-4 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No assignments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <Link
              key={a.id}
              href={`/vendor/assignments/${a.id}`}
              className="block bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0 text-zinc-400 text-sm font-medium">
                  {a.event_name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white text-sm font-medium">{a.event_name}</h3>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded border capitalize ${STATUS_STYLES[a.status] ?? ''}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                    {a.unread_messages > 0 && (
                      <span className="px-1.5 py-0.5 bg-violet-500 rounded-full text-[10px] text-white font-medium">
                        {a.unread_messages} new
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">
                    {a.tenant_name} · {fmtDate(a.event_date)}
                    {a.event_location && ` · ${a.event_location}`}
                  </p>
                  {a.service_description && (
                    <p className="text-zinc-400 text-xs mt-1.5 line-clamp-1">{a.service_description}</p>
                  )}
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-white text-sm font-medium">
                    {a.agreed_amount ? fmtCurrency(a.agreed_amount, a.currency_code) : <span className="text-zinc-600 text-xs">TBD</span>}
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">Invited {fmtDate(a.invited_at)}</p>
                </div>

                <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Respond buttons for invited state */}
              {a.status === 'invited' && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-2">
                  <span className="text-xs text-amber-400">⚠ Awaiting your response</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AssignmentsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">My Assignments</h1>
        <p className="text-zinc-400 text-sm mt-0.5">All event engagements across organisers</p>
      </div>
      <Suspense fallback={<div className="text-zinc-400 text-sm">Loading…</div>}>
        <AssignmentsList />
      </Suspense>
    </div>
  )
}
