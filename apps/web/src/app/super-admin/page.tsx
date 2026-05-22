'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, AlertTriangle, BarChart3, Building2, CheckCircle2,
  Clock, CreditCard, RefreshCw, TrendingDown, TrendingUp, Users,
  Zap, XCircle, Play, Pause,
} from 'lucide-react'
import { getGreeting } from '@/lib/greeting'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  summary: {
    totalTenants: number; activeTenants: number; totalEvents: number
    totalUsers: number; totalRevenue: number; planCounts: Record<string, number>
    churnRisk: { high: number; critical: number }
  }
  automations: JobStatus[]
  alerts: SmartAlert[]
}

interface JobStatus {
  jobName: string; isEnabled: boolean; isPaused: boolean
  lastRun: string | null; lastStatus: string | null
  lastError: string | null; lastDuration: number | null
}

interface SmartAlert {
  type: string; severity: string; tenantName?: string
  tenantId?: string; message: string; createdAt: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = 'violet', trend }: {
  label: string; value: string; sub?: string
  icon: React.FC<{ className?: string }>; color?: string; trend?: 'up' | 'down' | null
}) {
  const colors: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
  }
  return (
    <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
          {sub}
        </p>
      )}
    </div>
  )
}

function AutomationRow({ job, onTrigger, onTogglePause, triggering, toggling }: {
  job: JobStatus
  onTrigger: (name: string) => void
  onTogglePause: (name: string, pause: boolean) => void
  triggering: string | null
  toggling: string | null
}) {
  const statusColor = job.lastStatus === 'success'
    ? 'text-emerald-400'
    : job.lastStatus === 'failed'
    ? 'text-red-400'
    : 'text-zinc-500'

  const statusIcon = job.lastStatus === 'success'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    : job.lastStatus === 'failed'
    ? <XCircle className="w-3.5 h-3.5 text-red-400" />
    : <Clock className="w-3.5 h-3.5 text-zinc-500" />

  const label = job.jobName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {statusIcon}
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{label}</p>
          <p className={`text-[10px] ${statusColor}`}>
            {job.lastRun ? fmtRelative(job.lastRun) : 'Never run'}
            {job.lastDuration ? ` · ${job.lastDuration}ms` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-3">
        {job.isPaused && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
            PAUSED
          </span>
        )}
        <button
          onClick={() => onTogglePause(job.jobName, !job.isPaused)}
          disabled={toggling === job.jobName}
          title={job.isPaused ? 'Resume' : 'Pause'}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
        >
          {job.isPaused
            ? <Play className="w-3 h-3" />
            : <Pause className="w-3 h-3" />
          }
        </button>
        <button
          onClick={() => onTrigger(job.jobName)}
          disabled={triggering === job.jobName || job.isPaused}
          title="Run now"
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-violet-400 hover:bg-violet-400/10 transition-colors disabled:opacity-40"
        >
          {triggering === job.jobName
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <Zap className="w-3 h-3" />
          }
        </button>
      </div>
    </div>
  )
}

function AlertRow({ alert }: { alert: SmartAlert }) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/20',
    warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  }
  const sev = alert.severity?.toLowerCase() ?? 'info'

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${colors[sev] ?? colors.info} mb-2`}>
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium">{alert.message}</p>
        {alert.tenantName && (
          <p className="text-[10px] opacity-70 mt-0.5">{alert.tenantName} · {fmtRelative(alert.createdAt)}</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const token = getToken()
      const h = { Authorization: `Bearer ${token}` }
      const [ovRes, jobRes, alertRes] = await Promise.all([
        fetch(`${API}/super-admin/overview`, { headers: h }),
        fetch(`${API}/super-admin/automations`, { headers: h }),
        fetch(`${API}/super-admin/alerts`, { headers: h }),
      ])
      const [ov, jobs, alerts] = await Promise.all([
        ovRes.ok ? ovRes.json() : null,
        jobRes.ok ? jobRes.json() : [],
        alertRes.ok ? alertRes.json() : [],
      ])
      setData({
        summary: ov?.summary ?? {
          totalTenants: 0, activeTenants: 0, totalEvents: 0,
          totalUsers: 0, totalRevenue: 0, planCounts: {}, churnRisk: { high: 0, critical: 0 },
        },
        automations: jobs ?? [],
        alerts: alerts ?? [],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const triggerJob = async (jobName: string) => {
    setTriggering(jobName)
    try {
      await fetch(`${API}/super-admin/automations/${jobName}/trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      await load()
    } finally {
      setTriggering(null)
    }
  }

  const togglePause = async (jobName: string, pause: boolean) => {
    setToggling(jobName)
    try {
      await fetch(`${API}/super-admin/automations/${jobName}/${pause ? 'pause' : 'resume'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      await load()
    } finally {
      setToggling(null)
    }
  }

  const s = data?.summary
  const criticalAlerts = data?.alerts.filter(a => a.severity === 'critical') ?? []
  const warningAlerts = data?.alerts.filter(a => a.severity === 'warning') ?? []
  const failedJobs = data?.automations.filter(j => j.lastStatus === 'failed') ?? []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{getGreeting()}, Hariprathish</h1>
          <p className="text-sm text-muted-foreground">Platform Command Center</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {(criticalAlerts.length > 0 || failedJobs.length > 0) && (
        <div className="mb-5 p-3 bg-red-400/10 border border-red-400/20 rounded-xl flex items-center gap-2.5 text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">
            {criticalAlerts.length > 0 && `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''}`}
            {criticalAlerts.length > 0 && failedJobs.length > 0 && ' · '}
            {failedJobs.length > 0 && `${failedJobs.length} automation failure${failedJobs.length > 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Tenants" value={fmt(s?.totalTenants ?? 0)} sub={`${fmt(s?.activeTenants ?? 0)} active`} icon={Building2} color="violet" />
        <KpiCard label="Total Users" value={fmt(s?.totalUsers ?? 0)} icon={Users} color="blue" />
        <KpiCard label="Total Events" value={fmt(s?.totalEvents ?? 0)} icon={BarChart3} color="emerald" />
        <KpiCard label="Platform Revenue" value={fmtCurrency(s?.totalRevenue ?? 0)} icon={CreditCard} color="amber" />
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Automation Status */}
        <div className="lg:col-span-2 bg-card/60 border border-border/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-foreground">Automation Status</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {data?.automations.filter(j => !j.isPaused && j.isEnabled).length ?? 0}/{data?.automations.length ?? 0} running
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.automations.length ? (
            data.automations.map(job => (
              <AutomationRow
                key={job.jobName}
                job={job}
                onTrigger={triggerJob}
                onTogglePause={togglePause}
                triggering={triggering}
                toggling={toggling}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No automations configured</p>
          )}
        </div>

        {/* Smart Alerts + Churn Risk */}
        <div className="space-y-5">
          {/* Smart Alerts */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">Smart Alerts</h2>
              {data?.alerts.length ? (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded ml-auto">
                  {data.alerts.length}
                </span>
              ) : null}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted/30 rounded-xl animate-pulse" />)}
              </div>
            ) : data?.alerts.length ? (
              <div className="max-h-52 overflow-y-auto">
                {data.alerts.slice(0, 8).map((a, i) => <AlertRow key={i} alert={a} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-xs font-medium text-emerald-400">All clear</p>
                <p className="text-[10px] text-muted-foreground">No active alerts</p>
              </div>
            )}
          </div>

          {/* Churn Risk */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-foreground">Churn Risk</h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-red-400/10 border border-red-400/20 rounded-lg">
                <span className="text-xs text-red-400 font-medium">Critical</span>
                <span className="text-lg font-bold text-red-400">{s?.churnRisk?.critical ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                <span className="text-xs text-amber-400 font-medium">High</span>
                <span className="text-lg font-bold text-amber-400">{s?.churnRisk?.high ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Plan Distribution */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Plan Distribution</h2>
            {s?.planCounts && Object.entries(s.planCounts).length ? (
              <div className="space-y-1.5">
                {Object.entries(s.planCounts).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{plan}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
