/**
 * OccasionPro — Supabase Realtime hooks
 *
 * Central library for all real-time subscriptions across the platform.
 * Every module should use these hooks instead of raw Supabase channel calls.
 *
 * Pattern: React Query (initial fetch + cache) + Supabase Realtime (cache invalidation)
 * Result:  Instant UI updates, no full refetches, no stale data on active events.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type TableName =
  | 'guests' | 'guest_dietary_preferences' | 'guest_accommodations'
  | 'events' | 'event_modules'
  | 'runsheet_tasks' | 'runsheet_comments'
  | 'vendors' | 'vendor_payments'
  | 'budget_categories' | 'budget_items'
  | 'invoices' | 'invoice_payments' | 'invoice_payment_attempts'
  | 'fnb_items' | 'fnb_serving_sessions' | 'fnb_tokens'
  | 'accommodation_rooms' | 'accommodation_allocations'
  | 'floor_plan_objects'
  | 'documents'
  | 'communications'
  | 'check_in_logs'
  | 'short_links'
  | string // allow custom table names

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeOptions {
  /** Supabase table to subscribe to */
  table: TableName
  /** Row-level filter e.g. "event_id=eq.abc" */
  filter?: string
  /** Which events to listen for (default: all) */
  events?: ChangeEvent[]
  /** React Query keys to invalidate on change */
  queryKeys?: unknown[][]
  /** Custom handler, called in addition to queryKey invalidation */
  onPayload?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  /** Disable the subscription (e.g. when eventId is not yet loaded) */
  enabled?: boolean
}

/**
 * Core hook: subscribe to a single Supabase table and invalidate React Query cache.
 *
 * @example
 * useRealtime({
 *   table: 'guests',
 *   filter: `event_id=eq.${eventId}`,
 *   queryKeys: [['guests', eventId]],
 * })
 */
export function useRealtime({
  table,
  filter,
  events = ['*'],
  queryKeys = [],
  onPayload,
  enabled = true,
}: UseRealtimeOptions) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Keep a stable ref to onPayload so we don't recreate the channel on every render
  const onPayloadRef = useRef(onPayload)
  onPayloadRef.current = onPayload

  useEffect(() => {
    if (!enabled) return

    const channelName = `rt:${table}:${filter ?? 'all'}:${Date.now()}`
    const channel = supabase.channel(channelName)

    events.forEach(event => {
      channel.on(
        'postgres_changes',
        {
          event: event as '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          // Invalidate all provided query keys
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key })
          })
          // Call custom handler if provided
          onPayloadRef.current?.(payload as RealtimePostgresChangesPayload<Record<string, unknown>>)
        }
      )
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled, JSON.stringify(events)])
}

/**
 * Subscribe to multiple tables at once.
 * Useful for module-level subscriptions where several tables are relevant.
 *
 * @example
 * useMultiRealtime([
 *   { table: 'guests',       filter: `event_id=eq.${eventId}`, queryKeys: [['guests', eventId]] },
 *   { table: 'runsheet_tasks', filter: `event_id=eq.${eventId}`, queryKeys: [['runsheet', eventId]] },
 * ])
 */
export function useMultiRealtime(subscriptions: UseRealtimeOptions[]) {
  subscriptions.forEach(sub => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtime(sub)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-module convenience hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useGuestRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'guests',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['guests', eventId], ['event-health', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'guest_dietary_preferences',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['guests', eventId], ['fnb-coverage', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useRunsheetRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'runsheet_tasks',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['runsheet', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'runsheet_comments',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['runsheet-comments', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useVendorRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'vendors',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['vendors', eventId], ['budget', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'vendor_payments',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['vendor-payments', eventId], ['budget', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useBudgetRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'budget_categories',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['budget', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'budget_items',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['budget', eventId], ['budget-items', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useFinanceRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'invoices',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['invoices', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'invoice_payments',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['invoice-payments', eventId], ['budget', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useFnbRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'fnb_items',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['fnb', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'fnb_tokens',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['fnb-tokens', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useAccommodationRealtime(eventId: string) {
  useMultiRealtime([
    {
      table: 'accommodation_rooms',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['accommodation', eventId]],
      enabled: !!eventId,
    },
    {
      table: 'accommodation_allocations',
      filter: `event_id=eq.${eventId}`,
      queryKeys: [['accommodation', eventId], ['guests', eventId]],
      enabled: !!eventId,
    },
  ])
}

export function useCheckinRealtime(eventId: string) {
  useRealtime({
    table: 'check_in_logs',
    filter: `event_id=eq.${eventId}`,
    queryKeys: [['checkin', eventId], ['guests', eventId], ['event-health', eventId]],
    enabled: !!eventId,
  })
}

export function useFloorPlanRealtime(eventId: string) {
  useRealtime({
    table: 'floor_plan_objects',
    filter: `event_id=eq.${eventId}`,
    queryKeys: [['floor-plan', eventId]],
    enabled: !!eventId,
  })
}

export function useCommunicationsRealtime(eventId: string) {
  useRealtime({
    table: 'communications',
    filter: `event_id=eq.${eventId}`,
    queryKeys: [['communications', eventId]],
    enabled: !!eventId,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT-LEVEL hook — subscribe to all relevant modules for a single event
// Use this at the event page layout level so all child modules get real-time
// ─────────────────────────────────────────────────────────────────────────────

export function useEventRealtime(eventId: string) {
  useGuestRealtime(eventId)
  useRunsheetRealtime(eventId)
  useVendorRealtime(eventId)
  useBudgetRealtime(eventId)
  useFinanceRealtime(eventId)
  useFnbRealtime(eventId)
  useAccommodationRealtime(eventId)
  useCheckinRealtime(eventId)
  useCommunicationsRealtime(eventId)
}
