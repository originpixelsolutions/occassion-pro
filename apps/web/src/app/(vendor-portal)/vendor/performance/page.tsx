'use client'

import { useEffect, useState } from 'react'

interface PerformanceScore {
  vendor_id: string
  total_assignments: number
  completed_assignments: number
  declined_assignments: number
  cancelled_assignments: number
  avg_rating: number | null
  on_time_rate: number | null
  response_rate: number | null
  score: number
  score_band: 'excellent' | 'good' | 'average' | 'poor'
  last_updated: string
}

interface RatedAssignment {
  assignment_id: string
  event_name: string
  tenant_name: string
  event_date: string
  rating: number
  review_comment?: string
  reviewed_at: string
}

const BAND_CONFIG = {
  excellent: { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', bar: 'bg-green-500' },
  good:      { label: 'Good',      color: 'text-blue-400',  bg: 'bg-blue-500/15',  border: 'border-blue-500/30',  bar: 'bg-blue-500' },
  average:   { label: 'Average',   color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', bar: 'bg-amber-500' },
  poor:      { label: 'Poor',      color: 'text-red-400',   bg: 'bg-red-500/15',   border: 'border-red-500/30',   bar: 'bg-red-500' },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg
          key={s}
          className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-zinc-700'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function ScoreRing({ score, band }: { score: number; band: keyof typeof BAND_CONFIG }) {
  const cfg = BAND_CONFIG[band]
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#27272a" strokeWidth="12" />
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cfg.color}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`text-3xl font-bold ${cfg.color}`}>{score}</p>
        <p className="text-zinc-500 text-[10px] mt-0.5">/ 100</p>
      </div>
    </div>
  )
}

function MetricBar({ label, value, max = 100, suffix = '%' }: { label: string; value: number | null; max?: number; suffix?: string }) {
  const pct = value == null ? 0 : Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-zinc-400 text-xs">{label}</p>
        <p className="text-zinc-300 text-xs font-medium">
          {value == null ? '—' : `${typeof value === 'number' && suffix === '%' ? value.toFixed(0) : value}${suffix}`}
        </p>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PerformancePage() {
  const [score, setScore] = useState<PerformanceScore | null>(null)
  const [reviews, setReviews] = useState<RatedAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return
    fetch('/api/v1/vendor-portal/performance', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setScore(data.score ?? null)
        setReviews(data.reviews ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Performance</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Your performance score and ratings</p>
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const band = score?.score_band ?? 'average'
  const cfg = BAND_CONFIG[band]
  const completionRate = score
    ? score.total_assignments > 0
      ? Math.round((score.completed_assignments / score.total_assignments) * 100)
      : 0
    : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Performance</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Your performance score and event ratings</p>
      </div>

      {!score ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <svg className="w-8 h-8 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-zinc-500 text-sm">No performance data yet</p>
          <p className="text-zinc-600 text-xs mt-1">Complete events to build your performance score</p>
        </div>
      ) : (
        <>
          {/* Score overview card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Ring */}
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={score.score} band={band} />
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>

              {/* Stats */}
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total', value: score.total_assignments },
                    { label: 'Completed', value: score.completed_assignments },
                    { label: 'Declined', value: score.declined_assignments },
                    { label: 'Avg Rating', value: score.avg_rating != null ? score.avg_rating.toFixed(1) : '—' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-zinc-800/40 rounded-lg p-3">
                      <p className="text-white text-lg font-semibold">{s.value}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Metric bars */}
                <div className="space-y-3">
                  <MetricBar label="Completion rate" value={completionRate} />
                  <MetricBar label="On-time delivery" value={score.on_time_rate != null ? score.on_time_rate * 100 : null} />
                  <MetricBar label="Response rate" value={score.response_rate != null ? score.response_rate * 100 : null} />
                </div>
              </div>
            </div>
          </div>

          {/* Score breakdown info */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-medium mb-2">How your score is calculated</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-500">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                <span><strong className="text-zinc-300">40%</strong> — Completion rate (assignments completed vs total)</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                <span><strong className="text-zinc-300">35%</strong> — Average rating from organiser reviews</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                <span><strong className="text-zinc-300">25%</strong> — Response rate and on-time delivery</span>
              </div>
            </div>
          </div>

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-zinc-200 mb-3">Reviews from organisers</h2>
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.assignment_id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{r.event_name}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{r.tenant_name} · {fmtDate(r.event_date)}</p>
                        {r.review_comment && (
                          <p className="text-zinc-400 text-xs mt-2 leading-relaxed">"{r.review_comment}"</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StarRating rating={r.rating} />
                        <p className="text-zinc-600 text-[10px] mt-1">{fmtDate(r.reviewed_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
