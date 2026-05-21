'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Layers, AlertTriangle, CheckCircle2, Clock, Users, MapPin,
  Zap, RefreshCw, ArrowRight, Activity,
  TrendingUp, AlertCircle, Radio, Star, Truck, Package,
  CalendarDays, Eye, Shield, Flame, X,
  HardHat, Music2, Utensils, Circle, PanelLeft, Grid,
  Target, Crosshair, ServerCrash, BarChart3, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── API Types ────────────────────────────────────────────────────────────────

interface ApiEvent {
  id: string
  name: string
  status: string
  event_date: string
  end_date: string | null
  event_type?: string
  type?: string
  venue?: string
  city?: string
  budget_total?: number
  expected_guest_count?: number
  stats: {
    taskCompletion: number
    staffCheckin: number
    guestCheckin: number
    vendorConfirmed: number
    criticalTasks: number
  }
  health_score: number
  open_incidents: number
  incidents: any[]
  [key: string]: any
}

interface ApiAlert {
  id: string
  type: string
  severity: string
  title: string
  event: string
  created_at: string
}

interface ApiConflict {
  type: string
  resource_id: string
  resource_name: string
  event_a: string
  event_b: string
  overlap_start: string
  overlap_end: string
  severity: 'warning' | 'critical'
}

interface DashboardData {
  events: ApiEvent[]
  conflicts: ApiConflict[]
  open_incidents: any[]
  summary: {
    total_events: number
    live_events: number
    critical_alerts: number
    total_conflicts: number
    avg_health: number
  }
}

interface AlertsData {
  alerts: ApiAlert[]
  counts: { critical: number; warning: number; total: number }
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

type EventStatus = 'setup' | 'live' | 'wrapup' | 'upcoming' | 'paused'
type AlertSeverity = 'critical' | 'warning' | 'info'

// Map DB status → UI status
function mapStatus(s: string): EventStatus {
  if (s === 'live') return 'live'
  if (s === 'setup') return 'setup'
  if (s === 'wrapup' || s === 'completed') return 'wrapup'
  if (s === 'cancelled') return 'paused'
  return 'upcoming' // planning, confirmed
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1000)        return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function formatOverlap(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmtT = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const sameDay = s.toDateString() === e.toDateString()
  return sameDay ? `${fmtT(s)} – ${fmtT(e)}, ${fmtD(s)}` : `${fmtD(s)} – ${fmtD(e)}`
}

function eventTimeRange(start: string, end: string | null): string {
  const s = new Date(start)
  const fmtT = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (!end) return fmtT(s)
  const e = new Date(end)
  return `${fmtT(s)} – ${fmtT(e)}`
}

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string; pulse: string }> = {
  live:     { label: 'LIVE',     color: 'text-emerald-400', bg: 'bg-emerald-500/20', pulse: 'bg-emerald-500' },
  setup:    { label: 'SETUP',    color: 'text-amber-400',   bg: 'bg-amber-500/20',   pulse: 'bg-amber-500' },
  wrapup:   { label: 'WRAP-UP', color: 'text-blue-400',    bg: 'bg-blue-500/20',    pulse: 'bg-blue-500' },
  upcoming: { label: 'UPCOMING', color: 'text-white/50',    bg: 'bg-white/10',       pulse: 'bg-white/40' },
  paused:   { label: 'PAUSED',   color: 'text-red-400',     bg: 'bg-red-500/20',     pulse: 'bg-red-500' },
}

const EVENT_TYPE_ICON: Record<string, React.ElementType> = {
  'Wedding': Star, 'wedding': Star,
  'Conference': BarChart3, 'conference': BarChart3,
  'Music Festival': Music2, 'festival': Music2,
  'Private Party': Star, 'private': Star,
  'Corporate Retreat': Target, 'corporate': Target,
  'Religious Festival': Shield, 'religious': Shield,
  'Product Launch': Zap, 'launch': Zap,
  'Exhibition': Layers, 'exhibition': Layers,
  'Sports': Target, 'sports': Target,
  'default': CalendarDays,
}

function healthColor(score: number): string {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-400'
  return 'text-red-400'
}
function healthBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500'
  if (score >= 65) return 'bg-amber-500'
  return 'bg-red-500'
}

// ─── Health Ring ──────────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 85 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke={color}
        strokeWidth="4" strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="28" y="33" textAnchor="middle" fill={color} fontSize="11" fontWeight="700">{score}</text>
    </svg>
  )
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────

function PulseDot({ status }: { status: EventStatus }) {
  const cfg = STATUS_CONFIG[status]
  if (status !== 'live' && status !== 'setup') {
    return <span className={`w-2 h-2 rounded-full ${cfg.pulse} inline-block`} />
  }
  return (
    <span className="relative inline-flex">
      <span className={`w-2 h-2 rounded-full ${cfg.pulse} inline-block relative z-10`} />
      <span className={`absolute inset-0 w-2 h-2 rounded-full ${cfg.pulse} opacity-60 animate-ping`} />
    </span>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onClick, selected }: { event: ApiEvent; onClick: () => void; selected: boolean }) {
  const uiStatus = mapStatus(event.status)
  const st = STATUS_CONFIG[uiStatus]
  const TypeIcon = EVENT_TYPE_ICON[event.event_type ?? event.type ?? ''] ?? EVENT_TYPE_ICON['default']
  const { taskCompletion, staffCheckin, guestCheckin, vendorConfirmed, criticalTasks } = event.stats

  return (
    <div
      onClick={onClick}
      className={`bg-[#0f172a] border rounded-xl p-4 cursor-pointer transition-all group ${
        selected
          ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10'
          : criticalTasks > 0 || event.open_incidents > 0
          ? 'border-red-500/30 hover:border-red-500/50'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${st.bg}`}>
            <TypeIcon className={`w-4 h-4 ${st.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate leading-tight">{event.name}</p>
            <p className="text-[10px] text-white/35 mt-0.5 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {event.venue ? `${event.venue}${event.city ? `, ${event.city}` : ''}` : (event.city ?? '—')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(criticalTasks > 0 || event.open_incidents > 0) && (
            <span className="flex items-center gap-0.5 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">
              <Flame className="w-2.5 h-2.5" />{criticalTasks + event.open_incidents}
            </span>
          )}
          <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${st.bg} ${st.color}`}>
            <PulseDot status={uiStatus} />
            {st.label}
          </span>
        </div>
      </div>

      {/* Time */}
      <p className="text-[10px] text-white/30 mb-3 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        {eventTimeRange(event.event_date, event.end_date)}
      </p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Guests', value: `${guestCheckin}%`, pct: guestCheckin, color: 'bg-blue-500' },
          { label: 'Staff On-Site', value: `${staffCheckin}%`, pct: staffCheckin, color: staffCheckin < 90 ? 'bg-amber-500' : 'bg-emerald-500' },
          { label: 'Vendors', value: `${vendorConfirmed}%`, pct: vendorConfirmed, color: vendorConfirmed < 100 ? 'bg-amber-500' : 'bg-emerald-500' },
          { label: 'Tasks Done', value: `${taskCompletion}%`, pct: taskCompletion, color: taskCompletion < 60 ? 'bg-red-500' : 'bg-indigo-500' },
        ].map(({ label, value, pct, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}</span>
              <span className="text-[10px] text-white/60 font-medium">{value}</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Health */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${healthBg(event.health_score)}`} />
          <span className={`text-[10px] font-semibold ${healthColor(event.health_score)}`}>Health: {event.health_score}</span>
        </div>
        {event.open_incidents > 0 && (
          <span className="text-[10px] text-red-400">{event.open_incidents} incident{event.open_incidents > 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, onAck }: { alert: ApiAlert; onAck: (id: string) => void }) {
  const sevConfig = {
    critical: { icon: Flame,          color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
    warning:  { icon: AlertTriangle,  color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    info:     { icon: Activity,       color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' },
  }
  const sev = (alert.severity as keyof typeof sevConfig) in sevConfig ? alert.severity as keyof typeof sevConfig : 'info'
  const cfg = sevConfig[sev]
  const Icon = cfg.icon

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.03]">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} border`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold text-white/60 truncate">{alert.event}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${cfg.bg} border ${cfg.color}`}>
            {alert.type.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-white/70 leading-snug">{alert.title}</p>
        <p className="text-[10px] text-white/25 mt-1">{timeAgo(alert.created_at)}</p>
      </div>
    </div>
  )
}

// ─── Conflict Card ────────────────────────────────────────────────────────────

function ConflictCard({ conflict }: { conflict: ApiConflict }) {
  return (
    <div className={`border rounded-xl p-3 ${conflict.severity === 'critical' ? 'bg-red-500/5 border-red-500/15' : 'bg-amber-500/5 border-amber-500/15'}`}>
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${conflict.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80 truncate">{conflict.resource_name}</p>
          <p className={`text-[10px] mt-0.5 capitalize ${conflict.severity === 'critical' ? 'text-red-400/70' : 'text-amber-400/70'}`}>
            {conflict.type} conflict · {conflict.severity}
          </p>
        </div>
      </div>
      <div className="space-y-1 ml-5">
        {[conflict.event_a, conflict.event_b].map((e, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/40">
            <ArrowRight className={`w-2.5 h-2.5 ${conflict.severity === 'critical' ? 'text-red-400/50' : 'text-amber-400/50'}`} />
            {e}
          </div>
        ))}
        <p className="text-[10px] text-white/25 mt-1.5">{formatOverlap(conflict.overlap_start, conflict.overlap_end)}</p>
      </div>
    </div>
  )
}

// ─── Event Detail Panel ───────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose }: { event: ApiEvent; onClose: () => void }) {
  const uiStatus = mapStatus(event.status)
  const st = STATUS_CONFIG[uiStatus]
  const TypeIcon = EVENT_TYPE_ICON[event.event_type ?? event.type ?? ''] ?? EVENT_TYPE_ICON['default']
  const { taskCompletion, staffCheckin, guestCheckin, vendorConfirmed, criticalTasks } = event.stats

  return (
    <div className="h-full flex flex-col border-l border-white/[0.06] bg-[#090e1a]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${st.bg}`}>
            <TypeIcon className={`w-5 h-5 ${st.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">{event.name}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {event.venue ?? ''}{event.city ? ` · ${event.city}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>
            <PulseDot status={uiStatus} />
            {st.label}
          </span>
          <button onClick={onClose} className="text-white/25 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Health ring + budget */}
        <div className="flex items-center gap-4">
          <HealthRing score={event.health_score} />
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-3">
              {event.budget_total && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Budget</p>
                  <p className="text-sm font-semibold text-white">{fmt(event.budget_total)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Open Incidents</p>
                <p className={`text-sm font-semibold ${event.open_incidents > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {event.open_incidents}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {[
          {
            label: 'Guest Check-in', icon: Users, color: 'text-blue-400',
            items: [
              { k: 'Check-in Rate', v: `${guestCheckin}%` },
              { k: 'Expected', v: event.expected_guest_count?.toLocaleString() ?? '—' },
            ]
          },
          {
            label: 'Staff', icon: HardHat, color: 'text-amber-400',
            items: [
              { k: 'On-site Rate', v: `${staffCheckin}%` },
              { k: 'Critical Tasks', v: String(criticalTasks) },
            ]
          },
          {
            label: 'Vendors', icon: Truck, color: 'text-violet-400',
            items: [
              { k: 'Confirmed Rate', v: `${vendorConfirmed}%` },
              { k: 'Status', v: vendorConfirmed === 100 ? 'All confirmed' : 'Pending' },
            ]
          },
          {
            label: 'Tasks', icon: CheckCircle2, color: 'text-emerald-400',
            items: [
              { k: 'Completion', v: `${taskCompletion}%` },
              { k: 'Critical Open', v: String(criticalTasks) },
            ]
          },
        ].map(({ label, icon: Icon, color, items }) => (
          <div key={label} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-medium text-white/70">{label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map(({ k, v }) => (
                <div key={k}>
                  <p className="text-[10px] text-white/25">{k}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Schedule */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium text-white/70">Schedule</span>
          </div>
          <p className="text-xs text-white/50">{eventTimeRange(event.event_date, event.end_date)}</p>
          <p className="text-[11px] text-white/25 mt-1">
            {new Date(event.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Live incidents */}
        {event.incidents?.length > 0 && (
          <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-white/70">Open Incidents</span>
            </div>
            <div className="space-y-2">
              {event.incidents.slice(0, 3).map((inc: any) => (
                <div key={inc.id} className="flex items-start gap-2">
                  <Flame className={`w-3 h-3 mt-0.5 shrink-0 ${inc.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                  <p className="text-[11px] text-white/60 leading-snug">{inc.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-white/[0.06] p-4 space-y-2">
        <a
          href={`/events/${event.id}/command`}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Eye className="w-4 h-4" />
          Open Event Dashboard
        </a>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function EventCardSkeleton() {
  return (
    <div className="bg-[#0f172a] border border-white/[0.06] rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-3/4 bg-white/5 rounded mb-2" />
          <div className="h-2 w-1/2 bg-white/5 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3].map(i => <div key={i} className="h-8 bg-white/5 rounded" />)}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = 'grid' | 'command'

export default function OrchestrationPage() {
  const [view, setView] = useState<View>('command')
  const [selectedEvent, setSelectedEvent] = useState<ApiEvent | null>(null)

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [dash, alerts] = await Promise.all([
        api.get<DashboardData>('/command-center/orchestration/dashboard'),
        api.get<AlertsData>('/command-center/orchestration/alerts'),
      ])
      setDashboard(dash)
      setAlertsData(alerts)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Orchestration fetch failed', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => load(true), 30000)
    return () => clearInterval(t)
  }, [load])

  const events = dashboard?.events ?? []
  const conflicts = dashboard?.conflicts ?? []
  const alerts = alertsData?.alerts ?? []
  const summary = dashboard?.summary

  const activeEvents   = events.filter(e => ['live', 'setup'].includes(e.status))
  const upcomingEvents = events.filter(e => ['planning', 'confirmed'].includes(e.status))
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')

  return (
    <div className="h-screen flex flex-col bg-[#060b14] text-white overflow-hidden">
      {/* Top command bar */}
      <div className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between shrink-0 bg-[#060b14]/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Multi-Event Orchestration</h1>
            <p className="text-[10px] text-white/35">
              {loading ? 'Loading...' : `${events.length} events · ${activeEvents.length} active`}
            </p>
          </div>
        </div>

        {/* Live stats strip */}
        <div className="flex items-center gap-6 text-xs">
          {!loading && (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-white/50">{activeEvents.length} Active</span>
              </div>
              {summary && (
                <div className="text-white/50">
                  Avg Health: <span className={`font-semibold ${healthColor(summary.avg_health)}`}>{summary.avg_health}</span>
                </div>
              )}
              {criticalAlerts.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/25 text-red-400 px-3 py-1.5 rounded-lg">
                  <Flame className="w-3.5 h-3.5 animate-pulse" />
                  <span className="font-semibold text-sm">{criticalAlerts.length}</span>
                  <span className="text-xs">critical</span>
                </div>
              )}
              {conflicts.filter(c => c.severity === 'critical').length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 px-3 py-1.5 rounded-lg">
                  <ServerCrash className="w-3.5 h-3.5" />
                  <span className="font-semibold text-sm">{conflicts.length}</span>
                  <span className="text-xs">conflicts</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
            <button
              onClick={() => setView('command')}
              className={`p-1.5 rounded transition-all ${view === 'command' ? 'bg-indigo-600 text-white' : 'text-white/30 hover:text-white/60'}`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded transition-all ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-white/30 hover:text-white/60'}`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          <div className="w-[55%] space-y-3">
            {[0,1,2,3].map(i => <EventCardSkeleton key={i} />)}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          </div>
        </div>
      )}

      {/* Command layout */}
      {!loading && view === 'command' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Event grid */}
          <div className={`${selectedEvent ? 'w-[38%]' : 'w-[55%]'} shrink-0 overflow-y-auto border-r border-white/[0.06] transition-all`}>
            {/* Active events */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Active ({activeEvents.length})
                </span>
              </div>
              {activeEvents.length === 0 ? (
                <div className="text-center py-8 text-white/20 text-sm">No active events right now</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {activeEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      selected={selectedEvent?.id === event.id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3 h-3 text-white/30" />
                  <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                    Upcoming ({upcomingEvents.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {upcomingEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      selected={selectedEvent?.id === event.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: Alerts + Conflicts */}
          <div className={`${selectedEvent ? 'w-[27%]' : 'flex-1'} overflow-y-auto border-r border-white/[0.06] transition-all`}>
            {/* Alert Feed */}
            <div className="sticky top-0 bg-[#060b14]/95 backdrop-blur border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Live Alerts</span>
                {alerts.length > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">{alerts.length}</span>
                )}
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/20">
                <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500/30" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {alerts.map(alert => (
                  <AlertRow key={alert.id} alert={alert} onAck={() => {}} />
                ))}
              </div>
            )}

            {/* Resource Conflicts */}
            <div className="border-t border-white/[0.06]">
              <div className="px-4 py-2.5 flex items-center gap-2 bg-[#060b14]/95 backdrop-blur border-b border-white/[0.04]">
                <ServerCrash className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Resource Conflicts</span>
                {conflicts.length > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">{conflicts.length}</span>
                )}
              </div>
              {conflicts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-white/20">
                  <CheckCircle2 className="w-6 h-6 mb-1.5 text-emerald-500/30" />
                  <p className="text-xs">No conflicts detected</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {conflicts.map((c, i) => (
                    <ConflictCard key={`${c.resource_id}-${i}`} conflict={c} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Event detail */}
          {selectedEvent && (
            <div className="flex-1 overflow-y-auto">
              <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
          )}
        </div>
      )}

      {/* Grid view */}
      {!loading && view === 'grid' && (
        <div className="flex-1 overflow-y-auto p-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-white/20">
              <CalendarDays className="w-12 h-12 mb-4" />
              <p className="text-lg font-medium mb-1">No events in window</p>
              <p className="text-sm">Events within the next 7 days will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => { setSelectedEvent(event); setView('command') }}
                  selected={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer refresh info */}
      {!loading && (
        <div className="border-t border-white/[0.04] px-6 py-1.5 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-white/20">
            Last updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refreshes every 30s
          </p>
          {summary && (
            <div className="flex items-center gap-4 text-[10px] text-white/25">
              <span>{summary.total_events} total events</span>
              <span>{summary.total_conflicts} conflicts</span>
              <span>{summary.critical_alerts} critical alerts</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
