/**
 * OccasionPro — Presence System
 *
 * Shows who is currently viewing/editing a page.
 * Used in: Runsheet (full cursor presence), Event overview, Floor Plan.
 *
 * Supabase Realtime Presence: each user broadcasts their state,
 * all users see all other users' states in real-time.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PresenceUser {
  userId: string
  name: string
  initials: string
  color: string       // Consistent per-user color derived from userId
  page: string        // Which page/module they're on
  editingTaskId?: string  // For runsheet: which task they're currently editing
  cursorX?: number    // For collaborative editors
  cursorY?: number
  lastSeen: number    // timestamp
}

type PresenceState = Record<string, PresenceUser[]>

const COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#9333ea', '#0891b2', '#65a30d',
]

function userColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function userInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface UsePresenceOptions {
  /** Channel name — typically "{entityType}:{entityId}" e.g. "event:abc123" */
  channelKey: string
  /** Current user's info */
  currentUser: { id: string; name: string }
  /** Which page/module this user is on */
  page: string
  /** Disable when not needed (e.g. user is not logged in) */
  enabled?: boolean
}

interface UsePresenceResult {
  /** All other users currently present (excludes self) */
  others: PresenceUser[]
  /** All users including self */
  all: PresenceUser[]
  /** Update the current user's state (e.g. which task they're editing) */
  updateState: (update: Partial<Pick<PresenceUser, 'editingTaskId' | 'cursorX' | 'cursorY' | 'page'>>) => void
}

export function usePresence({
  channelKey,
  currentUser,
  page,
  enabled = true,
}: UsePresenceOptions): UsePresenceResult {
  const supabase = createClient()
  const [presenceState, setPresenceState] = useState<PresenceState>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const myState: PresenceUser = {
    userId: currentUser.id,
    name: currentUser.name,
    initials: userInitials(currentUser.name),
    color: userColor(currentUser.id),
    page,
    lastSeen: Date.now(),
  }
  const myStateRef = useRef(myState)
  myStateRef.current = myState

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel(`presence:${channelKey}`, {
      config: { presence: { key: currentUser.id } },
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        setPresenceState(channel.presenceState() as PresenceState)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setPresenceState(prev => ({ ...prev })) // trigger re-render
        void newPresences // satisfy linter
      })
      .on('presence', { event: 'leave' }, () => {
        setPresenceState(channel.presenceState() as PresenceState)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myStateRef.current)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, currentUser.id, enabled])

  const updateState = useCallback(
    async (update: Partial<Pick<PresenceUser, 'editingTaskId' | 'cursorX' | 'cursorY' | 'page'>>) => {
      if (!channelRef.current) return
      await channelRef.current.track({
        ...myStateRef.current,
        ...update,
        lastSeen: Date.now(),
      })
    },
    []
  )

  const all: PresenceUser[] = Object.values(presenceState).flat()
  const others = all.filter(u => u.userId !== currentUser.id)

  return { others, all, updateState }
}

// ─────────────────────────────────────────────────────────────────────────────
// PresenceAvatars component — render who's currently viewing
// ─────────────────────────────────────────────────────────────────────────────

interface PresenceAvatarsProps {
  users: PresenceUser[]
  maxVisible?: number
  size?: 'sm' | 'md'
}

export function PresenceAvatars({ users, maxVisible = 5, size = 'sm' }: PresenceAvatarsProps) {
  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible

  const dim = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[11px]'

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map(u => (
        <div
          key={u.userId}
          title={`${u.name} — ${u.page}`}
          className={`${dim} rounded-full flex items-center justify-center font-bold text-white border-2 border-background ring-0`}
          style={{ backgroundColor: u.color }}
        >
          {u.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${dim} rounded-full flex items-center justify-center font-bold text-muted-foreground bg-muted border-2 border-background`}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: "X is editing this task" indicator text
// ─────────────────────────────────────────────────────────────────────────────

export function getEditingIndicator(taskId: string, others: PresenceUser[]): string | null {
  const editor = others.find(u => u.editingTaskId === taskId)
  if (!editor) return null
  const first = editor.name.split(' ')[0]
  return `${first} is editing this`
}
