'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Edit3, Heart,
  Loader2, Phone, Plus, Shield, Trash2, XCircle, User,
  Building2, Activity, ChevronDown, ChevronRight, Settings,
} from 'lucide-react'
import { SmartAlert } from '@/components/ui/smart-alert'
import { calcOccupancySeverity } from '@/hooks/use-event-intelligence'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SafetyStats {
  totalChecklists: number; completedChecklists: number; pendingChecklists: number
  totalIncidents: number; criticalIncidents: number; unresolvedIncidents: number
  emergencyContacts: number; medicalStations: number; totalFirstAiders: number
}

interface Checklist {
  id: string; title: string; checklist_type: string; status: string
  due_date?: string; notes?: string
  safety_checklist_items: ChecklistItem[]
}

interface ChecklistItem {
  id: string; item_text: string; is_required: boolean; is_checked: boolean; order_index: number
}

interface Incident {
  id: string; incident_type: string; severity: string; title: string
  description?: string; location?: string; occurred_at: string
  injured_count: number; response_taken?: string; resolved: boolean
}

interface EmergencyContact {
  id: string; name: string; role: string; phone: string
  alternate_phone?: string; email?: string; is_on_site: boolean; notes?: string
}

interface MedicalStation {
  id: string; name: string; location: string; station_type: string
  capacity: number; staff_count: number; equipment?: string[]; is_active: boolean
}

interface SafetyConfig {
  venue_capacity?: number; max_crowd_density_pct?: number
  first_aiders_required?: number; security_ratio?: string
  evacuation_time_mins?: number; safety_briefing_done?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
} catch { return '' } }
function getTenantId() { try { return localStorage.getItem('tenantId') ?? '' } catch { return '' } }
function hdrs() { return { Authorization: `Bearer ${getToken()}`, 'x-tenant-id': getTenantId(), 'Content-Type': 'application/json' } }

const INCIDENT_SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  medium: { label: 'Medium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  high: { label: 'High', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  critical: { label: 'Critical', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  general: 'General', venue: 'Venue', fire: 'Fire Safety', medical: 'Medical',
  crowd: 'Crowd Management', evacuation: 'Evacuation', vendor: 'Vendor',
  electrical: 'Electrical', stage: 'Stage', custom: 'Custom',
}

const ROLE_LABELS: Record<string, string> = {
  event_manager: 'Event Manager', security_head: 'Security Head', medical_officer: 'Medical Officer',
  fire_marshal: 'Fire Marshal', police: 'Police', ambulance: 'Ambulance',
  fire_brigade: 'Fire Brigade', venue_manager: 'Venue Manager', client: 'Client',
  vip_liaison: 'VIP Liaison', general: 'General',
}

const DEFAULT_CHECKLIST_ITEMS: Record<string, string[]> = {
  general: ['Venue walkthrough completed', 'All exits clearly marked and unobstructed', 'First aid kits stocked and accessible', 'Emergency contacts list distributed to all staff', 'Weather forecast checked'],
  fire: ['Fire extinguishers checked and fully charged', 'Fire exits clear and unlocked', 'Smoke detectors tested', 'No combustible materials near stage/lighting', 'Fire marshal briefed and on-site'],
  medical: ['Medical station set up and staffed', 'AED (defibrillator) accessible', 'Allergy list reviewed with catering team', 'Hospital contact and route confirmed', 'Medical declaration form distributed'],
  crowd: ['Occupancy count system in place', 'Queue management barriers set up', 'Crowd marshals briefed and positioned', 'Entry rate control plan activated', 'No bottlenecks at entry/exit points'],
  evacuation: ['Evacuation drill conducted or planned', 'Assembly points marked and communicated', 'PA system tested for emergency announcements', 'All staff know their evacuation role', 'Guest count reconciliation plan ready'],
}

// ─── Checklist Card ───────────────────────────────────────────────────────────

function ChecklistCard({
  checklist, onToggleItem, onDelete, onStatusChange,
}: {
  checklist: Checklist
  onToggleItem: (itemId: string, checked: boolean) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [expanded, setExpanded] = useState(checklist.status !== 'completed')
  const items = checklist.safety_checklist_items ?? []
  const checked = items.filter(i => i.is_checked).length
  const total = items.length
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const statusColor = checklist.status === 'completed' ? 'text-emerald-400' : checklist.status === 'failed' ? 'text-red-400' : 'text-amber-400'

  return (
    <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${checklist.status === 'completed' ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-amber-500/15 border border-amber-500/25'}`}>
          <ClipboardCheck className={`w-4.5 h-4.5 ${statusColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{checklist.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
              {CHECKLIST_TYPE_LABELS[checklist.checklist_type] ?? checklist.checklist_type}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden max-w-[120px]">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{checked}/{total} done</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checklist.status !== 'completed' && pct === 100 && (
            <button onClick={e => { e.stopPropagation(); onStatusChange(checklist.id, 'completed') }}
              className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg hover:bg-emerald-500/20">
              Mark Complete
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(checklist.id) }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div className="border-t border-border/40 px-4 py-3 space-y-2">
          {items.sort((a, b) => a.order_index - b.order_index).map(item => (
            <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5">
                <input type="checkbox" checked={item.is_checked}
                  onChange={e => onToggleItem(item.id, e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-violet-500 cursor-pointer" />
              </div>
              <span className={`text-sm flex-1 ${item.is_checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.item_text}
                {item.is_required && !item.is_checked && <span className="ml-1 text-[10px] text-red-400">*</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'checklists' | 'incidents' | 'contacts' | 'medical'

export default function HealthSafetyPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [tab, setTab] = useState<ActiveTab>('overview')
  const [stats, setStats] = useState<SafetyStats | null>(null)
  const [config, setConfig] = useState<SafetyConfig>({})
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [stations, setStations] = useState<MedicalStation[]>([])
  const [loading, setLoading] = useState(true)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState<EmergencyContact | 'new' | null>(null)
  const [showStationModal, setShowStationModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, cfg, cl, inc, ct, ms] = await Promise.all([
        fetch(`${API}/health-safety/events/${eventId}/stats`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/health-safety/events/${eventId}/config`, { headers: hdrs() }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/health-safety/events/${eventId}/checklists`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/health-safety/events/${eventId}/incidents`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/health-safety/events/${eventId}/contacts`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/health-safety/events/${eventId}/medical-stations`, { headers: hdrs() }).then(r => r.json()),
      ])
      setStats(st)
      setConfig(cfg ?? {})
      setChecklists(Array.isArray(cl) ? cl : [])
      setIncidents(Array.isArray(inc) ? inc : [])
      setContacts(Array.isArray(ct) ? ct : [])
      setStations(Array.isArray(ms) ? ms : [])
    } catch {}
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function toggleChecklistItem(itemId: string, checked: boolean) {
    await fetch(`${API}/health-safety/checklists/items/${itemId}/toggle`, {
      method: 'PATCH', headers: hdrs(), body: JSON.stringify({ checked }),
    })
    setChecklists(prev => prev.map(cl => ({
      ...cl,
      safety_checklist_items: cl.safety_checklist_items.map(i => i.id === itemId ? { ...i, is_checked: checked } : i),
    })))
  }

  async function createDefaultChecklist(type: string) {
    const items = DEFAULT_CHECKLIST_ITEMS[type] ?? DEFAULT_CHECKLIST_ITEMS.general
    await fetch(`${API}/health-safety/checklists`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({
        event_id: eventId,
        title: `${CHECKLIST_TYPE_LABELS[type] ?? 'Safety'} Checklist`,
        checklist_type: type,
        items: items.map((text, i) => ({ item_text: text, is_required: true, order_index: i })),
      }),
    })
    load()
  }

  async function updateChecklistStatus(id: string, status: string) {
    await fetch(`${API}/health-safety/checklists/${id}`, {
      method: 'PATCH', headers: hdrs(), body: JSON.stringify({ status }),
    })
    setChecklists(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  async function deleteChecklist(id: string) {
    if (!confirm('Delete checklist?')) return
    await fetch(`${API}/health-safety/checklists/${id}`, { method: 'DELETE', headers: hdrs() })
    setChecklists(prev => prev.filter(c => c.id !== id))
  }

  // ─── Smart alerts ─────────────────────────────────────────────────────────

  const smartAlerts = []
  if (stats) {
    // First-aider coverage: 1 per 50 guests
    const requiredFirstAiders = config.venue_capacity ? Math.ceil(config.venue_capacity / 50) : 0
    if (requiredFirstAiders > 0 && stats.totalFirstAiders < requiredFirstAiders) {
      smartAlerts.push({ id: 'first-aid', severity: 'warning' as const, title: 'Insufficient first aider coverage', message: `${stats.totalFirstAiders} assigned, need ${requiredFirstAiders} (1 per 50 guests)` })
    }
    // Critical unresolved incidents
    if (stats.criticalIncidents > 0) {
      smartAlerts.push({ id: 'critical-inc', severity: 'critical' as const, title: `${stats.criticalIncidents} critical incident${stats.criticalIncidents > 1 ? 's' : ''} unresolved`, message: 'Immediate action required' })
    }
    // Emergency contacts
    if (stats.emergencyContacts < 3) {
      smartAlerts.push({ id: 'contacts', severity: 'info' as const, title: 'Few emergency contacts added', message: 'Ensure police, ambulance, and venue manager contacts are added' })
    }
    // Safety briefing not done
    if (!config.safety_briefing_done) {
      smartAlerts.push({ id: 'briefing', severity: 'info' as const, title: 'Safety briefing not marked complete', message: 'Complete the staff safety briefing before the event' })
    }
    // Missing medical stations
    if (stats.medicalStations === 0) {
      smartAlerts.push({ id: 'no-medical', severity: 'warning' as const, title: 'No medical stations configured', message: 'Set up at least one first aid station for the event' })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  )

  const TABS: Array<{ key: ActiveTab; label: string; icon: typeof Shield; count?: number }> = [
    { key: 'overview', label: 'Overview', icon: Shield },
    { key: 'checklists', label: 'Checklists', icon: ClipboardCheck, count: checklists.length },
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle, count: incidents.filter(i => !i.resolved).length || undefined },
    { key: 'contacts', label: 'Emergency Contacts', icon: Phone, count: contacts.length },
    { key: 'medical', label: 'Medical Stations', icon: Heart, count: stations.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Health & Safety</h1>
          <p className="text-sm text-muted-foreground mt-1">Safety checklists, incident tracking, and emergency coordination</p>
        </div>
        <button onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-2 text-sm bg-muted/50 hover:bg-muted border border-border/60 text-foreground px-4 py-2 rounded-xl transition-colors">
          <Settings className="w-4 h-4" /> Safety Config
        </button>
      </div>

      {/* Smart alerts */}
      {smartAlerts.length > 0 && (
        <div className="space-y-2">
          {smartAlerts.map(a => <SmartAlert key={a.id} severity={a.severity} title={a.title} message={a.message} />)}
        </div>
      )}

      {/* KPI stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Checklists Done', value: `${stats.completedChecklists}/${stats.totalChecklists}`, icon: ClipboardCheck, color: stats.completedChecklists === stats.totalChecklists ? 'emerald' : 'amber' },
            { label: 'Active Incidents', value: stats.unresolvedIncidents, icon: AlertTriangle, color: stats.criticalIncidents > 0 ? 'red' : stats.unresolvedIncidents > 0 ? 'amber' : 'emerald' },
            { label: 'Emergency Contacts', value: stats.emergencyContacts, icon: Phone, color: stats.emergencyContacts >= 5 ? 'emerald' : 'amber' },
            { label: 'First Aiders', value: stats.totalFirstAiders, icon: Heart, color: 'blue' },
          ].map(k => {
            const colors: Record<string, string> = { emerald: 'text-emerald-400 bg-emerald-400/10', amber: 'text-amber-400 bg-amber-400/10', red: 'text-red-400 bg-red-400/10', blue: 'text-blue-400 bg-blue-400/10' }
            return (
              <div key={k.label} className="bg-card/60 border border-border/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[k.color]}`}>
                    <k.icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Venue capacity indicator (smart) */}
      {config.venue_capacity && (
        <div className="bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center gap-4">
          <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-foreground">Venue Capacity</span>
              <span className="text-sm font-bold text-foreground">{config.venue_capacity.toLocaleString('en-IN')} guests max</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Alert threshold: {config.max_crowd_density_pct ?? 90}%</span>
              <span>·</span>
              <span>Evacuation time: {config.evacuation_time_mins ?? 10} min</span>
              <span>·</span>
              <span>Security ratio: {config.security_ratio ?? '1:50'}</span>
            </div>
          </div>
          {config.safety_briefing_done && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Briefing done
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-card/60 border border-border/60 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-0.5 ${tab === t.key ? 'bg-white/20' : 'bg-muted/60'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Checklist progress */}
          <div className="bg-card/60 border border-border/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Checklist Progress</h3>
              <button onClick={() => setTab('checklists')} className="text-xs text-violet-400 hover:text-violet-300">View all</button>
            </div>
            {checklists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklists created yet</p>
            ) : (
              <div className="space-y-3">
                {checklists.slice(0, 5).map(cl => {
                  const items = cl.safety_checklist_items ?? []
                  const done = items.filter(i => i.is_checked).length
                  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
                  return (
                    <div key={cl.id}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-foreground">{cl.title}</span>
                        <span className={pct === 100 ? 'text-emerald-400' : 'text-muted-foreground'}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent incidents */}
          <div className="bg-card/60 border border-border/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Incidents</h3>
              <button onClick={() => setTab('incidents')} className="text-xs text-violet-400 hover:text-violet-300">View all</button>
            </div>
            {incidents.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-emerald-400">No incidents reported</p>
              </div>
            ) : (
              <div className="space-y-2">
                {incidents.slice(0, 4).map(inc => {
                  const sc = INCIDENT_SEVERITY_CONFIG[inc.severity]
                  return (
                    <div key={inc.id} className="flex items-center gap-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                      <span className="text-sm text-foreground flex-1 truncate">{inc.title}</span>
                      {inc.resolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Checklists Tab ────────────────────────────────────────────────────── */}
      {tab === 'checklists' && (
        <div className="space-y-4">
          {/* Quick-add standard checklists */}
          <div className="bg-card/60 border border-border/60 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-3">Quick-add standard checklists</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CHECKLIST_TYPE_LABELS).slice(0, 6).map(([type, label]) => (
                <button key={type} onClick={() => createDefaultChecklist(type)}
                  className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-lg hover:bg-violet-500/20 transition-colors flex items-center gap-1.5">
                  <Plus className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {checklists.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-2xl p-12 text-center">
              <ClipboardCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No checklists yet — add one above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklists.map(cl => (
                <ChecklistCard key={cl.id} checklist={cl}
                  onToggleItem={toggleChecklistItem}
                  onDelete={deleteChecklist}
                  onStatusChange={updateChecklistStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Incidents Tab ─────────────────────────────────────────────────────── */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowIncidentModal(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Log Incident
            </button>
          </div>
          {incidents.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-2xl p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400/60 mx-auto mb-3" />
              <p className="text-emerald-400">No incidents reported — great!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map(inc => {
                const sc = INCIDENT_SEVERITY_CONFIG[inc.severity]
                return (
                  <div key={inc.id} className={`bg-card/60 border rounded-2xl p-4 ${inc.severity === 'critical' && !inc.resolved ? 'border-red-500/30' : 'border-border/60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">{inc.incident_type.replace(/_/g, ' ')}</span>
                          {inc.resolved && <span className="text-[10px] text-emerald-400">✓ Resolved</span>}
                          {!inc.resolved && <span className="text-[10px] text-amber-400">● Unresolved</span>}
                        </div>
                        <h4 className="text-sm font-medium text-foreground">{inc.title}</h4>
                        {inc.description && <p className="text-xs text-muted-foreground mt-0.5">{inc.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {inc.location && <span>📍 {inc.location}</span>}
                          {inc.injured_count > 0 && <span className="text-red-400">🩹 {inc.injured_count} injured</span>}
                          <span>{new Date(inc.occurred_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {inc.response_taken && <p className="text-xs text-muted-foreground mt-1">Response: {inc.response_taken}</p>}
                      </div>
                      {!inc.resolved && (
                        <button onClick={async () => {
                          await fetch(`${API}/health-safety/incidents/${inc.id}`, { method: 'PATCH', headers: hdrs(), body: JSON.stringify({ resolved: true, resolved_at: new Date().toISOString() }) })
                          load()
                        }} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg hover:bg-emerald-500/20 shrink-0">
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Emergency Contacts Tab ────────────────────────────────────────────── */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowContactModal('new')}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
          {contacts.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-2xl p-12 text-center">
              <Phone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No emergency contacts added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map(c => (
                <div key={c.id} className="bg-card/60 border border-border/60 rounded-2xl p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.is_on_site ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-muted/60 border border-border/40'}`}>
                    <User className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[c.role] ?? c.role}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setShowContactModal(c)} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          await fetch(`${API}/health-safety/contacts/${c.id}`, { method: 'DELETE', headers: hdrs() }); load()
                        }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </a>
                      {c.alternate_phone && <p className="text-xs text-muted-foreground">Alt: {c.alternate_phone}</p>}
                    </div>
                    {c.is_on_site && <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-400"><Activity className="w-3 h-3" /> On-site</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Medical Stations Tab ──────────────────────────────────────────────── */}
      {tab === 'medical' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowStationModal(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>
          {stations.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-2xl p-12 text-center">
              <Heart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No medical stations configured</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stations.map(s => (
                <div key={s.id} className={`bg-card/60 border rounded-2xl p-4 ${s.is_active ? 'border-emerald-500/25' : 'border-border/60 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                          {s.station_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">📍 {s.location}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span><Heart className="w-3 h-3 inline mr-1 text-red-400" />{s.staff_count} staff</span>
                        <span>Capacity: {s.capacity}</span>
                      </div>
                      {s.equipment?.length ? (
                        <p className="text-xs text-muted-foreground mt-1">🧰 {s.equipment.join(', ')}</p>
                      ) : null}
                    </div>
                    <button onClick={async () => {
                      await fetch(`${API}/health-safety/medical-stations/${s.id}`, { method: 'DELETE', headers: hdrs() }); load()
                    }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {showIncidentModal && <IncidentModal eventId={eventId} onClose={() => setShowIncidentModal(false)} onSaved={() => { setShowIncidentModal(false); load() }} />}
      {showContactModal !== null && <ContactModal contact={showContactModal === 'new' ? null : showContactModal} eventId={eventId} onClose={() => setShowContactModal(null)} onSaved={() => { setShowContactModal(null); load() }} />}
      {showStationModal && <StationModal eventId={eventId} onClose={() => setShowStationModal(false)} onSaved={() => { setShowStationModal(false); load() }} />}
      {showConfigModal && <ConfigModal config={config} eventId={eventId} onClose={() => setShowConfigModal(false)} onSaved={(c) => { setConfig(c); setShowConfigModal(false) }} />}
    </div>
  )
}

// ─── Sub-modals ───────────────────────────────────────────────────────────────

function IncidentModal({ eventId, onClose, onSaved }: { eventId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ incident_type: 'medical', severity: 'low', title: '', description: '', location: '', injured_count: 0, response_taken: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    await fetch(`${API}/health-safety/incidents`, { method: 'POST', headers: hdrs(), body: JSON.stringify({ ...form, event_id: eventId }) })
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Log Incident</h3>
          <button onClick={onClose}><XCircle className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <select value={form.incident_type} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {['medical','security','fire','crowd','property_damage','weather','technical','slip_fall','other'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Incident title *"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description…"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
            <input type="number" value={form.injured_count} min={0} onChange={e => setForm(f => ({ ...f, injured_count: parseInt(e.target.value) || 0 }))} placeholder="Injured count"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          <input value={form.response_taken} onChange={e => setForm(f => ({ ...f, response_taken: e.target.value }))} placeholder="Response taken…"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border/60">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 text-sm bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />} Log Incident
          </button>
        </div>
      </div>
    </div>
  )
}

function ContactModal({ contact, eventId, onClose, onSaved }: { contact: EmergencyContact | null; eventId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: contact?.name ?? '', role: contact?.role ?? 'general', phone: contact?.phone ?? '', alternate_phone: contact?.alternate_phone ?? '', email: contact?.email ?? '', is_on_site: contact?.is_on_site ?? false, notes: contact?.notes ?? '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    const method = contact ? 'PATCH' : 'POST'
    const url = contact ? `${API}/health-safety/contacts/${contact.id}` : `${API}/health-safety/contacts`
    await fetch(url, { method, headers: hdrs(), body: JSON.stringify({ ...form, event_id: eventId }) })
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">{contact ? 'Edit Contact' : 'Add Emergency Contact'}</h3>
          <button onClick={onClose}><XCircle className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name *"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Primary phone *"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
            <input value={form.alternate_phone} onChange={e => setForm(f => ({ ...f, alternate_phone: e.target.value }))} placeholder="Alternate phone"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.is_on_site} onChange={e => setForm(f => ({ ...f, is_on_site: e.target.checked }))} className="rounded" />
            Currently on-site
          </label>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border/60">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim() || !form.phone.trim()}
            className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

function StationModal({ eventId, onClose, onSaved }: { eventId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', location: '', station_type: 'first_aid', capacity: 1, staff_count: 1, equipment: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim() || !form.location.trim()) return
    setSaving(true)
    await fetch(`${API}/health-safety/medical-stations`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ ...form, event_id: eventId, equipment: form.equipment.split(',').map(s => s.trim()).filter(Boolean) }),
    })
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Add Medical Station</h3>
          <button onClick={onClose}><XCircle className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Station name *"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location *"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
          <select value={form.station_type} onChange={e => setForm(f => ({ ...f, station_type: e.target.value }))}
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {['first_aid','ambulance','doctor','nurse','medical_team'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Staff Count</label>
              <input type="number" value={form.staff_count} min={1} onChange={e => setForm(f => ({ ...f, staff_count: parseInt(e.target.value) || 1 }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Patient Capacity</label>
              <input type="number" value={form.capacity} min={1} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <input value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} placeholder="Equipment (AED, stretcher, oxygen kit…)"
            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border/60">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />} Add Station
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfigModal({ config, eventId, onClose, onSaved }: { config: SafetyConfig; eventId: string; onClose: () => void; onSaved: (c: SafetyConfig) => void }) {
  const [form, setForm] = useState({
    venue_capacity: config.venue_capacity ?? 0,
    max_crowd_density_pct: config.max_crowd_density_pct ?? 90,
    security_ratio: config.security_ratio ?? '1:50',
    evacuation_time_mins: config.evacuation_time_mins ?? 10,
    safety_briefing_done: config.safety_briefing_done ?? false,
  })
  const [saving, setSaving] = useState(false)

  // Smart: calculate required first aiders
  const requiredFirstAiders = form.venue_capacity > 0 ? Math.ceil(form.venue_capacity / 50) : 0

  async function save() {
    setSaving(true)
    const res = await fetch(`${API}/health-safety/events/${eventId}/config`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ ...form, first_aiders_required: requiredFirstAiders }),
    })
    const saved = await res.json()
    setSaving(false); onSaved(saved)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Safety Configuration</h3>
          <button onClick={onClose}><XCircle className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Venue Capacity (max guests)</label>
            <input type="number" value={form.venue_capacity || ''} min={0}
              onChange={e => setForm(f => ({ ...f, venue_capacity: parseInt(e.target.value) || 0 }))}
              className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60" />
            {requiredFirstAiders > 0 && (
              <p className="text-xs text-amber-400 mt-1">⚡ Smart: {requiredFirstAiders} first aiders required (1 per 50 guests)</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Alert at density %</label>
              <input type="number" value={form.max_crowd_density_pct} min={50} max={100}
                onChange={e => setForm(f => ({ ...f, max_crowd_density_pct: parseInt(e.target.value) || 90 }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Evacuation time (min)</label>
              <input type="number" value={form.evacuation_time_mins} min={1}
                onChange={e => setForm(f => ({ ...f, evacuation_time_mins: parseInt(e.target.value) || 10 }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Security ratio (e.g. 1:50)</label>
            <input value={form.security_ratio} onChange={e => setForm(f => ({ ...f, security_ratio: e.target.value }))}
              className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.safety_briefing_done}
              onChange={e => setForm(f => ({ ...f, safety_briefing_done: e.target.checked }))} className="rounded" />
            Safety briefing completed
          </label>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border/60">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Save Config
          </button>
        </div>
      </div>
    </div>
  )
}
