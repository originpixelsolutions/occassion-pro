'use client'
/**
 * OccasionPro — Runsheet Socket.IO Gateway Hook
 *
 * Connects to the NestJS RunsheetGateway (namespace: "runsheet") and:
 *   • Joins the runsheet room on connection / reconnection
 *   • Receives real-time item mutations: created / updated / deleted / status
 *   • Tracks per-item cursor presence (who's editing what)
 *   • Exposes helpers to emit cursor-move and typing events
 *
 * Usage:
 *   const { connected, presenceUsers, notifyCursorMove } = useRunsheetGateway({ ... })
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GatewayPresenceUser {
  userId: string
  userName: string
  color: string
  activeItemId?: string
}

export interface TypingIndicator {
  userId: string
  userName: string
  color: string
  field: string
}

interface UseRunsheetGatewayOptions<T = unknown> {
  /** runsheet.id — only join once this is set */
  runsheetId: string | null
  userId: string
  userName: string
  /** Supabase access token for socket auth */
  token: string | null
  /** Disable the hook (before runsheet is loaded / user not authed) */
  enabled?: boolean
  // ── Event callbacks ─────────────────────────────────────────────────────────
  onItemCreated?: (item: T) => void
  onItemUpdated?: (item: T) => void
  onItemDeleted?: (itemId: string, by: string) => void
  onItemStatusChanged?: (data: {
    itemId: string
    status: string
    delayMinutes?: number
  }) => void
  onItemsReordered?: (items: Array<{ id: string; position: number }>) => void
  onRunsheetLocked?: (by: string) => void
  onRunsheetUnlocked?: () => void
  onRunsheetRestored?: (versionId: string) => void
}

interface UseRunsheetGatewayResult {
  /** Socket.IO connection is live */
  connected: boolean
  /** All OTHER users in the runsheet room with their active item */
  presenceUsers: GatewayPresenceUser[]
  /** Per-item typing indicators: itemId → who's typing + which field */
  typingIndicators: Map<string, TypingIndicator>
  /** Emit that the current user focused / blurred an item */
  notifyCursorMove: (itemId: string | null) => void
  /** Emit that the current user is typing in a field */
  notifyTyping: (itemId: string, field: string) => void
}

// One socket per API URL — reused across component mounts
const SOCKET_CACHE: Record<string, Socket> = {}

// ─────────────────────────────────────────────────────────────────────────────

export function useRunsheetGateway<T = unknown>(
  opts: UseRunsheetGatewayOptions<T>,
): UseRunsheetGatewayResult {
  const {
    runsheetId,
    userId,
    userName,
    token,
    enabled = true,
    onItemCreated,
    onItemUpdated,
    onItemDeleted,
    onItemStatusChanged,
    onItemsReordered,
    onRunsheetLocked,
    onRunsheetUnlocked,
    onRunsheetRestored,
  } = opts

  const [connected, setConnected] = useState(false)
  const [presenceUsers, setPresenceUsers] = useState<GatewayPresenceUser[]>([])
  const [typingIndicators, setTypingIndicators] = useState<Map<string, TypingIndicator>>(new Map())

  const socketRef = useRef<Socket | null>(null)

  // Stable refs so we never recreate the socket just because a callback changed
  const runsheetIdRef = useRef(runsheetId)
  const userIdRef     = useRef(userId)
  const userNameRef   = useRef(userName)
  runsheetIdRef.current = runsheetId
  userIdRef.current     = userId
  userNameRef.current   = userName

  const onItemCreatedRef         = useRef(onItemCreated)
  const onItemUpdatedRef         = useRef(onItemUpdated)
  const onItemDeletedRef         = useRef(onItemDeleted)
  const onItemStatusChangedRef   = useRef(onItemStatusChanged)
  const onItemsReorderedRef      = useRef(onItemsReordered)
  const onRunsheetLockedRef      = useRef(onRunsheetLocked)
  const onRunsheetUnlockedRef    = useRef(onRunsheetUnlocked)
  const onRunsheetRestoredRef    = useRef(onRunsheetRestored)
  onItemCreatedRef.current       = onItemCreated
  onItemUpdatedRef.current       = onItemUpdated
  onItemDeletedRef.current       = onItemDeleted
  onItemStatusChangedRef.current = onItemStatusChanged
  onItemsReorderedRef.current    = onItemsReordered
  onRunsheetLockedRef.current    = onRunsheetLocked
  onRunsheetUnlockedRef.current  = onRunsheetUnlocked
  onRunsheetRestoredRef.current  = onRunsheetRestored

  useEffect(() => {
    if (!enabled || !runsheetId || !token || !userId) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    const cacheKey = `${apiUrl}/runsheet`

    // Reuse existing connected socket if available
    let sock = SOCKET_CACHE[cacheKey]
    if (!sock || !sock.connected) {
      sock = io(`${apiUrl}/runsheet`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 5_000,
      })
      SOCKET_CACHE[cacheKey] = sock
    }
    socketRef.current = sock

    const joinRoom = () => {
      sock.emit('join_runsheet', {
        runsheetId: runsheetIdRef.current,
        userId:     userIdRef.current,
        userName:   userNameRef.current,
      })
    }

    // ── Connection lifecycle ─────────────────────────────────────────────────
    const onConnect = () => {
      setConnected(true)
      joinRoom()
    }
    const onDisconnect = () => setConnected(false)

    sock.on('connect',    onConnect)
    sock.on('disconnect', onDisconnect)
    if (sock.connected) { setConnected(true); joinRoom() }

    // ── Presence ─────────────────────────────────────────────────────────────
    sock.on('presence_sync', (users: GatewayPresenceUser[]) => {
      setPresenceUsers(users.filter((u) => u.userId !== userIdRef.current))
    })
    sock.on('presence_updated', (users: GatewayPresenceUser[]) => {
      setPresenceUsers(users.filter((u) => u.userId !== userIdRef.current))
    })
    sock.on('user_left', ({ userId: uid }: { userId: string }) => {
      setPresenceUsers((prev) => prev.filter((u) => u.userId !== uid))
      setTypingIndicators((prev) => {
        const next = new Map(prev)
        for (const [itemId, ind] of next.entries()) {
          if (ind.userId === uid) next.delete(itemId)
        }
        return next
      })
    })
    sock.on(
      'cursor_updated',
      (data: { userId: string; itemId: string | null; color: string }) => {
        setPresenceUsers((prev) =>
          prev.map((u) =>
            u.userId === data.userId
              ? { ...u, activeItemId: data.itemId ?? undefined }
              : u,
          ),
        )
      },
    )

    // ── Typing indicators ────────────────────────────────────────────────────
    const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}
    sock.on(
      'user_typing',
      (data: {
        userId:   string
        userName: string
        color:    string
        itemId:   string
        field:    string
      }) => {
        if (data.userId === userIdRef.current) return
        setTypingIndicators((prev) => {
          const next = new Map(prev)
          next.set(data.itemId, {
            userId:   data.userId,
            userName: data.userName,
            color:    data.color,
            field:    data.field,
          })
          return next
        })
        // Auto-clear after 3 seconds of inactivity
        clearTimeout(typingTimers[data.itemId])
        typingTimers[data.itemId] = setTimeout(() => {
          setTypingIndicators((prev) => {
            const next = new Map(prev)
            if (next.get(data.itemId)?.userId === data.userId) next.delete(data.itemId)
            return next
          })
        }, 3_000)
      },
    )

    // ── Item mutations ────────────────────────────────────────────────────────
    sock.on('item_created', ({ item }: { item: T; by: string }) => {
      onItemCreatedRef.current?.(item)
    })
    sock.on('item_updated', ({ item }: { item: T; by: string }) => {
      onItemUpdatedRef.current?.(item)
    })
    sock.on('item_deleted', ({ itemId, by }: { itemId: string; by: string }) => {
      onItemDeletedRef.current?.(itemId, by)
    })
    sock.on(
      'item_status_changed',
      ({
        itemId,
        status,
        delayMinutes,
      }: {
        itemId:       string
        status:       string
        delayMinutes?: number
        by:           string
      }) => {
        onItemStatusChangedRef.current?.({ itemId, status, delayMinutes })
      },
    )
    sock.on(
      'items_reordered',
      ({ items }: { items: Array<{ id: string; position: number }>; by: string }) => {
        onItemsReorderedRef.current?.(items)
      },
    )

    // ── Runsheet-level events ─────────────────────────────────────────────────
    sock.on('runsheet_locked',   ({ by }: { by: string }) => { onRunsheetLockedRef.current?.(by) })
    sock.on('runsheet_unlocked', ()                       => { onRunsheetUnlockedRef.current?.() })
    sock.on('runsheet_restored', ({ versionId }: { versionId: string; by: string }) => {
      onRunsheetRestoredRef.current?.(versionId)
    })

    return () => {
      sock.off('connect',           onConnect)
      sock.off('disconnect',        onDisconnect)
      sock.off('presence_sync')
      sock.off('presence_updated')
      sock.off('user_left')
      sock.off('cursor_updated')
      sock.off('user_typing')
      sock.off('item_created')
      sock.off('item_updated')
      sock.off('item_deleted')
      sock.off('item_status_changed')
      sock.off('items_reordered')
      sock.off('runsheet_locked')
      sock.off('runsheet_unlocked')
      sock.off('runsheet_restored')

      if (runsheetIdRef.current) {
        sock.emit('leave_runsheet', { runsheetId: runsheetIdRef.current })
      }

      Object.values(typingTimers).forEach(clearTimeout)
      setConnected(false)
      setPresenceUsers([])
      setTypingIndicators(new Map())
    }
    // Only re-run when the fundamental connection params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, runsheetId, token, userId])

  // ── Emit helpers ─────────────────────────────────────────────────────────────

  const notifyCursorMove = useCallback((itemId: string | null) => {
    if (!socketRef.current?.connected || !runsheetIdRef.current) return
    socketRef.current.emit('cursor_move', {
      runsheetId: runsheetIdRef.current,
      itemId,
    })
  }, [])

  const notifyTyping = useCallback((itemId: string, field: string) => {
    if (!socketRef.current?.connected || !runsheetIdRef.current) return
    socketRef.current.emit('typing', {
      runsheetId: runsheetIdRef.current,
      itemId,
      field,
    })
  }, [])

  return { connected, presenceUsers, typingIndicators, notifyCursorMove, notifyTyping }
}
