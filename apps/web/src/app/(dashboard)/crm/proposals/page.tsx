'use client'

/**
 * OccasionPro — CRM Proposals
 *
 * Full proposals pipeline with status tracking.
 * Status flow: draft → sent → viewed → accepted | declined
 *
 * - List all proposals with status, value, client, event link
 * - Create new proposal (lead, event, title, value, valid until, notes)
 * - Filter by status
 * - Summary pipeline stats
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText, Plus, Search, X, ChevronDown, AlertCircle,
  Loader2, Clock, Send, Eye, CheckCircle2, XCircle,
  Calendar, DollarSign, Building2, ArrowLeft, RefreshCw,
  Sparkles, Tag, MoreHorizontal, FileSignature,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'

interface Proposal {
  id: string
  title: string
  status: ProposalStatus
  version: number
  total_amount: number | null
  currency: string
  valid_until: string | null
  notes: string | null
  lead_id: string | null
  event_id: string | null
  contact_id: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  decline_reason: string | null
  created_at: string
  // joined
  leads?: { id: string; name: string; stage: string } | null
  events?: { id: string; name: string } | null
  client_companies?: { id: string; name: string } | null
}

interface Lead {
  id: string
  name: string
  stage: string
}

interface Event {
  id: string
  name: string
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProposalStatus, {
  label: string
  badge: string
  icon: typeof Clock
  description: string
}> = {
  draft:    { label: 'Draft',    badge: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',     icon: FileText,     description: 'Not yet sent to client' },
  sent:     { label: 'Sent',     badge: 'text-blue-400   bg-blue-500/10   border-blue-500/20',     icon: Send,         description: 'Delivered to client' },
  viewed:   { label: 'Viewed',   badge: 'text-amber-400  bg-amber-500/10  border-amber-500/20',    icon: Eye,          description: 'Client has opened it' },
  accepted: { label: 'Accepted', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, description: 'Client accepted the proposal' },
  declined: { label: 'Declined', badge: 'text-red-400    bg-red-500/10    border-red-500/20',      icon: XCircle,      description: 'Client declined' },
}

const ALL_STATUSES: ProposalStatus[] = ['draft', 'sent', 'viewed', 'accepted', 'declined']

// ── Create Proposal Modal ─────────────────────────────────────────────────────

function CreateProposalModal({
  leads,
  events,
  token,
  onClose,
  onCreated,
}: {
  leads: Lead[]
  events: Event[]
  token: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    title: '',
    lead_id: '',
    event_id: '',
    total_amount: '',
    currency: 'INR',
    valid_until: '',
    notes: '',
    terms: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) { setError('Title is required.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          lead_id: form.lead_id || null,
          event_id: form.event_id || null,
          total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
          currency: form.currency,
          valid_until: form.valid_until || null,
          notes: form.notes || null,
          terms: form.terms || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create proposal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg bg-[#0f0f18] border border-border rounded-2xl shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <FileSignature className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="font-semibold text-sm">New Proposal</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Proposal Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Wedding Photography Package — Sharma Family"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            required
          />
        </div>

        {/* Lead + Event */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Link to Lead</label>
            <select
              value={form.lead_id}
              onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            >
              <option value="">None</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Link to Event</label>
            <select
              value={form.event_id}
              onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            >
              <option value="">None</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Total Amount</label>
            <input
              type="number"
              value={form.total_amount}
              onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            >
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Valid Until */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Valid Until</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="Scope summary, inclusions, what's special about this proposal…"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Proposal
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Proposal Card ─────────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const cfg = STATUS_CONFIG[proposal.status]
  const StatusIcon = cfg.icon

  const isExpired = proposal.valid_until
    ? new Date(proposal.valid_until) < new Date() && !['accepted', 'declined'].includes(proposal.status)
    : false

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-white/15 transition-all">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-violet-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{proposal.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.badge)}>
                  <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
                  {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground">v{proposal.version}</span>
                {isExpired && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-orange-400 bg-orange-500/10 border-orange-500/20 font-medium">
                    <AlertCircle className="w-3 h-3" /> Expired
                  </span>
                )}
              </div>
            </div>
            {proposal.total_amount != null && (
              <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                {formatCurrency(proposal.total_amount)}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            {proposal.leads && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Lead: {proposal.leads.name}
              </span>
            )}
            {proposal.events && (
              <Link
                href={`/events/${proposal.events.id}`}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {proposal.events.name}
              </Link>
            )}
            {proposal.valid_until && (
              <span className={cn('flex items-center gap-1', isExpired && 'text-orange-400')}>
                <Calendar className="w-3 h-3" />
                Valid until {formatDate(proposal.valid_until)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created {formatDate(proposal.created_at)}
            </span>
          </div>

          {/* Status timeline */}
          {(proposal.sent_at || proposal.viewed_at || proposal.accepted_at || proposal.declined_at) && (
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {proposal.sent_at && (
                <span className="flex items-center gap-1 text-blue-400/80">
                  <Send className="w-3 h-3" /> Sent {formatDate(proposal.sent_at)}
                </span>
              )}
              {proposal.viewed_at && (
                <span className="flex items-center gap-1 text-amber-400/80">
                  <Eye className="w-3 h-3" /> Viewed {formatDate(proposal.viewed_at)}
                </span>
              )}
              {proposal.accepted_at && (
                <span className="flex items-center gap-1 text-emerald-400/80">
                  <CheckCircle2 className="w-3 h-3" /> Accepted {formatDate(proposal.accepted_at)}
                </span>
              )}
              {proposal.declined_at && (
                <span className="flex items-center gap-1 text-red-400/80">
                  <XCircle className="w-3 h-3" /> Declined {formatDate(proposal.declined_at)}
                </span>
              )}
            </div>
          )}

          {proposal.notes && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">{proposal.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { token } = useAuth()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [propRes, leadRes, evtRes] = await Promise.all([
        fetch(`${API}/proposals`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/crm/leads?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/events?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const propData = await propRes.json()
      const leadData = await leadRes.json()
      const evtData  = await evtRes.json()
      setProposals(propData ?? [])
      setLeads(leadData.data ?? leadData ?? [])
      setEvents(evtData.data ?? evtData ?? [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const filtered = proposals.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.leads?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.events?.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = proposals.filter(p => p.status === s).length
    return acc
  }, {} as Record<ProposalStatus, number>)

  const totalAccepted = proposals
    .filter(p => p.status === 'accepted' && p.total_amount != null)
    .reduce((sum, p) => sum + (p.total_amount ?? 0), 0)

  const totalPending = proposals
    .filter(p => ['draft', 'sent', 'viewed'].includes(p.status) && p.total_amount != null)
    .reduce((sum, p) => sum + (p.total_amount ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/crm" className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> CRM
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Proposals</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-violet-400" />
            Proposals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {proposals.length} total
            {totalAccepted > 0 && ` · ${formatCurrency(totalAccepted)} accepted`}
            {totalPending > 0 && ` · ${formatCurrency(totalPending)} in pipeline`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Proposal
        </button>
      </div>

      {/* Status pipeline bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {ALL_STATUSES.map((s, idx) => {
            const scfg = STATUS_CONFIG[s]
            const SIcon = scfg.icon
            const isActive = filterStatus === s
            const pct = proposals.length > 0 ? Math.round((counts[s] / proposals.length) * 100) : 0
            return (
              <div key={s} className="flex items-center gap-1 min-w-0">
                <button
                  onClick={() => setFilterStatus(prev => prev === s ? 'all' : s)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all min-w-[80px] text-center',
                    isActive ? 'bg-violet-500/15 border border-violet-500/30' : 'hover:bg-white/5'
                  )}
                >
                  <SIcon className={cn('w-4 h-4', {
                    'text-zinc-400': s === 'draft',
                    'text-blue-400': s === 'sent',
                    'text-amber-400': s === 'viewed',
                    'text-emerald-400': s === 'accepted',
                    'text-red-400': s === 'declined',
                  })} />
                  <span className="text-base font-bold tabular-nums">{counts[s]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{scfg.label}</span>
                  {pct > 0 && <span className="text-xs text-muted-foreground/60">{pct}%</span>}
                </button>
                {idx < ALL_STATUSES.length - 1 && (
                  <ChevronDown className="w-3 h-3 text-muted-foreground/30 rotate-[-90deg] shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Search + filter controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search proposals, leads, events…"
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-xs focus:outline-none focus:border-violet-500/50 placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {filterStatus !== 'all' && (
          <button
            onClick={() => setFilterStatus('all')}
            className="flex items-center gap-1 px-2.5 py-2 border border-violet-500/40 rounded-xl text-xs text-violet-400 hover:bg-violet-500/10"
          >
            <X className="w-3 h-3" /> Clear filter
          </button>
        )}
        <button
          onClick={load}
          className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors ml-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Proposals list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
            <FileSignature className="w-6 h-6 text-violet-400" />
          </div>
          <p className="font-semibold">
            {proposals.length === 0 ? 'No proposals yet' : 'No proposals match your filter'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {proposals.length === 0
              ? 'Create your first proposal to start tracking client offers.'
              : 'Try changing the search or status filter.'}
          </p>
          {proposals.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Proposal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => <ProposalCard key={p.id} proposal={p} />)}
        </div>
      )}

      {showCreate && token && (
        <CreateProposalModal
          leads={leads}
          events={events}
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
