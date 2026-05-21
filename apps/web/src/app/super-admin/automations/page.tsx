'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, Pause, Play,
  RefreshCw, Zap, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

function fmtDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
function fmtRelative(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const JOB_DESCRIPTIONS: Record<string, { schedule: string; description: string }> = {
  'subscription-scheduler':   { schedule: '0 2 * * *', description: 'Checks billing due dates and triggers subscription renewals via Razorpay' },
  'tenant-health-updater':    { schedule: '0 * * * *', description: 'Recalculates health score for all tenants (activity + billing + storage + recency)' },
  'churn-risk-detector':      { schedule: '0 4 * * *', description: 'Flags tenants with high/critical churn risk and tags them for support follow-up' },
  'storage-enforcer':         { schedule: '0 6 * * *', description: 'Checks storage quotas and enforces limits on over-quota tenants' },
  'notification-engine':      { schedule: '0 9 * * *', description: 'Sends scheduled notification digests, trial expiry warnings, and billing reminders' },
  'payment-retry':            { schedule: '0 3 * * *', description: 'Retries failed payment invoices at 3/7/14-day intervals' },
  'auto-suspend':             { schedule: '0 5 * * *', description: 'Auto-suspends tenants with payment overdue beyond configured threshold' },
  'data-cleanup':             { schedule: '0 0 * * 0', description: 'Purges expired impersonation sessions, old audit log entries, and soft-deleted records' },
}

interface JobStatus {
  jobName: string; isEnabled: boolean; isPaused: boolean
  lastRun: string | null; lastStatus: string | null
  lastError: string | null; lastDuration: number | null
  recordsProcessed?: number
}

interface JobRun {
  id: string; status: string; started_at: string; completed_at: string | null
  duration_ms: number | null; records_processed: number | null; error_message: string | null
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-zinc-600">—</span>
  const map: Record<string, string> = {
    success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    failed:  'text-red-400 bg-red-400/10 border-red-400/20',
    running: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    skipped: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${map[status] ?? map.skipped}`}>
      {status.toUpperCase()}
    </span>
  )
}

function JobCard({ job, onTrigger, onTogglePause, triggering, toggling }: {
  job: JobStatus
  onTrigger: (name: string) => void
  onTogglePause: (name: string, pause: boolean) => void
  triggering: string | null
  toggling: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [runs, setRuns] = useState<JobRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)

  const loadRuns = async () => {
    if (runs.length) { setExpanded(e => !e); return }
    setLoadingRuns(true)
    setExpanded(true)
    try {
      const res = await fetch(`${API}/super-admin/automations/${job.jobName}/runs?limit=5`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRuns(await res.json())
    } finally {
      setLoadingRuns(false)
    }
  }

  const meta = JOB_DESCRIPTIONS[job.jobName]
  const label = job.jobName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const borderColor = job.lastStatus === 'failed'
    ? 'border-red-400/30'
    : job.isPaused
    ? 'border-amber-400/20'
    : 'border-border/50'

  return (
    <div className={`bg-card/60 border ${borderColor} rounded-2xl overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Status icon */}
            <div className="mt-0.5">
              {job.lastStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {job.lastStatus === 'failed'  && <XCircle className="w-4 h-4 text-red-400" />}
              {job.lastStatus === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
              {!job.lastStatus && <Clock className="w-4 h-4 text-zinc-600" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {job.isPaused && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">PAUSED</span>
                )}
                {!job.isEnabled && (
                  <span className="text-[9px] font-bold text-zinc-500 bg-zinc-500/10 border border-zinc-500/20 px-1.5 py-0.5 rounded">DISABLED</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{meta?.description ?? 'Automated job'}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">
                  {meta?.schedule ?? 'scheduled'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Last run: {fmtRelative(job.lastRun)}
                </span>
                {job.lastDuration && (
                  <span className="text-[10px] text-muted-foreground">
                    Duration: {fmtDuration(job.lastDuration)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={job.lastStatus} />
            <button
              onClick={() => onTogglePause(job.jobName, !job.isPaused)}
              disabled={toggling === job.jobName}
              title={job.isPaused ? 'Resume job' : 'Pause job'}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20 transition-all"
            >
              {toggling === job.jobName
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : job.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />
              }
            </button>
            <button
              onClick={() => onTrigger(job.jobName)}
              disabled={triggering === job.jobName || job.isPaused || !job.isEnabled}
              title="Trigger now"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/20 hover:bg-violet-600/30 transition-all disabled:opacity-40"
            >
              {triggering === job.jobName
                ? <><Loader2 className="w-3 h-3 animate-spin" />Running</>
                : <><Zap className="w-3 h-3" />Run Now</>
              }
            </button>
            <button
              onClick={loadRuns}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-foreground transition-colors"
              title="View run history"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Error message */}
        {job.lastStatus === 'failed' && job.lastError && (
          <div className="mt-3 p-2.5 bg-red-400/5 border border-red-400/20 rounded-lg">
            <p className="text-[11px] text-red-400 font-mono break-all">{job.lastError}</p>
          </div>
        )}
      </div>

      {/* Run history drawer */}
      {expanded && (
        <div className="border-t border-border/30 bg-background/40 p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Recent Runs
          </p>
          {loadingRuns ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </div>
          ) : runs.length ? (
            <div className="space-y-1">
              {runs.map(run => (
                <div key={run.id} className="flex items-center gap-3 text-[11px]">
                  <StatusBadge status={run.status} />
                  <span className="text-muted-foreground">{new Date(run.started_at).toLocaleString()}</span>
                  <span className="text-muted-foreground">{fmtDuration(run.duration_ms)}</span>
                  {run.records_processed != null && (
                    <span className="text-zinc-600">{run.records_processed} records</span>
                  )}
                  {run.error_message && (
                    <span className="text-red-400 truncate max-w-xs" title={run.error_message}>
                      {run.error_message.slice(0, 60)}…
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No run history</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [pendingPause, setPendingPause] = useState<{ name: string; pause: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/automations`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setJobs(await res.json())
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
      setTimeout(load, 1500)
    } finally {
      setTriggering(null)
    }
  }

  const togglePause = async (jobName: string, pause: boolean) => {
    if (pause) {
      setPendingPause({ name: jobName, pause })
      return
    }
    // Resume: no reason needed
    setToggling(jobName)
    try {
      await fetch(`${API}/super-admin/automations/${jobName}/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      await load()
    } finally {
      setToggling(null)
    }
  }

  const confirmPause = async () => {
    if (!pendingPause) return
    setToggling(pendingPause.name)
    try {
      await fetch(`${API}/super-admin/automations/${pendingPause.name}/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: pauseReason || 'Manual pause by super admin' }),
      })
      await load()
    } finally {
      setToggling(null)
      setPendingPause(null)
      setPauseReason('')
    }
  }

  const running  = jobs.filter(j => !j.isPaused && j.isEnabled && j.lastStatus !== 'failed')
  const paused   = jobs.filter(j => j.isPaused)
  const failed   = jobs.filter(j => j.lastStatus === 'failed')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Automation Control Center</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            The platform runs itself. Override when needed.
          </p>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{running.length}</p>
          <p className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-wide">Running</p>
        </div>
        <div className={`${paused.length ? 'bg-amber-400/10 border-amber-400/20' : 'bg-card/60 border-border/50'} border rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${paused.length ? 'text-amber-400' : 'text-muted-foreground'}`}>{paused.length}</p>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${paused.length ? 'text-amber-400/80' : 'text-muted-foreground'}`}>Paused</p>
        </div>
        <div className={`${failed.length ? 'bg-red-400/10 border-red-400/20' : 'bg-card/60 border-border/50'} border rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${failed.length ? 'text-red-400' : 'text-muted-foreground'}`}>{failed.length}</p>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${failed.length ? 'text-red-400/80' : 'text-muted-foreground'}`}>Failed</p>
        </div>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-card/30 border border-border/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : jobs.length ? (
        <div className="space-y-3">
          {/* Failed first */}
          {failed.map(job => (
            <JobCard key={job.jobName} job={job} onTrigger={triggerJob} onTogglePause={togglePause} triggering={triggering} toggling={toggling} />
          ))}
          {/* Paused */}
          {paused.filter(j => j.lastStatus !== 'failed').map(job => (
            <JobCard key={job.jobName} job={job} onTrigger={triggerJob} onTogglePause={togglePause} triggering={triggering} toggling={toggling} />
          ))}
          {/* Running */}
          {jobs.filter(j => !j.isPaused && j.lastStatus !== 'failed').map(job => (
            <JobCard key={job.jobName} job={job} onTrigger={triggerJob} onTogglePause={togglePause} triggering={triggering} toggling={toggling} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="w-12 h-12 text-zinc-700 mb-3" />
          <p className="text-sm text-muted-foreground">No automations configured</p>
        </div>
      )}

      {/* Pause confirm modal */}
      {pendingPause && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold">Pause Automation</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pausing <strong className="text-foreground">{pendingPause.name}</strong> will stop automatic execution.
              You can resume it at any time.
            </p>
            <input
              value={pauseReason}
              onChange={e => setPauseReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setPendingPause(null); setPauseReason('') }}
                className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmPause}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-all"
              >
                Pause Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
