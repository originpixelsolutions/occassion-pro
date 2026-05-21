'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Clock, Zap, Database, Radio, HardDrive, Globe,
  Play, RotateCcw, Activity, TrendingUp,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  if (typeof window === 'undefined') return ''
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('supabase') && k.includes('auth')) {
        const p = JSON.parse(localStorage.getItem(k) ?? '{}')
        return p?.access_token ?? p?.access_token ?? ''
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  latency_ms: number | null
  uptime_pct: number | null
  last_checked: string | null
  message?: string
}

interface ScheduledJob {
  id: string
  name: string
  cron: string
  last_run: string | null
  next_run: string | null
  status: 'idle' | 'running' | 'failed' | 'disabled'
  last_duration_ms: number | null
  last_error?: string
}

interface SystemMetrics {
  requests_per_min: number
  error_rate_pct: number
  avg_latency_ms: number
  p99_latency_ms: number
  active_connections: number
  queue_depth: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ElementType> = {
  api:       Zap,
  database:  Database,
  realtime:  Radio,
  storage:   HardDrive,
  cf_worker: Globe,
}

const STATUS_CONFIG = {
  healthy:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', label: 'Healthy' },
  degraded: { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     dot: 'bg-amber-400',   label: 'Degraded' },
  down:     { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         dot: 'bg-red-400',     label: 'Down' },
  unknown:  { color: 'text-zinc-500',    bg: 'bg-zinc-500/10 border-zinc-500/20',       dot: 'bg-zinc-500',    label: 'Unknown' },
}

const JOB_STATUS_CONFIG = {
  idle:     { color: 'text-zinc-400',    bg: 'bg-zinc-500/10 border-zinc-500/20',       label: 'Idle' },
  running:  { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Running' },
  failed:   { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Failed' },
  disabled: { color: 'text-zinc-600',    bg: 'bg-zinc-700/10 border-zinc-700/20',       label: 'Disabled' },
}

function StatusDot({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="relative flex h-2 w-2">
      {status === 'healthy' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-40`} />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
    </span>
  )
}

function StatusIcon({ status }: { status: keyof typeof STATUS_CONFIG }) {
  if (status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-400" />
  if (status === 'down') return <XCircle className="w-4 h-4 text-red-400" />
  return <Clock className="w-4 h-4 text-zinc-500" />
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtRelative(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [svc, jobsData, metricsData] = await Promise.allSettled([
        apiFetch('/super-admin/system/services'),
        apiFetch('/super-admin/system/jobs'),
        apiFetch('/super-admin/system/metrics'),
      ])
      if (svc.status === 'fulfilled') setServices(svc.value ?? [])
      if (jobsData.status === 'fulfilled') setJobs(jobsData.value ?? [])
      if (metricsData.status === 'fulfilled') setMetrics(metricsData.value)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const triggerJob = async (job: ScheduledJob) => {
    setTriggeringJob(job.id)
    try {
      await apiFetch(`/super-admin/system/jobs/${job.id}/trigger`, { method: 'POST' })
      // Optimistically update job status
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'running', last_run: new Date().toISOString() } : j))
      // Reload after 2s to get updated status
      setTimeout(load, 2000)
    } finally {
      setTriggeringJob(null)
    }
  }

  const overallStatus = services.length === 0
    ? 'unknown'
    : services.some(s => s.status === 'down')
      ? 'down'
      : services.some(s => s.status === 'degraded')
        ? 'degraded'
        : 'healthy'

  const overallCfg = STATUS_CONFIG[overallStatus]

  return (
    <div className="p-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">System Health</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Infrastructure status, scheduled jobs, and platform metrics
            {lastRefresh && (
              <span className="ml-2 text-zinc-600">· refreshed {fmtRelative(lastRefresh.toISOString())}</span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${overallCfg.bg}`}>
        <StatusDot status={overallStatus} />
        <p className={`text-xs font-semibold ${overallCfg.color}`}>
          {overallStatus === 'healthy' && 'All systems operational'}
          {overallStatus === 'degraded' && 'Some services are experiencing degraded performance'}
          {overallStatus === 'down' && 'One or more services are down'}
          {overallStatus === 'unknown' && 'System status unavailable'}
        </p>
        <span className="ml-auto text-[10px] text-zinc-600">
          Auto-refresh every 30s
        </span>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {loading && services.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-white/[0.04] rounded w-3/4 mb-3" />
                <div className="h-6 bg-white/[0.04] rounded w-1/2" />
              </div>
            ))
          : services.map(service => {
              const cfg = STATUS_CONFIG[service.status]
              const Icon = SERVICE_ICONS[service.name.toLowerCase().replace(/\s+/g, '_')] ?? Activity
              return (
                <div key={service.name} className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <StatusIcon status={service.status} />
                  </div>
                  <p className="text-xs font-semibold text-zinc-300 mb-0.5 capitalize">
                    {service.name.replace(/_/g, ' ')}
                  </p>
                  <p className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</p>
                  {service.latency_ms !== null && (
                    <p className="text-[10px] text-zinc-600 mt-1">{service.latency_ms}ms latency</p>
                  )}
                  {service.uptime_pct !== null && (
                    <p className="text-[10px] text-zinc-600">{service.uptime_pct.toFixed(2)}% uptime</p>
                  )}
                  {service.message && (
                    <p className="text-[10px] text-amber-500 mt-1 truncate" title={service.message}>
                      {service.message}
                    </p>
                  )}
                  {service.last_checked && (
                    <p className="text-[10px] text-zinc-700 mt-1">
                      {fmtRelative(service.last_checked)}
                    </p>
                  )}
                </div>
              )
            })
        }
      </div>

      {/* Metrics row */}
      {metrics && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Req/min',        value: metrics.requests_per_min.toLocaleString(),     icon: Activity,     color: 'text-blue-400' },
            { label: 'Error Rate',     value: `${metrics.error_rate_pct.toFixed(2)}%`,       icon: AlertTriangle, color: metrics.error_rate_pct > 5 ? 'text-red-400' : 'text-emerald-400' },
            { label: 'Avg Latency',    value: `${metrics.avg_latency_ms}ms`,                 icon: Clock,        color: 'text-zinc-300' },
            { label: 'p99 Latency',    value: `${metrics.p99_latency_ms}ms`,                 icon: TrendingUp,   color: metrics.p99_latency_ms > 2000 ? 'text-amber-400' : 'text-zinc-300' },
            { label: 'Connections',    value: metrics.active_connections.toLocaleString(),   icon: Radio,        color: 'text-violet-400' },
            { label: 'Queue Depth',    value: metrics.queue_depth.toLocaleString(),          icon: Database,     color: metrics.queue_depth > 100 ? 'text-amber-400' : 'text-zinc-300' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#111118] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3 h-3 text-zinc-600" />
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">{label}</p>
              </div>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Jobs */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-300">Scheduled Jobs</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Cron jobs and background workers</p>
          </div>
          <span className="text-[10px] text-zinc-600">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-zinc-600">No scheduled jobs found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {jobs.map(job => {
              const jcfg = JOB_STATUS_CONFIG[job.status]
              const isTriggering = triggeringJob === job.id
              return (
                <div key={job.id} className="px-4 py-3.5 flex items-center gap-4">
                  {/* Status + Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${jcfg.bg} ${jcfg.color} shrink-0`}>
                      {jcfg.label}
                      {job.status === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin ml-1" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">{job.name}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">{job.cron}</p>
                    </div>
                  </div>

                  {/* Last run */}
                  <div className="shrink-0 text-right w-28">
                    <p className="text-[10px] text-zinc-500">Last run</p>
                    <p className="text-xs text-zinc-400">{fmtRelative(job.last_run)}</p>
                    {job.last_duration_ms !== null && (
                      <p className="text-[10px] text-zinc-600">{job.last_duration_ms}ms</p>
                    )}
                  </div>

                  {/* Next run */}
                  <div className="shrink-0 text-right w-28">
                    <p className="text-[10px] text-zinc-500">Next run</p>
                    <p className="text-xs text-zinc-400">{fmtTime(job.next_run)}</p>
                  </div>

                  {/* Error message */}
                  {job.last_error && (
                    <div className="min-w-0 w-40 shrink-0">
                      <p className="text-[10px] text-red-400 truncate" title={job.last_error}>
                        ⚠ {job.last_error}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="shrink-0 flex gap-1.5">
                    <button
                      onClick={() => triggerJob(job)}
                      disabled={isTriggering || job.status === 'running' || job.status === 'disabled'}
                      title="Trigger manually"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 text-[10px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isTriggering
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      Run
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Response Time Bars — simple visualization */}
      {services.filter(s => s.latency_ms !== null).length > 0 && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 mt-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-4">Response Times</p>
          <div className="space-y-3">
            {services
              .filter(s => s.latency_ms !== null)
              .map(service => {
                const max = Math.max(...services.filter(s => s.latency_ms !== null).map(s => s.latency_ms!))
                const pct = max > 0 ? ((service.latency_ms! / max) * 100) : 0
                const barColor = service.latency_ms! < 100
                  ? 'bg-emerald-500'
                  : service.latency_ms! < 500
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                return (
                  <div key={service.name} className="flex items-center gap-3">
                    <p className="text-[10px] text-zinc-500 w-20 capitalize shrink-0">
                      {service.name.replace(/_/g, ' ')}
                    </p>
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono w-14 text-right shrink-0">
                      {service.latency_ms}ms
                    </p>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
