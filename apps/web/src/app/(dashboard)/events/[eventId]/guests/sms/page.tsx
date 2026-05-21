'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  MessageSquare,
  Send,
  Clock,
  CheckCheck,
  X,
  ChevronDown,
  Inbox,
  BarChart2,
  Plus,
  RefreshCw,
  Filter,
  Users,
  Smartphone,
  TrendingUp,
  AlertCircle,
  Ban,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'

interface Broadcast {
  id: string
  name: string
  message: string
  status: BroadcastStatus
  total_recipients: number
  sent_count: number
  delivered_count: number
  failed_count: number
  reply_count: number
  optout_count: number
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
  segment_filters: Record<string, any>
}

interface Reply {
  id: string
  from_phone: string
  from_name: string | null
  body: string
  is_read: boolean
  is_optout: boolean
  received_at: string
  broadcast_id: string | null
}

interface BroadcastStats {
  broadcast: Broadcast
  statusCounts: Record<string, number>
  deliveryRate: number
  replyCount: number
  unreadReplies: number
  optoutCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BroadcastStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',     color: 'text-zinc-400 bg-zinc-800',        icon: <Clock className="w-3 h-3" /> },
  scheduled: { label: 'Scheduled', color: 'text-amber-400 bg-amber-500/10',   icon: <Clock className="w-3 h-3" /> },
  sending:   { label: 'Sending…',  color: 'text-blue-400 bg-blue-500/10',     icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  sent:      { label: 'Sent',      color: 'text-emerald-400 bg-emerald-500/10', icon: <CheckCheck className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'text-zinc-500 bg-zinc-800',        icon: <X className="w-3 h-3" /> },
  failed:    { label: 'Failed',    color: 'text-red-400 bg-red-500/10',       icon: <AlertCircle className="w-3 h-3" /> },
}

const SEGMENT_OPTIONS = {
  rsvp_status:       { label: 'RSVP Status',     options: ['confirmed', 'pending', 'declined', 'tentative'] },
  accommodation_type:{ label: 'Accommodation',   options: ['hotel', 'guesthouse', 'self-arranged', 'none'] },
  dietary_requirement:{ label: 'Dietary',        options: ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free'] },
  guest_category:    { label: 'Guest Category',  options: ['VIP', 'Family', 'Friend', 'Colleague', 'Vendor'] },
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DeliveryRing({ rate }: { rate: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, rate))
  const dash = (pct / 100) * circ
  const color = pct >= 90 ? '#34d399' : pct >= 70 ? '#fbbf24' : '#f87171'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fill={color} fontWeight="700">{pct}%</text>
    </svg>
  )
}

// ─── Compose Form ─────────────────────────────────────────────────────────────

function ComposeForm({
  eventId,
  onCreated,
}: {
  eventId: string
  onCreated: (b: Broadcast) => void
}) {
  const api = useApi()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [unicode, setUnicode] = useState(false)
  const [segFilters, setSegFilters] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const charCount = message.length
  const smsSegments = unicode
    ? Math.ceil(charCount / 70)
    : Math.ceil(charCount / 160)

  function toggleSegOption(key: string, val: string) {
    setSegFilters(prev => {
      const cur = prev[key] ?? []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      if (next.length === 0) {
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })
  }

  async function handleSave(andSend = false) {
    if (!name.trim() || !message.trim()) {
      setError('Name and message are required')
      return
    }
    setError('')
    setSaving(true)
    try {
      const broadcast = await api.post('/api/v1/sms/broadcasts', {
        event_id: eventId,
        name: name.trim(),
        message: message.trim(),
        unicode,
        segment_filters: segFilters,
        scheduled_at: scheduledAt || undefined,
      })
      onCreated(broadcast)
      if (andSend) {
        await api.post(`/api/v1/sms/broadcasts/${broadcast.id}/send`, {})
      }
      setName('')
      setMessage('')
      setScheduledAt('')
      setSegFilters({})
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create broadcast')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Broadcast Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Day-1 arrival reminder"
          className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Message */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-400">Message</label>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className={charCount > (unicode ? 1540 : 1600) ? 'text-red-400' : ''}>{charCount} chars</span>
            <span>~{smsSegments} {smsSegments === 1 ? 'segment' : 'segments'}</span>
            <button
              onClick={() => setUnicode(!unicode)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${unicode ? 'border-violet-500/50 text-violet-400 bg-violet-500/10' : 'border-zinc-700 text-zinc-500'}`}
            >
              Unicode
            </button>
          </div>
        </div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          placeholder="Type your message here…"
          className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors resize-none"
        />
      </div>

      {/* Segment filters */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">
          Audience Filters <span className="text-zinc-600 font-normal">(empty = all guests)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SEGMENT_OPTIONS).map(([key, cfg]) => (
            <div key={key} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
              <p className="text-xs font-medium text-zinc-400 mb-2">{cfg.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {cfg.options.map(opt => {
                  const active = (segFilters[key] ?? []).includes(opt)
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleSegOption(key, opt)}
                      className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        active
                          ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Schedule (optional) <span className="text-zinc-600 font-normal">— leave blank to send immediately</span>
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !message.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {saving ? 'Sending…' : 'Send Now'}
        </button>
      </div>
    </div>
  )
}

// ─── Broadcast Card ───────────────────────────────────────────────────────────

function BroadcastCard({
  broadcast,
  onSend,
  onCancel,
  onSelect,
}: {
  broadcast: Broadcast
  onSend: (id: string) => void
  onCancel: (id: string) => void
  onSelect: (b: Broadcast) => void
}) {
  const cfg = STATUS_CONFIG[broadcast.status]
  const deliveryRate = broadcast.sent_count > 0
    ? Math.round((broadcast.delivered_count / broadcast.sent_count) * 100)
    : 0

  return (
    <div
      className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 cursor-pointer transition-all group"
      onClick={() => onSelect(broadcast)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{broadcast.name}</h3>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{broadcast.message}</p>
        </div>
        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {broadcast.total_recipients.toLocaleString()} recipients
        </span>
        {broadcast.sent_count > 0 && (
          <>
            <span className="text-emerald-400">{broadcast.delivered_count} delivered</span>
            {broadcast.failed_count > 0 && <span className="text-red-400">{broadcast.failed_count} failed</span>}
            {broadcast.reply_count > 0 && <span className="text-blue-400">{broadcast.reply_count} replies</span>}
            {broadcast.optout_count > 0 && <span className="text-zinc-600">{broadcast.optout_count} opt-outs</span>}
          </>
        )}
      </div>

      {/* Delivery rate bar */}
      {broadcast.status === 'sent' && broadcast.sent_count > 0 && (
        <div className="mb-3">
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-1">{deliveryRate}% delivery rate</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {broadcast.sent_at ? `Sent ${fmt(broadcast.sent_at)}` : `Created ${fmt(broadcast.created_at)}`}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {broadcast.status === 'draft' && (
            <>
              <button
                onClick={() => onSend(broadcast.id)}
                className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Send
              </button>
              <button
                onClick={() => onCancel(broadcast.id)}
                className="px-2.5 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stats Drawer ─────────────────────────────────────────────────────────────

function StatsDrawer({ broadcast, onClose }: { broadcast: Broadcast; onClose: () => void }) {
  const api = useApi()
  const [stats, setStats] = useState<BroadcastStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/v1/sms/broadcasts/${broadcast.id}/stats`)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [broadcast.id])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{broadcast.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Delivery ring */}
            <div className="flex items-center gap-5 p-4 rounded-xl bg-zinc-800/60">
              <DeliveryRing rate={stats.deliveryRate} />
              <div className="flex-1 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-white">{stats.broadcast.sent_count}</p>
                  <p className="text-xs text-zinc-500">Sent</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-400">{stats.broadcast.delivered_count}</p>
                  <p className="text-xs text-zinc-500">Delivered</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-400">{stats.broadcast.failed_count}</p>
                  <p className="text-xs text-zinc-500">Failed</p>
                </div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="p-4 rounded-xl bg-zinc-800/40">
              <p className="text-xs font-medium text-zinc-400 mb-3">Status Breakdown</p>
              <div className="space-y-2">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-zinc-500 capitalize">{status}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${stats.broadcast.total_recipients > 0 ? (count / stats.broadcast.total_recipients) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-white w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Replies', value: stats.replyCount, color: 'text-blue-400' },
                { label: 'Unread', value: stats.unreadReplies, color: 'text-amber-400' },
                { label: 'Opt-outs', value: stats.optoutCount, color: 'text-zinc-500' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-zinc-800/40 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Message preview */}
            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Message</p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{broadcast.message}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 text-center py-8">Could not load stats</p>
        )}
      </div>
    </div>
  )
}

// ─── Replies Inbox ────────────────────────────────────────────────────────────

function RepliesInbox({ eventId }: { eventId: string }) {
  const api = useApi()
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/v1/sms/replies?unread_only=${unreadOnly}`)
      setReplies(data ?? [])
    } catch {
      setReplies([])
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    await api.patch(`/api/v1/sms/replies/${id}/read`, {})
    setReplies(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              unreadOnly ? 'border-violet-500/50 text-violet-400 bg-violet-500/10' : 'border-zinc-700 text-zinc-400'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Unread only
          </button>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Inbox className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No replies yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {replies.map(reply => (
            <div
              key={reply.id}
              className={`p-4 rounded-xl border transition-all ${
                reply.is_read
                  ? 'bg-zinc-900 border-zinc-800'
                  : 'bg-zinc-800/60 border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-white">
                      {reply.from_name ?? reply.from_phone}
                    </span>
                    {reply.from_name && (
                      <span className="text-xs text-zinc-600">{reply.from_phone}</span>
                    )}
                    {reply.is_optout && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <Ban className="w-3 h-3" />
                        Opt-out
                      </span>
                    )}
                    {!reply.is_read && (
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-300">{reply.body}</p>
                  <p className="text-xs text-zinc-600 mt-1">{fmt(reply.received_at)}</p>
                </div>
                {!reply.is_read && (
                  <button
                    onClick={() => markRead(reply.id)}
                    className="shrink-0 p-1.5 rounded hover:bg-zinc-700 text-zinc-500 transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'compose' | 'broadcasts' | 'replies'

export default function SmsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const api = useApi()

  const [tab, setTab] = useState<Tab>('broadcasts')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const loadBroadcasts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/v1/sms/broadcasts?event_id=${eventId}`)
      setBroadcasts(data ?? [])
    } catch {
      setBroadcasts([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { loadBroadcasts() }, [loadBroadcasts])

  async function handleSend(broadcastId: string) {
    setSending(broadcastId)
    try {
      await api.post(`/api/v1/sms/broadcasts/${broadcastId}/send`, {})
      await loadBroadcasts()
    } catch (e: any) {
      alert(e?.message ?? 'Send failed')
    } finally {
      setSending(null)
    }
  }

  async function handleCancel(broadcastId: string) {
    if (!confirm('Cancel this broadcast?')) return
    await api.post(`/api/v1/sms/broadcasts/${broadcastId}/cancel`, {})
    await loadBroadcasts()
  }

  function handleCreated(b: Broadcast) {
    setBroadcasts(prev => [b, ...prev])
    setTab('broadcasts')
  }

  // Summary stats
  const totalSent = broadcasts.reduce((s, b) => s + b.sent_count, 0)
  const totalDelivered = broadcasts.reduce((s, b) => s + b.delivered_count, 0)
  const totalReplies = broadcasts.reduce((s, b) => s + b.reply_count, 0)
  const overallDeliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'broadcasts', label: 'Broadcasts', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'compose',   label: 'Compose',    icon: <Plus className="w-3.5 h-3.5" /> },
    { id: 'replies',   label: 'Replies',     icon: <Inbox className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="font-semibold text-white">SMS Broadcasts</h1>
              <p className="text-xs text-zinc-500">Send targeted SMS to your guests</p>
            </div>
          </div>
          <button
            onClick={loadBroadcasts}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Broadcasts', value: broadcasts.length, icon: <MessageSquare className="w-4 h-4" />, color: 'text-white' },
            { label: 'SMS Sent',   value: totalSent.toLocaleString(),       icon: <Send className="w-4 h-4" />,    color: 'text-blue-400' },
            { label: 'Delivered',  value: totalDelivered.toLocaleString(),  icon: <CheckCheck className="w-4 h-4" />, color: 'text-emerald-400' },
            { label: 'Delivery %', value: `${overallDeliveryRate}%`,        icon: <TrendingUp className="w-4 h-4" />, color: 'text-violet-400' },
          ].map(k => (
            <div key={k.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                {k.icon}
                <span className="text-xs">{k.label}</span>
              </div>
              <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-zinc-800">
        <div className="flex items-center gap-1 -mb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'compose' && (
          <div className="max-w-2xl">
            <ComposeForm eventId={eventId} onCreated={handleCreated} />
          </div>
        )}

        {tab === 'broadcasts' && (
          <div className="max-w-3xl space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-zinc-800 animate-pulse" />
              ))
            ) : broadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm mb-4">No broadcasts yet</p>
                <button
                  onClick={() => setTab('compose')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create your first broadcast
                </button>
              </div>
            ) : (
              broadcasts.map(b => (
                <BroadcastCard
                  key={b.id}
                  broadcast={b}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  onSelect={setSelectedBroadcast}
                />
              ))
            )}
          </div>
        )}

        {tab === 'replies' && <RepliesInbox eventId={eventId} />}
      </div>

      {/* Stats drawer */}
      {selectedBroadcast && (
        <StatsDrawer
          broadcast={selectedBroadcast}
          onClose={() => setSelectedBroadcast(null)}
        />
      )}
    </div>
  )
}
