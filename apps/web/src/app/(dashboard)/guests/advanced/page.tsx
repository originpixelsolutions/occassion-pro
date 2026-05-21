'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'tentative' | 'no_show'
type GuestType = 'vip' | 'family' | 'friend' | 'colleague' | 'vendor' | 'media' | 'other' | 'regular'
type MealPref = 'veg' | 'non_veg' | 'vegan' | 'jain' | 'kosher' | 'halal' | 'custom'

interface GuestDetail {
  id: string
  guest_id: string
  guest: { first_name: string; last_name: string; email?: string; phone?: string }
  group?: { name: string; side: string }
  guest_type: GuestType
  side?: string
  meal_preference?: MealPref
  dietary_notes?: string
  table_number?: string
  seat_number?: string
  seating_zone?: string
  seating_confirmed: boolean
  qr_code?: string
  checked_in: boolean
  check_in_time?: string
  rsvp_status: RsvpStatus
  plus_one_allowed: boolean
  plus_one_name?: string
  plus_one_checked_in: boolean
  gift_received: boolean
  gift_amount?: number
  invite_sent: boolean
  invite_channel?: string
  transport_needed: boolean
  hotel_needed: boolean
}

interface SeatingTable {
  id: string
  table_number: string
  table_name?: string
  table_type: string
  capacity: number
  zone?: string
  assigned_count: number
  guests: Array<{ guest: { first_name: string; last_name: string }; checked_in: boolean; guest_type: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rsvpConfig: Record<RsvpStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',    color: 'text-muted-foreground bg-slate-500/20' },
  confirmed: { label: 'Confirmed',  color: 'text-emerald-400 bg-emerald-500/20' },
  declined:  { label: 'Declined',   color: 'text-red-400 bg-red-500/20' },
  tentative: { label: 'Tentative',  color: 'text-amber-400 bg-amber-500/20' },
  no_show:   { label: 'No Show',    color: 'text-red-400 bg-red-500/10' },
}

const guestTypeColor: Record<GuestType, string> = {
  vip:       'text-amber-400 bg-amber-500/20',
  family:    'text-violet-400 bg-violet-500/20',
  friend:    'text-blue-400 bg-blue-500/20',
  colleague: 'text-foreground/80 bg-slate-500/20',
  vendor:    'text-orange-400 bg-orange-500/20',
  media:     'text-pink-400 bg-pink-500/20',
  other:     'text-muted-foreground bg-slate-500/15',
  regular:   'text-muted-foreground bg-slate-500/15',
}

const mealIcons: Record<string, string> = {
  veg: '🥗', non_veg: '🍗', vegan: '🌱', jain: '⭕', kosher: '✡', halal: '☪', custom: '🍽',
}

function initials(g: { first_name: string; last_name: string }) {
  return `${g.first_name[0]}${g.last_name[0]}`.toUpperCase()
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ─── QR Scanner Simulation ────────────────────────────────────────────────────

function QRScannerModal({ guests, onClose, onScan }: { guests: GuestDetail[]; onClose: () => void; onScan: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ success: boolean; name?: string; table?: string; meal?: string } | null>(null)

  const handleScan = () => {
    const guest = guests.find(g => g.qr_code === code.toUpperCase())
    if (!guest) {
      setResult({ success: false })
    } else if (guest.checked_in) {
      setResult({ success: false, name: `${guest.guest.first_name} ${guest.guest.last_name}` })
    } else {
      setResult({
        success: true,
        name: `${guest.guest.first_name} ${guest.guest.last_name}`,
        table: guest.table_number,
        meal: guest.meal_preference,
      })
      onScan(code.toUpperCase())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0f172a] border border-border/60 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-foreground">QR Check-in Scanner</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        {/* Simulated camera viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-6 flex items-center justify-center">
          <div className="absolute inset-4 border-2 border-violet-500/50 rounded-xl" />
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-violet-400 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-violet-400 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-violet-400 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-violet-400 rounded-br-lg" />
          <p className="text-muted-foreground text-sm">Camera feed (simulated)</p>
          {/* Scanning line animation */}
          <div className="absolute left-4 right-4 h-0.5 bg-violet-500/70 animate-bounce" style={{ top: '45%' }} />
        </div>

        {/* Manual entry fallback */}
        <div className="flex gap-2 mb-4">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Type QR code (e.g. ABC12345)"
            className="flex-1 rounded-xl bg-muted/40 border border-border/60 px-3 py-2.5 text-sm text-foreground placeholder-slate-500 font-mono uppercase tracking-wider outline-none"
            onKeyDown={e => e.key === 'Enter' && handleScan()}
          />
          <button
            onClick={handleScan}
            disabled={!code}
            className="px-4 py-2.5 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium disabled:opacity-40"
          >
            Scan
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-xl p-4 border ${result.success ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            {result.success ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <span className="font-semibold text-emerald-400">Checked In!</span>
                </div>
                <p className="text-foreground font-medium">{result.name}</p>
                {result.table && <p className="text-sm text-muted-foreground mt-1">Table: <span className="text-foreground">{result.table}</span></p>}
                {result.meal && <p className="text-sm text-muted-foreground">Meal: <span className="text-foreground">{mealIcons[result.meal]} {result.meal}</span></p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                <p className="text-red-400 font-medium">
                  {result.name ? `Already checked in: ${result.name}` : 'Invalid QR code'}
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-slate-600 mt-3 text-center">Enter the guest&apos;s QR code to check them in</p>
      </div>
    </div>
  )
}

// ─── Seating Chart Component ──────────────────────────────────────────────────

function SeatingChart({ tables }: { tables: SeatingTable[] }) {
  const [selectedTable, setSelectedTable] = useState<SeatingTable | null>(null)

  const typeIcon: Record<string, string> = { round: '⭕', rectangular: '▬', square: '⬜', head_table: '👑', kids: '🧸', cocktail: '🍸', banquet: '═' }
  const zones = ['Stage', 'Front', 'Middle', 'Back']

  return (
    <div className="space-y-6">
      {/* Floor plan grid */}
      <div className="rounded-2xl border border-border/30 bg-muted/20 p-6">
        <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
          <span>🗺️</span> Floor Plan
        </h3>

        {/* Stage area */}
        <div className="mb-4 flex justify-center">
          <div className="px-16 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 font-medium text-center">
            🎤 Stage / Mandap
          </div>
        </div>

        {zones.map(zone => {
          const zoneTables = tables.filter(t => t.zone === zone)
          if (!zoneTables.length) return null
          return (
            <div key={zone} className="mb-4">
              <p className="text-xs text-slate-600 uppercase tracking-wider mb-2">{zone}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {zoneTables.map(table => {
                  const fillPct = table.capacity > 0 ? Math.round((table.assigned_count / table.capacity) * 100) : 0
                  const checkedInCount = table.guests.filter(g => g.checked_in).length
                  const isSelected = selectedTable?.id === table.id
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(isSelected ? null : table)}
                      className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center border-2 transition-all hover:scale-105 ${
                        isSelected ? 'border-violet-400 bg-violet-500/20' : 'border-border/60 bg-muted/30 hover:border-border/80'
                      }`}
                    >
                      <span className="text-lg">{typeIcon[table.table_type] ?? '⭕'}</span>
                      <span className="text-xs font-bold text-foreground">{table.table_number}</span>
                      <span className="text-[9px] text-muted-foreground">{table.assigned_count}/{table.capacity}</span>
                      {/* Fill ring */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke={checkedInCount > 0 ? '#10b981' : '#7c3aed'} strokeWidth="2"
                          strokeDasharray={`${fillPct} 100`} />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Table Detail Panel */}
      {selectedTable && (
        <div className="rounded-2xl border border-border/30 bg-muted/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-foreground">{selectedTable.table_number} — {selectedTable.table_name}</h4>
              <p className="text-xs text-muted-foreground">{selectedTable.assigned_count}/{selectedTable.capacity} seats · Zone: {selectedTable.zone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{selectedTable.guests.filter(g => g.checked_in).length} checked in</p>
            </div>
          </div>
          <div className="space-y-2">
            {selectedTable.guests.map((g, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${g.checked_in ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/60 text-foreground/80'}`}>
                  {initials(g.guest)}
                </div>
                <span className="text-sm text-foreground">{g.guest.first_name} {g.guest.last_name}</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${guestTypeColor[g.guest_type as GuestType] ?? 'text-muted-foreground'}`}>{g.guest_type}</span>
                {g.checked_in ? (
                  <span className="text-xs text-emerald-400">✓ In</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not yet</span>
                )}
              </div>
            ))}
            {selectedTable.guests.length === 0 && (
              <p className="text-sm text-slate-600 text-center py-4">No guests assigned to this table</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'guests', label: 'Guest List', icon: '👥' },
  { id: 'checkin', label: 'Check-in', icon: '✅' },
  { id: 'seating', label: 'Seating', icon: '🪑' },
  { id: 'gifts', label: 'Gifts', icon: '🎁' },
]

export default function AdvancedGuestsPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showQR, setShowQR] = useState(false)
  const [filter, setFilter] = useState<{ rsvp: string; type: string; search: string }>({ rsvp: '', type: '', search: '' })

  // Event selector
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [eventId, setEventId] = useState('')
  const [eventsLoading, setEventsLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`${API}/events?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data.data ?? [])
        setEvents(list)
        if (list.length > 0) setEventId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false))
  }, [token])

  const [guests, setGuests] = useState<GuestDetail[]>([])
  const [tables, setTables] = useState<SeatingTable[]>([])
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    if (!token || !eventId) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [gData, tData] = await Promise.all([
        fetch(`${API}/guests/events/${eventId}/details`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/guests/events/${eventId}/tables`, { headers: h }).then(r => r.ok ? r.json() : []),
      ])
      setGuests(Array.isArray(gData) ? gData : (gData.data ?? []))
      setTables(Array.isArray(tData) ? tData : (tData.data ?? []))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token, eventId])

  useEffect(() => { loadAll() }, [loadAll])

  // Stats
  const total = guests.length
  const checkedIn = guests.filter(g => g.checked_in).length
  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length
  const pending = guests.filter(g => g.rsvp_status === 'pending').length
  const declined = guests.filter(g => g.rsvp_status === 'declined').length
  const vip = guests.filter(g => g.guest_type === 'vip').length
  const giftsReceived = guests.filter(g => g.gift_received).length
  const invitesSent = guests.filter(g => g.invite_sent).length
  const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0
  const rsvpRate = total > 0 ? Math.round(((confirmed + declined) / total) * 100) : 0

  // Filtered guests
  const filteredGuests = guests.filter(g => {
    if (filter.rsvp && g.rsvp_status !== filter.rsvp) return false
    if (filter.type && g.guest_type !== filter.type) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!`${g.guest.first_name} ${g.guest.last_name}`.toLowerCase().includes(q) &&
          !g.qr_code?.toLowerCase().includes(q) &&
          !(g.guest.phone?.includes(filter.search))) return false
    }
    return true
  })

  const handleQRScan = useCallback(async (code: string) => {
    if (!token) return
    const detail = guests.find(g => g.qr_code === code)
    if (detail) {
      await fetch(`${API}/guests/details/${detail.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checked_in: true }),
      })
      setGuests(prev => prev.map(g => g.qr_code === code ? { ...g, checked_in: true, check_in_time: new Date().toISOString() } : g))
    }
    setTimeout(() => setShowQR(false), 1500)
  }, [token, guests])

  const handleManualCheckin = useCallback(async (id: string) => {
    if (!token) return
    const current = guests.find(g => g.id === id)
    if (!current) return
    const newState = !current.checked_in
    const res = await fetch(`${API}/guests/details/${id}/checkin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ checked_in: newState }),
    })
    if (res.ok) {
      setGuests(prev => prev.map(g => g.id === id ? { ...g, checked_in: newState, check_in_time: newState ? new Date().toISOString() : undefined } : g))
    }
  }, [token, guests])

  const handleRsvp = useCallback(async (id: string, status: RsvpStatus) => {
    if (!token) return
    const res = await fetch(`${API}/guests/details/${id}/rsvp`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rsvp_status: status }),
    })
    if (res.ok) {
      setGuests(prev => prev.map(g => g.id === id ? { ...g, rsvp_status: status } : g))
    }
  }, [token])

  const handleGiftToggle = useCallback(async (id: string) => {
    if (!token) return
    const current = guests.find(g => g.id === id)
    if (!current) return
    const newState = !current.gift_received
    const res = await fetch(`${API}/guests/details/${id}/gift`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gift_received: newState }),
    })
    if (res.ok) {
      setGuests(prev => prev.map(g => g.id === id ? { ...g, gift_received: newState } : g))
    }
  }, [token, guests])

  const vegCount = guests.filter(g => g.meal_preference === 'veg').length
  const nonVegCount = guests.filter(g => g.meal_preference === 'non_veg').length
  const veganCount = guests.filter(g => g.meal_preference === 'vegan').length

  return (
    <div className="min-h-screen bg-[#0f172a] text-foreground">
      {showQR && <QRScannerModal guests={guests} onClose={() => setShowQR(false)} onScan={handleQRScan} />}

      {/* Header */}
      <div className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Guest Management</h1>
            <p className="text-xs text-muted-foreground">{total} guests · {checkedIn} checked in · {confirmed} confirmed</p>
          </div>
          <div className="flex items-center gap-2">
            {!eventsLoading && events.length > 0 && (
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground/80 outline-none focus:border-violet-500/50 max-w-[180px]"
              >
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            )}
            <button className="px-4 py-2 rounded-xl bg-muted/40 border border-border/60 text-foreground/80 text-sm hover:bg-muted/60 transition-colors">
              Import CSV
            </button>
            <button
              onClick={() => setShowQR(true)}
              className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20 flex items-center gap-2"
            >
              <span>📷</span> QR Check-in
            </button>
            <button className="px-4 py-2 rounded-xl bg-violet-600 text-foreground hover:bg-violet-500 transition-colors text-sm font-medium">
              + Add Guest
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Guests', value: total, sub: 'registered', color: 'text-foreground' },
                { label: 'Checked In', value: checkedIn, sub: `${checkInRate}% rate`, color: 'text-emerald-400' },
                { label: 'RSVP Confirmed', value: confirmed, sub: `${rsvpRate}% responded`, color: 'text-violet-400' },
                { label: 'VIP Guests', value: vip, sub: 'special treatment', color: 'text-amber-400' },
                { label: 'Gifts Received', value: giftsReceived, sub: `of ${confirmed} confirmed`, color: 'text-pink-400' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-2xl border border-border/30 bg-muted/30 p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-600 mt-1">{sub}</p>
                </div>
              ))}
            </div>

            {/* Progress bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Check-in Progress</h3>
                  <span className="text-sm font-bold text-emerald-400">{checkInRate}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${checkInRate}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>✓ {checkedIn} checked in</span>
                  <span>{total - checkedIn} remaining</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">RSVP Breakdown</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Confirmed', count: confirmed, color: '#10b981' },
                    { label: 'Pending', count: pending, color: 'hsl(var(--muted-foreground))' },
                    { label: 'Declined', count: declined, color: '#ef4444' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: total > 0 ? `${Math.round(count / total * 100)}%` : '0%', background: color }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Meal breakdown */}
            <div className="rounded-2xl border border-border/30 bg-muted/30 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Catering Headcount</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Vegetarian', count: vegCount, icon: '🥗', color: '#34d399' },
                  { label: 'Non-Vegetarian', count: nonVegCount, icon: '🍗', color: '#f59e0b' },
                  { label: 'Vegan', count: veganCount, icon: '🌱', color: '#a78bfa' },
                ].map(({ label, count, icon, color }) => (
                  <div key={label} className="rounded-xl p-4 text-center border border-border/30 bg-muted/20">
                    <span className="text-3xl">{icon}</span>
                    <p className="text-2xl font-bold mt-2" style={{ color }}>{count}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent check-ins */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Check-ins</h3>
              <div className="space-y-2">
                {guests.filter(g => g.checked_in).map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">{initials(g.guest)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{g.guest.first_name} {g.guest.last_name}</p>
                      <p className="text-xs text-muted-foreground">{g.table_number ? `Table ${g.table_number}` : 'No table'} · {mealIcons[g.meal_preference ?? ''] ?? ''} {g.meal_preference}</p>
                    </div>
                    {g.check_in_time && <span className="text-xs text-emerald-400">{fmtTime(g.check_in_time)}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${guestTypeColor[g.guest_type]}`}>{g.guest_type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GUEST LIST */}
        {activeTab === 'guests' && (
          <div>
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <input
                value={filter.search}
                onChange={e => setFilter(p => ({ ...p, search: e.target.value }))}
                placeholder="Search name, phone, QR code..."
                className="flex-1 min-w-48 rounded-xl bg-muted/40 border border-border/60 px-4 py-2 text-sm text-foreground placeholder-slate-500 outline-none"
              />
              <select
                value={filter.rsvp}
                onChange={e => setFilter(p => ({ ...p, rsvp: e.target.value }))}
                className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2 text-sm text-foreground/80"
              >
                <option value="">All RSVP</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
              <select
                value={filter.type}
                onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}
                className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2 text-sm text-foreground/80"
              >
                <option value="">All Types</option>
                <option value="vip">VIP</option>
                <option value="family">Family</option>
                <option value="friend">Friend</option>
                <option value="colleague">Colleague</option>
              </select>
              <span className="py-2 text-sm text-muted-foreground self-center">{filteredGuests.length} results</span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border/30 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/25 border-b border-border/30 text-xs text-muted-foreground uppercase tracking-wider">
                <div className="col-span-3">Guest</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-1">RSVP</div>
                <div className="col-span-1">Meal</div>
                <div className="col-span-2">Table</div>
                <div className="col-span-2">QR Code</div>
                <div className="col-span-2">Actions</div>
              </div>
              {filteredGuests.map(g => {
                const rsvpCfg = rsvpConfig[g.rsvp_status]
                return (
                  <div key={g.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors ${g.checked_in ? 'bg-emerald-500/[0.03]' : ''}`}>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${g.checked_in ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/60 text-foreground/80'}`}>
                        {initials(g.guest)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.guest.first_name} {g.guest.last_name}</p>
                        {g.plus_one_name && <p className="text-xs text-muted-foreground truncate">+1: {g.plus_one_name}</p>}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${guestTypeColor[g.guest_type]}`}>{g.guest_type}</span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${rsvpCfg.color}`}>{rsvpCfg.label}</span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      {g.meal_preference ? (
                        <span className="text-base" title={g.meal_preference}>{mealIcons[g.meal_preference] ?? '🍽'}</span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </div>
                    <div className="col-span-2 flex items-center">
                      {g.table_number ? (
                        <span className={`text-xs ${g.seating_confirmed ? 'text-foreground' : 'text-amber-400'}`}>
                          {g.seating_confirmed ? '✓ ' : '⚡ '}T{g.table_number}
                          {g.seat_number ? ` S${g.seat_number}` : ''}
                        </span>
                      ) : <span className="text-xs text-slate-600">Unassigned</span>}
                    </div>
                    <div className="col-span-2 flex items-center">
                      {g.qr_code ? (
                        <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">{g.qr_code}</span>
                      ) : <span className="text-xs text-slate-600">No QR</span>}
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <button
                        onClick={() => handleManualCheckin(g.id)}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                          g.checked_in ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        }`}
                      >
                        {g.checked_in ? 'Undo' : 'Check In'}
                      </button>
                      {g.rsvp_status === 'pending' && (
                        <button
                          onClick={() => handleRsvp(g.id, 'confirmed')}
                          className="px-2 py-1 text-xs rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredGuests.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">No guests match the current filters</div>
              )}
            </div>
          </div>
        )}

        {/* CHECK-IN LIVE */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            {/* Live stats strip */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                <p className="text-4xl font-bold text-emerald-400">{checkedIn}</p>
                <p className="text-sm text-muted-foreground mt-1">Checked In</p>
                <div className="mt-2 w-full h-1.5 rounded-full bg-muted/40">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${checkInRate}%` }} />
                </div>
                <p className="text-xs text-slate-600 mt-1">{checkInRate}%</p>
              </div>
              <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5 text-center">
                <p className="text-4xl font-bold text-amber-400">{confirmed - checkedIn}</p>
                <p className="text-sm text-muted-foreground mt-1">Expected, Not Arrived</p>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5 text-center">
                <p className="text-4xl font-bold text-foreground">{total - confirmed}</p>
                <p className="text-sm text-muted-foreground mt-1">Pending RSVP</p>
              </div>
            </div>

            {/* Quick scan button */}
            <div
              onClick={() => setShowQR(true)}
              className="rounded-2xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 p-8 text-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/10 transition-all group"
            >
              <span className="text-5xl group-hover:scale-110 transition-transform block mb-3">📷</span>
              <h3 className="text-base font-semibold text-foreground">Open QR Scanner</h3>
              <p className="text-sm text-muted-foreground mt-1">Click to scan guest QR codes at the gate</p>
            </div>

            {/* Pending check-ins */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Confirmed but Not Yet Arrived ({confirmed - checkedIn})</h3>
              <div className="space-y-2">
                {guests.filter(g => g.rsvp_status === 'confirmed' && !g.checked_in).map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/25 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-xs font-bold text-foreground/80">{initials(g.guest)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{g.guest.first_name} {g.guest.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.table_number ? `T${g.table_number}` : 'No table'} · {mealIcons[g.meal_preference ?? ''] ?? ''} {g.meal_preference ?? 'No meal pref'}
                        {g.guest_type === 'vip' ? ' · ⭐ VIP' : ''}
                      </p>
                    </div>
                    {g.qr_code && <span className="text-xs font-mono text-slate-600">{g.qr_code}</span>}
                    <button
                      onClick={() => handleManualCheckin(g.id)}
                      className="px-4 py-1.5 text-xs rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium"
                    >
                      Check In
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEATING */}
        {activeTab === 'seating' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Seating Chart</h2>
              <button className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                + Add Table
              </button>
            </div>
            <SeatingChart tables={tables} />
          </div>
        )}

        {/* GIFTS */}
        {activeTab === 'gifts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Gift Tracker</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{giftsReceived} gifts received</p>
              </div>
            </div>

            {/* Gift summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5 text-center">
                <p className="text-3xl font-bold text-pink-400">{giftsReceived}</p>
                <p className="text-sm text-muted-foreground mt-1">Gifts Received</p>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">
                  ₹{guests.filter(g => g.gift_amount).reduce((s, g) => s + (g.gift_amount ?? 0), 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Total Gift Value</p>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 p-5 text-center">
                <p className="text-3xl font-bold text-amber-400">{confirmed - giftsReceived}</p>
                <p className="text-sm text-muted-foreground mt-1">Pending Acknowledgement</p>
              </div>
            </div>

            {/* Gift list */}
            <div className="rounded-2xl border border-border/30 overflow-hidden">
              {guests.filter(g => g.rsvp_status === 'confirmed').map(g => (
                <div key={g.id} className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/20">
                  <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-xs font-bold text-foreground/80 flex-shrink-0">{initials(g.guest)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{g.guest.first_name} {g.guest.last_name}</p>
                    {g.gift_received && g.gift_amount && (
                      <p className="text-xs text-muted-foreground">₹{g.gift_amount.toLocaleString('en-IN')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {g.gift_received ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">🎁 Received</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-muted-foreground">Pending</span>
                    )}
                    <button
                      onClick={() => handleGiftToggle(g.id)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        g.gift_received ? 'bg-slate-500/20 text-muted-foreground hover:bg-red-500/20 hover:text-red-400' : 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
                      }`}
                    >
                      {g.gift_received ? 'Unmark' : 'Mark Received'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
