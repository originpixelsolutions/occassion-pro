'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Loader2,
  Zap,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReadinessItem {
  check_key: string
  check_label: string
  module: string
  is_required: boolean
  is_completed: boolean
  sort_order: number
}

interface ReadinessData {
  total_checks: number
  completed_checks: number
  score_pct: number
  event_type: string | null
  event_type_icon: string | null
  items: ReadinessItem[]
  message?: string
}

interface Props {
  eventId: string
  /** Called when user clicks a module CTA so parent can navigate */
  onNavigateToModule?: (module: string) => void
  /** Auto-refresh interval in ms (0 = no auto-refresh) */
  refreshInterval?: number
  className?: string
}

// ── Module display config ─────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  core:         'Event Details',
  venue:        'Venue',
  guests:       'Guests',
  finance:      'Finance',
  vendors:      'Vendors',
  team:         'Team',
  fnb:          'F&B',
  decor:        'Décor',
  production:   'Production',
  hospitality:  'Hospitality',
  artists:      'Artists',
  permits:      'Permits',
  documents:    'Documents',
  health_safety:'Health & Safety',
  media:        'Media',
}

const MODULE_PATHS: Record<string, string> = {
  core:         'details',
  venue:        'venue',
  guests:       'guests',
  finance:      'finance',
  vendors:      'vendors',
  team:         'team',
  fnb:          'fnb',
  decor:        'decor',
  production:   'production',
  hospitality:  'hospitality',
  artists:      'artists',
  permits:      'permits',
  documents:    'documents',
  health_safety:'health-safety',
  media:        'media',
}

// ── Circular progress ring ─────────────────────────────────────────────────────

function CircularProgress({ pct, color }: { pct: number; color: string }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (pct / 100) * circumference

  return (
    <svg width="130" height="130" viewBox="0 0 130 130" className="rotate-[-90deg]">
      {/* Track */}
      <circle
        cx="65" cy="65" r={radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="10"
        fill="none"
      />
      {/* Progress */}
      <circle
        cx="65" cy="65" r={radius}
        stroke={color}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

function getScoreColor(pct: number): string {
  if (pct >= 90) return '#22c55e'
  if (pct >= 70) return '#a3e635'
  if (pct >= 50) return '#f59e0b'
  if (pct >= 25) return '#f97316'
  return '#ef4444'
}

function getScoreLabel(pct: number): string {
  if (pct === 100) return 'Fully Ready! 🎉'
  if (pct >= 90)  return 'Almost there!'
  if (pct >= 70)  return 'Looking good'
  if (pct >= 50)  return 'Getting set up'
  if (pct >= 25)  return 'Just started'
  return 'Needs attention'
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SmartReadinessWidget({
  eventId,
  onNavigateToModule,
  refreshInterval = 0,
  className = '',
}: Props) {
  const [data, setData] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  const fetchReadiness = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`${apiBase}/events/${eventId}/readiness`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [apiBase, eventId])

  useEffect(() => {
    fetchReadiness()
  }, [fetchReadiness])

  useEffect(() => {
    if (!refreshInterval) return
    const id = setInterval(() => fetchReadiness(true), refreshInterval)
    return () => clearInterval(id)
  }, [fetchReadiness, refreshInterval])

  // Group items by module
  const byModule = data?.items?.reduce<Record<string, ReadinessItem[]>>((acc, item) => {
    if (!acc[item.module]) acc[item.module] = []
    acc[item.module].push(item)
    return acc
  }, {}) ?? {}

  const toggleModule = (mod: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })
  }

  if (loading) {
    return (
      <div className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 flex items-center justify-center ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-white/30 mr-2" />
        <span className="text-white/30 text-sm">Loading readiness score…</span>
      </div>
    )
  }

  if (!data || data.total_checks === 0) {
    return (
      <div className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 flex items-center gap-3 ${className}`}>
        <Zap className="w-5 h-5 text-white/20" />
        <p className="text-sm text-white/30">
          {data?.message || 'Select an event type to enable Smart Readiness tracking.'}
        </p>
      </div>
    )
  }

  const color = getScoreColor(data.score_pct)
  const label = getScoreLabel(data.score_pct)

  return (
    <div className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Smart Readiness</h3>
          {data.event_type && (
            <span className="text-xs text-white/30">
              · {data.event_type_icon} {data.event_type}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchReadiness(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Score ring + meta */}
      <div className="flex items-center gap-5 px-5 pb-5 border-b border-white/[0.06]">
        <div className="relative flex-shrink-0">
          <CircularProgress pct={data.score_pct} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{data.score_pct}%</span>
            <span className="text-xs text-white/40">Ready</span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-base font-semibold" style={{ color }}>{label}</p>
          <p className="text-sm text-white/50">
            {data.completed_checks} of {data.total_checks} checks complete
          </p>
          {/* Required incomplete count */}
          {(() => {
            const reqIncomplete = data.items.filter(i => i.is_required && !i.is_completed).length
            return reqIncomplete > 0 ? (
              <p className="text-xs text-orange-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {reqIncomplete} required step{reqIncomplete !== 1 ? 's' : ''} remaining
              </p>
            ) : null
          })()}
        </div>
      </div>

      {/* Module breakdown */}
      <div className="divide-y divide-white/[0.04]">
        {Object.entries(byModule).map(([mod, items]) => {
          const modCompleted = items.filter(i => i.is_completed).length
          const modTotal = items.length
          const modPct = Math.round((modCompleted / modTotal) * 100)
          const allDone = modCompleted === modTotal
          const hasRequired = items.some(i => i.is_required && !i.is_completed)
          const isExpanded = expandedModules.has(mod)

          return (
            <div key={mod}>
              <button
                onClick={() => toggleModule(mod)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {allDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : hasRequired ? (
                    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
                  )}
                  <span className="text-sm text-white/80 font-medium">
                    {MODULE_LABELS[mod] || mod}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30">
                    {modCompleted}/{modTotal}
                  </span>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${modPct}%`,
                        backgroundColor: allDone ? '#22c55e' : hasRequired ? '#f97316' : '#6366f1',
                      }}
                    />
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* Expanded check items */}
              {isExpanded && (
                <div className="px-5 pb-3 space-y-2 bg-white/[0.01]">
                  {items.map(item => (
                    <div key={item.check_key} className="flex items-center gap-2.5">
                      {item.is_completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Circle
                          className={`w-3.5 h-3.5 flex-shrink-0 ${item.is_required ? 'text-orange-400' : 'text-white/20'}`}
                        />
                      )}
                      <span
                        className={`text-xs ${item.is_completed ? 'text-white/50 line-through' : item.is_required ? 'text-white/70' : 'text-white/40'}`}
                      >
                        {item.check_label}
                        {item.is_required && !item.is_completed && (
                          <span className="ml-1 text-orange-400 text-[10px] font-medium">Required</span>
                        )}
                      </span>
                    </div>
                  ))}

                  {/* CTA: go to module */}
                  {items.some(i => !i.is_completed) && onNavigateToModule && (
                    <button
                      onClick={() => onNavigateToModule(MODULE_PATHS[mod] || mod)}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-2 transition-colors"
                    >
                      Complete setup →
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
