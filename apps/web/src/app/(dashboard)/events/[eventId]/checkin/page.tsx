'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────

interface CheckinStats {
  total_guests: number
  checked_in: number
  not_arrived: number
  vip_checked_in: number
  vip_total: number
  zones: { zone_id: string; zone_name: string; checked_in: number; total: number }[]
}

interface RecentCheckin {
  guest_id: string
  name: string
  table_number?: string
  category?: string
  checked_in_at: string
  zone?: string
  is_vip?: boolean
}

interface GuestRow {
  id: string
  name: string
  mobile?: string
  email?: string
  table_number?: string
  category?: string
  rsvp_status: string
  check_in_status: 'not_checked_in' | 'checked_in' | 'checked_out'
  checked_in_at?: string
  is_vip?: boolean
  dietary_requirement?: string
}

type TabKey = 'overview' | 'manual' | 'scanner' | 'noshows'

// ─── Helpers ───────────────────────────────────────────────────────────────

function pct(n: number, d: number) {
  if (!d) return 0
  return Math.round((n / d) * 100)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false, pulse = false,
}: { label: string; value: number | string; sub?: string; accent?: boolean; pulse?: boolean }) {
  return (
    <div className={`bg-zinc-900/60 border rounded-xl p-5 ${accent ? 'border-violet-500/40' : 'border-zinc-800'}`}>
      <div className="flex items-start justify-between">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        {pulse && (
          <span className="flex h-2 w-2 mt-0.5">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold mt-2 ${accent ? 'text-violet-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = 'bg-violet-500' }: { value: number; max: number; color?: string }) {
  const p = pct(value, max)
  return (
    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${p}%` }} />
    </div>
  )
}

// ─── Badge ──────────────────────────────────────────────────────────────────

function Badge({ status }: { status: GuestRow['check_in_status'] }) {
  if (status === 'checked_in') return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30">Checked In</span>
  )
  if (status === 'checked_out') return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">Checked Out</span>
  )
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">Pending</span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = params.eventId

  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [recentFeed, setRecentFeed] = useState<RecentCheckin[]>([])
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [guestsLoading, setGuestsLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [search, setSearch] = useState('')
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' })
  const [manualCheckinLoading, setManualCheckinLoading] = useState<string | null>(null)
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const scannerRef = useRef<HTMLVideoElement>(null)
  const scannerInstanceRef = useRef<unknown>(null)

  const supabase = createClient()

  // ── Auth token ─────────────────────────────────────────────────────────────

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  // ── Fetch stats ────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      const r = await fetch(`/api/v1/events/${eventId}/checkin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setStats(data)
      }
    } catch {}
    finally { setStatsLoading(false) }
  }, [eventId])

  // ── Fetch guests ───────────────────────────────────────────────────────────

  const fetchGuests = useCallback(async () => {
    setGuestsLoading(true)
    const token = await getToken()
    if (!token) { setGuestsLoading(false); return }
    try {
      const r = await fetch(`/api/v1/events/${eventId}/guests?include_checkin=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setGuests(Array.isArray(data) ? data : data.guests ?? [])
      }
    } catch {}
    finally { setGuestsLoading(false) }
  }, [eventId])

  // ── Realtime recent check-in feed via Supabase ─────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`checkin-feed-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'guest_details', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const g = payload.new as Record<string, unknown>
          if (g.check_in_status === 'checked_in' && g.checked_in_at) {
            const entry: RecentCheckin = {
              guest_id: g.id as string,
              name: g.name as string,
              table_number: g.table_number as string | undefined,
              category: g.category as string | undefined,
              checked_in_at: g.checked_in_at as string,
              is_vip: g.is_vip as boolean | undefined,
            }
            setRecentFeed(prev => [entry, ...prev].slice(0, 50))
            fetchStats()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId, supabase, fetchStats])

  // ── Poll stats every 10s ───────────────────────────────────────────────────

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // ── Fetch guests on tab switch ─────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'manual' || activeTab === 'noshows') fetchGuests()
  }, [activeTab, fetchGuests])

  // ── QR scanner (ZXing via dynamic import) ─────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'scanner') {
      if (scannerInstanceRef.current) {
        ;(scannerInstanceRef.current as { stop?: () => void }).stop?.()
        scannerInstanceRef.current = null
      }
      return
    }

    let stopped = false

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/library')
        const codeReader = new BrowserQRCodeReader()
        scannerInstanceRef.current = codeReader
        if (stopped) return
        codeReader.decodeFromVideoDevice(undefined, scannerRef.current!, async (result, err) => {
          if (result) {
            const qrCode = result.getText()
            setScanStatus({ type: 'idle' })
            try {
              const token = await getToken()
              const r = await fetch(`/api/v1/events/${eventId}/checkin/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ qrCode }),
              })
              const data = await r.json()
              if (r.ok) {
                setScanStatus({ type: 'success', message: `✓ ${data.guest_name ?? 'Guest'} checked in` })
                fetchStats()
              } else {
                setScanStatus({ type: 'error', message: data.message ?? 'Scan failed' })
              }
            } catch {
              setScanStatus({ type: 'error', message: 'Network error — try again' })
            }
            setTimeout(() => setScanStatus({ type: 'idle' }), 3000)
          }
        })
      } catch {
        setScanStatus({ type: 'error', message: 'Camera not accessible' })
      }
    }

    startScanner()
    return () => {
      stopped = true
      ;(scannerInstanceRef.current as { stop?: () => void })?.stop?.()
    }
  }, [activeTab, eventId])

  // ── Manual check-in ────────────────────────────────────────────────────────

  async function handleManualCheckin(guestId: string) {
    setManualCheckinLoading(guestId)
    try {
      const token = await getToken()
      const r = await fetch(`/api/v1/events/${eventId}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrCode: `MANUAL:${guestId}` }),
      })
      if (r.ok) {
        setGuests(prev =>
          prev.map(g => g.id === guestId ? { ...g, check_in_status: 'checked_in', checked_in_at: new Date().toISOString() } : g)
        )
        fetchStats()
      }
    } catch {}
    finally { setManualCheckinLoading(null) }
  }

  // ── Filtered guest lists ───────────────────────────────────────────────────

  const filteredGuests = guests.filter(g => {
    const q = search.toLowerCase()
    const matchSearch = !q || g.name.toLowerCase().includes(q) || g.mobile?.includes(q) || g.email?.toLowerCase().includes(q)
    const matchZone = zoneFilter === 'all' || g.table_number === zoneFilter
    return matchSearch && matchZone
  })

  const noShows = filteredGuests.filter(g =>
    g.rsvp_status === 'attending' && g.check_in_status === 'not_checked_in'
  )

  const manualGuests = filteredGuests.filter(g =>
    activeTab === 'manual' && g.check_in_status !== 'checked_in'
  )

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'manual', label: 'Manual Check-in' },
    { key: 'scanner', label: 'QR Scanner' },
    { key: 'noshows', label: `No-Shows${stats ? ` (${stats.not_arrived})` : ''}` },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────

  const checkinPct = stats ? pct(stats.checked_in, stats.total_guests) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Check-in Management</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Live guest check-in · updates in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
          <a
            href={`/${params.eventId}/checkin-pwa`}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
          >
            Open Offline PWA ↗
          </a>
        </div>
      </div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Checked In" value={stats.checked_in} sub={`${checkinPct}% of total`} accent pulse />
            <StatCard label="Total Guests" value={stats.total_guests} sub="confirmed + walk-ins" />
            <StatCard label="Not Arrived" value={stats.not_arrived} sub="RSVP'd but absent" />
            <StatCard label="VIP" value={`${stats.vip_checked_in}/${stats.vip_total}`} sub="VIPs checked in" />
          </div>

          {/* Overall progress bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-zinc-400 text-sm">Overall check-in progress</p>
              <p className="text-white text-sm font-medium">{checkinPct}%</p>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-700"
                style={{ width: `${checkinPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-zinc-500 text-xs">{stats.checked_in} checked in</p>
              <p className="text-zinc-500 text-xs">{stats.total_guests} total</p>
            </div>
          </div>

          {/* Zone breakdown */}
          {stats.zones.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-medium text-zinc-200 mb-4">Zone Breakdown</h2>
              <div className="space-y-3">
                {stats.zones.map(z => (
                  <div key={z.zone_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-zinc-300 text-sm">{z.zone_name}</p>
                      <p className="text-zinc-400 text-xs">{z.checked_in}/{z.total}</p>
                    </div>
                    <ProgressBar value={z.checked_in} max={z.total} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No check-in data available</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview — Recent feed */}
      {activeTab === 'overview' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">Live Check-in Feed</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Updates automatically as guests check in</p>
          </div>
          {recentFeed.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-8 h-8 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <p className="text-zinc-500 text-sm">Waiting for guests to check in…</p>
              <p className="text-zinc-600 text-xs mt-1">This feed updates in real-time</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {recentFeed.map((r, i) => (
                <div key={`${r.guest_id}-${i}`} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300 flex-shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{r.name}</p>
                      {r.is_vip && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">VIP</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs">
                      {r.category && <span className="capitalize">{r.category}</span>}
                      {r.table_number && <span> · Table {r.table_number}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 text-xs font-medium">{fmtTime(r.checked_in_at)}</p>
                    <p className="text-zinc-600 text-[10px]">{fmtDate(r.checked_in_at)}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Manual Check-in */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, mobile, or email…"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {guestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
              {manualGuests.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 text-sm">
                    {search ? 'No guests match your search' : 'All confirmed guests have checked in'}
                  </p>
                </div>
              ) : (
                manualGuests.map(g => (
                  <div key={g.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300 flex-shrink-0">
                      {initials(g.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{g.name}</p>
                        {g.is_vip && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">VIP</span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs">
                        {g.mobile && <span>{g.mobile}</span>}
                        {g.table_number && <span> · Table {g.table_number}</span>}
                        {g.category && <span className="capitalize"> · {g.category}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge status={g.check_in_status} />
                      {g.check_in_status !== 'checked_in' && (
                        <button
                          onClick={() => handleManualCheckin(g.id)}
                          disabled={manualCheckinLoading === g.id}
                          className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {manualCheckinLoading === g.id ? '…' : 'Check In'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: QR Scanner */}
      {activeTab === 'scanner' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-200 mb-1">Browser QR Scanner</h2>
            <p className="text-zinc-500 text-xs mb-4">Point camera at a guest's QR code to check them in instantly</p>

            {/* Scan status */}
            {scanStatus.type !== 'idle' && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
                scanStatus.type === 'success'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}>
                {scanStatus.message}
              </div>
            )}

            {/* Video feed */}
            <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-video max-w-lg mx-auto">
              <video ref={scannerRef} className="w-full h-full object-cover" />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-violet-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-violet-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-violet-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-violet-400 rounded-br" />
                  {/* Scan line */}
                  <div className="absolute inset-x-0 top-0 h-px bg-violet-400 opacity-70 animate-[scanLine_2s_linear_infinite]" />
                </div>
              </div>
            </div>

            <p className="text-zinc-600 text-xs text-center mt-3">Camera access required · Works on Chrome/Edge/Safari</p>
            <p className="text-zinc-600 text-xs text-center mt-1">
              For dedicated check-in tablets, use the{' '}
              <a href={`/${eventId}/checkin-pwa`} className="text-violet-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Offline PWA ↗
              </a>
            </p>
          </div>

          <style>{`
            @keyframes scanLine {
              0% { top: 0; }
              50% { top: 100%; }
              100% { top: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Tab: No-Shows */}
      {activeTab === 'noshows' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search no-shows…"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={fetchGuests}
              className="px-4 py-2.5 text-xs bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-zinc-400 text-xs">
              Guests who confirmed attendance (RSVP: Attending) but have not yet checked in.
            </p>
          </div>

          {guestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
              {noShows.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-8 h-8 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-zinc-500 text-sm">
                    {search ? 'No results match your search' : 'All confirmed guests have arrived!'}
                  </p>
                </div>
              ) : (
                noShows.map(g => (
                  <div key={g.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-red-900/30 flex items-center justify-center text-xs font-medium text-red-400 flex-shrink-0">
                      {initials(g.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{g.name}</p>
                        {g.is_vip && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">VIP</span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs">
                        {g.mobile && <span>{g.mobile}</span>}
                        {g.table_number && <span> · Table {g.table_number}</span>}
                        {g.category && <span className="capitalize"> · {g.category}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                        No-Show
                      </span>
                      <button
                        onClick={() => handleManualCheckin(g.id)}
                        disabled={manualCheckinLoading === g.id}
                        className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        {manualCheckinLoading === g.id ? '…' : 'Check In'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {noShows.length > 0 && (
            <div className="flex justify-end">
              <button className="px-4 py-2 text-xs bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors">
                Export No-Show List (.xlsx)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
