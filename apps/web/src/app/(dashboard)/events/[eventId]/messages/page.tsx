'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  MessageSquare, Plus, Search, Send, ChevronLeft, Megaphone, Pin,
  Trash2, Users, Check, CheckCheck, Clock, Loader2, AlertCircle,
  Broadcast, Bell, X, Filter, Hash, Lock, Globe,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Thread {
  id: string
  subject: string
  thread_type: 'internal' | 'client' | 'vendor' | 'broadcast'
  status: 'open' | 'resolved' | 'archived'
  participants: string[]
  last_message_at: string
  message_count: [{ count: number }]
  created_by_profile?: { id: string; full_name: string; avatar_url?: string }
}

interface Message {
  id: string
  thread_id: string
  sender_id?: string
  sender_name?: string
  message: string
  message_type: 'text' | 'system' | 'file'
  attachments: any[]
  is_read_by: string[]
  reply_to_id?: string
  created_at: string
  sender?: { id: string; full_name: string; avatar_url?: string }
}

interface Announcement {
  id: string
  title: string
  body: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_pinned: boolean
  expires_at?: string
  created_at: string
  created_by_profile?: { full_name: string }
}

interface Broadcast {
  id: string
  title: string
  message: string
  audience: string
  channels: string[]
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  sent_at?: string
  sent_count: number
  created_at: string
}

const THREAD_TYPE_CONFIG = {
  internal: { label: 'Internal', icon: Lock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  client:   { label: 'Client',   icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  vendor:   { label: 'Vendor',   icon: Hash, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  broadcast:{ label: 'Broadcast',icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'text-zinc-400  bg-zinc-500/10  border-zinc-500/20' },
  normal: { label: 'Normal', color: 'text-blue-400  bg-blue-500/10  border-blue-500/20' },
  high:   { label: 'High',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  urgent: { label: 'Urgent', color: 'text-red-400   bg-red-500/10   border-red-500/20' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Avatar({ name, size = 8 }: { name?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-${size} h-${size} rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0`}>
      <span className="text-xs font-semibold text-violet-400">{initials}</span>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type ActiveTab = 'threads' | 'announcements' | 'broadcasts'

export default function MessagesPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { token, tenantId, profile } = useAuth()

  const [activeTab, setActiveTab] = useState<ActiveTab>('threads')
  const [threads, setThreads] = useState<Thread[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [showNewThread, setShowNewThread] = useState(false)
  const [showNewBroadcast, setShowNewBroadcast] = useState(false)
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const hdrs = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId ?? '',
  }), [token, tenantId])

  const loadThreads = useCallback(async () => {
    if (!token || !tenantId) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/v1/messaging/threads?event_id=${eventId}`, { headers: hdrs() })
      if (res.ok) setThreads(await res.json())
    } finally { setLoading(false) }
  }, [token, tenantId, eventId, hdrs])

  const loadAnnouncements = useCallback(async () => {
    if (!token || !tenantId) return
    const res = await fetch(`${API}/v1/messaging/announcements?event_id=${eventId}`, { headers: hdrs() })
    if (res.ok) setAnnouncements(await res.json())
  }, [token, tenantId, eventId, hdrs])

  const loadBroadcasts = useCallback(async () => {
    if (!token || !tenantId) return
    const res = await fetch(`${API}/v1/messaging/broadcasts?event_id=${eventId}`, { headers: hdrs() })
    if (res.ok) setBroadcasts(await res.json())
  }, [token, tenantId, eventId, hdrs])

  useEffect(() => { loadThreads(); loadAnnouncements(); loadBroadcasts() }, [loadThreads, loadAnnouncements, loadBroadcasts])

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread)
    const res = await fetch(`${API}/v1/messaging/threads/${thread.id}/messages`, { headers: hdrs() })
    if (res.ok) setMessages(await res.json())
    // Mark read
    if (profile?.id) {
      fetch(`${API}/v1/messaging/threads/${thread.id}/read`, {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({ profile_id: profile.id }),
      })
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || !selectedThread) return
    setSending(true)
    try {
      const res = await fetch(`${API}/v1/messaging/threads/${selectedThread.id}/messages`, {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({
          sender_id: profile?.id,
          sender_name: profile?.full_name,
          message: newMsg.trim(),
          event_id: eventId,
        }),
      })
      if (res.ok) {
        const msg: Message = await res.json()
        setMessages(prev => [...prev, msg])
        setNewMsg('')
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } finally { setSending(false) }
  }

  const filteredThreads = threads.filter(t => {
    const matchSearch = !search || t.subject.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || t.thread_type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <h1 className="text-lg font-semibold">Communication Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewAnnouncement(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Pin className="w-3.5 h-3.5" /> Announcement
          </button>
          <button
            onClick={() => setShowNewBroadcast(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" /> Broadcast
          </button>
          <button
            onClick={() => setShowNewThread(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> New Thread
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 flex gap-1 border-b border-border/40 flex-shrink-0">
        {(['threads', 'announcements', 'broadcasts'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-violet-600/10 text-violet-400 border-b-2 border-violet-500'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'threads' && threads.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{threads.length}</span>
            )}
            {tab === 'announcements' && announcements.filter(a => a.is_pinned).length > 0 && (
              <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5">{announcements.filter(a => a.is_pinned).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* ── Threads Tab ── */}
        {activeTab === 'threads' && (
          <>
            {/* Thread list */}
            <div className={`flex-shrink-0 ${selectedThread ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border/60 overflow-hidden`}>
              {/* Search + filter */}
              <div className="p-3 space-y-2 border-b border-border/40">
                <div className="flex items-center gap-2 bg-muted/50 border border-border/40 rounded-lg px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search threads…"
                    className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {['all', 'internal', 'client', 'vendor'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors capitalize ${
                        typeFilter === t
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-400'
                          : 'bg-muted/50 border-border/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No threads yet</p>
                    <button
                      onClick={() => setShowNewThread(true)}
                      className="mt-3 text-xs text-violet-400 hover:text-violet-300"
                    >
                      Start a conversation
                    </button>
                  </div>
                ) : (
                  filteredThreads.map(thread => {
                    const tc = THREAD_TYPE_CONFIG[thread.thread_type]
                    const Icon = tc.icon
                    const msgCount = thread.message_count?.[0]?.count ?? 0
                    return (
                      <button
                        key={thread.id}
                        onClick={() => openThread(thread)}
                        className={`w-full text-left p-4 border-b border-border/30 hover:bg-muted/30 transition-colors ${
                          selectedThread?.id === thread.id ? 'bg-violet-600/5 border-l-2 border-l-violet-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${tc.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${tc.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-medium text-foreground truncate">{thread.subject}</p>
                              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(thread.last_message_at ?? thread.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${tc.bg} ${tc.color}`}>{tc.label}</span>
                              {msgCount > 0 && <span className="text-xs text-muted-foreground">{msgCount} msg{msgCount !== 1 ? 's' : ''}</span>}
                              {thread.status !== 'open' && (
                                <span className="text-xs text-muted-foreground capitalize">{thread.status}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Message pane */}
            {selectedThread ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Thread header */}
                <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => setSelectedThread(null)} className="md:hidden p-1 text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${THREAD_TYPE_CONFIG[selectedThread.thread_type].bg}`}>
                    {(() => { const Icon = THREAD_TYPE_CONFIG[selectedThread.thread_type].icon; return <Icon className={`w-3.5 h-3.5 ${THREAD_TYPE_CONFIG[selectedThread.thread_type].color}`} /> })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedThread.subject}</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedThread.thread_type} · {selectedThread.status}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Start the conversation below</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.sender_id === profile?.id
                      const senderName = msg.sender?.full_name ?? msg.sender_name ?? 'Unknown'
                      return (
                        <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && <Avatar name={senderName} size={7} />}
                          <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!isMe && <p className="text-xs text-muted-foreground px-1">{senderName}</p>}
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? 'bg-violet-600 text-white rounded-tr-sm'
                                : 'bg-card border border-border/60 text-foreground rounded-tl-sm'
                            }`}>
                              {msg.message}
                            </div>
                            <p className="text-xs text-muted-foreground/60 px-1">{timeAgo(msg.created_at)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send box */}
                <form onSubmit={sendMessage} className="px-4 py-3 border-t border-border/60 flex items-center gap-3 flex-shrink-0">
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 bg-muted/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!newMsg.trim() || sending}
                    className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground">Select a thread to view messages</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Announcements Tab ── */}
        {activeTab === 'announcements' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Pin className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground">No announcements yet</p>
                <button onClick={() => setShowNewAnnouncement(true)} className="mt-3 text-sm text-amber-400 hover:text-amber-300">
                  Create first announcement
                </button>
              </div>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className={`bg-card/60 border rounded-2xl p-5 ${
                  ann.is_pinned ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {ann.is_pinned && <Pin className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      <h3 className="font-semibold text-foreground">{ann.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_CONFIG[ann.priority].color}`}>
                        {PRIORITY_CONFIG[ann.priority].label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(ann.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ann.body}</p>
                  {ann.created_by_profile && (
                    <p className="text-xs text-muted-foreground/60 mt-3">By {ann.created_by_profile.full_name}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Broadcasts Tab ── */}
        {activeTab === 'broadcasts' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {broadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Megaphone className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground">No broadcasts yet</p>
                <button onClick={() => setShowNewBroadcast(true)} className="mt-3 text-sm text-emerald-400 hover:text-emerald-300">
                  Send first broadcast
                </button>
              </div>
            ) : (
              broadcasts.map(bc => (
                <div key={bc.id} className="bg-card/60 border border-border/60 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{bc.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        bc.status === 'sent' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                        bc.status === 'scheduled' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                        bc.status === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                      }`}>{bc.status}</span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(bc.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{bc.message}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">To: <span className="text-foreground capitalize">{bc.audience.replace(/_/g, ' ')}</span></span>
                    <span className="text-xs text-muted-foreground">Via: {bc.channels.join(', ')}</span>
                    {bc.status === 'sent' && <span className="text-xs text-emerald-400">{bc.sent_count} delivered</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── New Thread Modal ── */}
      {showNewThread && (
        <NewThreadModal
          eventId={eventId}
          hdrs={hdrs()}
          onClose={() => setShowNewThread(false)}
          onCreated={() => { setShowNewThread(false); loadThreads() }}
          profileId={profile?.id}
        />
      )}

      {/* ── New Announcement Modal ── */}
      {showNewAnnouncement && (
        <NewAnnouncementModal
          eventId={eventId}
          hdrs={hdrs()}
          onClose={() => setShowNewAnnouncement(false)}
          onCreated={() => { setShowNewAnnouncement(false); loadAnnouncements() }}
          profileId={profile?.id}
        />
      )}

      {/* ── New Broadcast Modal ── */}
      {showNewBroadcast && (
        <NewBroadcastModal
          eventId={eventId}
          hdrs={hdrs()}
          onClose={() => setShowNewBroadcast(false)}
          onCreated={() => { setShowNewBroadcast(false); loadBroadcasts() }}
          profileId={profile?.id}
        />
      )}
    </div>
  )
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function NewThreadModal({ eventId, hdrs, onClose, onCreated, profileId }: {
  eventId: string; hdrs: Record<string, string>; onClose: () => void
  onCreated: () => void; profileId?: string
}) {
  const [subject, setSubject] = useState('')
  const [type, setType] = useState<string>('internal')
  const [initialMsg, setInitialMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/v1/messaging/threads`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ event_id: eventId, subject, thread_type: type, initial_message: initialMsg || undefined, created_by: profileId }),
      })
      if (res.ok) onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h2 className="font-semibold">New Thread</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Thread Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['internal','client','vendor'] as const).map(t => {
                const tc = THREAD_TYPE_CONFIG[t]; const Icon = tc.icon
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                      type === t ? `${tc.bg} ${tc.color}` : 'bg-muted/50 border-border/40 text-muted-foreground hover:border-border'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{tc.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground"
              placeholder="Thread subject…" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">First message (optional)</label>
            <textarea value={initialMsg} onChange={e => setInitialMsg(e.target.value)} rows={3}
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground resize-none"
              placeholder="Start with a message…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-border/60 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !subject.trim()}
              className="flex-1 py-2.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg transition-colors font-medium">
              {saving ? 'Creating…' : 'Create Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewAnnouncementModal({ eventId, hdrs, onClose, onCreated, profileId }: {
  eventId: string; hdrs: Record<string, string>; onClose: () => void
  onCreated: () => void; profileId?: string
}) {
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', is_pinned: false })
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/v1/messaging/announcements`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ ...form, event_id: eventId, created_by: profileId }),
      })
      if (res.ok) onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div className="flex items-center gap-2"><Pin className="w-4 h-4 text-amber-400" /><h2 className="font-semibold">New Announcement</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 text-foreground"
              placeholder="Announcement title…" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Message</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 text-foreground resize-none"
              placeholder="Announcement body…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                {Object.keys(PRIORITY_CONFIG).map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Pin to top</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, is_pinned: !f.is_pinned }))}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-colors ${
                  form.is_pinned ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-muted/50 border-border/40 text-muted-foreground'
                }`}>
                <Pin className="w-3.5 h-3.5" />{form.is_pinned ? 'Pinned' : 'Not pinned'}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-border/60 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.body.trim()}
              className="flex-1 py-2.5 text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg transition-colors font-medium">
              {saving ? 'Posting…' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewBroadcastModal({ eventId, hdrs, onClose, onCreated, profileId }: {
  eventId: string; hdrs: Record<string, string>; onClose: () => void
  onCreated: () => void; profileId?: string
}) {
  const [form, setForm] = useState({ title: '', message: '', audience: 'all_team', channels: ['in_app'] })
  const [saving, setSaving] = useState(false)

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/v1/messaging/broadcasts`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ ...form, event_id: eventId, created_by: profileId }),
      })
      if (res.ok) onCreated()
    } finally { setSaving(false) }
  }

  const CHANNELS = [
    { id: 'in_app', label: 'In-App' },
    { id: 'email', label: 'Email' },
    { id: 'sms', label: 'SMS' },
    { id: 'whatsapp', label: 'WhatsApp' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-emerald-400" /><h2 className="font-semibold">New Broadcast</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/60 text-foreground"
              placeholder="Broadcast subject…" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/60 text-foreground resize-none"
              placeholder="Your message to recipients…" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Send to</label>
            <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
              <option value="all_team">All Team Members</option>
              <option value="all_guests">All Guests</option>
              <option value="vendors">All Vendors</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Delivery channels</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map(ch => (
                <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    form.channels.includes(ch.id)
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-muted/50 border-border/40 text-muted-foreground hover:border-border'
                  }`}>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-border/60 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.message.trim()}
              className="flex-1 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-colors font-medium">
              {saving ? 'Sending…' : 'Send Broadcast'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
