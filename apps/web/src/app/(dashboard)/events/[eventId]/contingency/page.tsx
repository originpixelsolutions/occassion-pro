'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Plus, AlertOctagon, ShieldAlert, ShieldCheck,
  Zap, CloudRain, UserX, Package, Wifi, Power, ChevronRight,
  CheckCircle2, Clock, Edit2, Trash2, AlertTriangle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type PlanStatus = 'draft' | 'reviewed' | 'activated'

type ContingencyPlan = {
  id: string
  scenario: string
  risk_level: RiskLevel
  category: string
  trigger_conditions: string
  response_actions: string
  responsible_person: string | null
  contact_number: string | null
  status: PlanStatus
  created_at: string
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low:      { label: 'Low',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  medium:   { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  high:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
}

const STATUS_CONFIG: Record<PlanStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',    color: 'text-muted-foreground bg-muted' },
  reviewed:  { label: 'Reviewed', color: 'text-blue-700 bg-blue-50' },
  activated: { label: 'ACTIVATED', color: 'text-red-700 bg-red-100 font-bold' },
}

const CATEGORIES = ['Weather', 'Vendor Failure', 'Technical', 'Medical', 'Security', 'Power', 'Crowd', 'Other']

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Weather: CloudRain, 'Vendor Failure': Package,
  Technical: Wifi, Medical: ShieldAlert,
  Security: ShieldCheck, Power: Power,
  Crowd: UserX,
}

const SUGGESTED_SCENARIOS = [
  { scenario: 'Heavy rain / flooding', category: 'Weather', risk_level: 'high' as RiskLevel, trigger_conditions: 'Rainfall > 10mm/hr or flood warning issued', response_actions: 'Move outdoor activities indoors, activate tent backup, notify guests via SMS' },
  { scenario: 'Main caterer no-show', category: 'Vendor Failure', risk_level: 'critical' as RiskLevel, trigger_conditions: 'Caterer fails to arrive 2 hours before event', response_actions: 'Call backup caterer, arrange emergency food delivery, inform guests of delay' },
  { scenario: 'Power outage', category: 'Power', risk_level: 'high' as RiskLevel, trigger_conditions: 'Grid power lost for > 5 minutes', response_actions: 'Activate generator, switch to battery lighting, pause AV until stable' },
  { scenario: 'Medical emergency', category: 'Medical', risk_level: 'critical' as RiskLevel, trigger_conditions: 'Guest requires emergency medical attention', response_actions: 'Call 108 (ambulance), clear path for responders, notify venue first aid, document incident' },
  { scenario: 'AV equipment failure', category: 'Technical', risk_level: 'medium' as RiskLevel, trigger_conditions: 'Main screen/sound fails during programme', response_actions: 'Switch to backup projector, use handheld mic, contact AV vendor for emergency support' },
  { scenario: 'Key speaker cancellation', category: 'Vendor Failure', risk_level: 'medium' as RiskLevel, trigger_conditions: '< 24 hours notice from speaker', response_actions: 'Activate standby speaker, reorganise agenda, notify attendees' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EventContingencyPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  const [plans, setPlans] = useState<ContingencyPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    scenario: '', category: 'Weather', risk_level: 'medium' as RiskLevel,
    trigger_conditions: '', response_actions: '',
    responsible_person: '', contact_number: '',
  })

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return
    setLoading(true)
    const { data } = await supabase
      .from('event_contingency_plans')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', profile.tenant_id)
      .order('risk_level')
    setPlans(data ?? [])
    setLoading(false)
  }, [eventId, profile?.tenant_id, supabase])

  useEffect(() => { load() }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────

  const savePlan = async () => {
    if (!form.scenario || !form.trigger_conditions || !form.response_actions) return
    await supabase.from('event_contingency_plans').insert({
      event_id: eventId,
      tenant_id: profile!.tenant_id,
      ...form,
      responsible_person: form.responsible_person || null,
      contact_number: form.contact_number || null,
      status: 'draft',
    })
    setShowAdd(false)
    setForm({ scenario: '', category: 'Weather', risk_level: 'medium', trigger_conditions: '', response_actions: '', responsible_person: '', contact_number: '' })
    load()
  }

  const useSuggestion = (s: typeof SUGGESTED_SCENARIOS[number]) => {
    setForm(p => ({ ...p, ...s }))
    setShowSuggestions(false)
    setShowAdd(true)
  }

  const toggleStatus = async (plan: ContingencyPlan) => {
    const next: PlanStatus = plan.status === 'draft' ? 'reviewed' : plan.status === 'reviewed' ? 'activated' : 'draft'
    await supabase.from('event_contingency_plans').update({ status: next }).eq('id', plan.id)
    load()
  }

  const deletePlan = async (id: string) => {
    await supabase.from('event_contingency_plans').delete().eq('id', id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const criticalCount  = plans.filter(p => p.risk_level === 'critical').length
  const activatedCount = plans.filter(p => p.status === 'activated').length
  const reviewedCount  = plans.filter(p => p.status === 'reviewed').length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event Overview
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Contingency</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-orange-500" />
            Contingency Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crisis scenarios, triggers, and response actions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSuggestions(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors"
          >
            <Zap className="w-4 h-4" /> Suggestions
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Plan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Plans',   value: plans.length,   color: 'text-foreground' },
          { label: 'Critical Risk', value: criticalCount,  color: 'text-red-600' },
          { label: 'Reviewed',      value: reviewedCount,  color: 'text-blue-600' },
          { label: 'Activated',     value: activatedCount, color: 'text-orange-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Plans */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <AlertOctagon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No contingency plans yet</p>
          <p className="text-sm text-muted-foreground mb-4">Prepare for the unexpected — add crisis response plans</p>
          <button
            onClick={() => setShowSuggestions(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4 inline mr-1.5" />Use Suggestions
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const rCfg = RISK_CONFIG[plan.risk_level]
            const sCfg = STATUS_CONFIG[plan.status]
            const CatIcon = CATEGORY_ICONS[plan.category] ?? AlertTriangle
            const expanded = expandedId === plan.id
            return (
              <div key={plan.id} className={cn('bg-card border rounded-xl overflow-hidden transition-colors', plan.status === 'activated' ? 'border-red-300' : 'border-border')}>
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : plan.id)}
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', rCfg.bg)}>
                    <CatIcon className={cn('w-4.5 h-4.5', rCfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{plan.scenario}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', rCfg.bg, rCfg.color)}>{rCfg.label}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sCfg.color)}>{sCfg.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.category} · {plan.responsible_person ?? 'No owner assigned'}</p>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-90')} />
                </div>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trigger Conditions</p>
                      <p className="text-sm bg-muted rounded-lg p-3">{plan.trigger_conditions}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Response Actions</p>
                      <p className="text-sm bg-muted rounded-lg p-3 whitespace-pre-wrap">{plan.response_actions}</p>
                    </div>
                    {plan.contact_number && (
                      <p className="text-sm text-muted-foreground">📞 Emergency contact: <strong>{plan.contact_number}</strong></p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => toggleStatus(plan)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          plan.status === 'activated'
                            ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                            : plan.status === 'reviewed'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700',
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {plan.status === 'activated' ? 'Deactivate' : plan.status === 'reviewed' ? 'Activate' : 'Mark Reviewed'}
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 my-4">
            <h2 className="text-lg font-bold mb-4">Suggested Contingency Plans</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {SUGGESTED_SCENARIOS.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className={cn('shrink-0 text-xs px-2 py-1 rounded-full border font-medium mt-0.5', RISK_CONFIG[s.risk_level].bg, RISK_CONFIG[s.risk_level].color)}>
                    {RISK_CONFIG[s.risk_level].label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.scenario}</p>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <button
                    onClick={() => useSuggestion(s)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSuggestions(false)} className="mt-4 w-full px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 my-4">
            <h2 className="text-lg font-bold mb-4">Add Contingency Plan</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Scenario *</label>
                <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.scenario} onChange={e => setForm(p => ({ ...p, scenario: e.target.value }))} placeholder="e.g. Main caterer no-show" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Risk Level</label>
                  <select className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.risk_level} onChange={e => setForm(p => ({ ...p, risk_level: e.target.value as RiskLevel }))}>
                    {(Object.keys(RISK_CONFIG) as RiskLevel[]).map(r => <option key={r} value={r}>{RISK_CONFIG[r].label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Trigger Conditions *</label>
                <textarea rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.trigger_conditions} onChange={e => setForm(p => ({ ...p, trigger_conditions: e.target.value }))} placeholder="When does this plan activate?" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Response Actions *</label>
                <textarea rows={3} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.response_actions} onChange={e => setForm(p => ({ ...p, response_actions: e.target.value }))} placeholder="Step-by-step actions to take..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Responsible Person</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.responsible_person} onChange={e => setForm(p => ({ ...p, responsible_person: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Emergency Contact</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" value={form.contact_number} onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={savePlan} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Save Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
