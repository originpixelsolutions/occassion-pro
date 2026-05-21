'use client'

/**
 * usePresence — Supabase Realtime channel presence.
 *
 * Tracks which users are viewing the same page/channel simultaneously.
 * Returns `others` — every connected user EXCEPT the current user.
 *
 * Usage:
 *   const { others } = usePresence({
 *     channelKey: `runsheet:${runsheet.id}`,
 *     currentUser: { id: userId, name: userName },
 *     page: 'runsheet',
 *     enabled: !!runsheet?.id && !!userId,
 *   })
 *   <PresenceAvatars users={others} maxVisible={5} size="md" />
 */

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string
  userName: string
  avatar?: string
  /** Assigned colour for this user's presence indicators */
  color: string
  /** Which runsheet item this user currently has focused (cursor position) */
  activeItemId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESENCE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
]

/**
 * Deterministic color for a user based on their ID string.
 * Same user always gets the same colour so it's stable across sessions.
 */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UsePresenceOptions {
  /** Supabase channel name — e.g. "runsheet:abc123" */
  channelKey: string
  currentUser: { id: string; name: string; avatar?: string }
  /** Used as metadata on the presence payload */
  page?: string
  /** Set to false to skip subscribing (e.g. while data is loading) */
  enabled?: boolean
}

export function usePresence({
  channelKey,
  currentUser,
  page = 'unknown',
  enabled = true,
}: UsePresenceOptions) {
  const [others, setOthers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!enabled || !channelKey || !currentUser.id) return

    const supabase = getSupabaseBrowserClient()
    const myColor = stringToColor(currentUser.id)

    const channel = supabase.channel(channelKey, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: PresenceUser[] = []

        for (const [userId, presences] of Object.entries(state)) {
          // Exclude the current user — "others" only
          if (userId === currentUser.id) continue

          const p = (presences as any[])[0]
          if (!p) continue

          users.push({
            userId,
            userName: p.userName ?? p.name ?? 'Unknown',
            avatar: p.avatar ?? undefined,
            color: p.color ?? stringToColor(userId),
            activeItemId: p.activeItemId ?? undefined,
          })
        }

        setOthers(users)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Additional join event — presence sync handles the full state,
        // but joining triggers a sync so this is a no-op (handled above).
        void newPresences
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        void leftPresences
        // Leave events are handled by the sync above, but we can also
        // remove immediately for snappier UX.
        setOthers((prev) => {
          const leavingIds = new Set(
            (leftPresences as any[]).map((p: any) => p.userId as string),
          )
          return prev.filter((u) => !leavingIds.has(u.userId))
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            userName: currentUser.name,
            avatar: currentUser.avatar ?? null,
            color: myColor,
            page,
            onlineAt: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack().then(() => channel.unsubscribe()).catch(() => channel.unsubscribe())
      setOthers([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, currentUser.id, currentUser.name, page, enabled])

  return { others }
}

// ─── PresenceAvatars component ────────────────────────────────────────────────

interface PresenceAvatarsProps {
  users: PresenceUser[]
  /** How many avatars to show before collapsing into "+N" pill */
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
}

/**
 * Row of stacked presence avatars — initials or photo.
 * Renders nothing when `users` is empty (safe to always render).
 */
export function PresenceAvatars({
  users,
  maxVisible = 4,
  size = 'md',
  className = '',
}: PresenceAvatarsProps) {
  if (users.length === 0) return null

  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible
  const dim = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  return (
    <div className={`flex items-center ${className}`}>
      {visible.map((user, i) => (
        <div
          key={user.userId}
          title={user.userName}
          className={`
            ${dim} rounded-full flex items-center justify-center font-semibold text-white
            border-2 border-zinc-900 -ml-2 first:ml-0 cursor-default select-none
            flex-shrink-0 overflow-hidden
          `}
          style={{
            backgroundColor: user.color,
            zIndex: visible.length - i,
          }}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.userName}
              className="w-full h-full object-cover"
            />
          ) : (
            (user.userName?.[0] ?? '?').toUpperCase()
          )}
        </div>
      ))}

      {overflow > 0 && (
        <div
          title={`${overflow} more user${overflow === 1 ? '' : 's'}`}
          className={`
            ${dim} rounded-full bg-zinc-700 flex items-center justify-center
            font-semibold text-zinc-300 border-2 border-zinc-900 -ml-2 flex-shrink-0
          `}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
