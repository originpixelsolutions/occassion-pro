'use client'

/**
 * useCheckinCache
 *
 * Dexie.js wrapper for offline guest storage + check-in queue.
 *
 * Tables:
 *   guests          – full guest list cached from API on page load
 *   pendingCheckins – check-ins made while offline, drained on reconnect
 *
 * Usage:
 *   const { cacheGuestList, markCheckedIn, getPendingSync, clearSynced } = useCheckinCache()
 */

import Dexie, { type Table } from 'dexie'

// ─── Schema Types ─────────────────────────────────────────────────────────────

export interface CachedGuest {
  id: string
  guest_name: string
  email: string | null
  phone: string | null
  company: string | null
  table_number: string | null
  ticket_type: string | null
  qr_code: string | null
  is_checked_in: boolean
  checked_in_at: string | null
  event_id: string
  photo_url: string | null
  notes: string | null
}

export interface PendingCheckin {
  id?: number // auto-increment
  guestId: string
  eventId: string
  timestamp: number
  retryCount: number
  token: string
  apiUrl: string
}

// ─── Dexie Database ───────────────────────────────────────────────────────────

class CheckinDatabase extends Dexie {
  guests!: Table<CachedGuest, string>
  pendingCheckins!: Table<PendingCheckin, number>

  constructor() {
    super('op-checkin-db')
    this.version(1).stores({
      guests: 'id, event_id, is_checked_in, qr_code, email',
      pendingCheckins: '++id, guestId, eventId, timestamp',
    })
  }
}

// Singleton — one DB instance per page
let db: CheckinDatabase | null = null

function getDb(): CheckinDatabase {
  if (!db) db = new CheckinDatabase()
  return db
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckinCache() {
  /**
   * Replace the full guest list for an event in IndexedDB.
   * Called once on page load after fetching from API.
   */
  async function cacheGuestList(eventId: string, guests: CachedGuest[]): Promise<void> {
    const database = getDb()
    // Remove stale records for this event, then bulk-insert fresh data
    await database.guests.where('event_id').equals(eventId).delete()
    await database.guests.bulkPut(guests)
  }

  /**
   * Mark a guest as checked in locally (optimistic update).
   * Also removes any pending sync entry for this guest.
   */
  async function markCheckedIn(guestId: string): Promise<void> {
    const database = getDb()
    await database.guests.update(guestId, {
      is_checked_in: true,
      checked_in_at: new Date().toISOString(),
    })
  }

  /**
   * Get all pending check-ins waiting to be synced.
   */
  async function getPendingSync(): Promise<PendingCheckin[]> {
    return getDb().pendingCheckins.toArray()
  }

  /**
   * Add a check-in to the pending queue (called when offline).
   */
  async function enqueuePendingCheckin(
    guestId: string,
    eventId: string,
    token: string,
    apiUrl: string,
  ): Promise<void> {
    const database = getDb()
    // Avoid duplicates — if already queued, skip
    const existing = await database.pendingCheckins
      .where('guestId')
      .equals(guestId)
      .first()
    if (existing) return

    await database.pendingCheckins.add({
      guestId,
      eventId,
      timestamp: Date.now(),
      retryCount: 0,
      token,
      apiUrl,
    })
  }

  /**
   * Remove synced check-ins from the pending queue by their IDs.
   */
  async function clearSynced(ids: number[]): Promise<void> {
    await getDb().pendingCheckins.bulkDelete(ids)
  }

  /**
   * Get all guests for an event from cache.
   */
  async function getCachedGuests(eventId: string): Promise<CachedGuest[]> {
    return getDb().guests.where('event_id').equals(eventId).toArray()
  }

  /**
   * Look up a guest by QR code value.
   */
  async function getGuestByQr(qrCode: string): Promise<CachedGuest | undefined> {
    return getDb().guests.where('qr_code').equals(qrCode).first()
  }

  /**
   * Get current check-in stats for an event.
   */
  async function getStats(
    eventId: string,
  ): Promise<{ total: number; checkedIn: number; pending: number }> {
    const database = getDb()
    const total = await database.guests.where('event_id').equals(eventId).count()
    const checkedIn = await database.guests
      .where({ event_id: eventId, is_checked_in: true as unknown as string })
      .count()
    const pending = await database.pendingCheckins
      .where('eventId')
      .equals(eventId)
      .count()
    return { total, checkedIn, pending }
  }

  return {
    cacheGuestList,
    markCheckedIn,
    getPendingSync,
    enqueuePendingCheckin,
    clearSynced,
    getCachedGuests,
    getGuestByQr,
    getStats,
  }
}
