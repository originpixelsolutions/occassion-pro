/**
 * OccasionPro — useNotifications hook
 *
 * Wraps React Query + Supabase Realtime subscription.
 * Provides real-time unread count, notification list, and mutation helpers.
 *
 * Smart batching: groups same-module notifications arriving within 60s
 * into a single "N new updates in <Module>" item on the client side.
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationUrgency = 'info' | 'warning' | 'critical'
export type NotificationModule =
  | 'guests' | 'finance' | 'fnb' | 'floorplan' | 'runsheet'
  | 'vendors' | 'clients' | 'team' | 'conference' | 'post_event' | 'system'

export interface Notification {
  id: string
  tenant_id: string
  event_id: string | null
  recipient_id: string
  module: NotificationModule
  urgency: NotificationUrgency
  title: string
  body: string
  action_url: string | null
  is_read: boolean
  read_at: string | null
  batch_count: number
  created_at: string
}

export interface UnreadResult {
  count: number
  items: Notification[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchUnread(): Promise<UnreadResult> {
  const res = await fetch('/api/notifications/unread?limit=50', { credentials: 'include' })
  if (!res.ok) return { count: 0, items: [] }
  return res.json()
}

async function fetchAll(page: number, limit = 25) {
  const res = await fetch(`/api/notifications?page=${page}&limit=${limit}`, { credentials: 'include' })
  if (!res.ok) return { items: [], total: 0, page, limit }
  return res.json()
}

async function apiMarkRead(ids: string[]) {
  await fetch('/api/notifications/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  })
}

async function apiMarkAllRead() {
  await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    credentials: 'include',
  })
}

// ─── Module display names ─────────────────────────────────────────────────────

export const MODULE_LABELS: Record<NotificationModule, string> = {
  guests:     'Guest Management',
  finance:    'Finance',
  fnb:        'F&B',
  floorplan:  'Floor Plan',
  runsheet:   'Runsheet',
  vendors:    'Vendors',
  clients:    'Clients',
  team:       'Team',
  conference: 'Conference',
  post_event: 'Post Event',
  system:     'System',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(recipientId: string | null) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread', recipientId],
    queryFn: fetchUnread,
    enabled: !!recipientId,
    refetchInterval: 60_000, // poll every minute as fallback
    staleTime: 10_000,
  })

  const unreadCount = unreadQuery.data?.count ?? 0
  const unreadItems = unreadQuery.data?.items ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => apiMarkRead(ids),
    onSuccess: (_, ids) => {
      // Optimistic update
      queryClient.setQueryData(
        ['notifications', 'unread', recipientId],
        (old: UnreadResult | undefined) => {
          if (!old) return old
          const idsSet = new Set(ids)
          return {
            count: Math.max(0, old.count - ids.length),
            items: old.items.filter(n => !idsSet.has(n.id)),
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all', recipientId] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: apiMarkAllRead,
    onSuccess: () => {
      queryClient.setQueryData(
        ['notifications', 'unread', recipientId],
        { count: 0, items: [] },
      )
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all', recipientId] })
    },
  })

  // ── Supabase Realtime subscription ───────────────────────────────────────────

  useEffect(() => {
    if (!recipientId) return

    // Subscribe to new notifications for this recipient
    const channel = supabase
      .channel(`notifications:recipient:${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification

          // Add to unread cache
          queryClient.setQueryData(
            ['notifications', 'unread', recipientId],
            (old: UnreadResult | undefined) => {
              const existing = old ?? { count: 0, items: [] }

              // Smart batching: update existing notification in cache if same batch_key
              const batchKey = (newNotification as any).batch_key
              if (batchKey) {
                const existingIdx = existing.items.findIndex(
                  n => (n as any).batch_key === batchKey,
                )
                if (existingIdx !== -1) {
                  const updated = [...existing.items]
                  updated[existingIdx] = newNotification
                  return { count: existing.count, items: updated }
                }
              }

              return {
                count: existing.count + 1,
                items: [newNotification, ...existing.items].slice(0, 50),
              }
            },
          )

          // Trigger bell animation via custom event
          window.dispatchEvent(
            new CustomEvent('op:notification:new', {
              detail: { urgency: newNotification.urgency },
            }),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          // Reflect read state changes from other sessions
          if (updated.is_read) {
            queryClient.setQueryData(
              ['notifications', 'unread', recipientId],
              (old: UnreadResult | undefined) => {
                if (!old) return old
                return {
                  count: Math.max(0, old.count - 1),
                  items: old.items.filter(n => n.id !== updated.id),
                }
              },
            )
          }
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [recipientId, queryClient, supabase])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const markRead = useCallback(
    (ids: string[]) => markReadMutation.mutate(ids),
    [markReadMutation],
  )

  const markAllRead = useCallback(
    () => markAllReadMutation.mutate(),
    [markAllReadMutation],
  )

  const fetchPage = useCallback(
    (page: number) => fetchAll(page),
    [],
  )

  return {
    unreadCount,
    unreadItems,
    isLoading: unreadQuery.isLoading,
    markRead,
    markAllRead,
    fetchPage,
  }
}
