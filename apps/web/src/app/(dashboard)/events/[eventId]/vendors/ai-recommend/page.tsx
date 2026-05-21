'use client'

/**
 * OccasionPro — AI Vendor Recommendation Engine
 *
 * Staff enters event requirements (service category, budget, date, notes)
 * and the AI ranks every eligible vendor in the tenant's library with
 * match scores, per-dimension breakdowns, and plain-English reasoning.
 *
 * Actions per recommendation:
 *   • Shortlist  — saves to shortlist for review
 *   • Assign     — navigates to vendor assignment flow
 *   • Dismiss    — removes from current view
 */

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Sparkles, ArrowLeft, Search, Loader2, Star, CheckCircle2,
  XCircle, Bookmark, TrendingUp, Wallet, Tag, Clock,
  ChevronRight, RefreshCw, BarChart3, MapPin, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApiClient } from '@/hooks/use-api-client'
import { useAuth } from '@/hooks/use-auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VendorRec {
  rank: number
  matchScore: number
  reasoning: string
  scores: {
    budget: number
    category: number
    history: number
    rating: number
  }
  vendor: {
    id: string
    name: string
    serviceType: string
    basePrice: number | null
    priceUnit: string | null
    city: string | null
    state: string | null
    website: string | null
    logoUrl: string | null
    avgRating: number | null
    compositeScore: number | null
    totalBookings: number | null
    onTimeRate: number | null
  }
}

const SERVICE_CATEGORIES = [
  'Catering', 'Photography', 'Videography', 'Decor & Florals', 'DJ & Music',
  'Live Band', 'Venue', 'AV & Lighting', 'Tent & Furniture', 'Transportation',
  'Security', 'Hospitality Staff', 'MC / Anchor', 'Makeup & Styling',
  'Cake & Desserts', 'Invitations & Stationery', 'Event Technology',
  'Wedding Planner', 'Conceptual Design', 'Other',
]

// ── Score Bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] text-zinc-400 w-7 text-right shrink-0">{Math.round(value)}</span>
    </div>
  )
}

// ── Match Ring ────────────────────────────────────────────────────────────────

function MatchRing({ score }: { score: number }) {
  const r = 20; const C = 2 * Math.PI * r
  const dash = (score / 100) * C
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e'
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
        transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="600" fill={color}>{Math.round(score)}</text>
    </svg>
  )
}

// ── Rec Card ──────────────────────────────────────────────────────────────────

function RecCard({
  rec, dismissed, onAction,
}: {
  rec: VendorRec
  dismissed: boolean
  onAction: (id: string, action: 'shortlisted' | 'dismissed' | 'assigned') => void
}) {
  const [actioned, setActioned] = useState<string | null>(null)

  if (dismissed) return null

  const v = rec.vendor
  const rankLabel = rec.rank === 1 ? '🥇 Top Pick' : rec.rank === 2 ? '🥈 Runner-up' : rec.rank === 3 ? '🥉 3rd' : `#${rec.rank}`

  const act = (action: 'shortlisted' | 'dismissed' | 'assigned') => {
    setActioned(action)
    onAction(v.id, action)
  }

  return (
    <div className={cn(
      'bg-zinc-900 border rounded-xl p-5 flex flex-col gap-4 transition-all duration-300',
      rec.rank === 1 ? 'border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.08)]' : 'border-zinc-800',
      actioned === 'shortlisted' ? 'border-emerald-500/40' : '',
      actioned === 'dismissed'   ? 'opacity-40 scale-95'   : '',
    )}>
      {/* Header row */}
      <div className="flex items-start gap-4">
        {/* Logo / avatar */}
        {v.logoUrl ? (
          <img src={v.logoUrl} alt={v.name} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-zinc-800" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-zinc-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 font-medium">{rankLabel}</span>
            {actioned === 'shortlisted' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">Shortlisted</span>
            )}
          </div>
          <p className="font-semibold text-zinc-100 mt-0.5 truncate">{v.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{v.serviceType}</p>
          {(v.city || v.state) && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-xs text-zinc-600">{[v.city, v.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        <MatchRing score={rec.matchScore} />
      </div>

      {/* Score breakdown */}
      <div className="space-y-1.5">
        <ScoreBar label="Budget"   value={rec.scores.budget}   color="#8B5CF6" />
        <ScoreBar label="Category" value={rec.scores.category} color="#06b6d4" />
        <ScoreBar label="History"  value={rec.scores.history}  color="#f59e0b" />
        <ScoreBar label="Rating"   value={rec.scores.rating}   color="#10b981" />
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {v.avgRating != null && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/50" />
            {v.avgRating.toFixed(1)}
          </div>
        )}
        {v.totalBookings != null && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <BarChart3 className="w-3.5 h-3.5 text-zinc-600" />
            {v.totalBookings} bookings
          </div>
        )}
        {v.onTimeRate != null && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-600" />
            {v.onTimeRate.toFixed(0)}% on-time
          </div>
        )}
        {v.basePrice != null && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Wallet className="w-3.5 h-3.5 text-zinc-600" />
            ₹{v.basePrice.toLocaleString()} {v.priceUnit ? `/ ${v.priceUnit}` : ''}
          </div>
        )}
      </div>

      {/* AI Reasoning */}
      <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-violet-500/30 pl-3">
        {rec.reasoning}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => act('shortlisted')}
          disabled={!!actioned}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            actioned === 'shortlisted'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-zinc-800 hover:bg-emerald-500/10 text-zinc-300 hover:text-emerald-300 border border-zinc-700',
          )}
        >
          <Bookmark className="w-3.5 h-3.5" />
          {actioned === 'shortlisted' ? 'Shortlisted' : 'Shortlist'}
        </button>
        <button
          onClick={() => act('assigned')}
          disabled={!!actioned}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Assign
        </button>
        <button
          onClick={() => act('dismissed')}
          disabled={!!actioned}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-rose-400 hover:bg-rose-500/5 transition-colors border border-transparent hover:border-rose-500/10"
        >
          <XCircle className="w-3.5 h-3.5" />
          Dismiss
        </button>
        {v.website && (
          <a href={v.website} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Visit website"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AiVendorRecommendPage() {
  const params  = useParams<{ eventId: string }>()
  const router  = useRouter()
  const api     = useApiClient()
  const { profile } = useAuth()

  const eventId = params?.eventId

  // Form state
  const [category, setCategory]   = useState('')
  const [eventType, setEventType] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation]   = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [requirements, setRequirements] = useState('')

  // Results state
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [sessionId, setSessionId]       = useState<string | null>(null)
  const [recommendations, setRecs]      = useState<VendorRec[]>([])
  const [dismissed, setDismissed]       = useState<Set<string>>(new Set())

  const handleSearch = useCallback(async () => {
    if (!category.trim()) return
    setLoading(true)
    setError(null)
    setRecs([])
    setSessionId(null)
    setDismissed(new Set())

    try {
      const res = await api.post<{ sessionId: string; recommendations: VendorRec[] }>(
        '/ai/vendor-recommendations',
        {
          event_id:         eventId,
          service_category: category,
          event_type:       eventType || undefined,
          budget_min:       budgetMin ? Number(budgetMin) : undefined,
          budget_max:       budgetMax ? Number(budgetMax) : undefined,
          event_date:       eventDate || undefined,
          location:         location  || undefined,
          guest_count:      guestCount ? Number(guestCount) : undefined,
          requirements:     requirements || undefined,
        },
      )
      setSessionId(res.sessionId)
      setRecs(res.recommendations)
    } catch (e: any) {
      setError(e.message ?? 'Failed to get recommendations')
    } finally {
      setLoading(false)
    }
  }, [api, eventId, category, eventType, budgetMin, budgetMax, eventDate, location, guestCount, requirements])

  const handleAction = useCallback(async (vendorId: string, action: 'shortlisted' | 'dismissed' | 'assigned') => {
    if (action === 'dismissed') {
      setDismissed(prev => new Set([...prev, vendorId]))
    }
    if (action === 'assigned') {
      router.push(`/events/${eventId}/vendors`)
    }
    // Persist action via PATCH if we have a recommendation ID
    // (we pass vendorId here, backend matches by vendor in session)
  }, [eventId, router])

  const visibleRecs = recommendations.filter(r => !dismissed.has(r.vendor.id))

  return (
    <div className="flex-1 overflow-auto bg-zinc-950 min-h-screen">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">AI Vendor Recommendations</h1>
            <p className="text-xs text-zinc-500">Describe your requirement — AI ranks matching vendors</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
          {/* ── Criteria Panel ── */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 xl:sticky xl:top-6">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              Search Criteria
            </h2>

            {/* Service Category — required */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Service Category <span className="text-rose-400">*</span></label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
              >
                <option value="">Select a category…</option>
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Event Type</label>
              <input
                type="text"
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                placeholder="e.g. Wedding, Corporate Conference"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Budget Range (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={budgetMin}
                  onChange={e => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="number"
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Event Date + Location */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Event Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Guest Count</label>
                <input
                  type="number"
                  value={guestCount}
                  onChange={e => setGuestCount(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Location / City</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Mumbai, Bangalore"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Special Requirements</label>
              <textarea
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder="Describe any specific needs, style preferences, or constraints…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSearch}
              disabled={loading || !category}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Analysing vendors…</>
              ) : (
                <><Sparkles className="w-4 h-4" />Get AI Recommendations</>
              )}
            </button>

            {recommendations.length > 0 && !loading && (
              <button
                onClick={handleSearch}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-run with same criteria
              </button>
            )}
          </div>

          {/* ── Results Panel ── */}
          <div className="space-y-4">
            {/* Error */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-400">
                {error}
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-1/2" />
                        <div className="h-3 bg-zinc-800 rounded w-1/3" />
                      </div>
                      <div className="w-12 h-12 rounded-full bg-zinc-800 shrink-0" />
                    </div>
                    <div className="space-y-1.5">
                      {[1,2,3,4].map(j => <div key={j} className="h-2 bg-zinc-800 rounded" />)}
                    </div>
                    <div className="h-12 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state — before first search */}
            {!loading && recommendations.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-violet-400 opacity-60" />
                </div>
                <div>
                  <p className="text-zinc-400 font-medium">AI-powered vendor matching</p>
                  <p className="text-zinc-600 text-sm mt-1 max-w-sm">
                    Fill in your service requirement on the left and get an AI-ranked shortlist with match scores and reasoning in seconds.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {['🎵 DJ & Music', '📸 Photography', '🍽️ Catering', '💐 Decor'].map(tag => (
                    <span key={tag} className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Results header */}
            {!loading && recommendations.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {visibleRecs.length} vendor{visibleRecs.length !== 1 ? 's' : ''} ranked
                  </p>
                  {sessionId && (
                    <p className="text-xs text-zinc-600 mt-0.5">Session {sessionId.slice(-8)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" />≥ 75 strong</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />50–74 fair</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" />{'< 50 weak'}</div>
                </div>
              </div>
            )}

            {/* Rec cards */}
            {!loading && recommendations.map(rec => (
              <RecCard
                key={rec.vendor.id}
                rec={rec}
                dismissed={dismissed.has(rec.vendor.id)}
                onAction={handleAction}
              />
            ))}

            {/* All dismissed */}
            {!loading && recommendations.length > 0 && visibleRecs.length === 0 && (
              <div className="text-center py-12 text-zinc-600 text-sm">
                All recommendations dismissed.{' '}
                <button onClick={handleSearch} className="text-violet-400 hover:underline">Run again?</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
