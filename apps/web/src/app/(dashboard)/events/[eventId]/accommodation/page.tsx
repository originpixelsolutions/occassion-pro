'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  Hotel, Bed, Users, Plus, X, Check, ChevronDown, Search,
  Star, Calendar, AlertTriangle, RefreshCw, Trash2, Send,
  Building2, CheckCircle2, XCircle, Clock, ArrowRight,
  BarChart3, Filter, MoreVertical, Edit2, ChevronRight,
  UserPlus, Package, ListFilter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotelData {
  id: string
  name: string
  address?: string
  city?: string
  star_rating?: number
  total_rooms?: number
  hotel_rooms?: RoomData[]
}

interface RoomData {
  id: string
  room_number: string
  room_type: string
  capacity: number
  is_available: boolean
  floor?: number
  notes?: string
  accommodation_bookings?: BookingData[]
}

interface BookingData {
  id: string
  hotel_id: string
  room_id: string
  guest_id: string
  event_id: string
  check_in_date: string
  check_out_date: string
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
  voucher_sent: boolean
  voucher_sent_at?: string
  special_requests?: string
  hotels?: { id: string; name: string; star_rating?: number }
  hotel_rooms?: { id: string; room_number: string; room_type: string; capacity: number }
  guests?: { id: string; full_name: string; email?: string; phone?: string; category?: string }
}

interface OccupancyStat {
  id: string
  name: string
  star_rating?: number
  total_rooms: number
  booked_rooms: number
  available_rooms: number
  occupancy_pct: number
}

interface Guest {
  id: string
  full_name: string
  email?: string
  phone?: string
  category?: string
  accommodation_status?: string
}

type Tab = 'overview' | 'hotels' | 'bookings'
type BookingStatus = 'all' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_TYPE_COLORS: Record<string, string> = {
  single: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  double: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  twin: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  suite: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  deluxe: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  checked_in: { label: 'Checked In', color: 'text-blue-400', dot: 'bg-blue-400' },
  checked_out: { label: 'Checked Out', color: 'text-slate-400', dot: 'bg-slate-400' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', dot: 'bg-red-400' },
  no_show: { label: 'No Show', color: 'text-orange-400', dot: 'bg-orange-400' },
}

function Stars({ n }: { n?: number }) {
  if (!n) return null
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={10} className={i < n ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
      ))}
    </div>
  )
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Assign Booking Modal ─────────────────────────────────────────────────────

interface AssignModalProps {
  eventId: string
  hotels: HotelData[]
  onClose: () => void
  onSave: () => void
  headers: Record<string, string>
  preselectedGuest?: Guest
}

function AssignModal({ eventId, hotels, onClose, onSave, headers, preselectedGuest }: AssignModalProps) {
  const [guestSearch, setGuestSearch] = useState(preselectedGuest?.full_name ?? '')
  const [guests, setGuests] = useState<Guest[]>(preselectedGuest ? [preselectedGuest] : [])
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(preselectedGuest ?? null)
  const [selectedHotel, setSelectedHotel] = useState<HotelData | null>(null)
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'guest' | 'room' | 'dates'>(preselectedGuest ? 'room' : 'guest')
  const [guestLoading, setGuestLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (!guestSearch || preselectedGuest) return
    const t = setTimeout(async () => {
      setGuestLoading(true)
      const r = await fetch(`${API}/guests?q=${encodeURIComponent(guestSearch)}&pageSize=20`, { headers })
      const d = await r.json()
      setGuests(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [])
      setShowDropdown(true)
      setGuestLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [guestSearch])

  useEffect(() => {
    if (!selectedHotel) return
    fetch(`${API}/accommodation/hotels/${selectedHotel.id}/rooms`, { headers })
      .then(r => r.json())
      .then(d => setRooms(Array.isArray(d) ? d : []))
  }, [selectedHotel])

  const availableRooms = useMemo(
    () => rooms.filter(r => r.is_available && !(r.accommodation_bookings ?? []).some(
      b => !['cancelled', 'no_show'].includes(b.status ?? '')
    )),
    [rooms]
  )

  const roomsByType = useMemo(() => {
    const map: Record<string, RoomData[]> = {}
    availableRooms.forEach(r => {
      if (!map[r.room_type]) map[r.room_type] = []
      map[r.room_type].push(r)
    })
    return map
  }, [availableRooms])

  const handleSave = async () => {
    if (!selectedGuest || !selectedRoom || !checkIn || !checkOut) {
      setError('Please complete all required fields')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/accommodation/events/${eventId}/bookings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: selectedHotel!.id,
          room_id: selectedRoom.id,
          guest_id: selectedGuest.id,
          check_in_date: checkIn,
          check_out_date: checkOut,
          special_requests: specialRequests || undefined,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.message ?? 'Failed to create booking')
      }
      onSave()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Assign Accommodation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {(['guest', 'room', 'dates'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step === s ? 'bg-indigo-600 text-white' :
                ['guest', 'room', 'dates'].indexOf(step) > i ? 'bg-emerald-600 text-white' :
                'bg-white/10 text-slate-500'
              )}>
                {['guest', 'room', 'dates'].indexOf(step) > i ? <Check size={12} /> : i + 1}
              </div>
              <span className={cn('text-xs capitalize', step === s ? 'text-white' : 'text-slate-500')}>
                {s === 'guest' ? 'Guest' : s === 'room' ? 'Room' : 'Dates'}
              </span>
              {i < 2 && <div className="h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {step === 'guest' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-400">Search Guest</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={guestSearch}
                  onChange={e => { setGuestSearch(e.target.value); setSelectedGuest(null) }}
                  placeholder="Type guest name or email…"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {showDropdown && guests.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
                  {guests.slice(0, 8).map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setSelectedGuest(g); setGuestSearch(g.full_name); setShowDropdown(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold">
                        {g.full_name[0]}
                      </div>
                      <div>
                        <div className="text-sm text-white">{g.full_name}</div>
                        {g.email && <div className="text-xs text-slate-500">{g.email}</div>}
                      </div>
                      {g.category && (
                        <span className="ml-auto text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                          {g.category}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedGuest && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-600/10 border border-indigo-500/20">
                  <CheckCircle2 size={16} className="text-indigo-400" />
                  <div>
                    <div className="text-sm font-medium text-white">{selectedGuest.full_name}</div>
                    {selectedGuest.email && <div className="text-xs text-slate-400">{selectedGuest.email}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'room' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">Select Hotel</label>
                <div className="grid gap-2">
                  {hotels.map(h => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHotel(h)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                        selectedHotel?.id === h.id
                          ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/8'
                      )}
                    >
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{h.name}</div>
                        {h.city && <div className="text-xs text-slate-500">{h.city}</div>}
                      </div>
                      <Stars n={h.star_rating} />
                      {selectedHotel?.id === h.id && <Check size={14} className="text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {selectedHotel && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">
                    Select Room
                    <span className="ml-2 text-slate-600">({availableRooms.length} available)</span>
                  </label>
                  {Object.entries(roomsByType).length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">No available rooms</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(roomsByType).map(([type, typeRooms]) => (
                        <div key={type}>
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 capitalize">{type}</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {typeRooms.map(r => (
                              <button
                                key={r.id}
                                onClick={() => setSelectedRoom(r)}
                                className={cn(
                                  'p-2 rounded-lg border text-left text-xs transition-colors',
                                  selectedRoom?.id === r.id
                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                )}
                              >
                                <div className="font-medium">#{r.room_number}</div>
                                <div className="text-slate-500 text-[10px] mt-0.5">
                                  Cap: {r.capacity}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'dates' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                <Building2 size={14} className="text-slate-400" />
                <div className="text-sm text-white">{selectedHotel?.name} — Room #{selectedRoom?.room_number}</div>
                <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full border capitalize', ROOM_TYPE_COLORS[selectedRoom?.room_type ?? ''] ?? 'bg-white/10 text-slate-300 border-white/10')}>
                  {selectedRoom?.room_type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Check-In *</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Check-Out *</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  rows={3}
                  placeholder="Any special requirements…"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/10">
          <button
            onClick={() => {
              const steps: typeof step[] = ['guest', 'room', 'dates']
              const i = steps.indexOf(step)
              if (i > 0) setStep(steps[i - 1])
              else onClose()
            }}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            {step === 'guest' ? 'Cancel' : '← Back'}
          </button>
          {step !== 'dates' ? (
            <button
              disabled={step === 'guest' ? !selectedGuest : !selectedRoom}
              onClick={() => {
                const steps: typeof step[] = ['guest', 'room', 'dates']
                const i = steps.indexOf(step)
                if (i < 2) setStep(steps[i + 1])
              }}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                (step === 'guest' ? !selectedGuest : !selectedRoom)
                  ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              )}
            >
              Next →
            </button>
          ) : (
            <button
              disabled={saving || !checkIn || !checkOut}
              onClick={handleSave}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                saving || !checkIn || !checkOut
                  ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              )}
            >
              {saving && <RefreshCw size={14} className="animate-spin" />}
              Confirm Booking
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Assign Modal ────────────────────────────────────────────────────────

interface BulkAssignModalProps {
  eventId: string
  hotels: HotelData[]
  onClose: () => void
  onSave: () => void
  headers: Record<string, string>
}

function BulkAssignModal({ eventId, hotels, onClose, onSave, headers }: BulkAssignModalProps) {
  const [guestSearch, setGuestSearch] = useState('')
  const [allGuests, setAllGuests] = useState<Guest[]>([])
  const [selectedGuests, setSelectedGuests] = useState<Guest[]>([])
  const [selectedHotel, setSelectedHotel] = useState<HotelData | null>(null)
  const [roomType, setRoomType] = useState('double')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ assigned: number; failed: number; errors: any[] } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/guests?pageSize=100`, { headers })
      .then(r => r.json())
      .then(d => setAllGuests(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []))
  }, [])

  const filtered = useMemo(() => {
    const q = guestSearch.toLowerCase()
    return allGuests.filter(g =>
      !selectedGuests.find(s => s.id === g.id) &&
      (g.full_name.toLowerCase().includes(q) || (g.email ?? '').toLowerCase().includes(q))
    )
  }, [allGuests, selectedGuests, guestSearch])

  const ROOM_TYPES = ['single', 'double', 'twin', 'suite', 'deluxe']

  const handleBulkAssign = async () => {
    if (!selectedGuests.length || !selectedHotel || !checkIn || !checkOut) {
      setError('Please complete all fields')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/accommodation/events/${eventId}/bookings/bulk-assign`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIds: selectedGuests.map(g => g.id),
          hotelId: selectedHotel.id,
          roomType,
          checkIn,
          checkOut,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? 'Bulk assign failed')
      setResult(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
          <div className={cn('w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4',
            result.failed === 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10'
          )}>
            {result.failed === 0
              ? <CheckCircle2 size={32} className="text-emerald-400" />
              : <AlertTriangle size={32} className="text-amber-400" />
            }
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Bulk Assignment Complete</h3>
          <p className="text-slate-400 text-sm mb-4">
            {result.assigned} guests assigned successfully
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
          {result.errors.length > 0 && (
            <div className="text-left mb-4 max-h-32 overflow-y-auto space-y-1.5">
              {result.errors.map((e: any, i: number) => (
                <div key={i} className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                  {e.error}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { onSave(); onClose() }}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Bulk Assign Accommodation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-5">
          {/* Guest selector */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-slate-400">
              Select Guests <span className="text-slate-600">({selectedGuests.length} selected)</span>
            </label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                placeholder="Search guests…"
                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex-1 border border-white/10 rounded-lg overflow-y-auto max-h-48 divide-y divide-white/5">
              {filtered.slice(0, 20).map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuests(prev => [...prev, g])}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {g.full_name[0]}
                  </div>
                  <span className="text-sm text-slate-300 truncate">{g.full_name}</span>
                </button>
              ))}
              {filtered.length === 0 && <div className="text-center py-4 text-slate-500 text-xs">No guests</div>}
            </div>
            {selectedGuests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedGuests.map(g => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1 text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 rounded-full px-2 py-0.5"
                  >
                    {g.full_name}
                    <button onClick={() => setSelectedGuests(prev => prev.filter(s => s.id !== g.id))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Assignment config */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Hotel</label>
              <div className="space-y-1.5">
                {hotels.map(h => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHotel(h)}
                    className={cn(
                      'w-full flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-colors',
                      selectedHotel?.id === h.id
                        ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/8'
                    )}
                  >
                    <Building2 size={13} className="text-slate-500 shrink-0" />
                    <span className="truncate">{h.name}</span>
                    {selectedHotel?.id === h.id && <Check size={12} className="ml-auto text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Room Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {ROOM_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setRoomType(t)}
                    className={cn(
                      'py-1.5 px-2 rounded-lg border text-xs capitalize transition-colors',
                      roomType === t
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Check-In</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={e => setCheckIn(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Check-Out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="flex items-center justify-between p-5 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            disabled={saving || !selectedGuests.length || !selectedHotel || !checkIn || !checkOut}
            onClick={handleBulkAssign}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
              saving || !selectedGuests.length || !selectedHotel || !checkIn || !checkOut
                ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            )}
          >
            {saving && <RefreshCw size={14} className="animate-spin" />}
            Assign {selectedGuests.length > 0 ? selectedGuests.length : ''} Guests
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Hotel Modal ──────────────────────────────────────────────────────────

interface AddHotelModalProps {
  onClose: () => void
  onSave: (hotel: HotelData) => void
  headers: Record<string, string>
}

function AddHotelModal({ onClose, onSave, headers }: AddHotelModalProps) {
  const [form, setForm] = useState({ name: '', address: '', city: '', star_rating: 3, contact_name: '', contact_phone: '', contact_email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Hotel name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/accommodation/hotels`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
      const d = await res.json()
      onSave(d)
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Add Hotel</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}
          {[
            { label: 'Hotel Name *', key: 'name', placeholder: 'e.g. The Grand Hyatt' },
            { label: 'Address', key: 'address', placeholder: 'Street address' },
            { label: 'City', key: 'city', placeholder: 'City' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">{f.label}</label>
              <input
                value={(form as any)[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Star Rating</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => set('star_rating', n)}
                  className={cn('w-10 h-10 rounded-lg border text-sm font-bold transition-colors flex items-center justify-center',
                    form.star_rating === n
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Contact Name', key: 'contact_name', placeholder: 'Manager name' },
              { label: 'Contact Phone', key: 'contact_phone', placeholder: '+1 234 567 8900' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <RefreshCw size={14} className="animate-spin" />}
            Add Hotel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Room Modal ───────────────────────────────────────────────────────────

interface AddRoomModalProps {
  hotelId: string
  onClose: () => void
  onSave: () => void
  headers: Record<string, string>
}

function AddRoomModal({ hotelId, onClose, onSave, headers }: AddRoomModalProps) {
  const [form, setForm] = useState({ room_number: '', room_type: 'double', capacity: 2, floor: 1, notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ROOM_TYPES = ['single', 'double', 'twin', 'suite', 'deluxe']
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.room_number.trim()) { setError('Room number is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/accommodation/hotels/${hotelId}/rooms`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
      onSave()
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Add Room</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Room Number *</label>
              <input value={form.room_number} onChange={e => set('room_number', e.target.value)} placeholder="101"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Floor</label>
              <input type="number" min={1} value={form.floor} onChange={e => set('floor', parseInt(e.target.value))}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Room Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ROOM_TYPES.map(t => (
                <button key={t} onClick={() => set('room_type', t)}
                  className={cn('py-1.5 rounded-lg border text-xs capitalize transition-colors',
                    form.room_type === t ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Capacity (guests)</label>
            <input type="number" min={1} max={10} value={form.capacity} onChange={e => set('capacity', parseInt(e.target.value))}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Sea view, corner room"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button disabled={saving} onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            Add Room
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hotel Card ───────────────────────────────────────────────────────────────

interface HotelCardProps {
  hotel: HotelData
  stats?: OccupancyStat
  onAddRoom: (hotelId: string) => void
  onAssignRoom: (hotel: HotelData) => void
  headers: Record<string, string>
}

function HotelCard({ hotel, stats, onAddRoom, onAssignRoom, headers }: HotelCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const loadRooms = useCallback(async () => {
    if (rooms.length > 0) return
    setLoadingRooms(true)
    const r = await fetch(`${API}/accommodation/hotels/${hotel.id}/rooms`, { headers })
    const d = await r.json()
    setRooms(Array.isArray(d) ? d : [])
    setLoadingRooms(false)
  }, [hotel.id, rooms.length])

  const handleExpand = () => {
    setExpanded(p => !p)
    if (!expanded) loadRooms()
  }

  const roomsByType = useMemo(() => {
    const map: Record<string, RoomData[]> = {}
    rooms.forEach(r => {
      if (!map[r.room_type]) map[r.room_type] = []
      map[r.room_type].push(r)
    })
    return map
  }, [rooms])

  const isBooked = (room: RoomData) =>
    (room.accommodation_bookings ?? []).some(b => !['cancelled', 'no_show'].includes(b.status ?? ''))

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">{hotel.name}</h3>
                <Stars n={hotel.star_rating} />
              </div>
              {hotel.city && <div className="text-xs text-slate-500 mt-0.5">{hotel.city}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onAssignRoom(hotel)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs hover:bg-indigo-600/30 transition-colors"
            >
              <UserPlus size={12} /> Assign
            </button>
            <button
              onClick={() => onAddRoom(hotel.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-xs hover:bg-white/10 transition-colors"
            >
              <Plus size={12} /> Room
            </button>
          </div>
        </div>

        {/* Occupancy */}
        {stats && (
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Occupancy</span>
              <span className={cn('text-xs font-semibold',
                stats.occupancy_pct >= 90 ? 'text-red-400' :
                stats.occupancy_pct >= 60 ? 'text-amber-400' : 'text-emerald-400'
              )}>
                {stats.occupancy_pct}%
              </span>
            </div>
            <OccupancyBar pct={stats.occupancy_pct} />
            <div className="flex items-center gap-4 mt-2">
              <div className="text-center">
                <div className="text-sm font-bold text-white">{stats.total_rooms}</div>
                <div className="text-[10px] text-slate-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">{stats.available_rooms}</div>
                <div className="text-[10px] text-slate-500">Available</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-indigo-400">{stats.booked_rooms}</div>
                <div className="text-[10px] text-slate-500">Booked</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Room grid toggle */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.02] transition-colors"
      >
        <span>Room Grid</span>
        <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Room grid */}
      {expanded && (
        <div className="px-4 pb-4">
          {loadingRooms ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={16} className="animate-spin text-slate-500" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No rooms added yet
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(roomsByType).map(([type, typeRooms]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize', ROOM_TYPE_COLORS[type] ?? 'bg-white/10 text-slate-300 border-white/10')}>
                      {type}
                    </span>
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[10px] text-slate-600">{typeRooms.length} rooms</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {typeRooms.map(r => {
                      const booked = isBooked(r)
                      const bookedBy = booked ? r.accommodation_bookings?.find(b => !['cancelled','no_show'].includes(b.status ?? ''))?.guests : null
                      return (
                        <div
                          key={r.id}
                          title={booked ? `Booked${bookedBy ? `: ${bookedBy.full_name}` : ''}` : `Room ${r.room_number} - Available`}
                          className={cn(
                            'relative aspect-square rounded-md border flex flex-col items-center justify-center text-[10px] font-medium cursor-default transition-all',
                            booked
                              ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
                          )}
                        >
                          <span className="font-bold">{r.room_number}</span>
                          {booked && (
                            <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-indigo-400" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/30" /><span className="text-[10px] text-slate-500">Available</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-indigo-600/20 border border-indigo-500/30" /><span className="text-[10px] text-slate-500">Booked</span></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccommodationPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useAuth()

  const [tab, setTab] = useState<Tab>('overview')
  const [hotels, setHotels] = useState<HotelData[]>([])
  const [stats, setStats] = useState<OccupancyStat[]>([])
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [bookingCount, setBookingCount] = useState(0)
  const [bookingPage, setBookingPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<BookingStatus>('all')
  const [hotelFilter, setHotelFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [showAssign, setShowAssign] = useState(false)
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [showAddHotel, setShowAddHotel] = useState(false)
  const [addRoomForHotel, setAddRoomForHotel] = useState<string | null>(null)
  const [assignForHotel, setAssignForHotel] = useState<HotelData | null>(null)

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${session?.access_token}`,
    'x-tenant-id': session?.user?.user_metadata?.tenant_id ?? '',
  }), [session])

  const loadHotels = useCallback(async () => {
    const r = await fetch(`${API}/accommodation/hotels`, { headers })
    const d = await r.json()
    setHotels(Array.isArray(d) ? d : [])
  }, [headers])

  const loadStats = useCallback(async () => {
    const r = await fetch(`${API}/accommodation/events/${eventId}/stats`, { headers })
    const d = await r.json()
    setStats(Array.isArray(d) ? d : [])
  }, [headers, eventId])

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true)
    const params = new URLSearchParams({ page: String(bookingPage), pageSize: '20' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (hotelFilter !== 'all') params.set('hotelId', hotelFilter)
    const r = await fetch(`${API}/accommodation/events/${eventId}/bookings?${params}`, { headers })
    const d = await r.json()
    setBookings(Array.isArray(d.data) ? d.data : [])
    setBookingCount(d.count ?? 0)
    setBookingsLoading(false)
  }, [headers, eventId, bookingPage, statusFilter, hotelFilter])

  useEffect(() => {
    if (!session) return
    Promise.all([loadHotels(), loadStats()]).finally(() => setLoading(false))
  }, [session])

  useEffect(() => {
    if (!session || tab !== 'bookings') return
    loadBookings()
  }, [session, tab, bookingPage, statusFilter, hotelFilter])

  const handleCancelBooking = async (id: string) => {
    await fetch(`${API}/accommodation/bookings/${id}/cancel`, { method: 'POST', headers })
    loadBookings()
    loadStats()
  }

  const handleVoucherSent = async (id: string) => {
    await fetch(`${API}/accommodation/bookings/${id}/mark-voucher-sent`, { method: 'POST', headers })
    loadBookings()
  }

  const totalBooked = stats.reduce((s, h) => s + h.booked_rooms, 0)
  const totalAvailable = stats.reduce((s, h) => s + h.available_rooms, 0)
  const totalRooms = stats.reduce((s, h) => s + h.total_rooms, 0)
  const overallOccupancy = totalRooms > 0 ? Math.round((totalBooked / totalRooms) * 100) : 0

  return (
    <div className="min-h-screen bg-[#080a0e] text-white">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/events/${eventId}`} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
              <ChevronRight size={16} className="rotate-180" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                <Hotel size={18} className="text-indigo-400" />
                Accommodation
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage hotel bookings and room assignments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkAssign(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm hover:bg-white/10 transition-colors"
            >
              <Package size={14} /> Bulk Assign
            </button>
            <button
              onClick={() => { setAssignForHotel(null); setShowAssign(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus size={14} /> New Booking
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {(['overview', 'hotels', 'bookings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm capitalize transition-colors',
                tab === t ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : (

          // ── Overview Tab ─────────────────────────────────────────────────────
          tab === 'overview' ? (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Rooms', value: totalRooms, icon: Bed, color: 'text-slate-400', bg: 'bg-slate-500/10' },
                  { label: 'Booked', value: totalBooked, icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'Available', value: totalAvailable, icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Occupancy', value: `${overallOccupancy}%`, icon: BarChart3, color: overallOccupancy >= 90 ? 'text-red-400' : overallOccupancy >= 60 ? 'text-amber-400' : 'text-emerald-400', bg: 'bg-white/5' },
                ].map(k => (
                  <div key={k.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500">{k.label}</span>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', k.bg)}>
                        <k.icon size={15} className={k.color} />
                      </div>
                    </div>
                    <div className={cn('text-2xl font-bold', k.color)}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Hotel stats */}
              {stats.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Hotel Occupancy</h2>
                  <div className="grid gap-3">
                    {stats.map(s => (
                      <div key={s.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-white">{s.name}</span>
                            <Stars n={s.star_rating} />
                          </div>
                          <span className={cn('text-sm font-bold',
                            s.occupancy_pct >= 90 ? 'text-red-400' :
                            s.occupancy_pct >= 60 ? 'text-amber-400' : 'text-emerald-400'
                          )}>{s.occupancy_pct}%</span>
                        </div>
                        <OccupancyBar pct={s.occupancy_pct} />
                        <div className="flex items-center gap-6 mt-2">
                          <div className="text-xs text-slate-500">{s.total_rooms} rooms total</div>
                          <div className="text-xs text-emerald-400">{s.available_rooms} available</div>
                          <div className="text-xs text-indigo-400">{s.booked_rooms} booked</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {hotels.length === 0 && (
                <div className="text-center py-24 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                    <Hotel size={28} className="text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">No Hotels Added</h3>
                    <p className="text-sm text-slate-500 mb-4">Add hotels and rooms to start managing accommodation for this event.</p>
                    <button
                      onClick={() => { setTab('hotels'); setShowAddHotel(true) }}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500"
                    >
                      Add First Hotel
                    </button>
                  </div>
                </div>
              )}
            </div>

          // ── Hotels Tab ───────────────────────────────────────────────────────
          ) : tab === 'hotels' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{hotels.length} Hotels</h2>
                <button
                  onClick={() => setShowAddHotel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm hover:bg-white/10"
                >
                  <Plus size={14} /> Add Hotel
                </button>
              </div>
              {hotels.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-sm">
                  No hotels yet. Add hotels to start managing accommodation.
                </div>
              ) : (
                <div className="grid gap-4">
                  {hotels.map(h => (
                    <HotelCard
                      key={h.id}
                      hotel={h}
                      stats={stats.find(s => s.id === h.id)}
                      onAddRoom={id => setAddRoomForHotel(id)}
                      onAssignRoom={hotel => { setAssignForHotel(hotel); setShowAssign(true) }}
                      headers={headers}
                    />
                  ))}
                </div>
              )}
            </div>

          // ── Bookings Tab ─────────────────────────────────────────────────────
          ) : (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                  {(['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as BookingStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setBookingPage(1) }}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs capitalize transition-colors',
                        statusFilter === s ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white'
                      )}
                    >
                      {s === 'all' ? 'All' : STATUS_META[s]?.label ?? s}
                    </button>
                  ))}
                </div>
                <select
                  value={hotelFilter}
                  onChange={e => { setHotelFilter(e.target.value); setBookingPage(1) }}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Hotels</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <div className="ml-auto text-xs text-slate-500">{bookingCount} bookings</div>
              </div>

              {/* Bookings list */}
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={18} className="animate-spin text-slate-500" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-sm">
                  No bookings found
                </div>
              ) : (
                <div className="space-y-2">
                  {bookings.map(b => {
                    const meta = STATUS_META[b.status]
                    return (
                      <div
                        key={b.id}
                        className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.05] transition-colors"
                      >
                        {/* Guest */}
                        <div className="w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-sm font-bold shrink-0">
                          {b.guests?.full_name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{b.guests?.full_name ?? 'Unknown'}</span>
                            {b.guests?.category && (
                              <span className="text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-full capitalize">
                                {b.guests.category}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {b.hotels?.name} · Room {b.hotel_rooms?.room_number} ({b.hotel_rooms?.room_type})
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="text-xs text-slate-400 text-center">
                          <div>{formatDate(b.check_in_date)}</div>
                          <div className="text-slate-600">→</div>
                          <div>{formatDate(b.check_out_date)}</div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-1.5 h-1.5 rounded-full', meta?.dot ?? 'bg-slate-400')} />
                          <span className={cn('text-xs', meta?.color ?? 'text-slate-400')}>{meta?.label ?? b.status}</span>
                        </div>

                        {/* Voucher */}
                        {b.voucher_sent ? (
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <Check size={12} /> Voucher Sent
                          </div>
                        ) : (
                          <button
                            onClick={() => handleVoucherSent(b.id)}
                            disabled={b.status === 'cancelled'}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 text-slate-400 rounded-lg text-xs hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Send size={11} /> Voucher
                          </button>
                        )}

                        {/* Cancel */}
                        {!['cancelled', 'no_show', 'checked_out'].includes(b.status) && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Cancel booking"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {bookingCount > 20 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    disabled={bookingPage === 1}
                    onClick={() => setBookingPage(p => p - 1)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-400 rounded-lg text-xs disabled:opacity-40 hover:bg-white/10"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {bookingPage} of {Math.ceil(bookingCount / 20)}
                  </span>
                  <button
                    disabled={bookingPage >= Math.ceil(bookingCount / 20)}
                    onClick={() => setBookingPage(p => p + 1)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-400 rounded-lg text-xs disabled:opacity-40 hover:bg-white/10"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showAssign && (
        <AssignModal
          eventId={eventId}
          hotels={assignForHotel ? [assignForHotel] : hotels}
          onClose={() => { setShowAssign(false); setAssignForHotel(null) }}
          onSave={() => { setShowAssign(false); setAssignForHotel(null); loadStats(); loadBookings() }}
          headers={headers}
        />
      )}

      {showBulkAssign && (
        <BulkAssignModal
          eventId={eventId}
          hotels={hotels}
          onClose={() => setShowBulkAssign(false)}
          onSave={() => { loadStats(); loadBookings() }}
          headers={headers}
        />
      )}

      {showAddHotel && (
        <AddHotelModal
          onClose={() => setShowAddHotel(false)}
          onSave={hotel => { setHotels(prev => [...prev, hotel]); setShowAddHotel(false) }}
          headers={headers}
        />
      )}

      {addRoomForHotel && (
        <AddRoomModal
          hotelId={addRoomForHotel}
          onClose={() => setAddRoomForHotel(null)}
          onSave={() => { setAddRoomForHotel(null); loadStats() }}
          headers={headers}
        />
      )}
    </div>
  )
}
