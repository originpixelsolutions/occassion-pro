'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Zap, Plus, Play, Pause, Trash2, ChevronDown, ChevronRight,
  Settings, AlertCircle, CheckCircle, Clock, BarChart2,
  ArrowRight, Loader2, X, Save, RefreshCw, Eye, EyeOff,
  Webhook, Mail, MessageSquare, ListTodo, Bell, Edit3,
  Timer, GitBranch, Smartphone, Activity, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TriggerDef {
  type: string
  label: string
  context_fields: string[]
}

interface TriggerGroup {
  group: string
  triggers: TriggerDef[]
}

interface ActionDef {
  type: string
  label: string
  description: string
  fields: string[]
}

interface RuleAction {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
}

interface Rule {
  id: string
  name: string
  description?: string
  trigger_type: string
  trigger_filters: Record<string, unknown>
  actions: RuleAction[]
  is_active: boolean
  run_once: boolean
  cooldown_seconds: number
  execution_count: number
  last_fired_at?: string
  last_success_at?: string
  last_failure_at?: string
  created_at: string
}

interface Execution {
  id: string
  status: string
  trigger_context: Record<string, unknown>
  started_at: string
  completed_at?: string
  actions_total: number
  actions_success: number
  actions_failed: number
  actions_skipped: number
  automation_action_logs?: ActionLog[]
}

interface ActionLog {
  id: string
  action_index: number
  action_type: string
  action_label?: string
  status: string
  http_status_code?: number
  error_message?: string
  http_duration_ms?: number
}

interface Analytics {
  total_rules: number
  active_rules: number
  total_executions: number
  success_rate: number
  failed_executions: number
  top_rules: Rule[]
  recent_executions: Array<{ status: string; trigger_type: string; created_at: string }>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'webhook.http':          Webhook,
  'email.send':            Mail,
  'whatsapp.send':         MessageSquare,
  'sms.send':              Smartphone,
  'task.create':           ListTodo,
  'notification.internal': Bell,
  'field.update':          Edit3,
  'delay.wait':            Timer,
  'condition.branch':      GitBranch,
}

const STATUS_STYLES: Record<string, string> = {
  success:         'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  partial_failure: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  failed:          'bg-red-500/10 text-red-400 border border-red-500/20',
  running:         'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  pending:         'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  skipped:         'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Rule Builder Modal ────────────────────────────────────────────────────────

function RuleBuilderModal({
  eventId,
  rule,
  triggers,
  actionTypes,
  onSave,
  onClose,
}: {
  eventId: string
  rule?: Rule
  triggers: TriggerGroup[]
  actionTypes: ActionDef[]
  onSave: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [triggerType, setTriggerType] = useState(rule?.trigger_type ?? '')
  const [triggerFilters, setTriggerFilters] = useState(
    rule?.trigger_filters ? JSON.stringify(rule.trigger_filters, null, 2) : '{}'
  )
  const [actions, setActions] = useState<RuleAction[]>(rule?.actions ?? [])
  const [runOnce, setRunOnce] = useState(rule?.run_once ?? false)
  const [cooldown, setCooldown] = useState(rule?.cooldown_seconds ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedTrigger = triggers
    .flatMap(g => g.triggers)
    .find(t => t.type === triggerType)

  function addAction(type: string) {
    const def = actionTypes.find(a => a.type === type)
    if (!def) return
    setActions(prev => [
      ...prev,
      { id: genId(), type, label: def.label, config: {} },
    ])
  }

  function removeAction(id: string) {
    setActions(prev => prev.filter(a => a.id !== id))
  }

  function updateActionConfig(id: string, key: string, value: unknown) {
    setActions(prev => prev.map(a =>
      a.id === id ? { ...a, config: { ...a.config, [key]: value } } : a
    ))
  }

  function updateActionLabel(id: string, label: string) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, label } : a))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!triggerType) { setError('Select a trigger'); return }
    if (actions.length === 0) { setError('Add at least one action'); return }

    let parsedFilters: Record<string, unknown> = {}
    try { parsedFilters = JSON.parse(triggerFilters) } catch {
      setError('Trigger filters must be valid JSON'); return
    }

    setSaving(true)
    setError('')
    try {
      if (rule?.id) {
        await apiFetch(`/automations/rules/${rule.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, description, trigger_type: triggerType, trigger_filters: parsedFilters, actions, run_once: runOnce, cooldown_seconds: cooldown }),
        })
      } else {
        await apiFetch('/automations/rules', {
          method: 'POST',
          body: JSON.stringify({ name, description, trigger_type: triggerType, trigger_filters: parsedFilters, actions, run_once: runOnce, cooldown_seconds: cooldown, event_id: eventId }),
        })
      }
      onSave()
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f0f0f] border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-base font-semibold">{rule ? 'Edit Rule' : 'New Automation Rule'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Name + Description */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rule Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Notify Slack on confirmed RSVP"
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this rule do?"
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">
              When this happens (Trigger)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {triggers.map(group => (
                <div key={group.group} className="col-span-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-1">{group.group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.triggers.map(t => (
                      <button
                        key={t.type}
                        onClick={() => setTriggerType(t.type)}
                        className={cn(
                          'text-left px-3 py-2 rounded-lg text-xs border transition-all',
                          triggerType === t.type
                            ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                            : 'border-border bg-white/3 text-muted-foreground hover:text-foreground hover:bg-white/5',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Available context fields hint */}
            {selectedTrigger && selectedTrigger.context_fields.length > 0 && (
              <div className="mt-3 p-3 bg-white/3 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Available template variables:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedTrigger.context_fields.map(f => (
                    <code key={f} className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded text-violet-300">
                      {`{{${f}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Trigger filters */}
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Trigger Filters (JSON) — e.g. {`{"rsvp_status": "confirmed"}`}
              </label>
              <textarea
                value={triggerFilters}
                onChange={e => setTriggerFilters(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">
              Then do these actions (in order)
            </label>

            {actions.length === 0 && (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                No actions yet — add one below
              </div>
            )}

            <div className="space-y-2 mb-3">
              {actions.map((action, idx) => (
                <ActionEditor
                  key={action.id}
                  index={idx}
                  action={action}
                  actionDef={actionTypes.find(a => a.type === action.type)}
                  onLabelChange={l => updateActionLabel(action.id, l)}
                  onConfigChange={(k, v) => updateActionConfig(action.id, k, v)}
                  onRemove={() => removeAction(action.id)}
                />
              ))}
            </div>

            {/* Add action picker */}
            <div className="border border-dashed border-border rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-medium mb-2">Add action:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {actionTypes.map(at => {
                  const Icon = ACTION_ICONS[at.type] ?? Zap
                  return (
                    <button
                      key={at.type}
                      onClick={() => addAction(at.type)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs bg-white/3 hover:bg-white/8 border border-border hover:border-violet-500/30 text-muted-foreground hover:text-foreground transition-all text-left"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                      <span className="truncate">{at.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setRunOnce(!runOnce)}
                className={cn(
                  'w-9 h-5 rounded-full transition-colors relative',
                  runOnce ? 'bg-violet-500' : 'bg-white/10',
                )}
              >
                <div className={cn(
                  'w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all',
                  runOnce ? 'left-4.5' : 'left-0.5',
                )} />
              </div>
              <span className="text-xs text-muted-foreground">Fire once only</span>
            </label>
            <div>
              <label className="text-xs text-muted-foreground">Cooldown (seconds)</label>
              <input
                type="number"
                value={cooldown}
                onChange={e => setCooldown(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full mt-1 bg-white/5 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : (rule ? 'Update Rule' : 'Create Rule')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionEditor({
  index, action, actionDef, onLabelChange, onConfigChange, onRemove,
}: {
  index: number
  action: RuleAction
  actionDef?: ActionDef
  onLabelChange: (l: string) => void
  onConfigChange: (k: string, v: unknown) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const Icon = ACTION_ICONS[action.type] ?? Zap

  const cfg = action.config as Record<string, string>

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-white/3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 h-5 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-violet-400">{index + 1}</span>
        </span>
        <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="text-xs font-medium flex-1 truncate">{action.label}</span>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
        >
          <X className="w-3 h-3" />
        </button>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-3 py-3 space-y-2.5 border-t border-border/50">
          <div>
            <label className="text-[10px] text-muted-foreground">Label</label>
            <input
              value={action.label}
              onChange={e => onLabelChange(e.target.value)}
              className="w-full mt-1 bg-white/5 border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          {actionDef?.fields.map(field => (
            <div key={field}>
              <label className="text-[10px] text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</label>
              {field.includes('template') || field === 'body_template_html' ? (
                <textarea
                  rows={3}
                  value={cfg[field] ?? ''}
                  onChange={e => onConfigChange(field, e.target.value)}
                  placeholder={`{{variable}} interpolation supported`}
                  className="w-full mt-1 bg-white/5 border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-none"
                />
              ) : field === 'method' ? (
                <select
                  value={cfg[field] ?? 'POST'}
                  onChange={e => onConfigChange(field, e.target.value)}
                  className="w-full mt-1 bg-[#1a1a1a] border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                >
                  {['GET','POST','PUT','PATCH'].map(m => <option key={m}>{m}</option>)}
                </select>
              ) : field === 'operator' ? (
                <select
                  value={cfg[field] ?? 'eq'}
                  onChange={e => onConfigChange(field, e.target.value)}
                  className="w-full mt-1 bg-[#1a1a1a] border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                >
                  {['eq','ne','gt','lt','contains','exists'].map(op => <option key={op}>{op}</option>)}
                </select>
              ) : field === 'seconds' || field === 'due_days_offset' || field === 'timeout_ms' || field === 'retry_count' ? (
                <input
                  type="number"
                  value={cfg[field] ?? ''}
                  onChange={e => onConfigChange(field, parseInt(e.target.value) || 0)}
                  className="w-full mt-1 bg-white/5 border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              ) : (
                <input
                  value={cfg[field] ?? ''}
                  onChange={e => onConfigChange(field, e.target.value)}
                  placeholder={field === 'url' ? 'https://hooks.slack.com/...' : field === 'to_field' ? 'guest.phone' : ''}
                  className="w-full mt-1 bg-white/5 border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Execution Log Drawer ──────────────────────────────────────────────────────

function ExecutionDrawer({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/automations/rules/${rule.id}/executions`)
      .then(d => setExecutions(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [rule.id])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0f0f0f] border-l border-border h-full overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Execution Log</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rule.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading executions…
            </div>
          )}
          {!loading && executions.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No executions yet. Fire the rule to see logs here.
            </div>
          )}
          {executions.map(exec => (
            <div key={exec.id} className="border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
                onClick={() => setExpanded(expanded === exec.id ? null : exec.id)}
              >
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_STYLES[exec.status] ?? STATUS_STYLES.pending)}>
                  {exec.status}
                </span>
                <span className="text-xs text-muted-foreground flex-1">{timeAgo(exec.started_at)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {exec.actions_success}/{exec.actions_total} actions
                </span>
                {expanded === exec.id
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {expanded === exec.id && (
                <div className="border-t border-border/50 px-4 py-3 space-y-2">
                  {(exec.automation_action_logs ?? []).map(log => {
                    const Icon = ACTION_ICONS[log.action_type] ?? Zap
                    return (
                      <div key={log.id} className="flex items-start gap-2.5">
                        <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{log.action_label ?? log.action_type}</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full shrink-0', STATUS_STYLES[log.status] ?? STATUS_STYLES.pending)}>
                              {log.status}
                            </span>
                            {log.http_status_code && (
                              <span className="text-[10px] text-muted-foreground">{log.http_status_code}</span>
                            )}
                            {log.http_duration_ms && (
                              <span className="text-[10px] text-muted-foreground">{log.http_duration_ms}ms</span>
                            )}
                          </div>
                          {log.error_message && (
                            <p className="text-[10px] text-red-400 mt-0.5 truncate">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Trigger context */}
                  {Object.keys(exec.trigger_context).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Context data</summary>
                      <pre className="text-[10px] mt-1.5 bg-white/3 rounded p-2 overflow-x-auto text-zinc-400 font-mono">
                        {JSON.stringify(exec.trigger_context, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = params?.eventId ?? ''

  const [rules, setRules] = useState<Rule[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [triggers, setTriggers] = useState<TriggerGroup[]>([])
  const [actionTypes, setActionTypes] = useState<ActionDef[]>([])

  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined)
  const [logRule, setLogRule] = useState<Rule | undefined>(undefined)
  const [firingId, setFiringId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'rules' | 'analytics'>('rules')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, a, t, at] = await Promise.all([
        apiFetch(`/automations/rules?event_id=${eventId}`),
        apiFetch(`/automations/analytics?event_id=${eventId}`),
        apiFetch('/automations/triggers'),
        apiFetch('/automations/action-types'),
      ])
      setRules(r)
      setAnalytics(a)
      setTriggers(t)
      setActionTypes(at)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function toggleRule(rule: Rule) {
    setTogglingId(rule.id)
    try {
      await apiFetch(`/automations/rules/${rule.id}/toggle`, { method: 'PATCH' })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Delete this automation rule?')) return
    await apiFetch(`/automations/rules/${ruleId}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  async function fireRule(rule: Rule) {
    setFiringId(rule.id)
    try {
      await apiFetch(`/automations/rules/${rule.id}/fire`, { method: 'POST', body: '{}' })
      // reload after brief pause so execution appears
      setTimeout(load, 1500)
    } finally {
      setFiringId(null)
    }
  }

  function openNew() { setEditingRule(undefined); setShowBuilder(true) }
  function openEdit(r: Rule) { setEditingRule(r); setShowBuilder(true) }

  const triggerLabel = (type: string) =>
    triggers.flatMap(g => g.triggers).find(t => t.type === type)?.label ?? type

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-violet-400" />
            Automation Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build no-code trigger → action workflows for this event
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New Rule
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Rules',    value: analytics.total_rules,      icon: Zap,      color: 'text-violet-400' },
            { label: 'Active',         value: analytics.active_rules,     icon: Activity, color: 'text-emerald-400' },
            { label: 'Total Runs',     value: analytics.total_executions, icon: Play,     color: 'text-blue-400' },
            { label: 'Success Rate',   value: `${analytics.success_rate}%`, icon: CheckCircle, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-surface/50 border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <s.icon className={cn('w-5 h-5 shrink-0', s.color)} />
              <div>
                <p className="text-lg font-semibold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white/3 rounded-xl p-1 w-fit border border-border">
        {(['rules', 'analytics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
              tab === t ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Rules Tab ── */}
      {tab === 'rules' && (
        <div className="space-y-2.5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading rules…
            </div>
          )}

          {!loading && rules.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-16 text-center">
              <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-base font-medium mb-1">No automation rules yet</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Create your first rule to automate tasks, notifications, and webhooks.
              </p>
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-medium mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create First Rule
              </button>
            </div>
          )}

          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                'border border-border rounded-xl bg-surface/30 p-4 transition-all',
                !rule.is_active && 'opacity-50',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Active toggle */}
                <button
                  onClick={() => toggleRule(rule)}
                  disabled={togglingId === rule.id}
                  className={cn(
                    'mt-0.5 w-9 h-5 rounded-full transition-colors relative shrink-0',
                    rule.is_active ? 'bg-violet-500' : 'bg-white/10',
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all',
                    rule.is_active ? 'left-[18px]' : 'left-0.5',
                  )} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium">{rule.name}</h3>
                    {rule.run_once && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Run once</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                  )}

                  {/* Trigger → Actions flow */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <Filter className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-blue-300 font-medium">{triggerLabel(rule.trigger_type)}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {rule.actions.map((a, i) => {
                      const Icon = ACTION_ICONS[a.type] ?? Zap
                      return (
                        <div key={a.id} className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                            <Icon className="w-3 h-3 text-violet-400" />
                            <span className="text-xs text-violet-300 font-medium">{a.label}</span>
                          </div>
                          {i < rule.actions.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mt-2.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Play className="w-2.5 h-2.5" />
                      {rule.execution_count} runs
                    </span>
                    {rule.last_fired_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Last: {timeAgo(rule.last_fired_at)}
                      </span>
                    )}
                    {rule.last_failure_at && (
                      <span className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Failed: {timeAgo(rule.last_failure_at)}
                      </span>
                    )}
                    {rule.cooldown_seconds > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5" />
                        {rule.cooldown_seconds}s cooldown
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setLogRule(rule)}
                    title="View execution log"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fireRule(rule)}
                    disabled={firingId === rule.id}
                    title="Fire rule manually"
                    className="p-1.5 rounded-lg hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400"
                  >
                    {firingId === rule.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => openEdit(rule)}
                    title="Edit rule"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    title="Delete rule"
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {tab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Top rules table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-white/3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-violet-400" />
                Most Active Rules
              </h3>
            </div>
            <div className="divide-y divide-border">
              {(analytics.top_rules ?? []).map(rule => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.trigger_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{rule.execution_count}</p>
                    <p className="text-[10px] text-muted-foreground">runs</p>
                  </div>
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    rule.is_active ? 'bg-emerald-400' : 'bg-zinc-500',
                  )} />
                </div>
              ))}
              {analytics.top_rules.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No rule executions yet</div>
              )}
            </div>
          </div>

          {/* Recent executions */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-white/3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Recent Executions
              </h3>
            </div>
            <div className="divide-y divide-border">
              {(analytics.recent_executions ?? []).map((exec, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[exec.status] ?? STATUS_STYLES.pending)}>
                    {exec.status}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{exec.trigger_type}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(exec.created_at)}</span>
                </div>
              ))}
              {analytics.recent_executions.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No executions yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showBuilder && (
        <RuleBuilderModal
          eventId={eventId}
          rule={editingRule}
          triggers={triggers}
          actionTypes={actionTypes}
          onSave={() => { setShowBuilder(false); load() }}
          onClose={() => setShowBuilder(false)}
        />
      )}

      {logRule && (
        <ExecutionDrawer
          rule={logRule}
          onClose={() => setLogRule(undefined)}
        />
      )}
    </div>
  )
}
