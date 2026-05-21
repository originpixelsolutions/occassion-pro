'use client'

/**
 * VendorMessageDrawer — slide-over panel for the staff↔vendor message thread
 * tied to a specific event assignment.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Send, Loader2, MessageSquare, AlertCircle, Building2,
  Tag, DollarSign, CheckCircle2, Clock, XCircle,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface Message {
  id: string
  sender_type: 'team' | 'vendor'
  sender_id: string | null
  content: string
  is_read_by_vendor: boolean
  is_read_by_team: boolean
  created_at: string
}

interface Assignment {
  id: string
  status: string
  service_description: string | null
  agreed_amount: number | null
  currency_code: string
  vendor_response_note: string | null
  responded_at: string | null
  vendor?: {
    name: string
    business_name: string | null
    email: string
    category: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  invited:     { label: 'Invited',     color: 'text-amber-400  bg-amber-500/10  border-amber-500/20',  icon: Clock },
  confirmed:   { label: 'Confirmed',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'text-blue-400   bg-blue-500/10   border-blue-500/20',   icon: Clock },
  completed:   { label: 'Completed',   color: 'text-zinc-300   bg-zinc-500/10   border-zinc-500/20',   icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'text-red-400    bg-red-500/10    border-red-500/20',    icon: XCircle },
  declined:    { label: 'Declined',    color: 'text-red-400    bg-red-500/10    border-red-500/20',    icon: XCircle },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  assignmentId: string
  onClose: () => void
}

export default function VendorMessageDrawer({ assignmentId, onClose }: Props) {
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [messages, setMessages]     = useState<Message[]>([])
  const [loading, setLoading]       = useState(true)
  const [content, setContent]       = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState('')
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/vendor-portal/staff/assignments/${assignmentId}/messages`,
        { credentials: 'include' }
      )
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? data)
    } catch {}
  }, [assignmentId])

  const loadAssignment = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/vendor-portal/staff/events/0/assignments`, // list then filter
        { credentials: 'include' }
      )
      // We'll rely on the message response to have context; attempt a broader fetch
    } catch {}
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadMessages()
      setLoading(false)
    }
    init()

    // Poll every 8 seconds
    pollRef.current = setInterval(loadMessages, 8_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadMessages])

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(
        `${API}/vendor-portal/staff/assignments/${assignmentId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: content.trim() }),
        }
      )
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to send message.')
        return
      }
      setContent('')
      await loadMessages()
    } catch {
      setError('Network error.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white leading-tight">Vendor Thread</h2>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">Assignment {assignmentId.slice(0, 8)}…</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No messages yet</p>
              <p className="text-xs text-zinc-600 mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map(msg => {
              const isTeam = msg.sender_type === 'team'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isTeam ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isTeam ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isTeam
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] ${isTeam ? 'text-zinc-500' : 'text-zinc-600'}`}>
                        {isTeam ? 'You (team)' : 'Vendor'}
                      </span>
                      <span className="text-[10px] text-zinc-600">·</span>
                      <span className="text-[11px] text-zinc-600">{formatTime(msg.created_at)}</span>
                      {isTeam && (
                        msg.is_read_by_vendor
                          ? <span className="text-[10px] text-emerald-500">Read</span>
                          : <span className="text-[10px] text-zinc-600">Sent</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Compose */}
        <form
          onSubmit={handleSend}
          className="px-4 py-3 border-t border-zinc-800 flex items-end gap-2 shrink-0"
        >
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e as any)
              }
            }}
            placeholder="Message the vendor… (Enter to send)"
            rows={2}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="w-9 h-9 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </form>
      </div>
    </>
  )
}
