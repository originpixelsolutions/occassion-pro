'use client'

/**
 * useOfflineSync
 *
 * Listens for the browser coming online and drains the pending check-in queue.
 * Also receives SYNC_COMPLETE messages from the service worker (Background Sync).
 *
 * Conflict handling:
 *   - 200/201 → success, remove from queue
 *   - 409     → guest already checked in (server wins) — treat as success, remove
 *   - 4xx     → bad data, discard (won't succeed on retry)
 *   - 5xx / network error → keep in queue, retry on next online event
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCheckinCache } from './useCheckinCache'

export interface SyncState {
  online: boolean
  pendingCount: number
  syncing: boolean
  lastSyncedAt: Date | null
  lastError: string | null
}

export function useOfflineSync(eventId: string) {
  const { getPendingSync, clearSynced, markCheckedIn } = useCheckinCache()
  const [state, setState] = useState<SyncState>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    syncing: false,
    lastSyncedAt: null,
    lastError: null,
  })

  const syncingRef = useRef(false)

  // Refresh pending count from IndexedDB
  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSync()
    const forEvent = pending.filter((p) => p.eventId === eventId)
    setState((s) => ({ ...s, pendingCount: forEvent.length }))
  }, [eventId, getPendingSync])

  // Drain the queue — called on reconnect or manually
  const drainQueue = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setState((s) => ({ ...s, syncing: true, lastError: null }))

    try {
      const pending = await getPendingSync()
      const forEvent = pending.filter((p) => p.eventId === eventId)
      if (forEvent.length === 0) {
        setState((s) => ({ ...s, syncing: false, lastSyncedAt: new Date() }))
        return
      }

      const successIds: number[] = []
      let lastError: string | null = null

      for (const item of forEvent) {
        try {
          const res = await fetch(item.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${item.token}`,
            },
            body: JSON.stringify({
              guest_id: item.guestId,
              event_id: item.eventId,
              checked_in_at: new Date(item.timestamp).toISOString(),
            }),
          })

          if (res.ok || res.status === 409) {
            // 409 = already checked in on server — our local state is correct, just remove from queue
            await markCheckedIn(item.guestId)
            if (item.id !== undefined) successIds.push(item.id)
          } else if (res.status >= 400 && res.status < 500) {
            // Bad request — drop it, won't recover
            if (item.id !== undefined) successIds.push(item.id)
            lastError = `Check-in failed for guest ${item.guestId}: ${res.status}`
          }
          // 5xx: leave in queue
        } catch {
          // Network error — leave in queue
          lastError = 'Network error during sync — will retry when back online'
        }
      }

      if (successIds.length > 0) {
        await clearSynced(successIds)
      }

      const remaining = await getPendingSync()
      setState((s) => ({
        ...s,
        syncing: false,
        pendingCount: remaining.filter((p) => p.eventId === eventId).length,
        lastSyncedAt: new Date(),
        lastError,
      }))

      // Notify other components
      window.dispatchEvent(
        new CustomEvent('checkin-sync-complete', {
          detail: { synced: successIds.length },
        }),
      )
    } catch (err) {
      setState((s) => ({
        ...s,
        syncing: false,
        lastError: err instanceof Error ? err.message : 'Sync failed',
      }))
    } finally {
      syncingRef.current = false
    }
  }, [eventId, getPendingSync, clearSynced, markCheckedIn])

  // Register Background Sync with service worker when offline
  const registerBackgroundSync = useCallback(async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready
        await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(
          'checkin-queue',
        )
      } catch {
        // Background Sync not supported — silently ignore
      }
    }
  }, [])

  // Wire up online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setState((s) => ({ ...s, online: true }))
      drainQueue()
    }

    const handleOffline = () => {
      setState((s) => ({ ...s, online: false }))
      registerBackgroundSync()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for SW Background Sync completion messages
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        refreshPendingCount()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    // Initial pending count
    refreshPendingCount()

    // If online on mount, drain any leftover queue from previous offline session
    if (navigator.onLine) {
      drainQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [drainQueue, registerBackgroundSync, refreshPendingCount])

  return {
    ...state,
    drainQueue,
    refreshPendingCount,
  }
}
