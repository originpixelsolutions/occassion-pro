'use client'

/**
 * WhatsApp Broadcast Dashboard — /events/[eventId]/whatsapp
 *
 * Tabs:
 *  1. Campaigns — list, create, send broadcast campaigns
 *  2. Inbox     — two-way message threads with guests
 *  3. Analytics — delivery/read/reply rates across campaigns
 *  4. Opt-outs  — manage opt-out list
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  MessageSquare, Send, Plus, Inbox, BarChart2, Users, X, Loader2,
  CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown, ChevronRight,
  Eye, Reply, Filter, Trash2, RefreshCw, Phone, UserMinus, MoreHorizontal,
  Megaphone, FileText, Zap, ArrowUpRight,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'campaigns' | 'inbox' | 'analytics' | 'opt-outs'
type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed'
type MessageType = 'template' | 'free_form'

interface Broadcast {
  id: string
  name: string
  description?: string
  message_type: MessageType
  template_name?: string
  body_text?: string
  audience_filter: Record<string, any>
  scheduled_at?: string
  sent_at?: string
  status: BroadcastStatus
  total_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  replied_count: number
  opted_out_count: number
  created_at: string
}

interface InboxThread {
  phone:        string
  contact_name: string
  guest_id?:    string
  last_message: string
  last_at:      string
  unread_count: number
  direction:    'inbound' | 'outbound'
}

interface InboxMessage {
  id:           string
  direction:    'inbound' | 'outbound'
  body:         string
  created_at:   string
  is_read:      boolean
}

interface OptOut {
  id:           string
  phone:        string
  opted_out_at: string
  source:       string
  notes?:       string
}

interface Analytics {
  totals: {
    total:     number
    sent:      number
    delivered: number
    read:      number
    replied:   number
    failed:    number
  }
  delivery_rate: number
  read_rate:     number
  reply_rate:    number
  broadcasts:    Broadcast[]
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<BroadcastStatus, { label: string; cls: string; dot: string }> = {
  draft:     { label: 'Draft',      cls: 'text-zinc-400 bg-zinc-800  border-zinc-700', dot: 'bg-zinc-500' },
  scheduled: { label: 'Scheduled',  cls: 'text-blue-400  bg-blue-900/30 border-blue-700', dot: 'bg-blue-400' },
  sending:   { label: 'Sending…',   cls: 'text-amber-400 bg-amber-900/30 border-amber-700', dot: 'bg-amber-400' },
  sent:      { label: 'Sent',       cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', dot: 'bg-emerald-400' },
  paused:    { label: 'Paused',     cls: 'text-yellow-400 bg-yellow-900/30 border-yellow-700', dot: 'bg-yellow-400' },
  cancelled: { label: 'Cancelled',  cls: 'text-zinc-500 bg-zinc-800 border-zinc-700', dot: 'bg-zinc-600' },
  failed:    { label: 'Failed',     cls: 'text-red-400 bg-red-900/30 border-red-700', dot: 'bg-red-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Create Broadcast Modal ───────────────────────────────────────────────────

interface CreateModalProps {
  eventId: string
  onClose: () => void
  onCreated: (b: Broadcast) => void
}

const TEMPLATES = [
  { id: 'event_invite',        label: '🎉 Event Invitation' },
  { id: 'rsvp_reminder',       label: '⏰ RSVP Reminder' },
  { id: 'event_reminder',      label: '📅 Event Day Reminder' },
  { id: 'guest_portal_access', label: '🔗 Guest Portal Access Link' },
  { id: 'payment_reminder',    label: '💰 Payment Reminder' },
  { id: 'thank_you',           label: '💛 Thank You (Post-Event)' },
]

const AUDIENCE_OPTIONS = [
  { value: 'all',           label: 'All guests' },
  { value: 'confirmed',     label: 'Confirmed RSVPs only' },
  { value: 'not_responded', label: 'Not yet responded' },
  { value: 'declined',      label: 'Declined RSVPs' },
  { value: 'vip',           label: 'VIP guests' },
]

function CreateBroadcastModal({ eventId, onClose, onCreated }: CreateModalProps) {
  const [step,         setStep]         = useState<1 | 2 | 3>(1)
  const [msgType,      setMsgType]      = useState<MessageType>('free_form')
  const [name,         setName]         = useState('')
  const [description,  setDescription]  = useState('')
  const [templateName, setTemplateName] = useState('')
  const [bodyText,     setBodyText]     = useState('')
  const [audience,     setAudience]     = useState('all')
  const [scheduledAt,  setScheduledAt]  = useState('')
  const [preview,      setPreview]      = useState<{ total: number; sample: any[] } | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function loadPreview() {
    setLoading(true)
    try {
      const filter = audience === 'all'
        ? { all: true }
        : audience === 'confirmed'   ? { rsvp_status: ['confirmed'] }
        : audience === 'not_responded' ? { rsvp_status: ['pending'] }
        : audience === 'declined'    ? { rsvp_status: ['declined'] }
        : { tags: ['vip'] }

      const res = await fetch(`${API}/whatsapp/broadcasts/preview-audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event_id: eventId, audience_filter: filter }),
      })
      if (res.ok) setPreview(await res.json())
    } catch { /* non-fatal */ } finally { setLoading(false) }
  }

  useEffect(() => { if (step === 2) loadPreview() }, [step]) // eslint-disable-line

  async function submit() {
    setLoading(true); setError('')
    try {
      const filter = audience === 'all'
        ? { all: true }
        : audience === 'confirmed'    ? { rsvp_status: ['confirmed'] }
        : audience === 'not_responded'? { rsvp_status: ['pending'] }
        : audience === 'declined'     ? { rsvp_status: ['declined'] }
        : { tags: ['vip'] }

      const res = await fetch(`${API}/whatsapp/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name, description: description || undefined,
          event_id: eventId,
          message_type: msgType,
          template_name: msgType === 'template' ? templateName : undefined,
          body_text: msgType === 'free_form' ? bodyText : undefined,
          audience_filter: filter,
          scheduled_at: scheduledAt || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.message ?? 'Failed'); return }
      onCreated(await res.json())
      onClose()
    } catch { setError('Network error.') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">New WhatsApp Broadcast</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4 min-h-[280px]">

          {/* Step 1 — Message content */}
          {step === 1 && (
            <>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Campaign name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Pre-event reminder — June 15"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-2 block">Message type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['free_form', 'template'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setMsgType(t)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                        msgType === t
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                      }`}
                    >
                      <span className="block text-base mb-0.5">{t === 'free_form' ? '✍️' : '📋'}</span>
                      {t === 'free_form' ? 'Custom message' : 'Approved template'}
                    </button>
                  ))}
                </div>
              </div>

              {msgType === 'free_form' ? (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Message body *</label>
                  <textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    rows={5}
                    placeholder={`Hello {{name}},

A reminder for tomorrow's event starting at 6 PM.

See you there! 🎉`}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-green-500 transition-colors"
                  />
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Use <code className="text-zinc-500">{'{{name}}'}</code> for guest name · {bodyText.length}/1000 chars
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Template *</label>
                  <select
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                  >
                    <option value="">Select a template…</option>
                    {TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Templates must be pre-approved in your Meta Business Manager account.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Audience */}
          {step === 2 && (
            <>
              <div>
                <label className="text-xs text-zinc-500 mb-2 block">Target audience</label>
                <div className="space-y-2">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setAudience(opt.value); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                        audience === opt.value
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        audience === opt.value ? 'border-green-500 bg-green-500' : 'border-zinc-600'
                      }`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {preview && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-xs text-zinc-400">
                    <span className="text-white font-semibold">{preview.total.toLocaleString()}</span> recipients will receive this broadcast
                    {preview.total > 0 && (
                      <span className="text-zinc-600 ml-1">
                        (e.g. {preview.sample.slice(0,3).map((s: any) => s.name).join(', ')}{preview.total > 3 ? '…' : ''})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 3 — Schedule & confirm */}
          {step === 3 && (
            <>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Schedule (optional — leave blank to send now)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-4 space-y-2.5 mt-2">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Broadcast Summary</p>
                {[
                  ['Campaign', name],
                  ['Type',     msgType === 'template' ? `Template: ${templateName}` : 'Custom message'],
                  ['Audience', AUDIENCE_OPTIONS.find(o => o.value === audience)?.label ?? audience],
                  ['Send',     scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Immediately'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs text-zinc-600">{k}</span>
                    <span className="text-xs text-zinc-300 text-right max-w-[55%] truncate">{v}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as any) : onClose()}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as any)}
              disabled={
                (step === 1 && (!name.trim() || (msgType === 'free_form' && !bodyText.trim()) || (msgType === 'template' && !templateName)))
              }
              className="flex items-center gap-1.5 px-5 py-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              {scheduledAt ? 'Schedule' : 'Send Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab({ eventId }: { eventId: string }) {
  const [broadcasts,    setBroadcasts]    = useState<Broadcast[]>([])
  const [loading,       setLoading]       = useState(true)
  const [creating,      setCreating]      = useState(false)
  const [sendingId,     setSendingId]     = useState<string | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/whatsapp/broadcasts?event_id=${eventId}`, { credentials: 'include' })
      if (res.ok) { const d = await res.json(); setBroadcasts(d.broadcasts ?? []) }
    } finally { setLoading(false) }
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function sendBroadcast(id: string) {
    setSendingId(id)
    try {
      await fetch(`${API}/whatsapp/broadcasts/${id}/send`, { method: 'POST', credentials: 'include' })
      await load()
    } finally { setSendingId(null) }
  }

  async function deleteBroadcast(id: string) {
    setDeletingId(id)
    try {
      await fetch(`${API}/whatsapp/broadcasts/${id}`, { method: 'DELETE', credentials: 'include' })
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    } finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Broadcast
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 text-center">
          <Megaphone className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-sm font-medium text-zinc-400">No broadcasts yet</p>
          <p className="text-xs text-zinc-600 mt-1">Create your first broadcast to reach all guests on WhatsApp</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {broadcasts.map(b => {
            const cfg = STATUS[b.status]
            const expanded = expandedId === b.id
            const deliveryRate = pct(b.delivered_count, b.sent_count)
            const readRate     = pct(b.read_count, b.sent_count)

            return (
              <div key={b.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                {/* Row header */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : b.id)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{b.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {b.message_type === 'template' ? `Template: ${b.template_name}` : (b.body_text ?? '').slice(0, 60) + ((b.body_text?.length ?? 0) > 60 ? '…' : '')}
                      </p>
                    </div>
                  </button>

                  <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border font-medium shrink-0 ${cfg.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>

                  {/* Stats summary */}
                  {b.status === 'sent' && (
                    <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500">
                      <span>{b.total_count.toLocaleString()} sent</span>
                      <span className="text-emerald-400">{deliveryRate}% delivered</span>
                      <span className="text-blue-400">{readRate}% read</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.status === 'draft' && (
                      <button
                        onClick={() => sendBroadcast(b.id)}
                        disabled={!!sendingId}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {sendingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Send
                      </button>
                    )}
                    {['draft', 'scheduled', 'failed', 'cancelled'].includes(b.status) && (
                      <button
                        onClick={() => deleteBroadcast(b.id)}
                        disabled={deletingId === b.id}
                        className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        {deletingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded delivery breakdown */}
                {expanded && b.status === 'sent' && (
                  <div className="px-4 pb-4 pt-0 border-t border-zinc-800/60">
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { label: 'Total',    val: b.total_count,     cls: 'text-white'         },
                        { label: 'Sent',     val: b.sent_count,      cls: 'text-zinc-300'      },
                        { label: 'Delivered',val: b.delivered_count, cls: 'text-emerald-400'   },
                        { label: 'Read',     val: b.read_count,      cls: 'text-blue-400'      },
                        { label: 'Replied',  val: b.replied_count,   cls: 'text-violet-400'    },
                        { label: 'Failed',   val: b.failed_count,    cls: 'text-red-400'       },
                      ].map(s => (
                        <div key={s.label} className="bg-zinc-900 rounded-xl px-3 py-2.5 text-center">
                          <p className={`text-lg font-bold ${s.cls}`}>{s.val.toLocaleString()}</p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Mini progress bars */}
                    <div className="mt-3 space-y-2">
                      {[
                        { label: 'Delivery rate', val: deliveryRate, cls: 'bg-emerald-500' },
                        { label: 'Read rate',      val: readRate,    cls: 'bg-blue-500'    },
                        { label: 'Reply rate',     val: pct(b.replied_count, b.sent_count), cls: 'bg-violet-500' },
                      ].map(p => (
                        <div key={p.label} className="flex items-center gap-2">
                          <p className="text-[11px] text-zinc-500 w-24 shrink-0">{p.label}</p>
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className={`h-full rounded-full ${p.cls}`} style={{ width: `${p.val}%` }} />
                          </div>
                          <p className="text-[11px] text-zinc-400 w-8 text-right shrink-0">{p.val}%</p>
                        </div>
                      ))}
                    </div>

                    {b.sent_at && (
                      <p className="text-[11px] text-zinc-600 mt-3">
                        Sent {new Date(b.sent_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <CreateBroadcastModal
          eventId={eventId}
          onClose={() => setCreating(false)}
          onCreated={b => { setBroadcasts(prev => [b, ...prev]); setCreating(false) }}
        />
      )}
    </div>
  )
}

// ─── Inbox Tab ────────────────────────────────────────────────────────────────

function InboxTab({ eventId }: { eventId: string }) {
  const [threads,       setThreads]       = useState<InboxThread[]>([])
  const [activePhone,   setActivePhone]   = useState<string | null>(null)
  const [messages,      setMessages]      = useState<InboxMessage[]>([])
  const [replyText,     setReplyText]     = useState('')
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API}/whatsapp/inbox?event_id=${eventId}`, { credentials: 'include' })
        if (res.ok) { const d = await res.json(); setThreads(d.threads ?? []) }
      } finally { setLoading(false) }
    })()
  }, [eventId])

  async function openThread(phone: string) {
    setActivePhone(phone)
    const res = await fetch(`${API}/whatsapp/inbox/${encodeURIComponent(phone)}/thread`, { credentials: 'include' })
    if (res.ok) { const d = await res.json(); setMessages(d.messages ?? []) }
    // Mark thread as read in UI
    setThreads(prev => prev.map(t => t.phone === phone ? { ...t, unread_count: 0 } : t))
  }

  async function sendReply() {
    if (!activePhone || !replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`${API}/whatsapp/inbox/${encodeURIComponent(activePhone)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: replyText, event_id: eventId }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => [...prev, msg])
        setReplyText('')
      }
    } finally { setSending(false) }
  }

  const totalUnread = threads.reduce((n, t) => n + t.unread_count, 0)

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Thread list */}
      <div className="w-72 flex-shrink-0 border border-zinc-800 rounded-2xl overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950 px-3 py-3 border-b border-zinc-800">
          <p className="text-xs font-medium text-zinc-400">
            Inbox {totalUnread > 0 && <span className="ml-1 px-1.5 py-0.5 bg-green-600 text-white rounded-full text-[10px]">{totalUnread}</span>}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-4 h-4 text-zinc-500 animate-spin" /></div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <Inbox className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500">No replies yet</p>
          </div>
        ) : (
          threads.map(t => (
            <button
              key={t.phone}
              onClick={() => openThread(t.phone)}
              className={`w-full px-3 py-3 flex items-start gap-2.5 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors text-left ${
                activePhone === t.phone ? 'bg-zinc-900' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center text-xs font-semibold text-green-400 shrink-0">
                {(t.contact_name?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-white truncate">{t.contact_name || t.phone}</p>
                  <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(t.last_at)}</span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                  {t.direction === 'inbound' ? '' : '↑ '}{t.last_message}
                </p>
              </div>
              {t.unread_count > 0 && (
                <span className="w-4 h-4 bg-green-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold shrink-0">
                  {t.unread_count}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Message thread */}
      <div className="flex-1 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
        {!activePhone ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center text-xs font-semibold text-green-400">
                {(threads.find(t => t.phone === activePhone)?.contact_name?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-white">
                  {threads.find(t => t.phone === activePhone)?.contact_name || activePhone}
                </p>
                <p className="text-[11px] text-zinc-600">{activePhone}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    msg.direction === 'outbound'
                      ? 'bg-green-700 text-white rounded-tr-sm'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-green-300' : 'text-zinc-500'}`}>
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="px-4 py-3 border-t border-zinc-800 flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                rows={2}
                placeholder="Type a reply… (Enter to send)"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-green-500 transition-colors"
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="p-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors disabled:opacity-50 shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ eventId }: { eventId: string }) {
  const [data,    setData]    = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API}/whatsapp/analytics?event_id=${eventId}`, { credentials: 'include' })
        if (res.ok) setData(await res.json())
      } finally { setLoading(false) }
    })()
  }, [eventId])

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
  if (!data)   return <div className="text-sm text-zinc-500 text-center py-12">No analytics data available</div>

  const { totals } = data

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent',     val: totals.sent.toLocaleString(),      sub: `of ${totals.total}`,     cls: 'text-white'       },
          { label: 'Delivery Rate',  val: `${data.delivery_rate}%`,           sub: `${totals.delivered} delivered`, cls: 'text-emerald-400' },
          { label: 'Read Rate',      val: `${data.read_rate}%`,               sub: `${totals.read} opened`,       cls: 'text-blue-400'    },
          { label: 'Reply Rate',     val: `${data.reply_rate}%`,              sub: `${totals.replied} replies`,   cls: 'text-violet-400'  },
        ].map(k => (
          <div key={k.label} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-4">
            <p className={`text-2xl font-bold ${k.cls}`}>{k.val}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-zinc-700 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Rate bars */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Funnel Performance</p>
        {[
          { label: 'Messages Sent',     val: totals.sent,      total: totals.total,     cls: 'bg-zinc-500' },
          { label: 'Delivered',         val: totals.delivered, total: totals.sent,      cls: 'bg-emerald-500' },
          { label: 'Read',              val: totals.read,      total: totals.sent,      cls: 'bg-blue-500' },
          { label: 'Replied',           val: totals.replied,   total: totals.sent,      cls: 'bg-violet-500' },
        ].map(p => (
          <div key={p.label} className="flex items-center gap-3">
            <p className="text-xs text-zinc-500 w-32 shrink-0">{p.label}</p>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full ${p.cls}`} style={{ width: `${pct(p.val, p.total)}%` }} />
            </div>
            <p className="text-xs text-zinc-400 w-20 text-right shrink-0">
              {p.val.toLocaleString()} ({pct(p.val, p.total)}%)
            </p>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      {data.broadcasts.length > 0 && (
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recent Broadcasts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Name', 'Status', 'Sent', 'Delivered', 'Read', 'Replied'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.broadcasts.map(b => {
                  const cfg = STATUS[b.status]
                  return (
                    <tr key={b.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-white">{b.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{b.sent_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-emerald-400">{pct(b.delivered_count, b.sent_count)}%</td>
                      <td className="px-4 py-3 text-xs text-blue-400">{pct(b.read_count, b.sent_count)}%</td>
                      <td className="px-4 py-3 text-xs text-violet-400">{pct(b.replied_count, b.sent_count)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Opt-outs Tab ─────────────────────────────────────────────────────────────

function OptOutsTab() {
  const [optOuts,   setOptOuts]   = useState<OptOut[]>([])
  const [loading,   setLoading]   = useState(true)
  const [phone,     setPhone]     = useState('')
  const [notes,     setNotes]     = useState('')
  const [adding,    setAdding]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/whatsapp/opt-outs`, { credentials: 'include' })
      if (res.ok) { const d = await res.json(); setOptOuts(d.opt_outs ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addOptOut() {
    if (!phone.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`${API}/whatsapp/opt-outs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, notes }),
      })
      if (res.ok) { setPhone(''); setNotes(''); await load() }
    } finally { setAdding(false) }
  }

  async function reOptIn(p: string) {
    await fetch(`${API}/whatsapp/opt-outs/${encodeURIComponent(p)}/re-opt-in`, { method: 'PATCH', credentials: 'include' })
    await load()
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Manually add opt-out</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">Phone number</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <button
            onClick={addOptOut}
            disabled={adding || !phone.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-4 h-4 text-zinc-500 animate-spin" /></div>
      ) : optOuts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-700 mb-2" />
          <p className="text-sm text-zinc-500">No opt-outs registered</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                {['Phone', 'Source', 'Date', 'Notes', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {optOuts.map(o => (
                <tr key={o.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-white font-mono">{o.phone}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 capitalize">
                      {o.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(o.opted_out_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{o.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => reOptIn(o.phone)}
                      className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                      Re-opt in
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const params  = useParams<{ eventId: string }>()
  const eventId = params?.eventId ?? ''
  const [tab, setTab] = useState<Tab>('campaigns')

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'campaigns',  label: 'Campaigns', icon: Megaphone      },
    { id: 'inbox',      label: 'Inbox',     icon: Inbox          },
    { id: 'analytics',  label: 'Analytics', icon: BarChart2      },
    { id: 'opt-outs',   label: 'Opt-outs',  icon: UserMinus      },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-green-900/40 border border-green-800/50 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-green-400" />
            </div>
            <h1 className="text-lg font-semibold text-white">WhatsApp Broadcasts</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Send bulk WhatsApp messages to guests, track delivery, and manage two-way conversations.
          </p>
        </div>

        {/* Provider status pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-900/20 border border-green-800/40 text-xs text-green-400 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Meta Cloud API
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'campaigns'  && <CampaignsTab  eventId={eventId} />}
      {tab === 'inbox'      && <InboxTab       eventId={eventId} />}
      {tab === 'analytics'  && <AnalyticsTab   eventId={eventId} />}
      {tab === 'opt-outs'   && <OptOutsTab />}
    </div>
  )
}
