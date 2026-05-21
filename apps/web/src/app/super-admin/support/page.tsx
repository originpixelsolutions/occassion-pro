'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  HeadphonesIcon, RefreshCw, Filter, Search, ChevronRight,
  AlertCircle, Clock, CheckCircle2, Zap, Bot, Loader2, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') && key.includes('auth')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          return parsed?.access_token ?? parsed?.access_token ?? ''
        }
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

interface Ticket {
  id: string
  ticket_number: string
  title: string
  subject?: string
  description: string
  status: string
  priority: string
  tenant_id: string
  tenant?: { name: string }
  submitter?: { full_name: string; email: string }
  escalated_at: string | null
  bot_faq_id: string | null
  created_at: string
  updated_at: string
  _msg_count?: { count: number }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-500/20 text-blue-400',       dot: 'bg-blue-400' },
  bot_handled: { label: 'Bot Handled', color: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
  escalated:   { label: 'Escalated',   color: 'bg-amber-500/20 text-amber-400',     dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', color: 'bg-violet-500/20 text-violet-400',   dot: 'bg-violet-400' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-600/20 text-emerald-300', dot: 'bg-emerald-300' },
  closed:      { label: 'Closed',      color: 'bg-muted text-muted-foreground',     dot: 'bg-muted-foreground' },
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-slate-400', medium: 'text-blue-400', high: 'text-amber-400',
  urgent: 'text-red-400', critical: 'text-red-500',
}

const STATUS_TABS = [
  { value: '',            label: 'All' },
  { value: 'open',        label: 'Open' },
  { value: 'escalated',   label: 'Escalated' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function SuperAdminSupportPage() {
  const router = useRouter()
  const [tickets, setTickets]         = useState<Ticket[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatus]     = useState('')
  const [priorityFilter, setPriority] = useState('')
  const [search, setSearch]           = useState('')
  const [refreshing, setRefreshing]   = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter)   params.set('status',   statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      const data = await apiFetch(`/super-admin/support/tickets?${params}`)
      setTickets(data)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [statusFilter, priorityFilter])

  useEffect(() => { load() }, [load])

  const filtered = tickets.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (t.title ?? t.subject ?? '').toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q) ||
      (t.tenant?.name ?? '').toLowerCase().includes(q) ||
      (t.submitter?.full_name ?? '').toLowerCase().includes(q)
    )
  })

  const counts = {
    open:        tickets.filter(t => t.status === 'open').length,
    escalated:   tickets.filter(t => t.status === 'escalated').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
  }

  function ageLabel(ts: string) {
    const hrs = (Date.now() - new Date(ts).getTime()) / 3600000
    if (hrs < 1) return `${Math.round(hrs * 60)}m`
    if (hrs < 24) return `${Math.round(hrs)}h`
    return `${Math.round(hrs / 24)}d`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <HeadphonesIcon className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Support Inbox</h1>
            <p className="text-xs text-muted-foreground">Platform-wide help tickets from all workspaces</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
        >
          <RefreshCw className={refreshing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
        </button>
      </div>

      {/* Summary chips */}
      <div className="shrink-0 px-6 py-3 flex gap-3 border-b border-border overflow-x-auto">
        {([
          { label: 'Open',        count: counts.open,        cls: 'text-blue-400 bg-blue-500/10' },
          { label: 'Escalated',   count: counts.escalated,   cls: 'text-amber-400 bg-amber-500/10' },
          { label: 'In Progress', count: counts.in_progress, cls: 'text-violet-400 bg-violet-500/10' },
          { label: 'Resolved',    count: counts.resolved,    cls: 'text-emerald-400 bg-emerald-500/10' },
        ] as const).map(s => (
          <div key={s.label} className={`shrink-0 px-3 py-1.5 rounded-lg flex items-center gap-2 ${s.cls}`}>
            <span className="text-lg font-bold leading-none">{s.count}</span>
            <span className="text-xs font-medium opacity-80">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-3 border-b border-border">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === t.value ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <select
          value={priorityFilter}
          onChange={e => setPriority(e.target.value)}
          className="px-2 py-1 bg-muted rounded-lg text-xs border border-border text-foreground focus:outline-none"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="pl-8 pr-3 py-1 bg-muted rounded-lg text-xs border border-border text-foreground placeholder:text-muted-foreground focus:outline-none w-44"
          />
        </div>
      </div>

      {/* Ticket table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <HeadphonesIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                {['Ticket','Workspace','Status','Priority','Age',''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open
                const msgCount = ticket._msg_count?.[0]?.count ?? 0
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => router.push(`/super-admin/support/${ticket.id}`)}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                        <div>
                          <p className="font-medium text-foreground group-hover:text-violet-400 transition-colors line-clamp-1">
                            {ticket.title ?? ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {ticket.ticket_number}{msgCount > 0 ? ` · ${msgCount} msg` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground/80">{ticket.tenant?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{ticket.submitter?.full_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_COLOR[ticket.priority] ?? 'text-foreground'}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ageLabel(ticket.created_at)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
