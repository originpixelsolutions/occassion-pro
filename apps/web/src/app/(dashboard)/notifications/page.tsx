'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Bell, BellOff, Check, CheckCheck, Archive, Trash2,
  Search, Calendar, DollarSign, Users, Zap, Info,
  AlertCircle, MessageSquare, Settings, ChevronRight, Circle,
  Loader2, RefreshCw, Package, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
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

type Notification = {
  id: string
  type: string
  category: string
  title: string
  body: string
  is_read: boolean
  is_archived: boolean
  action_url?: string
  created_at: string
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'event', label: 'Events', icon: Calendar, color: 'text-blue-400' },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: 'text-emerald-400' },
  { id: 'team', label: 'Team', icon: Users, color: 'text-violet-400' },
  { id: 'ai', label: 'AI', icon: Zap, color: 'text-amber-400' },
  { id: 'system', label: 'System', icon: Settings, color: 'text-slate-400' },
  { id: 'operations', label: 'Operations', icon: Package, color: 'text-orange-400' },
  { id: 'support', label: 'Support', icon: MessageSquare, color: 'text-cyan-400' },
]

const TYPE_ICONS: Record<string, any> = {
  event: Calendar, finance: DollarSign, team: Users, ai: Zap,
  system: Settings, operations: Package, support: MessageSquare, default: Info
}

const TYPE_COLORS: Record<string, string> = {
  event: 'bg-blue-500/10 text-blue-400',
  finance: 'bg-emerald-500/10 text-emerald-400',
  team: 'bg-violet-500/10 text-violet-400',
  ai: 'bg-amber-500/10 text-amber-400',
  system: 'bg-slate-500/10 text-slate-400',
  operations: 'bg-orange-500/10 text-orange-400',
  support: 'bg-cyan-500/10 text-cyan-400',
  default: 'bg-primary/10 text-primary',
}

// Demo notifications when API has none
const DEMO_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'event', category: 'event', title: 'Event "Royal Wedding" goes live in 3 days', body: 'Final preparations needed. 12 tasks still pending.', is_read: false, is_archived: false, created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '2', type: 'finance', category: 'finance', title: 'Invoice #INV-2024-089 overdue', body: 'Client Sharma Family — ₹2,50,000 overdue by 5 days.', is_read: false, is_archived: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', type: 'ai', category: 'ai', title: 'AI detected budget overrun risk', body: 'Event "Tech Summit" is projected to exceed budget by 12%. Review vendors.', is_read: false, is_archived: false, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', type: 'team', category: 'team', title: 'Rahul Kumar assigned to Event #47', body: 'Operations Manager role assigned by Admin.', is_read: true, is_archived: false, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '5', type: 'operations', category: 'operations', title: 'Vendor delivery confirmed', body: 'FlowerFest Decor confirmed delivery for Saturday 8AM.', is_read: true, is_archived: false, created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: '6', type: 'system', category: 'system', title: 'System backup completed', body: 'All data backed up successfully at 02:00 AM.', is_read: true, is_archived: false, created_at: new Date(Date.now() - 259200000).toISOString() },
]

function NotificationItem({ notif, selected, onSelect, onMarkRead, onArchive, onDelete }: {
  notif: Notification
  selected: boolean
  onSelect: () => void
  onMarkRead: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const Icon = TYPE_ICONS[notif.category] ?? TYPE_ICONS.default
  const colorClass = TYPE_COLORS[notif.category] ?? TYPE_COLORS.default

  return (
    <div onClick={onSelect}
      className={cn('flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border',
        selected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-accent',
        !notif.is_read && 'border-l-2 border-l-primary')}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm truncate', notif.is_read ? 'text-muted-foreground' : 'font-medium')}>{notif.title}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(notif.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
      </div>
      {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
    </div>
  )
}

function NotificationDetail({ notif, onMarkRead, onArchive, onClose }: {
  notif: Notification; onMarkRead: () => void; onArchive: () => void; onClose: () => void
}) {
  const Icon = TYPE_ICONS[notif.category] ?? TYPE_ICONS.default
  const colorClass = TYPE_COLORS[notif.category] ?? TYPE_COLORS.default

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notification Detail</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{notif.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{notif.category} · {timeAgo(notif.created_at)}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{notif.body}</p>
        {notif.action_url && (
          <a href={notif.action_url} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            View Details <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="p-4 border-t border-border flex gap-2">
        {!notif.is_read && (
          <button onClick={onMarkRead} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent">
            <Check className="w-3.5 h-3.5" /> Mark Read
          </button>
        )}
        <button onClick={onArchive} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent">
          <Archive className="w-3.5 h-3.5" /> Archive
        </button>
      </div>
    </div>
  )
}

function PreferencesTab() {
  const [prefs, setPrefs] = useState({
    events: { email: true, push: true, in_app: true },
    finance: { email: true, push: false, in_app: true },
    team: { email: false, push: true, in_app: true },
    ai: { email: true, push: true, in_app: true },
    operations: { email: false, push: false, in_app: true },
    system: { email: true, push: false, in_app: true },
  })

  const toggle = (category: string, channel: string) => {
    setPrefs(p => ({
      ...p,
      [category]: { ...p[category as keyof typeof p], [channel]: !p[category as keyof typeof p][channel as keyof typeof p[keyof typeof p]] }
    }))
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Notification Preferences</h3>
        <p className="text-xs text-muted-foreground">Control how and where you receive notifications.</p>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground bg-accent/50 px-4 py-2.5 border-b border-border">
          <span>Category</span><span className="text-center">Email</span><span className="text-center">Push</span><span className="text-center">In-App</span>
        </div>
        {Object.entries(prefs).map(([category, channels]) => (
          <div key={category} className="grid grid-cols-4 px-4 py-3 border-b border-border last:border-0 items-center">
            <span className="text-sm capitalize">{category}</span>
            {(['email', 'push', 'in_app'] as const).map(ch => (
              <div key={ch} className="flex justify-center">
                <button onClick={() => toggle(category, ch)}
                  className={cn('w-9 h-5 rounded-full transition-colors relative', channels[ch as keyof typeof channels] ? 'bg-primary' : 'bg-border')}>
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', channels[ch as keyof typeof channels] ? 'left-4' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button className="px-4 py-2 text-sm bg-primary text-foreground rounded-lg hover:bg-primary/90">Save Preferences</button>
    </div>
  )
}

export default function NotificationsPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<'inbox' | 'archived' | 'preferences'>('inbox')
  const [category, setCategory] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Notification | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS)

  const { data, loading, refetch } = useApi<{ data: Notification[] }>('/notifications', token ?? '')

  useEffect(() => {
    if (data?.data && data.data.length > 0) setNotifications(data.data)
  }, [data])

  const inbox = notifications.filter(n => !n.is_archived)
  const archived = notifications.filter(n => n.is_archived)
  const unreadCount = inbox.filter(n => !n.is_read).length

  const filtered = (tab === 'archived' ? archived : inbox).filter(n => {
    const q = search.toLowerCase()
    return (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      && (category === 'all' || n.category === category)
      && (!unreadOnly || !n.is_read)
  })

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  const archiveNotif = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_archived: true } : n))
    if (selected?.id === id) setSelected(null)
  }
  const deleteNotif = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
        <Bell className="w-4 h-4 text-primary" />
        <div>
          <h1 className="font-semibold text-sm">Notifications</h1>
          <p className="text-[10px] text-muted-foreground">{unreadCount} unread</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search notifications..." />
          </div>
          <button onClick={() => setUnreadOnly(v => !v)}
            className={cn('h-8 px-3 text-xs rounded-lg border', unreadOnly ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}>
            Unread Only
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:bg-accent flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}
          <button onClick={refetch} className="p-2 rounded-lg border border-border hover:bg-accent text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: category filter */}
        <div className="w-44 shrink-0 border-r border-border flex flex-col">
          <div className="flex border-b border-border">
            {(['inbox', 'archived', 'preferences'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-2 text-[10px] font-medium capitalize border-b-2 transition-colors',
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {t}
              </button>
            ))}
          </div>
          {tab !== 'preferences' && (
            <div className="p-2 space-y-0.5">
              {CATEGORIES.map(cat => {
                const count = (tab === 'archived' ? archived : inbox).filter(n => cat.id === 'all' || n.category === cat.id).length
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className={cn('w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors',
                      category === cat.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                    <div className="flex items-center gap-1.5">
                      {cat.icon && <cat.icon className="w-3 h-3" />}
                      <span>{cat.label}</span>
                    </div>
                    <span className="text-[10px]">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Main list */}
        {tab === 'preferences' ? (
          <div className="flex-1 overflow-auto"><PreferencesTab /></div>
        ) : (
          <div className="flex flex-1 min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <BellOff className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                </div>
              ) : (
                filtered.map(notif => (
                  <NotificationItem key={notif.id} notif={notif} selected={selected?.id === notif.id}
                    onSelect={() => { setSelected(notif); markRead(notif.id) }}
                    onMarkRead={() => markRead(notif.id)}
                    onArchive={() => archiveNotif(notif.id)}
                    onDelete={() => deleteNotif(notif.id)}
                  />
                ))
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="w-72 border-l border-border shrink-0">
                <NotificationDetail
                  notif={selected}
                  onMarkRead={() => markRead(selected.id)}
                  onArchive={() => archiveNotif(selected.id)}
                  onClose={() => setSelected(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
