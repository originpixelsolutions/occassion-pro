'use client'

import { useEffect, useState, useCallback, use } from 'react'
import {
  Download, Loader2, CheckCircle, XCircle, Clock, RefreshCw,
  FileText, FileSpreadsheet, Archive, Zap, Users, Calendar,
  ShoppingCart, ChefHat, DollarSign, Tag, Ticket, BarChart3,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportType =
  | 'guest_list' | 'seating_chart' | 'runsheet' | 'badges' | 'attendance'
  | 'budget_report' | 'vendor_report' | 'fnb_report' | 'payment_report'
  | 'full_event_zip'

type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'zip'
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface ExportJob {
  id:                string
  export_type:       ExportType
  format:            ExportFormat
  status:            JobStatus
  file_url:          string | null
  file_size_bytes:   number | null
  created_at:        string
  completed_at:      string | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const QUICK_EXPORTS: Array<{
  type: 'guest_list' | 'attendance' | 'vendor_report' | 'payment_report'
  label: string
  icon: React.ElementType
  color: string
}> = [
  { type: 'guest_list',    label: 'Guest List CSV',   icon: Users,        color: 'text-blue-400' },
  { type: 'attendance',    label: 'Attendance CSV',   icon: CheckCircle,  color: 'text-emerald-400' },
  { type: 'vendor_report', label: 'Vendor CSV',       icon: Tag,          color: 'text-orange-400' },
  { type: 'payment_report',label: 'Payment CSV',      icon: DollarSign,   color: 'text-purple-400' },
]

const FULL_REPORTS: Array<{
  type: ExportType
  label: string
  description: string
  icon: React.ElementType
  formats: ExportFormat[]
  color: string
}> = [
  {
    type: 'guest_list',    label: 'Guest List',    description: 'Complete guest registry with RSVP, seating, and check-in status',
    icon: Users,        formats: ['pdf', 'xlsx', 'csv'], color: 'text-blue-400',
  },
  {
    type: 'seating_chart', label: 'Seating Chart', description: 'Zone → table → seat assignments with dietary flags',
    icon: Calendar,     formats: ['pdf'],           color: 'text-cyan-400',
  },
  {
    type: 'runsheet',      label: 'Run Sheet',     description: 'Day-of schedule with time blocks, owners and notes',
    icon: FileText,     formats: ['pdf'],           color: 'text-amber-400',
  },
  {
    type: 'badges',        label: 'Badges (6-up)', description: 'Print-ready badge sheet, 6 per A4 page',
    icon: Ticket,       formats: ['pdf'],           color: 'text-rose-400',
  },
  {
    type: 'attendance',    label: 'Attendance',    description: 'Check-in log with timestamps and methods',
    icon: CheckCircle,  formats: ['xlsx', 'csv'],   color: 'text-emerald-400',
  },
  {
    type: 'budget_report', label: 'Budget Report', description: 'Category totals, vendor breakdown, budget vs actual',
    icon: BarChart3,    formats: ['pdf', 'xlsx'],   color: 'text-violet-400',
  },
  {
    type: 'vendor_report', label: 'Vendor Report', description: 'Vendor list with status, payment and performance scores',
    icon: Tag,          formats: ['pdf', 'csv'],    color: 'text-orange-400',
  },
  {
    type: 'fnb_report',    label: 'F&B Report',    description: 'Menu summary, token stats, item-wise consumption',
    icon: ChefHat,      formats: ['pdf'],           color: 'text-pink-400',
  },
  {
    type: 'payment_report',label: 'Payment Report',description: 'Orders by status, revenue by ticket type, refunds',
    icon: DollarSign,   formats: ['pdf', 'csv'],    color: 'text-purple-400',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function StatusChip({ status }: { status: JobStatus }) {
  const cfg: Record<JobStatus, { label: string; color: string; icon: React.ElementType }> = {
    queued:     { label: 'Queued',     color: 'bg-yellow-500/10 text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-400',    icon: Loader2 },
    completed:  { label: 'Done',       color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle },
    failed:     { label: 'Failed',     color: 'bg-red-500/10 text-red-400',      icon: XCircle },
  }
  const { label, color, icon: Icon } = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} /> {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExportCenterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session } = useAuth()

  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [quickDownloading, setQuickDownloading] = useState<string | null>(null)

  // Per-report state: { [type]: { format, generating, jobId } }
  const [reportState, setReportState] = useState<Record<string, {
    format: ExportFormat; generating: boolean; jobId: string | null
  }>>(() =>
    Object.fromEntries(FULL_REPORTS.map(r => [r.type, { format: r.formats[0], generating: false, jobId: null }]))
  )

  // ZIP state
  const [zipState, setZipState] = useState<{ generating: boolean; jobId: string | null }>({ generating: false, jobId: null })

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  // ── Polling logic ─────────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    if (!session?.access_token) return
    const res = await fetch(`${API}/api/v1/events/${eventId}/exports`, { headers: headers() })
    const data = await res.json()
    setJobs(Array.isArray(data) ? data : [])
    setLoadingJobs(false)
  }, [eventId, session, headers])

  useEffect(() => { loadJobs() }, [loadJobs])

  // Poll active jobs every 3 s
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing')
    if (!hasActive) return
    const timer = setInterval(loadJobs, 3000)
    return () => clearInterval(timer)
  }, [jobs, loadJobs])

  // Sync report/zip state with completed jobs
  useEffect(() => {
    jobs.forEach(j => {
      if (j.export_type === 'full_event_zip') {
        if (j.status !== 'queued' && j.status !== 'processing') {
          setZipState(prev => prev.jobId === j.id ? { ...prev, generating: false } : prev)
        }
      } else {
        setReportState(prev => {
          const cur = prev[j.export_type]
          if (cur?.jobId === j.id && (j.status === 'completed' || j.status === 'failed')) {
            return { ...prev, [j.export_type]: { ...cur, generating: false } }
          }
          return prev
        })
      }
    })
  }, [jobs])

  // ── Quick export ──────────────────────────────────────────────────────────────

  const quickDownload = async (type: string) => {
    setQuickDownloading(type)
    try {
      const res = await fetch(`${API}/api/v1/events/${eventId}/exports/quick/${type}`, { headers: headers() })
      const blob = await res.blob()
      const ext = type === 'guest_list' || type === 'attendance' || type === 'vendor_report' || type === 'payment_report' ? 'csv' : 'pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${type}.${ext}`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setQuickDownloading(null)
    }
  }

  // ── Queue full report ─────────────────────────────────────────────────────────

  const generateReport = async (type: ExportType) => {
    const cur = reportState[type]
    setReportState(prev => ({ ...prev, [type]: { ...cur, generating: true, jobId: null } }))
    const res = await fetch(`${API}/api/v1/events/${eventId}/exports`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ export_type: type, format: cur.format }),
    })
    const data = await res.json()
    setReportState(prev => ({ ...prev, [type]: { ...prev[type], jobId: data.job_id } }))
    await loadJobs()
  }

  // ── Queue ZIP ─────────────────────────────────────────────────────────────────

  const generateZip = async () => {
    setZipState({ generating: true, jobId: null })
    const res = await fetch(`${API}/api/v1/events/${eventId}/exports`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ export_type: 'full_event_zip', format: 'zip' }),
    })
    const data = await res.json()
    setZipState({ generating: true, jobId: data.job_id })
    await loadJobs()
  }

  // ── Download helper ───────────────────────────────────────────────────────────

  const downloadJob = (jobId: string) => {
    window.open(`${API}/api/v1/exports/${jobId}/download?token=${session?.access_token}`, '_blank')
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const latestJobForType = (type: string, format?: string) =>
    jobs.find(j => j.export_type === type && (!format || j.format === format))

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Export Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate branded reports, spreadsheets, and a full event ZIP package.</p>
      </div>

      {/* ── Quick Exports ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h2 className="text-base font-semibold text-foreground">Quick Exports</h2>
          <span className="text-xs text-muted-foreground ml-1">Instant CSV download, no queue</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_EXPORTS.map(q => {
            const Icon = q.icon
            const busy = quickDownloading === q.type
            return (
              <button
                key={q.type}
                onClick={() => quickDownload(q.type)}
                disabled={busy}
                className="flex flex-col items-center gap-3 p-5 bg-card border border-border rounded-xl hover:bg-accent transition-all disabled:opacity-50"
              >
                {busy
                  ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  : <Icon className={`w-6 h-6 ${q.color}`} />
                }
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{q.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">CSV</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Download className="w-3 h-3" /> Download
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Full Reports ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-semibold text-foreground">Full Reports</h2>
          <span className="text-xs text-muted-foreground ml-1">Branded PDFs and spreadsheets</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FULL_REPORTS.map(report => {
            const Icon = report.icon
            const state = reportState[report.type]
            const latestJob = latestJobForType(report.type, state.format)
            const isGenerating = state.generating || latestJob?.status === 'queued' || latestJob?.status === 'processing'

            return (
              <div key={report.type} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-background ${report.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{report.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{report.description}</p>
                  </div>
                </div>

                {/* Format selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Format:</span>
                  <div className="flex gap-1">
                    {report.formats.map(f => (
                      <button
                        key={f}
                        onClick={() => setReportState(prev => ({ ...prev, [report.type]: { ...prev[report.type], format: f } }))}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          state.format === f
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => generateReport(report.type)}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Generate</>
                    )}
                  </button>

                  {latestJob?.status === 'completed' && latestJob.file_url && (
                    <button
                      onClick={() => downloadJob(latestJob.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {formatBytes(latestJob.file_size_bytes)}
                    </button>
                  )}

                  {latestJob?.status === 'failed' && (
                    <span className="text-xs text-red-400">Failed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Full Event ZIP ─────────────────────────────────────────────────────── */}
      <section>
        <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-8">
          <div className="flex items-start gap-5">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <Archive className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground">Export Everything</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Generate a single ZIP archive containing all reports — guest list, seating chart, runsheet, badges, attendance, budget, vendors, F&amp;B, and payments — organised into folders.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {['00_Summary.pdf', '01_Guests/', '02_Schedule/', '03_Vendors/', '04_Budget/', '05_FnB/', '06_Payments/', '07_Badges/', '08_Attendance/'].map(f => (
                  <span key={f} className="bg-background border border-border rounded px-2 py-1 font-mono">{f}</span>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={generateZip}
                  disabled={zipState.generating}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {zipState.generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating ZIP…</>
                    : <><Archive className="w-4 h-4" /> Generate Full ZIP</>
                  }
                </button>

                {(() => {
                  const job = latestJobForType('full_event_zip')
                  if (job?.status === 'completed' && job.file_url) {
                    return (
                      <button
                        onClick={() => downloadJob(job.id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download ZIP {formatBytes(job.file_size_bytes) && `(${formatBytes(job.file_size_bytes)})`}
                      </button>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Export History ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Export History</h2>
          </div>
          <button onClick={loadJobs} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingJobs ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No exports yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-center py-3 px-4 font-medium">Format</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Size</th>
                  <th className="text-right py-3 px-4 font-medium">Created</th>
                  <th className="text-center py-3 px-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-foreground font-medium capitalize">{job.export_type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono uppercase">{job.format}</span>
                    </td>
                    <td className="py-3 px-4 text-center"><StatusChip status={job.status} /></td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                      {formatBytes(job.file_size_bytes)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {job.status === 'completed' && job.file_url && (
                        <button
                          onClick={() => downloadJob(job.id)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-background border border-border rounded-lg hover:bg-accent transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
