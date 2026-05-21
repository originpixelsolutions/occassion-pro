'use client'

/**
 * OccasionPro — NotificationBell  (v2)
 *
 * Bell icon with animated unread badge.
 * Subscribes to real-time notifications via Supabase Realtime.
 * Click opens the NotificationDrawer.
 *
 * Upgrades over v1:
 *  • Pulsing red ring when any unread notification has urgency === 'critical'
 *  • hasCritical exposed so parent components can also react
 */

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { NotificationDrawer } from './NotificationDrawer'
import { useNotifications } from './useNotifications'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface NotificationBellProps {
  className?: string
  variant?: 'default' | 'compact'
}

export function NotificationBell({
  className = '',
  variant = 'default',
}: NotificationBellProps) {
  const { user } = useCurrentUser()
  const recipientId = user?.id ?? null

  const { unreadCount, unreadItems, markRead, markAllRead } =
    useNotifications(recipientId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [animate, setAnimate]       = useState(false)
  const prevCountRef                = useRef(unreadCount)

  // Does any unread item have critical urgency?
  const hasCritical = unreadItems.some(n => !n.is_read && n.urgency === 'critical')

  // Animate bell when new notification arrives
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setAnimate(true)
      const t = setTimeout(() => setAnimate(false), 700)
      prevCountRef.current = unreadCount
      return () => clearTimeout(t)
    }
    prevCountRef.current = unreadCount
  }, [unreadCount])

  // Also listen for the custom event fired by the hook
  useEffect(() => {
    const handler = () => {
      setAnimate(true)
      setTimeout(() => setAnimate(false), 700)
    }
    window.addEventListener('op:notification:new', handler)
    return () => window.removeEventListener('op:notification:new', handler)
  }, [])

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <>
      <style>{`
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(15deg); }
          30%  { transform: rotate(-13deg); }
          45%  { transform: rotate(10deg); }
          60%  { transform: rotate(-8deg); }
          75%  { transform: rotate(5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50%       { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
        .bell-critical-ring {
          animation: criticalPulse 1.6s ease-in-out infinite;
        }
        .bell-critical-ring::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 10px;
          border: 1.5px solid rgba(239, 68, 68, 0.5);
          animation: criticalPulse 1.6s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <button
        onClick={() => setDrawerOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread${hasCritical ? ', critical' : ''})` : ''}`}
        className={`
          relative inline-flex items-center justify-center rounded-lg transition-colors
          ${variant === 'default' ? 'w-9 h-9 hover:bg-zinc-800' : 'w-8 h-8 hover:bg-zinc-800/60'}
          focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950
          ${hasCritical ? 'bell-critical-ring' : ''}
          ${className}
        `}
      >
        {/* Bell icon */}
        <Bell
          className={`
            ${variant === 'default' ? 'w-[18px] h-[18px]' : 'w-4 h-4'}
            transition-colors
            ${drawerOpen      ? 'text-white'    : 'text-zinc-400 hover:text-zinc-200'}
            ${hasCritical     ? 'text-red-400'  : ''}
          `}
          style={{
            transformOrigin: 'top center',
            animation: animate
              ? 'bellRing 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both'
              : undefined,
          }}
        />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className={`
              absolute flex items-center justify-center
              font-bold rounded-full ring-2 ring-zinc-950
              transition-all duration-200
              ${hasCritical ? 'bg-red-500' : 'bg-violet-500'} text-white
              ${unreadCount > 9
                ? 'min-w-[18px] h-[18px] px-1 text-[9px] -top-0.5 -right-0.5'
                : 'w-4 h-4 text-[10px] -top-0.5 -right-0.5'
              }
              ${animate ? 'scale-125' : 'scale-100'}
            `}
            aria-hidden
          >
            {badgeLabel}
          </span>
        )}

        {/* Critical pulse ping overlay — additional visual layer */}
        {hasCritical && (
          <span className="absolute inset-0 rounded-lg ring-1 ring-red-500/40 animate-ping pointer-events-none" />
        )}
      </button>

      {/* Notification drawer */}
      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        unreadCount={unreadCount}
        initialItems={unreadItems}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        recipientId={recipientId}
      />
    </>
  )
}
