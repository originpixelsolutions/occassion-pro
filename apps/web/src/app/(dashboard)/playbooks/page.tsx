'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Search, Plus, Filter, ChevronRight, Star, Copy,
  Trash2, Zap, Clock, DollarSign, Users, CheckSquare, List,
  Tag, Calendar, BarChart3, Loader2, AlertTriangle, X,
  PlayCircle, Settings, ArrowRight, Check, Building2, Music2,
  Utensils, Mic2, Globe, Briefcase, GraduationCap, Heart,
  Edit3, MoreVertical, Package, ChevronDown, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Playbook {
  id: string
  name: string
  description: string | null
  event_type: string | null
  category: string | null
  is_system: boolean
  emoji: string | null
  color: string | null
  tenant_id: string | null
  times_applied: number
  task_count: number
  budget_item_count: number
  vendor_requirement_count: number
  checklist_item_count: number
  runsheet_item_count: number
  created_at: string
}

interface PlaybookDetail extends Playbook {
  tasks: PlaybookTask[]
  budgetItems: BudgetItem[]
  vendorRequirements: VendorReq[]
  checklistItems: ChecklistItem[]
  runsheetItems: RunsheetItem[]
}

interface PlaybookTask {
  id: string
  title: string
  description: string | null
  category: string | null
  priority: string
  days_before_event: number | null
  assigned_role: string | null
  estimated_hours: number | null
}

interface BudgetItem {
  id: string
  name: string
  category: string
  amount: number
  amount_type: string
  currency: string
  notes: string | null
}

interface VendorReq {
  id: string
  vendor_type: string
  description: string | null
  is_required: boolean
  budget_estimate: number | null
}

interface ChecklistItem {
  id: string
  title: string
  category: string | null
  days_before_event: number | null
  responsible_role: string | null
  is_critical: boolean
}

interface RunsheetItem {
  id: string
  title: string
  duration_minutes: number
  offset_hours: number
  category: string | null
  notes: string | null
}

interface ApplyOptions {
  applyTasks: boolean
  applyBudget: boolean
  applyVendors: boolean
  applyChecklist: boolean
  applyRunsheet: boolean
  eventDate: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
  wedding: Heart,
  corporate: Briefcase,
  concert: Music2,
  conference: Briefcase,
  festival: Globe,
  'product-launch': Zap,
  award: Star,
  hospitality: Utensils,
  educational: GraduationCap,
  government: Building2,
}

const CATEGORIES = [
  'All', 'Wedding', 'Corporate', 'Concert', 'Conference',
  'Festival', 'Social', 'Educational', 'Government',
]

const SECTION_TABS = [
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, countKey: 'task_count' },
  { key: 'budget', label: 'Budget', icon: DollarSign, countKey: 'budget_item_count' },
  { key: 'vendors', label: 'Vendors', icon: Users, countKey: 'vendor_requirement_count' },
  { key: 'checklist', label: 'Checklist', icon: List, countKey: 'checklist_item_count' },
  { key: 'runsheet', label: 'Run Sheet', icon: Clock, countKey: 'runsheet_item_count' },
] as const

type SectionKey = typeof SECTION_TABS[number]['key']

function getDefaultColor(playbook: Playbook) {
  return playbook.color ?? '#6366f1'
}

function priorityColor(p: string) {
  if (p === 'critical') return 'text-red-400 bg-red-500/10'
  if (p === 'high') return 'text-orange-400 bg-orange-500/10'
  if (p === 'medium') return 'text-yellow-400 bg-yellow-500/10'
  return 'text-slate-400 bg-slate-500/10'
}

function formatDayOffset(days: number | null) {
  if (days === null) return 'Day of event'
  if (days === 0) return 'Day of event'
  if (days > 0) return `${days}d after`
  return `${Math.abs(days)}d before`
}

function formatHourOffset(hours: number) {
  if (hours === 0) return 'Event start'
  if (hours > 0) return `+${hours}h`
  return `${hours}h before`
}

function formatAmountType(type: string, amount: number) {
  if (type === 'percentage') return `${amount}%`
  if (type === 'per_guest') return `₹${amount.toLocaleString()}/guest`
  if (type === 'per_day') return `₹${amount.toLocaleString()}/day`
  return `₹${amount.toLocaleString()}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlaybookCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-5 bg-muted rounded w-16" />
        <div className="h-5 bg-muted rounded w-12" />
        <div className="h-5 bg-muted rounded w-14" />
      </div>
    </div>
  )
}

// ─── Apply Modal ───────────────────────────────────────────────────────────────

interface ApplyModalProps {
  playbook: Playbook
  onClose: () => void
  onApplied: () => void
}

function ApplyModal({ playbook, onClose, onApplied }: ApplyModalProps) {
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string }[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [options, setOptions] = useState<ApplyOptions>({
    applyTasks: true,
    applyBudget: true,
    applyVendors: true,
    applyChecklist: true,
    applyRunsheet: true,
    eventDate: '',
  })
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/events?status=planning,confirmed&limit=50').then(r => {
      const data = r.data?.events ?? r.data?.data ?? []
      setEvents(data)
    }).catch(() => {})
  }, [])

  function onEventChange(id: string) {
    setSelectedEvent(id)
    const ev = events.find(e => e.id === id)
    if (ev?.event_date) {
      setOptions(o => ({ ...o, eventDate: ev.event_date.slice(0, 10) }))
    }
  }

  async function handleApply() {
    if (!selectedEvent) { setError('Please select an event'); return }
    setApplying(true)
    setError('')
    try {
      await api.post(`/playbooks/${playbook.id}/apply/${selectedEvent}`, options)
      setApplied(true)
      setTimeout(() => { onApplied(); onClose() }, 1200)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to apply playbook')
    } finally {
      setApplying(false)
    }
  }

  const toggleOpt = (key: keyof ApplyOptions) => {
    if (typeof options[key] === 'boolean') {
      setOptions(o => ({ ...o, [key]: !o[key] }))
    }
  }

  const sectionOpts = [
    { key: 'applyTasks' as const, label: 'Tasks', count: playbook.task_count },
    { key: 'applyBudget' as const, label: 'Budget items', count: playbook.budget_item_count },
    { key: 'applyVendors' as const, label: 'Vendor requirements', count: playbook.vendor_requirement_count },
    { key: 'applyChecklist' as const, label: 'Checklist items', count: playbook.checklist_item_count },
    { key: 'applyRunsheet' as const, label: 'Run sheet items', count: playbook.runsheet_item_count },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-xl"
              style={{ background: `${getDefaultColor(playbook)}22` }}
            >
              {playbook.emoji ?? '📋'}
            </div>
            <div>
              <p className="font-semibold text-sm">Apply Playbook</p>
              <p className="text-xs text-muted-foreground">{playbook.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Event selector */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Target Event</label>
            <select
              value={selectedEvent}
              onChange={e => onEventChange(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select an event…</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Event date override */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Event Date <span className="text-muted-foreground">(for relative task scheduling)</span>
            </label>
            <input
              type="date"
              value={options.eventDate}
              onChange={e => setOptions(o => ({ ...o, eventDate: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Section toggles */}
          <div>
            <p className="text-xs font-medium mb-2">What to apply</p>
            <div className="space-y-1.5">
              {sectionOpts.map(({ key, label, count }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => toggleOpt(key)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                      options[key]
                        ? 'bg-primary border-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    {options[key] && <Check className="w-2.5 h-2.5 text-foreground" />}
                  </div>
                  <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
                    {label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || applied}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {applied ? (
              <><Check className="w-4 h-4" /> Applied!</>
            ) : applying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
            ) : (
              <><PlayCircle className="w-4 h-4" /> Apply Playbook</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreated: (p: Playbook) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    event_type: '',
    category: '',
    emoji: '📋',
    color: '#6366f1',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/playbooks', form)
      onCreated(res.data)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create playbook')
    } finally {
      setSaving(false)
    }
  }

  const EMOJIS = ['📋', '🎉', '💍', '🎤', '🎸', '🏢', '🎓', '🙏', '🎭', '🌟', '⚡', '🚀']

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-sm">Create New Playbook</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border transition-all ${
                    form.emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Destination Wedding Playbook"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Briefly describe this playbook…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Event Type</label>
              <input
                value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                placeholder="e.g. wedding"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Category</label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. luxury"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <span className="text-xs text-muted-foreground">{form.color}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Create Playbook'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  id: string
  onClose: () => void
  onApply: (p: Playbook) => void
}

function DetailPanel({ id, onClose, onApply }: DetailPanelProps) {
  const [detail, setDetail] = useState<PlaybookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SectionKey>('tasks')

  useEffect(() => {
    setLoading(true)
    api.get(`/playbooks/${id}`).then(r => {
      setDetail(r.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (!detail) return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  )

  const color = getDefaultColor(detail)
  const TypeIcon = EVENT_TYPE_ICONS[detail.event_type ?? ''] ?? BookOpen

  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: `${color}22` }}
          >
            {detail.emoji ?? '📋'}
          </div>
          <div className="flex items-center gap-1">
            {!detail.is_system && (
              <button
                onClick={() => onApply(detail)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Apply
              </button>
            )}
            {detail.is_system && (
              <button
                onClick={() => onApply(detail)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Apply
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h2 className="font-semibold text-base leading-tight mb-1">{detail.name}</h2>
        {detail.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{detail.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {detail.is_system && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 flex items-center gap-1">
              <Star className="w-2.5 h-2.5" /> System
            </span>
          )}
          {detail.event_type && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <TypeIcon className="w-2.5 h-2.5" />
              {detail.event_type}
            </span>
          )}
          {detail.category && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
              {detail.category}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground flex items-center gap-1">
            <PlayCircle className="w-2.5 h-2.5" />
            Used {detail.times_applied}×
          </span>
        </div>
      </div>

      {/* Section stats */}
      <div className="grid grid-cols-5 border-b border-border divide-x divide-border">
        {SECTION_TABS.map(({ key, label, icon: Icon, countKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center py-2.5 gap-1 text-xs transition-colors ${
              activeTab === key
                ? 'bg-primary/5 text-primary border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="font-medium">{(detail as any)[countKey]}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">

        {activeTab === 'tasks' && (
          detail.tasks.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No tasks defined</p>
            : detail.tasks.map(task => (
              <div key={task.id} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium leading-snug">{task.title}</p>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                {task.description && <p className="text-xs text-muted-foreground mb-1.5">{task.description}</p>}
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDayOffset(task.days_before_event)}</span>
                  {task.assigned_role && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{task.assigned_role}</span>}
                  {task.estimated_hours && <span className="flex items-center gap-1"><BarChart3 className="w-2.5 h-2.5" />{task.estimated_hours}h</span>}
                  {task.category && <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{task.category}</span>}
                </div>
              </div>
            ))
        )}

        {activeTab === 'budget' && (
          detail.budgetItems.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No budget items defined</p>
            : detail.budgetItems.map(item => (
              <div key={item.id} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <span className="text-sm font-semibold text-green-400">
                    {formatAmountType(item.amount_type, item.amount)}
                  </span>
                </div>
                <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{item.category}</span>
                  <span className="capitalize">{item.amount_type.replace('_', ' ')}</span>
                </div>
                {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
              </div>
            ))
        )}

        {activeTab === 'vendors' && (
          detail.vendorRequirements.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No vendor requirements defined</p>
            : detail.vendorRequirements.map(v => (
              <div key={v.id} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium capitalize">{v.vendor_type.replace('_', ' ')}</p>
                  {v.is_required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">Required</span>
                  )}
                </div>
                {v.description && <p className="text-xs text-muted-foreground mb-1">{v.description}</p>}
                {v.budget_estimate && (
                  <p className="text-xs text-green-400">Est. ₹{v.budget_estimate.toLocaleString()}</p>
                )}
              </div>
            ))
        )}

        {activeTab === 'checklist' && (
          detail.checklistItems.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No checklist items defined</p>
            : detail.checklistItems.map(item => (
              <div key={item.id} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${
                    item.is_critical ? 'border-red-400 bg-red-500/10' : 'border-border'
                  }`}>
                    {item.is_critical && <AlertTriangle className="w-2.5 h-2.5 text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{formatDayOffset(item.days_before_event)}</span>
                      {item.responsible_role && <span>{item.responsible_role}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}

        {activeTab === 'runsheet' && (
          detail.runsheetItems.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No run sheet items defined</p>
            : [...detail.runsheetItems]
                .sort((a, b) => a.offset_hours - b.offset_hours)
                .map((item, i, arr) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.category === 'ceremony' ? 'bg-pink-400' :
                        item.category === 'entertainment' ? 'bg-violet-400' :
                        item.category === 'catering' ? 'bg-orange-400' :
                        'bg-primary'
                      }`} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-medium leading-snug">{item.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatHourOffset(item.offset_hours)}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{item.duration_minutes}min</span>
                        {item.category && <span>{item.category}</span>}
                      </div>
                      {item.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.notes}</p>}
                    </div>
                  </div>
                ))
        )}
      </div>
    </div>
  )
}

// ─── Playbook Card ─────────────────────────────────────────────────────────────

interface PlaybookCardProps {
  playbook: Playbook
  selected: boolean
  onClick: () => void
  onApply: () => void
}

function PlaybookCard({ playbook, selected, onClick, onApply }: PlaybookCardProps) {
  const color = getDefaultColor(playbook)

  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md group ${
        selected ? 'border-primary shadow-sm shadow-primary/20' : 'border-border hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}22` }}
        >
          {playbook.emoji ?? '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-semibold leading-snug truncate">{playbook.name}</p>
            {playbook.is_system && (
              <Star className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
            )}
          </div>
          {playbook.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {playbook.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {playbook.task_count > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <CheckSquare className="w-2.5 h-2.5" /> {playbook.task_count} tasks
          </span>
        )}
        {playbook.budget_item_count > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <DollarSign className="w-2.5 h-2.5" /> {playbook.budget_item_count} budget
          </span>
        )}
        {playbook.vendor_requirement_count > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Users className="w-2.5 h-2.5" /> {playbook.vendor_requirement_count} vendors
          </span>
        )}
        {playbook.runsheet_item_count > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Clock className="w-2.5 h-2.5" /> {playbook.runsheet_item_count} runsheet
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1">
          {playbook.event_type && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
              style={{ borderColor: `${color}40`, color, background: `${color}15` }}
            >
              {playbook.event_type}
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onApply() }}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] px-2 py-1 bg-primary text-foreground rounded-lg transition-all hover:bg-primary/90"
        >
          <PlayCircle className="w-3 h-3" /> Apply
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applyTarget, setApplyTarget] = useState<Playbook | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'all' | 'system' | 'custom'>('all')

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (categoryFilter !== 'All') params.category = categoryFilter.toLowerCase()
      const qs = new URLSearchParams(params).toString()
      const res = await api.get(`/playbooks${qs ? `?${qs}` : ''}`)
      setPlaybooks(res.data?.playbooks ?? res.data ?? [])
    } catch {
      setPlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => { load() }, [load])

  const filtered = playbooks.filter(p => {
    if (tab === 'system' && !p.is_system) return false
    if (tab === 'custom' && p.is_system) return false
    return true
  })

  const systemCount = playbooks.filter(p => p.is_system).length
  const customCount = playbooks.filter(p => !p.is_system).length
  const totalApplied = playbooks.reduce((s, p) => s + p.times_applied, 0)

  function handleCreated(p: Playbook) {
    setPlaybooks(prev => [p, ...prev])
    setSelectedId(p.id)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-sm">Event Playbooks</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
            {playbooks.length} playbooks · {totalApplied} applied
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Playbook
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="px-4 pt-4 pb-3 border-b border-border space-y-3 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search playbooks…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1">
              {([
                { key: 'all', label: `All (${playbooks.length})` },
                { key: 'system', label: `System (${systemCount})` },
                { key: 'custom', label: `Custom (${customCount})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    tab === key
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-primary text-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => <PlaybookCardSkeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No playbooks found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search ? 'Try a different search term' : 'Create your first custom playbook'}
                </p>
                {!search && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Playbook
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(p => (
                  <PlaybookCard
                    key={p.id}
                    playbook={p}
                    selected={selectedId === p.id}
                    onClick={() => setSelectedId(prev => prev === p.id ? null : p.id)}
                    onApply={() => setApplyTarget(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer stats */}
          <div className="h-10 border-t border-border flex items-center px-4 gap-6 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-violet-400" />
              {systemCount} system templates
            </span>
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-3 h-3" />
              {customCount} custom playbooks
            </span>
            <span className="flex items-center gap-1.5">
              <PlayCircle className="w-3 h-3 text-green-400" />
              {totalApplied} total applications
            </span>
          </div>
        </div>

        {/* Detail panel */}
        {selectedId && (
          <DetailPanel
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onApply={p => setApplyTarget(p)}
          />
        )}
      </div>

      {/* Modals */}
      {applyTarget && (
        <ApplyModal
          playbook={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={() => load()}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
