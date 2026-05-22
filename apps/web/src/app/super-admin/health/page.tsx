'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, RefreshCw, Wifi, WifiOff, Users, Zap, Server } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down'
  api_latency_ms: number
  db_latency_ms: number
  active_sessions: number
  active_events_today: number
  webhook_success_rate: number
  webhook_failures_24h: number
  queue_depth: number
  queue_processing: boolean
  services: Array<{
    name: string
    status: 'up' | 'degraded' | 'down'
    latency_ms?: number
    last_check: string
    error?: string
  }>
  recent_errors: Array<{
    service: string
    message: string
    count: number
    last_seen: string
  }>
}

function StatusDot({ status }: { status: string }) {
  const cls = status === 'up' || status === 'healthy' ? 'bg-emerald-400'
    : status === 'degraded' ? 'bg-amber-400'
    : 'bg-red-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} ${status === 'up' || status === 'healthy' ? 'shadow-[0_0_6px_rgba(52,211,153,0.6)]' : ''}`} />
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/health`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setHealth(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(load, 30000) // auto-refresh every 30s
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const overallStatus = health?.status ?? 'down'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">System Health</h1>
          </div>
          <p className="text-sm text-muted-foreground">Real-time platform operational status</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${autoRefresh ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-border/50 text-muted-foreground'}`}
          >
            {autoRefresh ? '● Auto' : '○ Manual'}
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border mb-6 ${
        overallStatus === 'healthy' ? 'border-emerald-500/20 bg-emerald-500/5' :
        overallStatus === 'degraded' ? 'border-amber-500/20 bg-amber-500/5' :
        'border-red-500/20 bg-red-500/5'
      }`}>
        <StatusDot status={overallStatus} />
        <div>
          <p className={`text-sm font-bold capitalize ${
            overallStatus === 'healthy' ? 'text-emerald-400' :
            overallStatus === 'degraded' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {overallStatus === 'healthy' ? 'All Systems Operational' :
             overallStatus === 'degraded' ? 'Partial System Degradation' : 'System Down'}
          </p>
          <p className="text-[11px] text-muted-foreground">Platform status as of now</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Zap,    label: 'API Latency',     value: health ? `${health.api_latency_ms}ms` : '—', sub: 'avg response time', ok: (health?.api_latency_ms ?? 999) < 200 },
          { icon: Server, label: 'DB Latency',      value: health ? `${health.db_latency_ms}ms` : '—',  sub: 'database query time', ok: (health?.db_latency_ms ?? 999) < 100 },
          { icon: Users,  label: 'Active Sessions', value: health?.active_sessions?.toLocaleString() ?? '—', sub: 'logged in right now', ok: true },
          { icon: Activity, label: 'Live Events',   value: health?.active_events_today?.toString() ?? '—', sub: 'events happening today', ok: true },
        ].map(item => (
          <div key={item.label} className="bg-card/60 border border-border/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.ok ? 'text-emerald-400' : 'text-red-400'}`} />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Webhook health */}
        <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            {(health?.webhook_success_rate ?? 0) >= 95
              ? <Wifi className="w-4 h-4 text-emerald-400" />
              : <WifiOff className="w-4 h-4 text-red-400" />
            }
            <h2 className="text-sm font-semibold text-foreground">Webhook Health</h2>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Success Rate (24h)</span>
                <span className={`font-semibold ${(health?.webhook_success_rate ?? 0) >= 95 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {health?.webhook_success_rate?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(health?.webhook_success_rate ?? 0) >= 95 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${health?.webhook_success_rate ?? 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Failures (24h)</span>
              <span className={`font-semibold ${(health?.webhook_failures_24h ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {health?.webhook_failures_24h ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Job Queue */}
        <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-foreground">Job Queue</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Queue Depth</span>
              <span className={`font-semibold ${(health?.queue_depth ?? 0) > 100 ? 'text-amber-400' : 'text-foreground'}`}>
                {health?.queue_depth?.toLocaleString() ?? '—'} jobs
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Processing</span>
              <span className={`font-semibold ${health?.queue_processing ? 'text-emerald-400' : 'text-red-400'}`}>
                {health?.queue_processing ? '● Running' : '○ Stopped'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Service status */}
      {health?.services?.length ? (
        <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Service Status</h2>
          <div className="space-y-2">
            {health.services.map((svc, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-3">
                  <StatusDot status={svc.status} />
                  <p className="text-xs font-medium text-foreground">{svc.name}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {svc.latency_ms !== undefined && <span>{svc.latency_ms}ms</span>}
                  <span>{fmtRelative(svc.last_check)}</span>
                  {svc.error && <span className="text-red-400">{svc.error}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recent errors */}
      {health?.recent_errors?.length ? (
        <div className="bg-red-400/5 border border-red-400/20 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-red-400 mb-4">Recent Errors</h2>
          <div className="space-y-2">
            {health.recent_errors.map((err, i) => (
              <div key={i} className="flex items-start justify-between text-xs">
                <div>
                  <span className="font-mono text-red-300 mr-2">[{err.service}]</span>
                  <span className="text-muted-foreground">{err.message}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground whitespace-nowrap ml-4">
                  <span className="text-red-400 font-semibold">×{err.count}</span>
                  <span>{fmtRelative(err.last_seen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !health && (
        <div className="flex flex-col items-center justify-center py-20">
          <WifiOff className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-sm font-medium text-red-400">Could not reach health endpoint</p>
          <p className="text-xs text-muted-foreground">Check API server status</p>
        </div>
      )}
    </div>
  )
}
