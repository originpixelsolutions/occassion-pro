'use client'
import { use, useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, Plus, ChevronDown, ChevronRight,
  CheckSquare, Square, ClipboardList, Users, Flame, Zap,
  HeartPulse, Package, Cloud, Utensils, Car, FileText,
  X, RefreshCw, Check, ShieldAlert, AlertOctagon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HSSummary {
  plan: {
    id: string; title: string; status: string
    crowd_capacity: number | null; venue_area_sqm: number | null; expected_attendance: number | null
    medical_team_count: number; security_team_count: number; first_aid_kits: number
    aed_units: number; fire_extinguishers: number; emergency_exits: number
    nearest_hospital: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null
    ambulance_on_site: boolean; notes: string | null
  }
  stats: {
    risks_total: number; risks_critical: number; risks_open: number
    incidents_total: number; incidents_open: number
    checklist_total_items: number; checklist_checked_items: number; checklist_pct: number
  }
}

interface Risk {
  id: string; category: string; hazard: string; likelihood: number; severity: number
  risk_score: number; risk_level: string; mitigation: string; owner: string | null; status: string
}

interface Incident {
  id: string; incident_type: string; title: string; description: string
  severity: string; occurred_at: string; location: string | null; injured_count: number
  status: string; action_taken: string | null
}

interface ChecklistItem { id: string; text: string; is_checked: boolean; checked_by: string | null; sort_order: number }
interface Checklist { id: string; title: string; category: string; status: string; hs_checklist_items: ChecklistItem[] }

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_LEVEL_COLORS: Record<string, string> = {
  very_low: 'bg-green-500/10 text-green-400 border-green-500/20',
  low:      'bg-lime-500/10 text-lime-400 border-lime-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const SEVERITY_COLORS: Record<string, string> = {
  minor:    'bg-blue-500/10 text-blue-400',
  moderate: 'bg-amber-500/10 text-amber-400',
  serious:  'bg-orange-500/10 text-orange-400',
  critical: 'bg-red-500/10 text-red-400',
}

const RISK_CATEGORIES = [
  'crowd_management','fire_safety','medical','security','electrical',
  'structural','weather','food_safety','transport','chemical','noise','other',
]

const INCIDENT_TYPES = [
  'medical','security','fire','structural','crowd','electrical',
  'weather','food_poisoning','theft','harassment','near_miss','other',
]

const CATEGORY_ICONS: Record<string, any> = {
  crowd_management: Users, fire_safety: Flame, medical: HeartPulse,
  security: ShieldCheck, electrical: Zap, structural: Package,
  weather: Cloud, food_safety: Utensils, transport: Car,
  general: ClipboardList, default: AlertTriangle,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SafetyPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const api = useApi()

  const [tab, setTab] = useState<'overview' | 'risks' | 'incidents' | 'checklists'>('overview')
  const [summary, setSummary] = useState<HSSummary | null>(null)
  const [risks, setRisks] = useState<Risk[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set())

  // Risk form state
  const [riskForm, setRiskForm] = useState({
    category: 'crowd_management', hazard: '', who_affected: '',
    likelihood: 3, severity: 3, mitigation: '', owner: '', status: 'open',
  })

  // Incident form state
  const [incidentForm, setIncidentForm] = useState({
    incident_type: 'medical', title: '', description: '',
    severity: 'minor', occurred_at: '', location: '', injured_count: 0, reported_by: '',
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, riskRes, incRes, clRes] = await Promise.all([
        api.get(`/events/${eventId}/health-safety`),
        api.get(`/events/${eventId}/health-safety/risks`),
        api.get(`/events/${eventId}/health-safety/incidents`),
        api.get(`/events/${eventId}/health-safety/checklists`),
      ])
      setSummary(sumRes)
      setRisks(riskRes ?? [])
      setIncidents(incRes ?? [])
      setChecklists(clRes ?? [])
      // expand all checklists by default
      if (clRes?.length) setExpandedChecklists(new Set(clRes.map((c: Checklist) => c.id)))
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const submitRisk = async () => {
    await api.post(`/events/${eventId}/health-safety/risks`, riskForm)
    setShowRiskForm(false)
    setRiskForm({ category: 'crowd_management', hazard: '', who_affected: '', likelihood: 3, severity: 3, mitigation: '', owner: '', status: 'open' })
    fetchAll()
  }

  const submitIncident = async () => {
    await api.post(`/events/${eventId}/health-safety/incidents`, incidentForm)
    setShowIncidentForm(false)
    setIncidentForm({ incident_type: 'medical', title: '', description: '', severity: 'minor', occurred_at: '', location: '', injured_count: 0, reported_by: '' })
    fetchAll()
  }

  const toggleItem = async (itemId: string) => {
    await api.patch(`/health-safety/checklist-items/${itemId}/toggle`, {})
    fetchAll()
  }

  const deleteRisk = async (id: string) => {
    await api.delete(`/health-safety/risks/${id}`)
    setRisks(r => r.filter(x => x.id !== id))
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}
    </div>
  )

  const stats = summary?.stats

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-400" /> Health & Safety
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Risk management, incident log & safety checklists</p>
        </div>
        <div className="flex items-center gap-2">
          {summary?.plan.status === 'approved' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
              ✓ Plan Approved
            </span>
          )}
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Checklist Progress', value: `${stats?.checklist_pct ?? 0}%`, sub: `${stats?.checklist_checked_items}/${stats?.checklist_total_items} items`, color: 'text-blue-400' },
          { label: 'Open Risks', value: stats?.risks_open ?? 0, sub: `${stats?.risks_critical ?? 0} critical`, color: stats?.risks_critical ? 'text-red-400' : 'text-amber-400' },
          { label: 'Total Risks', value: stats?.risks_total ?? 0, sub: 'in register', color: 'text-violet-400' },
          { label: 'Incidents', value: stats?.incidents_total ?? 0, sub: `${stats?.incidents_open ?? 0} open`, color: 'text-orange-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {(['overview','risks','incidents','checklists'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-5 py-3 text-xs font-medium capitalize border-b-2 transition-all',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
              {t === 'risks' && risks.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px]">{risks.length}</span>
              )}
              {t === 'incidents' && incidents.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">{incidents.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {tab === 'overview' && summary && (
            <div className="space-y-6">

              {/* Plan status banner */}
              <div className={cn(
                'flex items-center justify-between p-4 rounded-xl border',
                summary.plan.status === 'approved'
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    summary.plan.status === 'approved' ? 'bg-green-500/20' : 'bg-amber-500/20'
                  )}>
                    {summary.plan.status === 'approved'
                      ? <Check className="w-4 h-4 text-green-400" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{summary.plan.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">Status: {summary.plan.status.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Resources grid */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Safety Resources</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Medical Staff', value: summary.plan.medical_team_count, icon: HeartPulse, color: 'text-red-400' },
                    { label: 'Security Staff', value: summary.plan.security_team_count, icon: ShieldCheck, color: 'text-blue-400' },
                    { label: 'First Aid Kits', value: summary.plan.first_aid_kits, icon: Package, color: 'text-green-400' },
                    { label: 'AED Units', value: summary.plan.aed_units, icon: HeartPulse, color: 'text-pink-400' },
                    { label: 'Fire Extinguishers', value: summary.plan.fire_extinguishers, icon: Flame, color: 'text-orange-400' },
                    { label: 'Emergency Exits', value: summary.plan.emergency_exits, icon: AlertOctagon, color: 'text-amber-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-background border border-border rounded-xl p-3 flex items-center gap-3">
                      <Icon className={cn('w-4 h-4 shrink-0', color)} />
                      <div>
                        <p className="text-lg font-bold tabular-nums">{value ?? 0}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emergency contacts */}
              {(summary.plan.emergency_contact_name || summary.plan.nearest_hospital) && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Emergency Contacts</h3>
                  <div className="space-y-2">
                    {summary.plan.emergency_contact_name && (
                      <div className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                        <span className="text-xs text-muted-foreground">Emergency Contact</span>
                        <span className="text-sm font-medium">
                          {summary.plan.emergency_contact_name}
                          {summary.plan.emergency_contact_phone && ` · ${summary.plan.emergency_contact_phone}`}
                        </span>
                      </div>
                    )}
                    {summary.plan.nearest_hospital && (
                      <div className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                        <span className="text-xs text-muted-foreground">Nearest Hospital</span>
                        <span className="text-sm font-medium">{summary.plan.nearest_hospital}</span>
                      </div>
                    )}
                    {summary.plan.ambulance_on_site && (
                      <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Ambulance on-site confirmed</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Crowd density */}
              {summary.plan.venue_area_sqm && summary.plan.expected_attendance && (
                <CrowdDensityCard
                  capacity={summary.plan.crowd_capacity}
                  areaSqm={summary.plan.venue_area_sqm}
                  expected={summary.plan.expected_attendance}
                />
              )}

            </div>
          )}

          {/* ── RISKS TAB ────────────────────────────────────────────────── */}
          {tab === 'risks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{risks.length} risk{risks.length !== 1 ? 's' : ''} in register</p>
                <button
                  onClick={() => setShowRiskForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Risk
                </button>
              </div>

              {/* Risk matrix summary */}
              {risks.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {(['very_low','low','medium','high','critical'] as const).map(level => {
                    const count = risks.filter(r => r.risk_level === level).length
                    return (
                      <div key={level} className={cn('p-2 rounded-lg border text-center', RISK_LEVEL_COLORS[level])}>
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] capitalize">{level.replace('_', ' ')}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {risks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No risks added yet</p>
                  <p className="text-xs mt-1">Add potential hazards to your risk register</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {risks.map(risk => (
                    <div key={risk.id} className="bg-background border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize', RISK_LEVEL_COLORS[risk.risk_level])}>
                              {risk.risk_level.replace('_', ' ')} (score: {risk.risk_score})
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border capitalize">
                              {risk.category.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1.5">{risk.hazard}</p>
                          <p className="text-xs text-muted-foreground mt-1">↳ {risk.mitigation}</p>
                          {risk.owner && <p className="text-xs text-muted-foreground mt-0.5">Owner: {risk.owner}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">L×S</p>
                            <p className="text-sm font-bold">{risk.likelihood}×{risk.severity}</p>
                          </div>
                          <button
                            onClick={() => deleteRisk(risk.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Risk Form */}
              {showRiskForm && (
                <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold">New Risk</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Category</label>
                      <select
                        value={riskForm.category}
                        onChange={e => setRiskForm(f => ({ ...f, category: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        {RISK_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      <select
                        value={riskForm.status}
                        onChange={e => setRiskForm(f => ({ ...f, status: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        {['open','mitigated','accepted','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hazard *</label>
                    <input
                      value={riskForm.hazard}
                      onChange={e => setRiskForm(f => ({ ...f, hazard: e.target.value }))}
                      placeholder="Describe the hazard..."
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mitigation *</label>
                    <textarea
                      value={riskForm.mitigation}
                      onChange={e => setRiskForm(f => ({ ...f, mitigation: e.target.value }))}
                      placeholder="How will this risk be mitigated?"
                      rows={2}
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Likelihood (1–5)</label>
                      <input
                        type="number" min={1} max={5}
                        value={riskForm.likelihood}
                        onChange={e => setRiskForm(f => ({ ...f, likelihood: Number(e.target.value) }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Severity (1–5)</label>
                      <input
                        type="number" min={1} max={5}
                        value={riskForm.severity}
                        onChange={e => setRiskForm(f => ({ ...f, severity: Number(e.target.value) }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Risk Score</label>
                      <div className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm font-bold text-amber-400">
                        {riskForm.likelihood * riskForm.severity}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Owner</label>
                    <input
                      value={riskForm.owner}
                      onChange={e => setRiskForm(f => ({ ...f, owner: e.target.value }))}
                      placeholder="Responsible person"
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={submitRisk} disabled={!riskForm.hazard || !riskForm.mitigation}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      Add Risk
                    </button>
                    <button onClick={() => setShowRiskForm(false)}
                      className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INCIDENTS TAB ────────────────────────────────────────────── */}
          {tab === 'incidents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} logged</p>
                <button
                  onClick={() => setShowIncidentForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Incident
                </button>
              </div>

              {incidents.length === 0 && !showIncidentForm ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No incidents logged</p>
                  <p className="text-xs mt-1">Log any incidents or near-misses during the event</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incidents.map(inc => (
                    <div key={inc.id} className="bg-background border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize', SEVERITY_COLORS[inc.severity])}>
                              {inc.severity}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border capitalize">
                              {inc.incident_type.replace(/_/g, ' ')}
                            </span>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize',
                              inc.status === 'closed' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                            )}>
                              {inc.status}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1.5">{inc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{inc.description}</p>
                          {inc.location && <p className="text-xs text-muted-foreground mt-0.5">📍 {inc.location}</p>}
                          {inc.injured_count > 0 && (
                            <p className="text-xs text-red-400 mt-0.5">{inc.injured_count} person(s) affected</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(inc.occurred_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Incident Form */}
              {showIncidentForm && (
                <div className="bg-background border border-red-500/20 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-red-400">Log Incident</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Type</label>
                      <select
                        value={incidentForm.incident_type}
                        onChange={e => setIncidentForm(f => ({ ...f, incident_type: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Severity</label>
                      <select
                        value={incidentForm.severity}
                        onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        {['minor','moderate','serious','critical'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Title *</label>
                    <input
                      value={incidentForm.title}
                      onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Brief incident title"
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Description *</label>
                    <textarea
                      value={incidentForm.description}
                      onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="What happened?"
                      rows={3}
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Occurred At *</label>
                      <input
                        type="datetime-local"
                        value={incidentForm.occurred_at}
                        onChange={e => setIncidentForm(f => ({ ...f, occurred_at: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Location</label>
                      <input
                        value={incidentForm.location}
                        onChange={e => setIncidentForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Where did it happen?"
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Persons Affected</label>
                      <input
                        type="number" min={0}
                        value={incidentForm.injured_count}
                        onChange={e => setIncidentForm(f => ({ ...f, injured_count: Number(e.target.value) }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Reported By</label>
                      <input
                        value={incidentForm.reported_by}
                        onChange={e => setIncidentForm(f => ({ ...f, reported_by: e.target.value }))}
                        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={submitIncident}
                      disabled={!incidentForm.title || !incidentForm.description || !incidentForm.occurred_at}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                      Log Incident
                    </button>
                    <button onClick={() => setShowIncidentForm(false)}
                      className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CHECKLISTS TAB ───────────────────────────────────────────── */}
          {tab === 'checklists' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {stats?.checklist_checked_items}/{stats?.checklist_total_items} items complete · {stats?.checklist_pct}%
                </p>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.checklist_pct ?? 0}%` }}
                />
              </div>

              {checklists.map(cl => {
                const checked = cl.hs_checklist_items.filter(i => i.is_checked).length
                const total = cl.hs_checklist_items.length
                const isExpanded = expandedChecklists.has(cl.id)
                const Icon = CATEGORY_ICONS[cl.category] ?? CATEGORY_ICONS.default

                return (
                  <div key={cl.id} className="bg-background border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedChecklists(prev => {
                        const next = new Set(prev)
                        next.has(cl.id) ? next.delete(cl.id) : next.add(cl.id)
                        return next
                      })}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="text-sm font-medium">{cl.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{cl.category.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'text-xs font-semibold',
                          checked === total && total > 0 ? 'text-green-400' : 'text-muted-foreground'
                        )}>
                          {checked}/{total}
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-3">
                        {cl.hs_checklist_items
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(item => (
                            <button
                              key={item.id}
                              onClick={() => toggleItem(item.id)}
                              className="w-full flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-accent/30 rounded px-1 transition-colors text-left"
                            >
                              {item.is_checked
                                ? <CheckSquare className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                : <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                              }
                              <div className="flex-1">
                                <p className={cn('text-sm', item.is_checked && 'line-through text-muted-foreground')}>
                                  {item.text}
                                </p>
                                {item.is_checked && item.checked_by && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">✓ {item.checked_by}</p>
                                )}
                              </div>
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Crowd Density Card ───────────────────────────────────────────────────────

function CrowdDensityCard({
  capacity, areaSqm, expected,
}: { capacity: number | null; areaSqm: number; expected: number }) {
  const density = areaSqm > 0 ? expected / areaSqm : 0
  const status = density <= 1 ? 'safe' : density <= 2 ? 'moderate' : density <= 3 ? 'dense' : 'overcrowded'
  const colors: Record<string, string> = {
    safe: 'text-green-400 border-green-500/20 bg-green-500/5',
    moderate: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    dense: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    overcrowded: 'text-red-400 border-red-500/20 bg-red-500/5',
  }

  return (
    <div className={cn('p-4 rounded-xl border', colors[status])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Crowd Density</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {expected.toLocaleString()} people · {areaSqm.toLocaleString()} m²
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{density.toFixed(2)}</p>
          <p className="text-xs">persons/m² · <span className="capitalize font-semibold">{status}</span></p>
        </div>
      </div>
      {capacity && expected > capacity && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Attendance exceeds venue capacity by {(expected - capacity).toLocaleString()} persons
        </div>
      )}
    </div>
  )
}
