'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SmartAlert } from './AlertsList'

interface Props {
  className?: string
}

const SEV_COLOR: Record<SmartAlert['severity'], string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

export function TenantAlertsPanel({ className }: Props) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/tenants/me/intelligence/alerts?limit=10')
      .then((r) => r.json())
      .then((data) => setAlerts(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')

  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium text-white/80">Alerts Requiring Attention</span>
          {criticalAlerts.length > 0 && (
            <span className="text-xs font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
              {criticalAlerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <AlertCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-sm text-white/50">All events are healthy</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {alerts.slice(0, 8).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
                  SEV_COLOR[alert.severity],
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug truncate">{alert.title}</p>
                  <p className="text-[11px] opacity-60 mt-0.5 truncate">{alert.message}</p>
                </div>
                {alert.event_id && (
                  <Link
                    href={`/events/${alert.event_id}`}
                    className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}

            {alerts.length > 8 && (
              <p className="text-center text-xs text-white/30 pt-1">
                +{alerts.length - 8} more alerts
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
