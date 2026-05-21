'use client'

/**
 * OccasionPro — NotificationDrawer  (v2)
 *
 * Slide-in notification centre panel (380px wide).
 * Upgrades over v1:
 *  • Per-module colour-coded icon chips
 *  • Deep-link navigation on item click (action_url)
 *  • Prominent "Mark all read" banner when unread > 0
 *  • hasCritical prop → consumed by NotificationBell for pulsing ring
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Settings2,
  CheckCheck,
  Bell,
  Info,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  Users,
  DollarSign,
  Utensils,
  Map,
  Clock,
  Package,
  Megaphone,
  BarChart2,
  UserCog,
  Zap,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel'
import type { Notification, NotificationModule, NotificationUrgency } from './useNotifications'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'info' | 'warning' | 'critical'

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
  unreadCount: number
  initialItems: Notification[]
  onMarkRead: (ids: string[]) => void
  onMarkAllRead: () => void
  recipientId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)     return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Per-module icon mapping
const MODULE_ICONS: Record<NotificationModule, typeof Bell> = {
  guests:     Users,
  finance:    DollarSign,
  fnb:        Utensils,
  floorplan:  Map,
  runsheet:   Clock,
  vendors:    Package,
  clients:    UserCog,
  team:       Users,
  conference: Calendar,
  post_event: BarChart2,
  system:     Zap,
  marketing:  Megaphone,
} as any

// Per-module colour chip — background + icon tint
const MODULE_COLORS: Record<NotificationModule, { bg: string; icon: string }> = {
  guests:     { bg: 'bg-blue-500/15',    icon: 'text-blue-400' },
  finance:    { bg: 'bg-emerald-500/15', icon: 'text-emerald-400' },
  fnb:        { bg: 'bg-orange-500/15',  icon: 'text-orange-400' },
  floorplan:  { bg: 'bg-cyan-500/15',    icon: 'text-cyan-400' },
  runsheet:   { bg: 'bg-violet-500/15',  icon: 'text-violet-400' },
  vendors:    { bg: 'bg-amber-500/15',   icon: 'text-amber-400' },
  clients:    { bg: 'bg-indigo-500/15',  icon: 'text-indigo-400' },
  team:       { bg: 'bg-teal-500/15',    icon: 'text-teal-400' },
  conference: { bg: 'bg-purple-500/15',  icon: 'text-purple-400' },
  post_event: { bg: 'bg-rose-500/15',    icon: 'text-rose-400' },
  system:     { bg: 'bg-zinc-700/60',    icon: 'text-zinc-400' },
  marketing:  { bg: 'bg-pink-500/15',    icon: 'text-pink-400' },
} as any

const URGENCY_STYLE: Record<NotificationUrgency, { border: string; icon: typeof Info; iconColor: string; bg: string }> = {
  info:     { border: 'border-l-blue-500',   icon: Info,          iconColor: 'text-blue-400',   bg: '' },
  warning:  { border: 'border-l-amber-500',  icon: AlertTriangle, iconColor: 'text-amber-400',  bg: 'bg-amber-500/[0.03]' },
  critical: { border: 'border-l-red-500',    icon: AlertOctagon,  iconColor: 'text-red-400',    bg: 'bg-red-500/[0.05]' },
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const router = useRouter()
  const urgency  = URGENCY_STYLE[notification.urgency]
  const modColor = MODULE_COLORS[notification.module] ?? { bg: 'bg-zinc-800', icon: 'text-zinc-400' }
  const ModuleIcon  = MODULE_ICONS[notification.module] ?? Bell
  const UrgencyIcon = urgency.icon

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id)
    if (notification.action_url) {
      // Internal routes start with /; external URLs open in new tab
      if (notification.action_url.startsWith('/')) {
        router.push(notification.action_url)
      } else {
        window.open(notification.action_url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label={notification.title}
      className={`
        relative flex gap-3 px-4 py-3 border-l-2 cursor-pointer
        transition-colors group outline-none
        focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500
        ${urgency.border}
        ${urgency.bg}
        ${notification.is_read
          ? 'opacity-60 hover:opacity-80 hover:bg-zinc-800/30'
          : 'hover:bg-zinc-800/50'
        }
        ${notification.action_url ? '' : 'cursor-default'}
      `}
    >
      {/* Module colour chip */}
      <div className="shrink-0 mt-0.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${modColor.bg}`}>
          <ModuleIcon className={`w-3.5 h-3.5 ${modColor.icon}`} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <p className={`text-sm font-medium leading-snug flex-1 ${notification.is_read ? 'text-zinc-400' : 'text-white'}`}>
            {notification.batch_count > 1 && (
              <span className="text-xs font-bold mr-1 px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                ×{notification.batch_count}
              </span>
            )}
            {notification.title}
          </p>
          <UrgencyIcon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${urgency.iconColor}`} />
        </div>

        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-zinc-600">{relativeTime(notification.created_at)}</span>

          {/* Module label chip */}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${modColor.bg} ${modColor.icon}`}>
            {notification.module}
          </span>

          {notification.action_url && (
            <span className="ml-auto text-[11px] text-violet-400 group-hover:text-violet-300 flex items-center gap-0.5 transition-colors">
              {notification.action_url.startsWith('/') ? (
                <>Open <ArrowRight className="w-2.5 h-2.5" /></>
              ) : (
                <>View <ExternalLink className="w-2.5 h-2.5" /></>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Unread dot */}
      {!notification.is_read && (
        <div className="absolute right-3 top-4 w-1.5 h-1.5 rounded-full bg-violet-500" />
      )}
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function NotificationDrawer({
  open,
  onClose,
  unreadCount,
  initialItems,
  onMarkRead,
  onMarkAllRead,
  recipientId,
}: NotificationDrawerProps) {
  const [activeTab, setActiveTab]           = useState<FilterTab>('all')
  const [allItems, setAllItems]             = useState<Notification[]>([])
  const [page, setPage]                     = useState(1)
  const [hasMore, setHasMore]               = useState(true)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Seed with unread items on open, then fetch full history
  useEffect(() => {
    if (!open) return
    setAllItems(initialItems)
    loadPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadPage = useCallback(async (p: number, reset = false) => {
    if (!recipientId) return
    setLoadingMore(true)
    try {
      const res  = await fetch(`/api/notifications?page=${p}&limit=25`, { credentials: 'include' })
      const data = await res.json()
      setAllItems(prev => reset ? data.items : [...prev, ...data.items])
      setHasMore(data.items.length === 25)
      setPage(p)
    } catch {}
    setLoadingMore(false)
  }, [recipientId])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      loadPage(page + 1)
    }
  }, [loadingMore, hasMore, page, loadPage])

  const handleMarkRead = (id: string) => {
    onMarkRead([id])
    setAllItems(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
    )
  }

  const handleMarkAllRead = () => {
    onMarkAllRead()
    setAllItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
  }

  // Filter items
  const filtered = allItems.filter(n => {
    if (activeTab === 'unread')   return !n.is_read
    if (activeTab === 'info')     return n.urgency === 'info'
    if (activeTab === 'warning')  return n.urgency === 'warning'
    if (activeTab === 'critical') return n.urgency === 'critical'
    return true
  })

  const criticalUnread = allItems.filter(n => !n.is_read && n.urgency === 'critical').length

  const TABS: Array<{ key: FilterTab; label: string; color?: string; count?: number }> = [
    { key: 'all',      label: 'All' },
    { key: 'unread',   label: 'Unread',   count: unreadCount },
    { key: 'critical', label: 'Critical', color: 'text-red-400',   count: criticalUnread },
    { key: 'warning',  label: 'Warning',  color: 'text-amber-400' },
    { key: 'info',     label: 'Info',     color: 'text-blue-400' },
  ]

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-[380px] bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl"
        style={{ animation: 'slideInFromRight 0.2s ease-out' }}
      >
        <style>{`
          @keyframes slideInFromRight {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">
                {unreadCount} unread
              </span>
            )}
            {criticalUnread > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold animate-pulse">
                {criticalUnread} critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPreferences(true)}
              title="Notification preferences"
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Prominent mark-all-read banner — only when there are unread items */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <p className="text-xs text-zinc-400">
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-1 border-b border-zinc-800 shrink-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 px-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? `border-violet-500 ${tab.color ?? 'text-white'}`
                  : `border-transparent text-zinc-500 hover:text-zinc-300`
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                  tab.key === 'critical'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto divide-y divide-zinc-800/50"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <Bell className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
              </p>
              {activeTab === 'unread' && (
                <p className="text-xs text-zinc-600 mt-1">You're fully up to date</p>
              )}
            </div>
          ) : (
            filtered.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleMarkRead}
              />
            ))
          )}

          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!hasMore && filtered.length > 0 && (
            <div className="py-4 text-center text-xs text-zinc-600">
              You've reached the end
            </div>
          )}
        </div>

        {/* Footer — quick link to settings page */}
        <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
          <a
            href="/settings/notifications"
            className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Settings2 className="w-3 h-3" />
            Manage notification settings
          </a>
        </div>
      </div>

      {/* Preferences panel (nested slide-in) */}
      {showPreferences && recipientId && (
        <NotificationPreferencesPanel
          recipientId={recipientId}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  )
}
