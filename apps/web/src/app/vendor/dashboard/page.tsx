'use client'

/**
 * Vendor Portal — Dashboard
 * GET /vendor-portal/events  → assignments + event info
 * GET /vendor-portal/performance
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, CheckCircle2, Clock, DollarSign, Star,
  TrendingUp, ChevronRight, Loader2, AlertCircle, Award,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface Assignment {
  id: string
  status: string
  service_description: string | null
  agreed_amount: number | null
  currency_code: string
  event: {
    id: string
    name: string
    event_date: string | null
    event_type: string | null
    venue: string | null
  }
}

interface Performance {
  score: number | null
  total_assignments: number
  completed_assignments: number
  avg_rating: number | null
  total_earnings: number
}

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
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VendorDashboardPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [perf, setPerf]               = useState<Performance | null>(null)
  const [vendorName, setVendorName]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    const session = localStorage.getItem('vp_session')
    const vendor  = localStorage.getItem('vp_vendor')
    if (vendor) {
      try { setVendorName(JSON.parse(vendor).name ?? '') } catch {}
    }
    if (!session) { router.replace('/vendor/login'); return }

    async function load() {
      try {
        const headers = { 'X-Vendor-Session': session! }
        const [aRes, pRes] = await Promise.all([
          fetch(`${API}/vendor-portal/events`, { headers }),
          fetch(`${API}/vendor-portal/performance`, { headers }),
        ])
        if (aRes.status === 401) { router.replace('/vendor/login'); return }
        if (aRes.ok) {
          const data = await aRes.json()
          setAssignments(data.assignments ?? data)
        }
        if (pRes.ok) {
          const data = await pRes.json()
          setPerf(data)
        }
      } catch {
        setError('Failed to load dashboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const pending   = assignments.filter(a => a.status === 'invited').length
  const active    = assignments.filter(a => ['confirmed','in_progress'].includes(a.status)).length
  const completed = assignments.filter(a => a.status === 'completed').length
  const recent    = [...assignments]
    .sort((a, b) => (b.event?.event_date ?? '').localeCompare(a.event?.event_date ?? ''))
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">
          {vendorName ? `Welcome, ${vendorName.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Here's an overview of your vendor activity.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Invites', value: String(pending),   icon: Clock,       color: 'text-amber-400',   bg: 'bg-amber-500/10' },
          { label: 'Active Events',   value: String(active),    icon: CalendarDays, color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Completed',       value: String(completed), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Performance',     value: perf?.score != null ? String(Math.round(perf.score)) : '—', suffix: perf?.score != null ? '/100' : '', icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map(({ label, value, icon: Icon, color, bg, suffix = '' }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-white">{value}</span>
              {suffix && <span className="text-sm text-zinc-500 mb-0.5">{suffix}</span>}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Performance & Earnings */}
      {perf && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-white">Performance Score</span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-white">
                {perf.score != null ? Math.round(perf.score) : '—'}
              </span>
              <span className="text-zinc-500 mb-1">/100</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                style={{ width: `${Math.min(perf.score ?? 0, 100)}%` }}
              />
            </div>
            {perf.avg_rating != null && (
              <div className="flex items-center gap-1.5 mt-2">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">{perf.avg_rating.toFixed(1)}</span>
                <span className="text-xs text-zinc-500">avg rating</span>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Total Earnings</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {formatCurrency(perf.total_earnings)}
            </div>
            <p className="text-xs text-zinc-500">
              {perf.completed_assignments} of {perf.total_assignments} assignments completed
            </p>
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Events</h2>
          <button
            onClick={() => router.push('/vendor/events')}
            className="text-xs text-zinc-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No events yet</p>
            <p className="text-xs text-zinc-600 mt-1">You'll see your event assignments here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {recent.map(a => (
              <button
                key={a.id}
                onClick={() => router.push(`/vendor/events/${a.id}`)}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.event?.name ?? 'Unnamed Event'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">{formatDate(a.event?.event_date)}</span>
                    {a.service_description && (
                      <span className="text-xs text-zinc-600 truncate">· {a.service_description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.agreed_amount != null && (
                    <span className="text-sm font-medium text-emerald-400">
                      {formatCurrency(a.agreed_amount, a.currency_code)}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[a.status] ?? ''}`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites CTA */}
      {pending > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {pending} pending invite{pending > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-400/60">Respond to confirm your participation.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/vendor/events?status=invited')}
            className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Review
          </button>
        </div>
      )}
    </div>
  )
}
