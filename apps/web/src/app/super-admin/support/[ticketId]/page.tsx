'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Send, CheckCircle2, Loader2, Bot, User,
  HeadphonesIcon, Building2, Calendar, Tag, AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') && key.includes('auth')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const p = JSON.parse(raw)
          return p?.access_token ?? p?.access_token ?? ''
        }
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

interface Message {
  id: string
  ticket_id: string
  sender_type: 'user' | 'bot' | 'super_admin'
  sender_id: string | null
  message: string
  created_at: string
}

interface Ticket {
  id: string
  ticket_number: string
  title: string
  subject?: string
  description: string
  status: string
  priority: string
  tenant?: { name: string }
  submitter?: { full_name: string; email: string }
  bot_faq_id: string | null
  escalated_at: string | null
  resolution_notes: string | null
  super_admin_notes: string | null
  created_at: string
  updated_at: string
  support_messages: Message[]
}

const STATUS_OPTIONS = [
  'open', 'bot_handled', 'escalated', 'in_progress', 'resolved', 'closed'
]

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-blue-500/20 text-blue-400',
  bot_handled: 'bg-emerald-500/20 text-emerald-400',
  escalated:   'bg-amber-500/20 text-amber-400',
  in_progress: 'bg-violet-500/20 text-violet-400',
  resolved:    'bg-emerald-600/20 text-emerald-300',
  closed:      'bg-muted text-muted-foreground',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-slate-400', medium: 'text-blue-400',
  high: 'text-amber-400', urgent: 'text-red-400',
}

export default function SuperAdminTicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.ticketId as string

  const [ticket, setTicket]               = useState<Ticket | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [loading, setLoading]             = useState(true)
  const [replyText, setReplyText]         = useState('')
  const [sending, setSending]             = useState(false)
  const [resolveNotes, setResolveNotes]   = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolving, setResolving]         = useState(false)
  const [statusChange, setStatusChange]   = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch(`/super-admin/support/tickets`)
      // Find this ticket in the list (full endpoint is /support/help/:id which requires tenant scope)
      // For super admin, we call the general list and filter, or use the per-ticket endpoint
      const t = (data as Ticket[]).find(t => t.id === ticketId)
      if (t) {
        setTicket(t)
        setMessages(t.support_messages ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [ticketId])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    if (!ticketId) return
    const ch = supabase
      .channel(`sa_ticket_${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'support_messages', filter: `ticket_id=eq.${ticketId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [ticketId])

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true)
    try {
      await apiFetch(`/super-admin/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText }),
      })
      setReplyText('')
      await load()
    } finally {
      setSending(false)
    }
  }

  async function resolveTicket() {
    setResolving(true)
    try {
      await apiFetch(`/super-admin/support/tickets/${ticketId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: resolveNotes }),
      })
      setShowResolveForm(false)
      await load()
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Ticket not found</p>
        <button onClick={() => router.back()} className="text-sm text-violet-400 hover:underline">← Go back</button>
      </div>
    )
  }

  const sc = STATUS_COLOR[ticket.status] ?? 'bg-muted text-muted-foreground'
  const resolved = ['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Message thread (left/main) ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-border flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{ticket.title ?? ticket.subject}</p>
            <p className="text-xs text-muted-foreground font-mono">{ticket.ticket_number}</p>
          </div>
          <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${sc}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Original description as first "user" message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-muted/40 rounded-xl rounded-tl-sm px-4 py-3 flex-1 max-w-[80%]">
              <p className="text-xs font-semibold text-foreground/60 mb-1.5">
                {ticket.submitter?.full_name ?? 'User'} · Original request
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {new Date(ticket.created_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Subsequent messages */}
          {messages.map(msg => {
            const isUser  = msg.sender_type === 'user'
            const isBot   = msg.sender_type === 'bot'
            const isAdmin = msg.sender_type === 'super_admin'

            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isBot ? 'bg-violet-600' : isAdmin ? 'bg-blue-600' : 'bg-muted'
                }`}>
                  {isBot   ? <Bot className="w-4 h-4 text-white" /> :
                   isAdmin ? <HeadphonesIcon className="w-4 h-4 text-white" /> :
                             <User className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className={`max-w-[75%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                  isUser  ? 'bg-violet-600/20 text-foreground rounded-tr-sm' :
                  isAdmin ? 'bg-blue-600/20 text-foreground rounded-tl-sm border border-blue-500/20' :
                            'bg-muted/40 text-foreground/90 rounded-tl-sm'
                }`}>
                  {isAdmin && <p className="text-[10px] text-blue-400 font-semibold mb-1">You (Support Team)</p>}
                  {isBot   && <p className="text-[10px] text-violet-400 font-semibold mb-1">Bot Response</p>}
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1.5 ${isUser ? 'text-right text-white/50' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Resolve form */}
        {showResolveForm && (
          <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/10">
            <p className="text-sm font-medium text-foreground mb-2">Resolution notes</p>
            <textarea
              value={resolveNotes}
              onChange={e => setResolveNotes(e.target.value)}
              rows={3}
              placeholder="Describe how this was resolved…"
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowResolveForm(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={resolveTicket}
                disabled={resolving}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Resolved
              </button>
            </div>
          </div>
        )}

        {/* Reply box */}
        {!resolved && (
          <div className="shrink-0 px-4 py-3 border-t border-border flex gap-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
              placeholder="Reply to user…"
              disabled={sending}
              className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={() => setShowResolveForm(v => !v)}
              className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={sendReply}
              disabled={!replyText.trim() || sending}
              className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
        {resolved && (
          <p className="text-xs text-center text-muted-foreground py-3 border-t border-border shrink-0">
            Ticket resolved{ticket.resolution_notes ? `: ${ticket.resolution_notes}` : '.'}
          </p>
        )}
      </div>

      {/* ── Right sidebar: ticket metadata ── */}
      <div className="w-64 shrink-0 border-l border-border overflow-y-auto p-5 flex flex-col gap-5">
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-3">Ticket Info</p>
          <div className="flex flex-col gap-3">
            <InfoRow icon={Building2} label="Workspace" value={ticket.tenant?.name ?? '—'} />
            <InfoRow icon={User}      label="Submitted by" value={ticket.submitter?.full_name ?? '—'} />
            <InfoRow icon={Calendar}  label="Created"
              value={new Date(ticket.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })} />
            {ticket.escalated_at && (
              <InfoRow icon={AlertCircle} label="Escalated"
                value={new Date(ticket.escalated_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short',
                })} />
            )}
          </div>
        </div>

        {/* Priority badge */}
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-2">Priority</p>
          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${PRIORITY_COLOR[ticket.priority] ?? 'text-foreground'} bg-muted/40`}>
            {ticket.priority}
          </span>
        </div>

        {/* Bot answered? */}
        {ticket.bot_faq_id && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <Bot className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-300">Bot answered this ticket automatically.</p>
          </div>
        )}

        {/* Resolution notes */}
        {ticket.resolution_notes && (
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-2">Resolution</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{ticket.resolution_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground font-medium">{value}</p>
      </div>
    </div>
  )
}
