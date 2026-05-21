'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LifeBuoy, Plus, Search, Filter, RefreshCw, ChevronRight,
  AlertTriangle, Clock, CheckCircle2, XCircle, ArrowUpRight,
  MessageSquare, User, Tag, Zap, BookOpen, Star, BarChart3,
  Flame, TrendingUp, AlertCircle, Circle, Inbox, Activity,
  Shield, ThumbsUp, ThumbsDown, Send, Lock, Unlock, ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'pending_client' | 'resolved' | 'closed' | 'cancelled'
type Priority = 'critical' | 'high' | 'medium' | 'low'

interface Ticket {
  id: string
  ticket_number: string
  title: string
  description?: string
  status: TicketStatus
  priority: Priority
  category?: { name: string; color: string }
  reporter_name?: string
  reporter_email?: string
  reporter_type: string
  assigned_to?: string
  assignee?: { full_name: string; avatar_url?: string }
  event_id?: string
  sla_breached: boolean
  response_sla_breached: boolean
  first_response_due?: string
  resolution_due?: string
  first_response_at?: string
  resolved_at?: string
  satisfaction_score?: number
  tags: string[]
  created_at: string
  updated_at: string
  _comment_count?: [{ count: number }]
}

interface KbArticle {
  id: string
  title: string
  slug: string
  summary?: string
  status: 'draft' | 'published' | 'archived'
  is_public: boolean
  view_count: number
  helpful_count: number
  not_helpful_count: number
  tags: string[]
  category?: { name: string; color: string }
  author?: { full_name: string }
  published_at?: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function slaCountdown(iso: string): { label: string; urgent: boolean; breached: boolean } {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return { label: 'Breached', urgent: true, breached: true }
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const urgent = diff < 2 * 3600000
  if (hrs > 0) return { label: `${hrs}h ${mins}m`, urgent, breached: false }
  return { label: `${mins}m`, urgent: true, breached: false }
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open:           { label: 'Open',           icon: Circle,       color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  in_progress:    { label: 'In Progress',    icon: Activity,     color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  pending_client: { label: 'Pending Client', icon: Clock,        color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  resolved:       { label: 'Resolved',       icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  closed:         { label: 'Closed',         icon: XCircle,      color: 'text-white/30',    bg: 'bg-white/5' },
  cancelled:      { label: 'Cancelled',      icon: XCircle,      color: 'text-white/20',    bg: 'bg-white/5' },
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-400',    dot: 'bg-red-500' },
  high:     { label: 'High',     color: 'text-orange-400', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'text-amber-400',  dot: 'bg-amber-500' },
  low:      { label: 'Low',      color: 'text-white/40',   dot: 'bg-white/20' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function SlaBadge({ due, breached }: { due?: string; breached?: boolean }) {
  if (!due) return null
  const { label, urgent, breached: slaBreached } = slaCountdown(due)
  const isBad = breached || slaBreached
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
      isBad ? 'bg-red-500/20 text-red-400' :
      urgent ? 'bg-amber-500/20 text-amber-400' :
      'bg-white/5 text-white/30'
    }`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= score ? 'text-amber-400 fill-amber-400' : 'text-white/15'}`}
        />
      ))}
    </div>
  )
}

// ─── Ticket Row ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const commentCount = ticket._comment_count?.[0]?.count ?? 0
  const isSlaBreached = ticket.sla_breached || ticket.response_sla_breached

  return (
    <div
      onClick={onClick}
      className={`border-b border-white/[0.04] px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors group ${
        isSlaBreached ? 'border-l-2 border-l-red-500/60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Priority dot */}
        <div className="mt-1 shrink-0">
          <span className={`w-2 h-2 rounded-full block ${PRIORITY_CONFIG[ticket.priority].dot}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] text-white/30 font-mono">{ticket.ticket_number}</span>
                {isSlaBreached && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">
                    <Flame className="w-2.5 h-2.5" />
                    SLA Breached
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-white/90 group-hover:text-white truncate">{ticket.title}</p>
              {ticket.description && (
                <p className="text-xs text-white/35 mt-0.5 line-clamp-1">{ticket.description}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 mt-1 transition-colors" />
          </div>

          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.category && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ background: ticket.category.color + '22', color: ticket.category.color }}
              >
                {ticket.category.name}
              </span>
            )}
            {ticket.resolution_due && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <SlaBadge due={ticket.resolution_due} breached={ticket.sla_breached} />
            )}
            <span className="text-[10px] text-white/25 ml-auto flex items-center gap-3">
              {ticket.assignee && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {ticket.assignee.full_name}
                </span>
              )}
              {commentCount > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {commentCount}
                </span>
              )}
              {ticket.satisfaction_score && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {ticket.satisfaction_score}/5
                </span>
              )}
              <span>{timeAgo(ticket.created_at)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ticket Detail Panel ──────────────────────────────────────────────────────

function TicketDetail({
  ticket,
  onClose,
  onComment,
}: {
  ticket: Ticket
  onClose: () => void
  onComment: (ticketId: string, body: string, isInternal: boolean) => Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-[#0f172a] border-l border-white/[0.08] flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-white/30 font-mono">{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            {(ticket.sla_breached || ticket.response_sla_breached) && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <Flame className="w-2.5 h-2.5" /> SLA Breached
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold text-white leading-snug">{ticket.title}</h2>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white p-1 rounded transition-colors shrink-0">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Meta grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-white/[0.06]">
          {[
            { label: 'Priority', value: <PriorityBadge priority={ticket.priority} /> },
            { label: 'Category', value: ticket.category
              ? <span style={{ color: ticket.category.color }} className="text-xs">{ticket.category.name}</span>
              : <span className="text-xs text-white/30">—</span> },
            { label: 'Reporter', value: <span className="text-xs text-white/70">{ticket.reporter_name ?? '—'}</span> },
            { label: 'Assignee', value: <span className="text-xs text-white/70">{ticket.assignee?.full_name ?? 'Unassigned'}</span> },
            { label: 'Response SLA', value: <SlaBadge due={ticket.first_response_due} breached={ticket.response_sla_breached} /> },
            { label: 'Resolution SLA', value: <SlaBadge due={ticket.resolution_due} breached={ticket.sla_breached} /> },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
              {value}
            </div>
          ))}
        </div>

        {/* Description */}
        {ticket.description && (
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-white/70 leading-relaxed">{ticket.description}</p>
          </div>
        )}

        {/* Tags */}
        {ticket.tags.length > 0 && (
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-white/20" />
            {ticket.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[11px] text-white/40">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Satisfaction */}
        {ticket.satisfaction_score && (
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
            <span className="text-[11px] text-white/30">Client Satisfaction</span>
            <StarRating score={ticket.satisfaction_score} />
            <span className="text-xs text-amber-400">{ticket.satisfaction_score}/5</span>
          </div>
        )}

        {/* Activity timeline (mock) */}
        <div className="px-5 py-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Activity</p>
          <div className="space-y-4">
            {/* Mocked activity items */}
            {[
              { icon: Plus, text: 'Ticket created', time: ticket.created_at, color: 'text-blue-400' },
              ...(ticket.first_response_at ? [{ icon: MessageSquare, text: 'First response sent', time: ticket.first_response_at, color: 'text-emerald-400' }] : []),
              ...(ticket.resolved_at ? [{ icon: CheckCircle2, text: 'Ticket resolved', time: ticket.resolved_at, color: 'text-emerald-400' }] : []),
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}>
                  <item.icon className="w-3 h-3" />
                </div>
                <div>
                  <p className="text-xs text-white/70">{item.text}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{timeAgo(item.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment box */}
      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsInternal(false)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${!isInternal ? 'bg-indigo-600/30 text-indigo-300' : 'text-white/30 hover:text-white/60'}`}
          >
            <Send className="w-3 h-3" /> Reply
          </button>
          <button
            onClick={() => setIsInternal(true)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${isInternal ? 'bg-amber-600/30 text-amber-300' : 'text-white/30 hover:text-white/60'}`}
          >
            <Lock className="w-3 h-3" /> Internal Note
          </button>
        </div>
        <div className={`rounded-lg border ${isInternal ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.08] bg-white/[0.03]'} p-3`}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={isInternal ? 'Add an internal note (not visible to client)…' : 'Write a reply…'}
            rows={3}
            className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 resize-none outline-none"
          />
          <div className="flex justify-end mt-2">
            <button
              disabled={!comment.trim() || sending}
              onClick={async () => {
                if (!comment.trim()) return
                setSending(true)
                await onComment(ticket.id, comment.trim(), isInternal)
                setComment('')
                setSending(false)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                comment.trim() && !sending
                  ? isInternal ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {sending ? 'Sending…' : isInternal ? 'Add Note' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'inbox' | 'all' | 'kb' | 'agents'

const STATUS_FILTERS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'open', label: 'Open', icon: Circle },
  { key: 'in_progress', label: 'In Progress', icon: Activity },
  { key: 'pending_client', label: 'Pending Client', icon: Clock },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
]

export default function SupportPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('inbox')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [showNewTicket, setShowNewTicket] = useState(false)

  // ── API state ──────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [kb, setKb] = useState<KbArticle[]>([])
  const [agentStats, setAgentStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [tk, kb_, ag] = await Promise.all([
        fetch(`${API}/support/tickets?limit=200`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/support/kb`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/support/agents/stats`, { headers: h }).then(r => r.ok ? r.json() : []),
      ])
      setTickets(Array.isArray(tk) ? tk : (tk.data ?? []))
      setKb(Array.isArray(kb_) ? kb_ : (kb_.data ?? []))
      setAgentStats(Array.isArray(ag) ? ag : (ag.data ?? []))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadAll() }, [loadAll])

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    if (!token) return
    const res = await fetch(`${API}/support/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as TicketStatus } : t))
      setSelectedTicket(prev => prev?.id === id ? { ...prev, status: status as TicketStatus } : prev)
    }
  }, [token])

  const handleComment = useCallback(async (ticketId: string, body: string, isInternal: boolean) => {
    if (!token) return
    await fetch(`${API}/support/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body, is_internal: isInternal }),
    })
  }, [token])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const open = tickets.filter(t => t.status === 'open').length
  const inProgress = tickets.filter(t => t.status === 'in_progress').length
  const slaBreached = tickets.filter(t => t.sla_breached || t.response_sla_breached).length
  const resolvedToday = tickets.filter(t => t.resolved_at &&
    new Date(t.resolved_at).toDateString() === new Date().toDateString()).length

  // Filter tickets
  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inboxTickets = tickets.filter(t =>
    t.status !== 'resolved' && t.status !== 'closed' && t.status !== 'cancelled'
  ).sort((a, b) => {
    // Sort: breached first, then by priority, then by created_at
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    if ((a.sla_breached || a.response_sla_breached) && !(b.sla_breached || b.response_sla_breached)) return -1
    if (!(a.sla_breached || a.response_sla_breached) && (b.sla_breached || b.response_sla_breached)) return 1
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const TABS: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: inboxTickets.length },
    { key: 'all', label: 'All Tickets', icon: LifeBuoy },
    { key: 'kb', label: 'Knowledge Base', icon: BookOpen },
    { key: 'agents', label: 'Agent Stats', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div>
          <h1 className="text-xl font-semibold text-white">Support & Ticketing</h1>
          <p className="text-xs text-white/40 mt-0.5">Internal operations support desk</p>
        </div>
        <div className="flex items-center gap-3">
          {slaBreached > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400 font-medium">{slaBreached} SLA Breach{slaBreached > 1 ? 'es' : ''}</span>
            </div>
          )}
          <button
            onClick={() => setShowNewTicket(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="border-b border-white/[0.06] px-8 py-3 grid grid-cols-4 divide-x divide-white/[0.06]">
        {[
          { label: 'Open', value: open, icon: Circle, color: 'text-blue-400' },
          { label: 'In Progress', value: inProgress, icon: Activity, color: 'text-amber-400' },
          { label: 'SLA Breached', value: slaBreached, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Resolved Today', value: resolvedToday, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-6 first:pl-0 last:pr-0">
            <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
              <p className="text-[11px] text-white/30">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-8 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-all ${
              tab === t.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                tab === t.key ? 'bg-indigo-600/40 text-indigo-300' : 'bg-white/10 text-white/30'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1">

        {/* ── INBOX ──────────────────────────────────────────────────────────── */}
        {tab === 'inbox' && (
          <div className="flex h-full">
            <div className={`${selectedTicket ? 'w-[calc(100%-520px)]' : 'w-full'} transition-all`}>
              {/* Priority sections */}
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                const group = inboxTickets.filter(t => t.priority === p)
                if (group.length === 0) return null
                const cfg = PRIORITY_CONFIG[p]
                return (
                  <div key={p}>
                    <div className="px-5 py-2.5 flex items-center gap-2 bg-white/[0.015] border-b border-white/[0.04]">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[11px] text-white/25 ml-1">({group.length})</span>
                    </div>
                    {group.map(ticket => (
                      <TicketRow
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)}
                      />
                    ))}
                  </div>
                )
              })}
              {inboxTickets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mb-4" />
                  <p className="text-white/40 text-sm font-medium">Inbox is clear</p>
                  <p className="text-white/20 text-xs mt-1">All tickets are resolved or closed</p>
                </div>
              )}
            </div>
            {selectedTicket && (
              <TicketDetail ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onComment={handleComment} />
            )}
          </div>
        )}

        {/* ── ALL TICKETS ─────────────────────────────────────────────────────── */}
        {tab === 'all' && (
          <div className="flex h-full">
            <div className={`${selectedTicket ? 'w-[calc(100%-520px)]' : 'w-full'} transition-all`}>
              {/* Filters */}
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search tickets…"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500/50"
                  />
                </div>

                {/* Status filter pills */}
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                  {STATUS_FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                        statusFilter === f.key
                          ? 'bg-indigo-600 text-white'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Priority filter */}
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/60 outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <span className="text-xs text-white/25 ml-auto">{filtered.length} tickets</span>
              </div>

              {/* Ticket list */}
              <div>
                {filtered.map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Inbox className="w-10 h-10 text-white/10 mb-3" />
                    <p className="text-white/30 text-sm">No tickets match your filters</p>
                  </div>
                )}
              </div>
            </div>
            {selectedTicket && (
              <TicketDetail ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onComment={handleComment} />
            )}
          </div>
        )}

        {/* ── KNOWLEDGE BASE ───────────────────────────────────────────────────── */}
        {tab === 'kb' && (
          <div className="px-8 py-6">
            {/* KB header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
                <p className="text-xs text-white/40 mt-0.5">{kb.length} articles · {kb.filter(a => a.status === 'published').length} published</p>
              </div>
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                <Plus className="w-4 h-4" />
                New Article
              </button>
            </div>

            {/* Article grid */}
            <div className="grid grid-cols-2 gap-4">
              {kb.map(article => {
                const helpful = article.helpful_count + article.not_helpful_count
                const helpfulPct = helpful > 0 ? Math.round((article.helpful_count / helpful) * 100) : null

                return (
                  <div
                    key={article.id}
                    className="bg-[#111] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            article.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' :
                            article.status === 'draft' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-white/10 text-white/30'
                          }`}>
                            {article.status}
                          </span>
                          {article.is_public && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                              <Unlock className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-white group-hover:text-white/90">{article.title}</h3>
                      </div>
                      <BookOpen className="w-4 h-4 text-white/20 shrink-0 mt-1" />
                    </div>

                    {article.summary && (
                      <p className="text-xs text-white/40 line-clamp-2 mb-3 leading-relaxed">{article.summary}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {article.category && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-medium"
                          style={{ background: article.category.color + '22', color: article.category.color }}
                        >
                          {article.category.name}
                        </span>
                      )}
                      {article.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-white/30 rounded">{tag}</span>
                      ))}
                      <span className="ml-auto flex items-center gap-3 text-[10px] text-white/25">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          {article.view_count} views
                        </span>
                        {helpfulPct !== null && (
                          <span className="flex items-center gap-1 text-emerald-400/70">
                            <ThumbsUp className="w-3 h-3" />
                            {helpfulPct}%
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── AGENT STATS ──────────────────────────────────────────────────────── */}
        {tab === 'agents' && (
          <div className="px-8 py-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Agent Performance</h2>
              <span className="text-xs text-white/30">Last 30 days</span>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Avg Resolution', value: '6.2h', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Avg Satisfaction', value: '4.4 / 5', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Tickets Resolved', value: '54', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'SLA Compliance', value: '87%', icon: Shield, color: 'text-violet-400', bg: 'bg-violet-500/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-[#111] border border-white/[0.06] rounded-xl p-4 flex gap-3 items-start">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{value}</p>
                    <p className="text-[11px] text-white/35">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Agent table */}
            <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <p className="text-sm font-medium text-white">Agent Leaderboard</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Agent', 'Open', 'Critical', 'Resolved (30d)', 'Avg Resolution', 'CSAT', 'Workload'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] text-white/30 font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map((agent: any, i: number) => (
                    <tr key={agent.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs font-semibold text-indigo-300">
                            {agent.name.charAt(0)}
                          </div>
                          <span className="text-sm text-white/80">{agent.name}</span>
                          {i === 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">🔥 Top</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60 font-medium">{agent.openTickets}</td>
                      <td className="px-4 py-3">
                        {agent.criticalTickets > 0 ? (
                          <span className="text-red-400 font-medium">{agent.criticalTickets}</span>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{agent.resolvedThisMonth}</td>
                      <td className="px-4 py-3 text-white/50">
                        {agent.avgResolutionHrs != null ? `${agent.avgResolutionHrs}h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {agent.avgSatisfaction != null ? (
                          <div className="flex items-center gap-1.5">
                            <StarRating score={Math.round(agent.avgSatisfaction)} />
                            <span className="text-xs text-amber-400">{agent.avgSatisfaction}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                agent.openTickets >= 5 ? 'bg-red-500' :
                                agent.openTickets >= 3 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (agent.openTickets / 8) * 100)}%` }}
                            />
                          </div>
                          <span className={`text-[11px] ${
                            agent.openTickets >= 5 ? 'text-red-400' :
                            agent.openTickets >= 3 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {agent.openTickets >= 5 ? 'High' : agent.openTickets >= 3 ? 'Normal' : 'Light'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">New Support Ticket</h2>
              <button onClick={() => setShowNewTicket(false)} className="text-white/30 hover:text-white transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Title *</label>
                <input
                  placeholder="Brief description of the issue…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Priority</label>
                  <select className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none">
                    <option>Medium</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Category</label>
                  <select className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none">
                    <option>Vendor Issue</option>
                    <option>Client Request</option>
                    <option>Event Operations</option>
                    <option>Finance & Billing</option>
                    <option>Staff & HR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Description</label>
                <textarea
                  placeholder="Describe the issue in detail…"
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Assign To</label>
                <select className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none">
                  <option value="">Unassigned</option>
                  <option>Rohan Mehta</option>
                  <option>Sneha Patel</option>
                  <option>Kiran Nair</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
