'use client'

/**
 * Vendor Portal — Performance
 * GET /vendor-portal/performance
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Star, Award, TrendingUp, CheckCircle2, CalendarDays,
  DollarSign, Loader2, AlertCircle, BarChart2,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface Performance {
  score: number | null
  total_assignments: number
  completed_assignments: number
  cancelled_assignments: number
  declined_assignments: number
  completion_rate: number | null
  avg_rating: number | null
  total_earnings: number
  monthly_earnings?: { month: string; amount: number }[]
  rating_breakdown?: Record<string, number>
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-500">—</span>
  const s = Math.round(score)
  const color = s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-red-400'
  const label = s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : 'Needs Improvement'
  return (
    <div>
      <span className={`text-5xl font-bold ${color}`}>{s}</span>
      <span className="text-zinc-500 text-xl ml-1">/100</span>
      <p className={`text-sm font-medium mt-1 ${color}`}>{label}</p>
    </div>
  )
}

export default function VendorPerformancePage() {
  const router = useRouter()
  const [perf, setPerf]     = useState<Performance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    const session = localStorage.getItem('vp_session')
    if (!session) { router.replace('/vendor/login'); return }

    fetch(`${API}/vendor-portal/performance`, { headers: { 'X-Vendor-Session': session } })
      .then(r => {
        if (r.status === 401) { router.replace('/vendor/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setPerf(data) })
      .catch(() => setError('Failed to load performance data.'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Performance</h1>
        <p className="text-sm text-zinc-500 mt-1">Your vendor performance metrics and ratings.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!perf ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <BarChart2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No performance data yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Complete your first event to see metrics here.</p>
        </div>
      ) : (
        <>
          {/* Score Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white">Overall Score</h2>
                </div>
                <ScoreBadge score={perf.score} />
              </div>
              {perf.avg_rating != null && (
                <div className="text-center">
                  <div className="flex items-center gap-1 mb-1 justify-center">
                    {[1,2,3,4,5].map(i => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i <= Math.round(perf.avg_rating!) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}
                      />
                    ))}
                  </div>
                  <p className="text-2xl font-bold text-white">{perf.avg_rating.toFixed(1)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Avg. Rating</p>
                </div>
              )}
            </div>

            {/* Score bar */}
            {perf.score != null && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                  <span>Score breakdown</span>
                  <span>{Math.round(perf.score)}/100</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all"
                    style={{ width: `${Math.min(perf.score, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                  <span>Completion rate (50%)</span>
                  <span>Avg. rating (50%)</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: 'Total Assignments',
                value: perf.total_assignments,
                icon: CalendarDays,
                color: 'text-blue-400', bg: 'bg-blue-500/10',
              },
              {
                label: 'Completed',
                value: perf.completed_assignments,
                icon: CheckCircle2,
                color: 'text-emerald-400', bg: 'bg-emerald-500/10',
              },
              {
                label: 'Completion Rate',
                value: perf.completion_rate != null ? `${Math.round(perf.completion_rate)}%` : '—',
                icon: TrendingUp,
                color: 'text-violet-400', bg: 'bg-violet-500/10',
              },
              {
                label: 'Avg. Rating',
                value: perf.avg_rating != null ? perf.avg_rating.toFixed(1) : '—',
                icon: Star,
                color: 'text-amber-400', bg: 'bg-amber-500/10',
              },
              {
                label: 'Total Earnings',
                value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(perf.total_earnings || 0),
                icon: DollarSign,
                color: 'text-emerald-400', bg: 'bg-emerald-500/10',
              },
              {
                label: 'Declined / Cancelled',
                value: `${(perf.declined_assignments || 0) + (perf.cancelled_assignments || 0)}`,
                icon: BarChart2,
                color: 'text-zinc-400', bg: 'bg-zinc-500/10',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Rating Breakdown */}
          {perf.rating_breakdown && Object.keys(perf.rating_breakdown).length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Rating Breakdown</h2>
              <div className="space-y-2">
                {[5,4,3,2,1].map(star => {
                  const count = perf.rating_breakdown![String(star)] ?? 0
                  const total = Object.values(perf.rating_breakdown!).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16 shrink-0">
                        <span className="text-xs text-zinc-400">{star}</span>
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      </div>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-violet-300 mb-2">How to improve your score</h3>
            <ul className="space-y-1 text-xs text-violet-400/70">
              <li>• Accept invitations promptly and complete all assigned events</li>
              <li>• Communicate proactively with the event team via messages</li>
              <li>• Deliver high-quality work to earn 5-star ratings</li>
              <li>• Avoid last-minute cancellations to maintain reliability</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
