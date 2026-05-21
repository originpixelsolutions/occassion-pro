'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Plus, Search, X, Phone, Mail,
  Calendar, Tag, ArrowRight,
  TrendingUp, Target,
  Clock, CheckCircle2, AlertCircle, Loader2, MessageSquare,
  FileText, BarChart2, Edit2, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function formatINR(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

const STAGES = [
  { id: 'new', label: 'New', color: 'bg-slate-500', light: 'bg-slate-500/10 text-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500', light: 'bg-blue-500/10 text-blue-400' },
  { id: 'qualified', label: 'Qualified', color: 'bg-violet-500', light: 'bg-violet-500/10 text-violet-400' },
  { id: 'proposal_sent', label: 'Proposal', color: 'bg-amber-500', light: 'bg-amber-500/10 text-amber-400' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500', light: 'bg-orange-500/10 text-orange-400' },
  { id: 'won', label: 'Won', color: 'bg-emerald-500', light: 'bg-emerald-500/10 text-emerald-400' },
]

const STAGE_NEXT: Record<string, string> = {
  new: 'contacted',
  contacted: 'qualified',
  qualified: 'proposal_sent',
  proposal_sent: 'negotiation',
  negotiation: 'won',
}

const EVENT_INTERESTS = [
  'Wedding', 'Corporate Event', 'Conference', 'Birthday', 'Anniversary',
  'Concert', 'Exhibition', 'Product Launch', 'Award Show', 'Other'
]

const LEAD_SOURCES = ['Website', 'Referral', 'Instagram', 'LinkedIn', 'Google Ads', 'Walk-in', 'Phone', 'Other']

type Lead = {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  stage: string
  estimated_value: number
  event_interest?: string
  event_date?: string
  source?: string
  notes?: string
  created_at: string
  updated_at: string
  priority?: 'low' | 'medium' | 'high'
}

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

function LeadModal({ token, lead, onClose, onSaved }: {
  token: string; lead?: Lead | null; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: lead?.name ?? '', email: lead?.email ?? '', phone: lead?.phone ?? '',
    company: lead?.company ?? '', stage: lead?.stage ?? 'new',
    estimated_value: lead?.estimated_value ?? 0, event_interest: lead?.event_interest ?? '',
    event_date: lead?.event_date?.slice(0, 10) ?? '', source: lead?.source ?? '',
    priority: lead?.priority ?? 'medium', notes: lead?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const url = lead ? `${API}/crm/leads/${lead.id}` : `${API}/crm/leads`
      const r = await fetch(url, {
        method: lead ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_value: Number(form.estimated_value) }),
      })
      if (!r.ok) throw new Error('Failed to save')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{lead ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="John Doe" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="john@example.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Company</label>
              <input value={form.company} onChange={e => set('company', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estimated Value (INR)</label>
              <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="500000" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pipeline Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Event Interest</label>
              <select value={form.event_interest} onChange={e => set('event_interest', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select type</option>
                {EVENT_INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Event Date</label>
              <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lead Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select source</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {lead ? 'Save Changes' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LeadDetail({ lead, token, onClose, onUpdate }: {
  lead: Lead; token: string; onClose: () => void; onUpdate: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'notes'>('overview')
  const [editing, setEditing] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const stage = STAGES.find(s => s.id === lead.stage)
  const nextStageId = STAGE_NEXT[lead.stage]
  const nextStage = STAGES.find(s => s.id === nextStageId)

  const advanceStage = async () => {
    if (!nextStageId) return
    setAdvancing(true)
    try {
      await fetch(`${API}/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStageId }),
      })
      onUpdate()
    } finally { setAdvancing(false) }
  }

  const deleteLead = async () => {
    if (!confirm('Delete this lead?')) return
    await fetch(`${API}/crm/leads/${lead.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onClose(); onUpdate()
  }

  const priorityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10', medium: 'text-amber-400 bg-amber-500/10', low: 'text-slate-400 bg-slate-500/10',
  }

  return (
    <>
      {editing && <LeadModal token={token} lead={lead} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onUpdate() }} />}
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {lead.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
            {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', stage?.light)}>{stage?.label}</span>
              {lead.priority && <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', priorityColors[lead.priority])}>{lead.priority}</span>}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={deleteLead} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {nextStage && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border">
            <button onClick={advanceStage} disabled={advancing}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-primary hover:text-primary/80">
              {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Move to {nextStage.label}
            </button>
          </div>
        )}
        {lead.stage === 'won' && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-border text-center">
            <span className="text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Deal Won!
            </span>
          </div>
        )}

        <div className="flex border-b border-border px-4">
          {(['overview', 'notes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('py-2.5 px-3 text-xs font-medium capitalize border-b-2 transition-colors',
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'overview' && (
            <>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Estimated Value</p>
                <p className="text-xl font-bold text-primary">{formatINR(lead.estimated_value)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</p>
                {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" />{lead.email}</a>}
                {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground"><Phone className="w-3.5 h-3.5" />{lead.phone}</a>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Details</p>
                {lead.event_interest && <div className="flex items-center gap-2 text-sm"><Tag className="w-3.5 h-3.5 text-muted-foreground" /><span>{lead.event_interest}</span></div>}
                {lead.event_date && <div className="flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><span>{new Date(lead.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                {lead.source && <div className="flex items-center gap-2 text-sm"><Tag className="w-3.5 h-3.5 text-muted-foreground" /><span>via {lead.source}</span></div>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pipeline</p>
                <div className="flex items-center gap-1">
                  {STAGES.map((s, i) => {
                    const stageIdx = STAGES.findIndex(st => st.id === lead.stage)
                    const done = i <= stageIdx
                    return (
                      <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                        <div className={cn('h-1.5 w-full rounded-full', done ? s.color : 'bg-border')} />
                        <span className={cn('text-[9px]', done ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created {timeAgo(lead.created_at)}</p>
                <p>Updated {timeAgo(lead.updated_at)}</p>
              </div>
            </>
          )}
          {tab === 'notes' && (
            lead.notes
              ? <div className="bg-background border border-border rounded-lg p-3 text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</div>
              : <div className="text-center py-10"><MessageSquare className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No notes yet</p></div>
          )}
        </div>
      </div>
    </>
  )
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const dotColor: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-slate-400' }
  return (
    <div onClick={onClick} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40 transition-all space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
        {lead.priority && <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', dotColor[lead.priority])} />}
      </div>
      {lead.event_interest && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Tag className="w-3 h-3" />{lead.event_interest}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary">{formatINR(lead.estimated_value)}</span>
        {lead.event_date && <span className="text-[10px] text-muted-foreground">{new Date(lead.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
      </div>
      <p className="text-[10px] text-muted-foreground">{timeAgo(lead.created_at)}</p>
    </div>
  )
}

export default function CrmPage() {
  const { token } = useAuth()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  const { data: leadsData, loading, refetch } = useApi<{ data: Lead[]; total: number }>('/crm/leads', token ?? '')
  const leads: Lead[] = leadsData?.data ?? []

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return (!q || l.name.toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q) || (l.company ?? '').toLowerCase().includes(q))
      && (stageFilter === 'all' || l.stage === stageFilter)
      && (sourceFilter === 'all' || l.source === sourceFilter)
  })

  const totalPipeline = leads.reduce((s, l) => s + l.estimated_value, 0)
  const wonDeals = leads.filter(l => l.stage === 'won')
  const wonValue = wonDeals.reduce((s, l) => s + l.estimated_value, 0)
  const highPriority = leads.filter(l => l.priority === 'high').length
  const convRate = leads.length > 0 ? Math.round((wonDeals.length / leads.length) * 100) : 0

  const stageLeads = (sid: string) => filtered.filter(l => l.stage === sid)
  const stageValue = (sid: string) => stageLeads(sid).reduce((s, l) => s + l.estimated_value, 0)

  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find(l => l.id === selectedLead.id)
      if (updated) setSelectedLead(updated)
    }
  }, [leads])

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
          <div>
            <h1 className="font-semibold text-sm">CRM & Sales Pipeline</h1>
            <p className="text-[10px] text-muted-foreground">{leads.length} leads · {formatINR(totalPipeline)} pipeline</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search leads..." />
            </div>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
              <option value="all">All Stages</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
              <option value="all">All Sources</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView('kanban')} className={cn('px-2 py-1.5', view === 'kanban' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:bg-accent')}><BarChart2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setView('list')} className={cn('px-2 py-1.5', view === 'list' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:bg-accent')}><FileText className="w-3.5 h-3.5" /></button>
            </div>
            <a href="/crm/proposals"
              className="h-8 px-3 border border-border text-muted-foreground hover:text-foreground hover:border-white/20 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors">
              <FileText className="w-3.5 h-3.5" /> Proposals
            </a>
            <button onClick={() => setShowCreate(true)}
              className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-border border-b border-border shrink-0">
          {[
            { label: 'Total Pipeline', value: formatINR(totalPipeline), icon: TrendingUp, color: 'text-blue-400' },
            { label: 'Won Value', value: formatINR(wonValue), icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Conv. Rate', value: `${convRate}%`, icon: Target, color: 'text-violet-400' },
            { label: 'High Priority', value: String(highPriority), icon: AlertCircle, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-card px-4 py-3 flex items-center gap-3">
              <stat.icon className={cn('w-4 h-4', stat.color)} />
              <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-sm font-bold">{stat.value}</p></div>
            </div>
          ))}
        </div>

        {/* Board */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : view === 'kanban' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full gap-0 min-w-max">
              {STAGES.map(stage => {
                const cards = stageLeads(stage.id)
                return (
                  <div key={stage.id} className="w-60 flex flex-col border-r border-border last:border-r-0">
                    <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', stage.color)} />
                        <span className="text-xs font-semibold">{stage.label}</span>
                        <span className="text-[10px] text-muted-foreground bg-accent rounded px-1 py-0.5">{cards.length}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatINR(stageValue(stage.id))}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {cards.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />)}
                      {cards.length === 0 && <p className="text-center text-xs text-muted-foreground/50 py-6">No leads</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>{['Name', 'Stage', 'Event', 'Value', 'Source', 'Priority', 'Updated'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const stage = STAGES.find(s => s.id === lead.stage)
                  const pc: Record<string, string> = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-slate-400' }
                  return (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="border-b border-border hover:bg-accent/50 cursor-pointer">
                      <td className="px-4 py-3"><p className="text-sm font-medium">{lead.name}</p>{lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}</td>
                      <td className="px-4 py-3"><span className={cn('text-xs px-1.5 py-0.5 rounded', stage?.light)}>{stage?.label}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.event_interest ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-primary">{formatINR(lead.estimated_value)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.source ?? '—'}</td>
                      <td className="px-4 py-3">{lead.priority && <span className={cn('text-xs capitalize', pc[lead.priority])}>{lead.priority}</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(lead.updated_at)}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No leads found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="w-80 border-l border-border shrink-0 flex flex-col">
          <LeadDetail lead={selectedLead} token={token ?? ''} onClose={() => setSelectedLead(null)} onUpdate={refetch} />
        </div>
      )}
      {showCreate && <LeadModal token={token ?? ''} onClose={() => setShowCreate(false)} onSaved={refetch} />}
    </div>
  )
}
