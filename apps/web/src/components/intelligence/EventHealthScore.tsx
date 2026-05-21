'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DimensionScores {
  guests: number
  finance: number
  vendors: number
  runsheet: number
  fnb: number
  team: number
}

interface HealthScore {
  overall_score: number
  dimension_scores: DimensionScores
  computed_at: string
  alert_count_critical: number
  alert_count_warning: number
  alert_count_info: number
}

interface Props {
  eventId: string
  className?: string
  compact?: boolean
}

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  guests: 'Guests',
  finance: 'Finance',
  vendors: 'Vendors',
  runsheet: 'Runsheet',
  fnb: 'F&B',
  team: 'Team',
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function scoreRingColor(score: number): string {
  if (score >= 80) return '#10b981' // emerald-500
  if (score >= 60) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

function scoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'At Risk'
  return 'Critical'
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const strokeColor = scoreRingColor(score)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={8}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.6s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', scoreColor(score), size >= 100 ? 'text-3xl' : 'text-xl')}>
          {score}
        </span>
        <span className="text-xs text-white/40 mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

function DimensionBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: scoreRingColor(score),
          }}
        />
      </div>
      <span className={cn('text-xs font-medium w-8 text-right tabular-nums', scoreColor(score))}>
        {score}
      </span>
    </div>
  )
}

export function EventHealthScore({ eventId, className, compact = false }: Props) {
  const [data, setData] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchScore = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/intelligence/health-score`)
      if (!res.ok) throw new Error('Failed to fetch health score')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError('Unable to load health score')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchScore()
  }, [fetchScore])

  const handleRecompute = async () => {
    setRecomputing(true)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/intelligence/recompute`, { method: 'POST' })
      if (!res.ok) throw new Error('Recompute failed')
      const json = await res.json()
      setData(json.score)
    } catch {
      // silent
    } finally {
      setRecomputing(false)
    }
  }

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5', className)}>
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-4 bg-white/[0.06] rounded w-28" />
          <div className="flex justify-center">
            <div className="w-28 h-28 rounded-full bg-white/[0.06]" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5', className)}>
        <p className="text-sm text-white/40">{error ?? 'No score available'}</p>
      </div>
    )
  }

  const { overall_score, dimension_scores, computed_at, alert_count_critical, alert_count_warning } = data

  const computedDate = new Date(computed_at)
  const minutesAgo = Math.round((Date.now() - computedDate.getTime()) / 60000)
  const timeLabel = minutesAgo < 60
    ? `${minutesAgo}m ago`
    : `${Math.round(minutesAgo / 60)}h ago`

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <ScoreRing score={overall_score} size={56} />
        <div>
          <p className={cn('text-sm font-semibold', scoreColor(overall_score))}>{scoreLabel(overall_score)}</p>
          {(alert_count_critical > 0 || alert_count_warning > 0) && (
            <p className="text-xs text-white/40">
              {alert_count_critical > 0 && <span className="text-red-400">{alert_count_critical} critical</span>}
              {alert_count_critical > 0 && alert_count_warning > 0 && ' · '}
              {alert_count_warning > 0 && <span className="text-amber-400">{alert_count_warning} warnings</span>}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5', scoreBgColor(overall_score), className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-white/60">Event Health</span>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', recomputing && 'animate-spin')} />
          {recomputing ? 'Recomputing...' : timeLabel}
        </button>
      </div>

      {/* Score ring + label */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <ScoreRing score={overall_score} size={112} />
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-semibold', scoreColor(overall_score))}>
            {scoreLabel(overall_score)}
          </span>
        </div>

        {/* Alert summary */}
        {(alert_count_critical > 0 || alert_count_warning > 0) && (
          <div className="flex gap-3 text-xs">
            {alert_count_critical > 0 && (
              <span className="text-red-400">{alert_count_critical} critical</span>
            )}
            {alert_count_warning > 0 && (
              <span className="text-amber-400">{alert_count_warning} warnings</span>
            )}
          </div>
        )}
      </div>

      {/* Dimension bars */}
      <div className="flex flex-col gap-2">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <DimensionBar
            key={key}
            label={label}
            score={dimension_scores[key as keyof DimensionScores] ?? 100}
          />
        ))}
      </div>
    </div>
  )
}
