'use client'

/**
 * Vendor Portal — My Events
 * GET /vendor-portal/events → list of assignments with event info
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays, ChevronRight, Loader2, MapPin, Tag,
  DollarSign, Clock, CheckCircle2, XCircle, Search,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface Assignment {
  id: string
  status: string
  service_description: string | null
  agreed_amount: number | null
  currency_code: string
  vendor_response_note: string | null
  responded_at: string | null
  event: {
    id: string
    name: string
    event_date: string | null
    event_type: string | null
    venue: string | null
  }
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'invited', label: 'Invited' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled,declined', label: 'Inactive' },
]

const STATUS_COLORS: Record<string, string> = {
  invited:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  confirmed:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  in_progress: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  completed:   'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  cancelled:   'text-red-400 bg-red-500/10 border-red-500/20',
  declined:    'text-red-400 bg-red-500/10 border-red-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  invited: 'Invited', confirmed: 'Confirmed', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined',
}

function formatCurrency(amount: number | null, currency = 'INR') {
  if (amount == null) return null
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function EventsList() {
  const router  = useRouter()
  const params  = useSearchParams()
  const initTab = params.get('status') ?? ''

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState(initTab)
  const [search, setSearch]           = useState('')

  useEffect(() => {
    const session = localStorage.getItem('vp_session')
    if (!session) { router.replace('/vendor/login'); return }

    fetch(`${API}/vendor-portal/events`, { headers: { 'X-Vendor-Session': session } })
      .then(r => {
        if (r.status === 401) { router.replace('/vendor/login'); return null }
        return r.json()
      })
      .then(data => {
        if (data) setAssignments(data.assignments ?? data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  const filtered = assignments.filter(a => {
    const tabMatch = !tab || tab.split(',').includes(a.status)
    const q = search.toLowerCase()
    const searchMatch = !q ||
      (a.event?.name ?? '').toLowerCase().includes(q) ||
      (a.service_description ?? '').toLowerCase().includes(q) ||
      (a.event?.venue ?? '').toLowerCase().includes(q)
    return tabMatch && searchMatch
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">My Events</h1>
        <p className="text-sm text-zinc-500 mt-1">All your event assignments in one place.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No events found</p>
          {search && <p className="text-xs text-zinc-600 mt-1">Try a different search term.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <button
              key={a.id}
              onClick={() => router.push(`/vendor/events/${a.id}`)}
              className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                      {a.event?.name ?? 'Unnamed Event'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_COLORS[a.status] ?? ''}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(a.event?.event_date)}
                    </span>
                    {a.event?.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {a.event.venue}
                      </span>
                    )}
                    {a.event?.event_type && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {a.event.event_type}
                      </span>
                    )}
                    {a.service_description && (
                      <span className="text-zinc-600">· {a.service_description}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {a.agreed_amount != null && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(a.agreed_amount, a.currency_code)}
                      </p>
                      <p className="text-xs text-zinc-600">{a.currency_code}</p>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>

              {/* Invited CTA */}
              {a.status === 'invited' && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">Awaiting your response — tap to accept or decline.</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VendorEventsPage() {
  return (
    <Suspense>
      <EventsList />
    </Suspense>
  )
}
