'use client'

import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react'

type Severity = 'critical' | 'warning' | 'info' | 'success'

interface SmartAlertProps {
  severity: Severity
  title: string
  message?: string
  onDismiss?: () => void
  className?: string
  compact?: boolean
}

const CONFIG: Record<Severity, { icon: typeof AlertCircle; bg: string; border: string; text: string; iconColor: string }> = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-500/8',
    border: 'border-red-500/25',
    text: 'text-red-400',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    text: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/25',
    text: 'text-blue-400',
    iconColor: 'text-blue-400',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
    iconColor: 'text-emerald-400',
  },
}

/**
 * SmartAlert — unified component for all rule-based intelligence alerts.
 * Used by every module for budget warnings, duplicate detection, vendor conflicts, etc.
 */
export function SmartAlert({ severity, title, message, onDismiss, className = '', compact = false }: SmartAlertProps) {
  const c = CONFIG[severity]
  const Icon = c.icon

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${c.bg} ${c.border} ${c.text} ${className}`}>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${c.iconColor}`} />
        <span className="font-medium">{title}</span>
        {message && <span className="text-muted-foreground">{message}</span>}
        {onDismiss && (
          <button onClick={onDismiss} className="ml-auto hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${c.bg} ${c.border} ${className}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${c.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${c.text}`}>{title}</p>
        {message && <p className="text-xs text-muted-foreground mt-0.5">{message}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/** SmartAlertGroup — renders a stack of SmartAlerts with consistent spacing */
export function SmartAlertGroup({ alerts }: { alerts: Array<SmartAlertProps & { id: string }> }) {
  if (!alerts.length) return null
  return (
    <div className="space-y-2">
      {alerts.map(a => <SmartAlert key={a.id} {...a} />)}
    </div>
  )
}
