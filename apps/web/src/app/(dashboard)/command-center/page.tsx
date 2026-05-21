'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock,
  MapPin, Users, Zap, AlertCircle, RefreshCw, Circle,
  XCircle, Radio, Loader2, Shield, UserCheck, ListChecks,
  FileWarning, ChevronRight, Play, Square,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
const POLL_INTERVAL = 30_000 // 30 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveDashboard {
  event: { id: string; name: string; status: string; start_date: string; end_date?: string; event_type: string; venue_id?: string }
  taskStats: { total: number; completed: number; inProgress: number; pending: number; overdue: number }
  guestStats: { total: number; rsvpConfirmed: number; checkedIn: number; checkInRate: number }
  vendorStats: { total: number; confirmed: number; pending: number }
  crew: CrewMember[]
  currentRunsheetItem: RunsheetItem | null
  nextRunsheetItem: RunsheetItem | null
  upcomingTimeline: RunsheetItem[]
  recentIncidents: Incident[]
  criticalTasks: Task[]
  vendors: VendorRow[]
}

interface RunsheetItem {
  id: string; title: string; description?: string; category: string
  scheduled_time: string; duration_minutes?: number; location?: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'delayed'
  is_critical?: boolean; delay_minutes?: number; notes?: string
}

interface Incident {
  id: string; title: string; description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string; status: 'open' | 'investigating' | 'resolved' | 'closed'
  location?: string; created_at: string; resolution?: string
}

interface Task {
  id: string; title: string; status: string; priority: string
  assignee_id?: string; due_date?: string; module?: string
}

interface CrewMember {
  id: string; check_in_status: string; role?: string; department?: string
  profiles?: { id: string; full_name: string; role: string }
}

interface VendorRow {
  id: string; service_type: string; status: string
  vendors?: { name: string; phone?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  if (diff < 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  return `in ${Math.floor(m / 60)}h ${m % 60}m`
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', icon: AlertTriangle },
  high:     { color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30', icon: AlertCircle },
  medium:   { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', icon: AlertCircle },
  low:      { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Circle },
}

const RUNSHEET_CATEGORY_COLOR: Record<string, string> = {
  setup: 'bg-muted/40 text-muted-foreground',
  ceremony: 'bg-violet-500/20 text-violet-400',
  reception: 'bg-purple-500/20 text-purple-400',
  entertainment: 'bg-pink-500/20 text-pink-400',
  catering: 'bg-amber-500/20 text-amber-400',
  vip: 'bg-yellow-500/20 text-yellow-400',
  logistics: 'bg-blue-500/20 text-blue-400',
  technical: 'bg-cyan-500/20 text-cyan-400',
  teardown: 'bg-muted/30 text-muted-foreground',
  general: 'bg-muted/40 text-muted-foreground',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color = 'zinc', pulse = false }: {
  label: string; value: string | number; sub?: string; color?: string; pulse?: boolean
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400', violet: 'text-violet-400', amber: 'text-amber-400',
    red: 'text-red-400', blue: 'text-blue-400', zinc: 'text-foreground',
  }
  return (
    <div className="bg-card/60 border border-border/60 rounded-xl p-4 relative overflow-hidden">
      {pulse && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function RunsheetItemRow({
  item, onStatusChange, updating,
}: {
  item: RunsheetItem
  onStatusChange: (id: string, status: string) => void
  updating: string | null
}) {
  const isNow = item.status === 'in_progress'
  const isDone = item.status === 'completed' || item.status === 'skipped'
  return (
    <div className={`flex items-center gap-3 py-2.5 px-4 rounded-lg border transition-all ${
      isNow ? 'bg-violet-900/20 border-violet-700/40' :
      isDone ? 'opacity-50 border-border/20 bg-transparent' :
      'border-border/30 bg-card/30 hover:bg-muted/30'
    }`}>
      {isNow && <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />}
      {!isNow && <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-zinc-600'}`} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</p>
          {item.is_critical && <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">Critical</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RUNSHEET_CATEGORY_COLOR[item.category] ?? RUNSHEET_CATEGORY_COLOR.general}`}>{item.category}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(item.scheduled_time)}</span>
          {item.duration_minutes && <span>{item.duration_minutes}m</span>}
          {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>}
          {item.delay_minutes && item.delay_minutes > 0 && <span className="text-amber-400">+{item.delay_minutes}m delay</span>}
        </div>
      </div>
      {!isDone && (
        <div className="flex items-center gap-1 shrink-0">
          {updating === item.id ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <>
              {item.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(item.id, 'in_progress')}
                  className="p-1.5 text-muted-foreground hover:text-violet-400 hover:bg-violet-400/10 rounded transition-colors"
                  title="Start"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              {item.status === 'in_progress' && (
                <button
                  onClick={() => onStatusChange(item.id, 'completed')}
                  className="p-1.5 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                  title="Mark complete"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}
      {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [events, setEvents] = useState<{ id: string; name: string; status: string; start_date: string }[]>([])
  const [dashboard, setDashboard] = useState<LiveDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [tab, setTab] = useState<'timeline' | 'tasks' | 'crew' | 'incidents' | 'vendors'>('timeline')
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)
  const [reportIncident, setReportIncident] = useState(false)
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'medium', category: 'general', location: '' })
  const [submittingIncident, setSubmittingIncident] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Load events list
  useEffect(() => {
    const tok = getToken()
    fetch(`${API}/events?status=live,upcoming&limit=20`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.events ?? data.data ?? [])
        setEvents(list)
        // Auto-select first live event
        const liveEvent = list.find((e: { status: string }) => e.status === 'live')
        if (liveEvent) setSelectedEventId(liveEvent.id)
        else if (list.length > 0) setSelectedEventId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false))
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!selectedEventId) return
    setLoading(true)
    const tok = getToken()
    try {
      const res = await fetch(`${API}/command-center/events/${selectedEventId}/live`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.ok) {
        setDashboard(await res.json())
        setLastUpdated(new Date())
      }
    } catch {}
    finally { setLoading(false) }
  }, [selectedEventId])

  // Initial load + polling
  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadDashboard])

  async function handleRunsheetStatus(itemId: string, status: string) {
    setUpdatingItem(itemId)
    const tok = getToken()
    try {
      await fetch(`${API}/command-center/runsheet/${itemId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await loadDashboard()
    } catch {} finally { setUpdatingItem(null) }
  }

  async function handleTaskStatus(taskId: string, status: string) {
    setUpdatingItem(taskId)
    const tok = getToken()
    try {
      await fetch(`${API}/command-center/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await loadDashboard()
    } catch {} finally { setUpdatingItem(null) }
  }

  async function handleCrewCheckin(assignmentId: string) {
    const tok = getToken()
    setUpdatingItem(assignmentId)
    try {
      await fetch(`${API}/command-center/crew/${assignmentId}/checkin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}` },
      })
      await loadDashboard()
    } catch {} finally { setUpdatingItem(null) }
  }

  async function submitIncident() {
    if (!selectedEventId || !incidentForm.title.trim()) return
    setSubmittingIncident(true)
    const tok = getToken()
    try {
      await fetch(`${API}/command-center/events/${selectedEventId}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentForm),
      })
      setReportIncident(false)
      setIncidentForm({ title: '', description: '', severity: 'medium', category: 'general', location: '' })
      await loadDashboard()
    } catch { alert('Failed to report incident') }
    finally { setSubmittingIncident(false) }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Command bar */}
      <div className="border-b border-border/60 bg-card/50 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-sm font-bold text-foreground">LIVE COMMAND CENTER</span>
        </div>

        {/* Event selector */}
        <div className="flex items-center gap-2 ml-4">
          <select
            value={selectedEventId ?? ''}
            onChange={e => setSelectedEventId(e.target.value)}
            className="bg-muted/60 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/60 min-w-[200px]"
          >
            {eventsLoading && <option>Loading events…</option>}
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name}{e.status === 'live' ? ' 🔴' : ''}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 bg-muted/50 border border-border/50 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setReportIncident(true)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-white px-3 py-1.5 bg-red-400/10 hover:bg-red-600 border border-red-400/20 hover:border-red-600 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Report Incident
          </button>
        </div>
      </div>

      {!dashboard && !loading && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a live event to begin monitoring</p>
          </div>
        </div>
      )}

      {loading && !dashboard && (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}

      {dashboard && (
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Event header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{dashboard.event.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    dashboard.event.status === 'live'
                      ? 'text-red-400 bg-red-400/10 border-red-400/20 animate-pulse'
                      : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  }`}>
                    {dashboard.event.status === 'live' ? '● LIVE' : dashboard.event.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {fmtDate(dashboard.event.start_date)}
                  {dashboard.event.end_date ? ` – ${fmtDate(dashboard.event.end_date)}` : ''}
                  {' · '}{dashboard.event.event_type}
                </p>
              </div>
            </div>

            {/* Critical alerts */}
            {(dashboard.recentIncidents.filter(i => i.status === 'open' && (i.severity === 'critical' || i.severity === 'high')).length > 0 ||
              dashboard.criticalTasks.length > 0) && (
              <div className="space-y-2">
                {dashboard.recentIncidents
                  .filter(i => i.status === 'open' && (i.severity === 'critical' || i.severity === 'high'))
                  .map(incident => {
                    const cfg = SEVERITY_CONFIG[incident.severity]
                    return (
                      <div key={incident.id} className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${cfg.bg}`}>
                        <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${cfg.color}`}>[{incident.severity.toUpperCase()}] {incident.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{incident.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtTime(incident.created_at)}</span>
                      </div>
                    )
                  })}
                {dashboard.criticalTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 border border-orange-400/20 bg-orange-400/5 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                    <p className="text-sm text-orange-300 flex-1">Critical task pending: <span className="font-semibold">{task.title}</span></p>
                    <button
                      onClick={() => handleTaskStatus(task.id, 'in_progress')}
                      className="text-xs text-orange-400 hover:text-white px-2 py-1 bg-orange-400/10 rounded"
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatTile label="Tasks Done" value={`${dashboard.taskStats.completed}/${dashboard.taskStats.total}`}
                sub={`${dashboard.taskStats.overdue > 0 ? `${dashboard.taskStats.overdue} overdue` : 'on track'}`}
                color={dashboard.taskStats.overdue > 0 ? 'amber' : 'emerald'} />
              <StatTile label="Guests In" value={dashboard.guestStats.checkedIn}
                sub={`${dashboard.guestStats.checkInRate}% check-in rate`} color="blue" pulse />
              <StatTile label="Vendors" value={`${dashboard.vendorStats.confirmed}/${dashboard.vendorStats.total}`}
                sub={`${dashboard.vendorStats.pending} pending`} color={dashboard.vendorStats.pending > 0 ? 'amber' : 'emerald'} />
              <StatTile label="Crew On-Site" value={dashboard.crew.filter(c => c.check_in_status === 'checked_in').length}
                sub={`of ${dashboard.crew.length} assigned`} color="violet" />
              <StatTile label="Open Incidents" value={dashboard.recentIncidents.filter(i => i.status === 'open').length}
                color={dashboard.recentIncidents.filter(i => i.status === 'open').length > 0 ? 'red' : 'emerald'} />
              <StatTile label="Timeline" value={`${dashboard.upcomingTimeline.length}`}
                sub="upcoming items" color="zinc" />
            </div>

            {/* NOW / NEXT cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-2xl border p-5 ${dashboard.currentRunsheetItem ? 'bg-violet-900/20 border-violet-700/40' : 'bg-card/40 border-border/40'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">Happening Now</span>
                </div>
                {dashboard.currentRunsheetItem ? (
                  <div>
                    <p className="text-base font-bold text-foreground">{dashboard.currentRunsheetItem.title}</p>
                    {dashboard.currentRunsheetItem.location && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{dashboard.currentRunsheetItem.location}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{fmtTime(dashboard.currentRunsheetItem.scheduled_time)} · {dashboard.currentRunsheetItem.duration_minutes}m</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No item currently scheduled</p>
                )}
              </div>

              <div className="bg-card/40 border border-border/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Up Next</span>
                </div>
                {dashboard.nextRunsheetItem ? (
                  <div>
                    <p className="text-base font-bold text-foreground">{dashboard.nextRunsheetItem.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtTime(dashboard.nextRunsheetItem.scheduled_time)} · {timeUntil(dashboard.nextRunsheetItem.scheduled_time)}</p>
                    {dashboard.nextRunsheetItem.location && (
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{dashboard.nextRunsheetItem.location}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing scheduled next</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-card/60 border border-border/60 rounded-xl p-1 w-fit">
              {([
                { key: 'timeline', label: 'Timeline', icon: Clock },
                { key: 'tasks', label: `Tasks (${dashboard.taskStats.total})`, icon: ListChecks },
                { key: 'crew', label: `Crew (${dashboard.crew.length})`, icon: Users },
                { key: 'incidents', label: `Incidents (${dashboard.recentIncidents.filter(i => i.status === 'open').length})`, icon: FileWarning },
                { key: 'vendors', label: 'Vendors', icon: Zap },
              ] as { key: typeof tab; label: string; icon: React.FC<{ className?: string }> }[]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 text-sm py-2 px-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>

            {/* ── Timeline Tab ── */}
            {tab === 'timeline' && (
              <div className="space-y-1.5">
                {dashboard.upcomingTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">No upcoming timeline items</p>
                ) : (
                  dashboard.upcomingTimeline.map(item => (
                    <RunsheetItemRow
                      key={item.id}
                      item={item}
                      onStatusChange={handleRunsheetStatus}
                      updating={updatingItem}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Tasks Tab ── */}
            {tab === 'tasks' && (
              <div className="space-y-2">
                {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
                  const priorityTasks = dashboard.criticalTasks.filter(t => t.priority === priority)
                  if (priorityTasks.length === 0) return null
                  return (
                    <div key={priority} className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{priority} priority</p>
                      {priorityTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 bg-card/60 border border-border/40 rounded-xl px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{task.title}</p>
                            {task.due_date && (
                              <p className={`text-xs mt-0.5 ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-muted-foreground'}`}>
                                Due {fmtTime(task.due_date)}
                                {new Date(task.due_date) < new Date() && ' — OVERDUE'}
                              </p>
                            )}
                          </div>
                          {updatingItem === task.id ? (
                            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                          ) : (
                            <select
                              value={task.status}
                              onChange={e => handleTaskStatus(task.id, e.target.value)}
                              className="bg-muted border border-border rounded-lg px-2 py-1 text-xs text-foreground"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
                {dashboard.criticalTasks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
                    <p className="text-sm">All critical tasks completed!</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Crew Tab ── */}
            {tab === 'crew' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {dashboard.crew.map(member => {
                  const isCheckedIn = member.check_in_status === 'checked_in'
                  return (
                    <div key={member.id} className={`flex items-center gap-3 p-4 rounded-xl border ${
                      isCheckedIn ? 'border-emerald-800/30 bg-emerald-900/10' : 'border-border/40 bg-card/40'
                    }`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                        isCheckedIn ? 'bg-emerald-600/20 text-emerald-400' : 'bg-muted/40 text-muted-foreground'
                      }`}>
                        {(member.profiles?.full_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{member.profiles?.full_name ?? 'Unassigned'}</p>
                        <p className="text-xs text-muted-foreground">{member.role ?? member.profiles?.role ?? '—'}</p>
                      </div>
                      {isCheckedIn ? (
                        <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <button
                          onClick={() => handleCrewCheckin(member.id)}
                          disabled={updatingItem === member.id}
                          className="text-xs text-muted-foreground hover:text-primary-foreground px-2 py-1 bg-muted hover:bg-primary rounded-lg transition-colors shrink-0"
                        >
                          {updatingItem === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check In'}
                        </button>
                      )}
                    </div>
                  )
                })}
                {dashboard.crew.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-12 text-sm">No crew assigned to this event</p>
                )}
              </div>
            )}

            {/* ── Incidents Tab ── */}
            {tab === 'incidents' && (
              <div className="space-y-3">
                {dashboard.recentIncidents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No incidents reported</p>
                  </div>
                ) : (
                  dashboard.recentIncidents.map(incident => {
                    const cfg = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.low
                    return (
                      <div key={incident.id} className={`border rounded-2xl p-5 ${cfg.bg}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-semibold ${cfg.color}`}>{incident.title}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>{incident.severity}</span>
                                <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{incident.category}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  incident.status === 'open' ? 'bg-red-900/30 text-red-300' :
                                  incident.status === 'resolved' ? 'bg-emerald-900/30 text-emerald-300' :
                                  'bg-muted text-muted-foreground'
                                }`}>{incident.status}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
                              {incident.location && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{incident.location}</p>
                              )}
                              {incident.resolution && (
                                <p className="text-xs text-emerald-400 mt-2">✓ {incident.resolution}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{fmtTime(incident.created_at)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ── Vendors Tab ── */}
            {tab === 'vendors' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dashboard.vendors.map(v => (
                  <div key={v.id} className="flex items-center gap-3 bg-card/60 border border-border/40 rounded-xl p-4">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      v.status === 'active' || v.status === 'signed' ? 'bg-emerald-400' :
                      v.status === 'pending' ? 'bg-amber-400' : 'bg-zinc-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{v.vendors?.name ?? 'Unknown vendor'}</p>
                      <p className="text-xs text-muted-foreground">{v.service_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-medium ${
                        v.status === 'active' || v.status === 'signed' ? 'text-emerald-400' :
                        v.status === 'pending' ? 'text-amber-400' : 'text-muted-foreground'
                      }`}>{v.status}</p>
                      {v.vendors?.phone && (
                        <a href={`tel:${v.vendors.phone}`} className="text-xs text-muted-foreground hover:text-foreground">{v.vendors.phone}</a>
                      )}
                    </div>
                  </div>
                ))}
                {dashboard.vendors.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-12 text-sm">No vendors on this event</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Report Incident Modal ── */}
      {reportIncident && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-foreground">Report Incident</h3>
            </div>
            <div className="space-y-3">
              <input type="text" value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Incident title *" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/60" />
              <textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what happened…" rows={3}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/60 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Severity</label>
                  <select value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category</label>
                  <select value={incidentForm.category} onChange={e => setIncidentForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                    {['general','safety','technical','vendor','guest','weather','security','medical','logistics'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input type="text" value={incidentForm.location} onChange={e => setIncidentForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Location (optional)" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/60" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setReportIncident(false)} className="flex-1 py-2 text-sm text-muted-foreground bg-muted rounded-lg">Cancel</button>
              <button
                onClick={submitIncident}
                disabled={!incidentForm.title.trim() || submittingIncident}
                className={`flex-1 py-2 text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-2 ${
                  incidentForm.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                } disabled:opacity-50`}
              >
                {submittingIncident ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Submit Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}