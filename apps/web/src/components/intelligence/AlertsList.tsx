'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SmartAlert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
  event_id?: string | null
}

interface Props {
  /** If provided, fetches event-scoped alerts */
  eventId?: string
  /** If provided, fetches tenant-level alerts (all events) */
  tenantId?: string
  /** Filter by severity */
  severity?: 'info' | 'warning' | 'critical'
  /** Compact mode: hide message, show only title */
  compact?: boolean
  /** Maximum alerts to show before "show more" */
  maxVisible?: number
  className?: string
  onAlertDismissed?: (alertId: string) => void
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    iconClass: 'text-red-400',
    borderClass: 'border-red-500/20',
    bgClass: 'bg-red-500/[0.04]',
    badgeClass: 'bg-red-500/15 text-red-400',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
    bgClass: 'bg-amber-500/[0.04]',
    badgeClass: 'bg-amber-500/15 text-amber-400',
    label: 'Warning',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-400',
    borderClass: 'border-blue-500/20',
    bgClass: 'bg-blue-500/[0.04]',
    badgeClass: 'bg-blue-500/15 text-blue-400',
    label: 'Info',
  },
}

function AlertCard({
  alert,
  compact,
  onDismiss,
}: {
  alert: SmartAlert
  compact?: boolean
  onDismiss: (id: string) => Promise<void>
}) {
  const [dismissing, setDismissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const cfg = SEVERITY_CONFIG[alert.severity]
  const Icon = cfg.icon

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await onDismiss(alert.id)
      setDismissed(true)
    } finally {
      setDismissing(false)
    }
  }

  if (dismissed) return null

  return (
    <div
      className={cn(
        'relative flex gap-3 rounded-xl border p-3.5 transition-all duration-200',
        cfg.borderClass,
        cfg.bgClass,
      )}
    >
      {/* Severity icon */}
      <div className="shrink-0 pt-0.5">
        <Icon className={cn('w-4 h-4', cfg.iconClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 leading-snug">{alert.title}</p>
            {!compact && (
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{alert.message}</p>
            )}
          </div>
          <span className={cn('shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full', cfg.badgeClass)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="shrink-0 self-start text-white/20 hover:text-white/60 transition-colors p-0.5"
        title="Dismiss alert"
      >
        <X className={cn('w-3.5 h-3.5', dismissing && 'opacity-50')} />
      </button>
    </div>
  )
}

export function AlertsList({
  eventId,
  tenantId,
  severity,
  compact = false,
  maxVisible = 10,
  className,
  onAlertDismissed,
}: Props) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const url = eventId
        ? `/api/v1/events/${eventId}/intelligence/alerts${severity ? `?severity=${severity}` : ''}`
        : `/api/v1/tenants/me/intelligence/alerts${severity ? `?severity=${severity}` : ''}`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch alerts')
      const data = await res.json()
      setAlerts(data)
      setError(null)
    } catch {
      setError('Unable to load alerts')
    } finally {
      setLoading(false)
    }
  }, [eventId, tenantId, severity])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleDismiss = async (alertId: string) => {
    const endpoint = eventId
      ? `/api/v1/events/${eventId}/intelligence/alerts/${alertId}/dismiss`
      : `/api/v1/events/unknown/intelligence/alerts/${alertId}/dismiss`

    await fetch(endpoint, { method: 'POST' })
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    onAlertDismissed?.(alertId)
  }

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-white/40">{error}</p>
  }

  if (!alerts.length) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-white/60">All clear</p>
        <p className="text-xs text-white/30 mt-0.5">No active alerts</p>
      </div>
    )
  }

  const visible = showAll ? alerts : alerts.slice(0, maxVisible)
  const hiddenCount = alerts.length - maxVisible

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {visible.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          compact={compact}
          onDismiss={handleDismiss}
        />
      ))}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <span>Show {hiddenCount} more alert{hiddenCount !== 1 ? 's' : ''}</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/** Compact badge showing critical+warning count — for sidebar nav items */
export function AlertBadge({
  eventId,
  tenantId,
  className,
}: {
  eventId?: string
  tenantId?: string
  className?: string
}) {
  const [counts, setCounts] = useState({ critical: 0, warning: 0 })

  useEffect(() => {
    const url = eventId
      ? `/api/v1/events/${eventId}/intelligence/alerts`
      : `/api/v1/tenants/me/intelligence/alerts`

    fetch(url)
      .then((r) => r.json())
      .then((data: SmartAlert[]) => {
        setCounts({
          critical: data.filter((a) => a.severity === 'critical').length,
          warning: data.filter((a) => a.severity === 'warning').length,
        })
      })
      .catch(() => {})
  }, [eventId, tenantId])

  const total = counts.critical + counts.warning
  if (!total) return null

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
        counts.critical > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-black',
        className,
      )}
    >
      {total}
    </span>
  )
}
