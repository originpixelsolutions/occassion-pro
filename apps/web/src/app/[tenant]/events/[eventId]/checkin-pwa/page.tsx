'use client'

/**
 * Offline PWA Check-in Page
 *
 * Loads and caches the full guest list from the API on mount.
 * Falls back to IndexedDB cache if offline.
 *
 * Tabs:
 *   - QR Scanner  → continuous camera scan
 *   - Search      → fuzzy search over cached guests
 *
 * Guest card appears after a successful scan or search selection.
 * Stats bar shows total / checked-in counts.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { QrScanner } from './components/QrScanner'
import { GuestSearch } from './components/GuestSearch'
import { SyncStatus } from './components/SyncStatus'
import { useCheckinCache, type CachedGuest } from './hooks/useCheckinCache'
import { useOfflineSync } from './hooks/useOfflineSync'

interface CheckinPageProps {
  params: { tenant: string; eventId: string }
}

type Tab = 'scanner' | 'search'
type CheckinResult = 'success' | 'duplicate' | 'not_found' | null

interface GuestCardState {
  guest: CachedGuest
  result: 'success' | 'duplicate'
}

export default function CheckinPwaPage({ params }: CheckinPageProps) {
  const { tenant, eventId } = params

  const [tab, setTab] = useState<Tab>('scanner')
  const [guests, setGuests] = useState<CachedGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [guestCard, setGuestCard] = useState<GuestCardState | null>(null)
  const [notFoundValue, setNotFoundValue] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0 })
  const tokenRef = useRef<string>('')
  const cardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cache = useCheckinCache()
  const syncState = useOfflineSync(eventId)

  // Get auth token from Supabase browser client
  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await sb.auth.getSession()
    tokenRef.current = data.session?.access_token ?? ''
    return tokenRef.current
  }, [])

  // Fetch + cache the guest list
  const loadGuests = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api'
      const url = `${apiBase}/v1/guests/${eventId}?page_size=2000&include_checked_in=true`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('API error')

      const { data } = await res.json()
      const mapped: CachedGuest[] = (data ?? []).map((g: Record<string, unknown>) => ({
        id: g.id as string,
        guest_name: g.guest_name as string,
        email: (g.email as string) ?? null,
        phone: (g.phone as string) ?? null,
        company: (g.company as string) ?? null,
        table_number: (g.table_number as string) ?? null,
        ticket_type: (g.ticket_type as string) ?? null,
        qr_code: (g.qr_code as string) ?? null,
        is_checked_in: (g.is_checked_in as boolean) ?? false,
        checked_in_at: (g.checked_in_at as string) ?? null,
        event_id: eventId,
        photo_url: (g.photo_url as string) ?? null,
        notes: (g.notes as string) ?? null,
      }))

      await cache.cacheGuestList(eventId, mapped)
      setGuests(mapped)
    } catch {
      // Offline or API error — fall back to cache
      const cached = await cache.getCachedGuests(eventId)
      setGuests(cached)
    } finally {
      setLoading(false)
    }
  }, [eventId, getToken, cache])

  const refreshStats = useCallback(async () => {
    const s = await cache.getStats(eventId)
    setStats(s)
  }, [eventId, cache])

  useEffect(() => {
    loadGuests()
  }, [loadGuests])

  useEffect(() => {
    if (!loading) refreshStats()
  }, [loading, guests, refreshStats])

  // Listen for sync-complete events to refresh stats
  useEffect(() => {
    const handler = () => refreshStats()
    window.addEventListener('checkin-sync-complete', handler)
    return () => window.removeEventListener('checkin-sync-complete', handler)
  }, [refreshStats])

  // Show guest card for 4 seconds then auto-dismiss
  const showCard = useCallback((guest: CachedGuest, result: 'success' | 'duplicate') => {
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
    setNotFoundValue(null)
    setGuestCard({ guest, result })
    cardTimerRef.current = setTimeout(() => setGuestCard(null), 4000)
  }, [])

  // Perform check-in
  const checkInGuest = useCallback(
    async (guest: CachedGuest) => {
      // Optimistic local update first
      await cache.markCheckedIn(guest.id)
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id ? { ...g, is_checked_in: true, checked_in_at: new Date().toISOString() } : g,
        ),
      )
      showCard({ ...guest, is_checked_in: true }, 'success')
      await refreshStats()

      const token = await getToken()
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api'
      const url = `${apiBase}/v1/guests/${guest.id}/checkin`

      if (!navigator.onLine) {
        await cache.enqueuePendingCheckin(guest.id, eventId, token, url)
        syncState.refreshPendingCount()
        return
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ event_id: eventId }),
        })
        if (!res.ok && res.status !== 409) {
          // Enqueue for retry if server error
          await cache.enqueuePendingCheckin(guest.id, eventId, token, url)
          syncState.refreshPendingCount()
        }
      } catch {
        await cache.enqueuePendingCheckin(guest.id, eventId, token, url)
        syncState.refreshPendingCount()
      }
    },
    [cache, eventId, getToken, showCard, refreshStats, syncState],
  )

  const handleScan = useCallback(
    (guest: CachedGuest) => checkInGuest(guest),
    [checkInGuest],
  )

  const handleAlreadyCheckedIn = useCallback(
    (guest: CachedGuest) => showCard(guest, 'duplicate'),
    [showCard],
  )

  const handleNotFound = useCallback((qrValue: string) => {
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
    setGuestCard(null)
    setNotFoundValue(qrValue)
    cardTimerRef.current = setTimeout(() => setNotFoundValue(null), 3000)
  }, [])

  const handleSearchSelect = useCallback(
    (guest: CachedGuest) => {
      if (guest.is_checked_in) {
        showCard(guest, 'duplicate')
      } else {
        checkInGuest(guest)
      }
    },
    [checkInGuest, showCard],
  )

  return (
    <div className="flex flex-col h-full select-none">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div>
          <h1 className="text-white font-semibold text-base leading-tight">Guest Check-in</h1>
          <p className="text-white/30 text-xs mt-0.5 truncate max-w-[180px]">
            {tenant} · Event {eventId.slice(0, 8)}
          </p>
        </div>
        <SyncStatus syncState={syncState} onSyncNow={syncState.drainQueue} />
      </header>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0">
        <StatChip
          label="Total"
          value={stats.total}
          color="text-white/60"
        />
        <div className="w-px h-4 bg-white/10" />
        <StatChip
          label="Checked in"
          value={stats.checkedIn}
          color="text-emerald-400"
        />
        {stats.total > 0 && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.checkedIn / stats.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-white/40 w-8 text-right">
              {Math.round((stats.checkedIn / stats.total) * 100)}%
            </span>
          </>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 mx-4 mb-3 p-1 bg-white/5 rounded-xl shrink-0">
        {(['scanner', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
                        ${tab === t
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-white/50 hover:text-white/80'
                        }`}
          >
            {t === 'scanner' ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan QR
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
                </svg>
                Search
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto px-4 pb-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-white/40">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading guest list…</span>
            </div>
          </div>
        ) : (
          <>
            {tab === 'scanner' && (
              <QrScanner
                onScan={handleScan}
                onAlreadyCheckedIn={handleAlreadyCheckedIn}
                onNotFound={handleNotFound}
                lookupByQr={(qr) => cache.getGuestByQr(qr)}
              />
            )}

            {tab === 'search' && (
              <GuestSearch
                guests={guests}
                onSelect={handleSearchSelect}
              />
            )}
          </>
        )}
      </div>

      {/* ── Guest card toast ── */}
      {guestCard && (
        <GuestCard
          guest={guestCard.guest}
          result={guestCard.result}
          onDismiss={() => setGuestCard(null)}
        />
      )}

      {/* ── Not found toast ── */}
      {notFoundValue && (
        <div className="fixed bottom-6 inset-x-4 z-50 pointer-events-none">
          <div className="mx-auto max-w-sm bg-red-950/90 border border-red-500/30 backdrop-blur-xl
                          rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-medium">Guest not found</p>
              <p className="text-red-400/60 text-xs truncate max-w-[220px]">{notFoundValue}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-white/30 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function GuestCard({
  guest,
  result,
  onDismiss,
}: {
  guest: CachedGuest
  result: 'success' | 'duplicate'
  onDismiss: () => void
}) {
  const isSuccess = result === 'success'

  return (
    <div className="fixed bottom-6 inset-x-4 z-50">
      <div
        className={`mx-auto max-w-sm border backdrop-blur-xl rounded-2xl px-4 py-4
                    shadow-2xl flex items-center gap-3 cursor-pointer active:scale-98 transition-transform
                    ${isSuccess
                      ? 'bg-emerald-950/90 border-emerald-500/30'
                      : 'bg-amber-950/90 border-amber-500/30'
                    }`}
        onClick={onDismiss}
      >
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                      ${isSuccess ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}
        >
          {isSuccess ? (
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          )}
        </div>

        {/* Guest info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm truncate">{guest.guest_name}</p>
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium
                          ${isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                          }`}
            >
              {isSuccess ? '✓ Checked in' : 'Already in'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
            {guest.ticket_type && <span>{guest.ticket_type}</span>}
            {guest.table_number && <span className="text-indigo-400">Table {guest.table_number}</span>}
            {guest.company && <span className="truncate">{guest.company}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
