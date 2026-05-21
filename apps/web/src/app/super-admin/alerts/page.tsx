'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

interface SmartAlert {
  type: string; severity: string; tenantName?: string
  tenantId?: string; message: string; createdAt: string
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`
}

const SEV: Record<string, { cls: string; icon: React.FC<{ className?: string }> }> = {
  critical: { cls: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
  warning:  { cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: AlertTriangle },
  info:     { cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: AlertTriangle },
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/alerts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setAlerts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-foreground">Smart Alerts</h1>
          </div>
          <p className="text-sm text-muted-foreground">AI-detected risks and platform issues</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {(['critical','warning','info'] as const).map(sev => (
          <button
            key={sev}
            onClick={() => setFilter(filter === sev ? 'all' : sev)}
            className={`p-3 rounded-xl border text-center transition-all ${filter === sev ? SEV[sev].cls : 'bg-card/60 border-border/50 hover:bg-card'}`}
          >
            <p className={`text-2xl font-bold ${filter === sev ? '' : 'text-foreground'}`}>{counts[sev]}</p>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${filter === sev ? 'opacity-80' : 'text-muted-foreground'}`}>{sev}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card/30 border border-border/30 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length ? (
        <div className="space-y-2">
          {filtered.map((alert, i) => {
            const s = SEV[alert.severity] ?? SEV.info
            const Icon = s.icon
            return (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${s.cls}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {alert.tenantName && <span className="text-[10px] opacity-70">{alert.tenantName}</span>}
                    <span className="text-[10px] opacity-60">{fmtRelative(alert.createdAt)}</span>
                    <span className="text-[9px] font-mono opacity-50 bg-black/20 px-1.5 py-0.5 rounded">{alert.type}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
          <p className="text-sm font-medium text-emerald-400">All systems normal</p>
          <p className="text-xs text-muted-foreground">No {filter === 'all' ? '' : filter} alerts detected</p>
        </div>
      )}
    </div>
  )
}
