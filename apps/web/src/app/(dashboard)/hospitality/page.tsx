'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type AccomStatus = 'reserved' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
type VipStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled'
type TransportStatus = 'scheduled' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled' | 'no_show'
type FnbStatus = 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

interface RoomBlock {
  id: string
  hotel_name: string
  hotel_address?: string
  hotel_phone?: string
  hotel_contact?: string
  room_type: string
  total_rooms: number
  confirmed_rooms: number
  occupied_rooms: number
  rate_per_night?: number
  currency: string
  check_in_date?: string
  check_out_date?: string
  cutoff_date?: string
  status: 'pending' | 'negotiating' | 'confirmed' | 'cancelled'
  notes?: string
}

interface GuestAccommodation {
  id: string
  guest_name: string
  guest_email?: string
  guest_phone?: string
  room_number?: string
  room_type?: string
  check_in_date?: string
  check_out_date?: string
  status: AccomStatus
  special_requests?: string
  is_vip: boolean
  is_complimentary: boolean
  cost?: number
  room_block?: { hotel_name: string; room_type: string }
}

interface FnbPlan {
  id: string
  name: string
  meal_type: string
  scheduled_time?: string
  duration_minutes: number
  location?: string
  pax_count: number
  menu_style: string
  vendor?: { id: string; name: string }
  dietary_counts?: Record<string, number>
  cost_per_head?: number
  total_cost?: number
  status: FnbStatus
  notes?: string
}

interface VipGuest {
  id: string
  guest_name: string
  guest_type: string
  company?: string
  designation?: string
  requirements?: string
  transport_needed: boolean
  security_needed: boolean
  dietary_notes?: string
  protocol_notes?: string
  assigned_to?: { id: string; full_name: string; avatar_url?: string }
  arrival_time?: string
  departure_time?: string
  flight_details?: string
  gift_arranged: boolean
  status: VipStatus
  notes?: string
}

interface TransportBooking {
  id: string
  type: string
  passenger_name: string
  passenger_count: number
  pickup_location: string
  dropoff_location: string
  pickup_time: string
  vehicle_type: string
  vehicle_number?: string
  driver_name?: string
  driver_phone?: string
  vendor?: { id: string; name: string }
  status: TransportStatus
  cost?: number
  notes?: string
}

// ─── Status Configs ───────────────────────────────────────────────────────────

const ACCOM_STATUS: Record<AccomStatus, { label: string; color: string }> = {
  reserved:    { label: 'Reserved',    color: 'hsl(var(--muted-foreground))' },
  confirmed:   { label: 'Confirmed',   color: '#3b82f6' },
  checked_in:  { label: 'Checked In',  color: '#10b981' },
  checked_out: { label: 'Checked Out', color: '#475569' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444' },
  no_show:     { label: 'No Show',     color: '#f59e0b' },
}

const VIP_TYPE_ICONS: Record<string, string> = {
  artist: '🎤', dignitary: '🏛️', sponsor: '💼', celebrity: '⭐',
  media: '📰', client: '👥', family: '👨‍👩‍👧', other: '👤',
}

const TRANSPORT_TYPE_ICONS: Record<string, string> = {
  airport_pickup: '✈️→🏨', airport_drop: '🏨→✈️', hotel_venue: '🏨→🎪',
  venue_hotel: '🎪→🏨', intercity: '🚌', sightseeing: '🗺️', other: '🚗',
}

const VEHICLE_ICONS: Record<string, string> = {
  sedan: '🚗', suv: '🚙', van: '🚐', bus: '🚌', luxury: '🚘', ambulance: '🚑', other: '🚗',
}

const FNB_MEAL_ICONS: Record<string, string> = {
  breakfast: '☀️', lunch: '🥗', dinner: '🍽️', cocktails: '🍸',
  snacks: '🍴', welcome_drink: '🥂', high_tea: '☕', gala: '🎊', other: '🍱',
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border) / 0.5)',
  borderRadius: 12,
  padding: '18px 20px',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {label}
    </span>
  )
}

function StatTile({ icon, label, value, sub, accent }: { icon: string; label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent ?? '#6366f1'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? '#fff', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Room Blocks Section ──────────────────────────────────────────────────────

function RoomBlockCard({ block, onStatusChange }: { block: RoomBlock; onStatusChange: (id: string, s: string) => void }) {
  const occupancy = block.total_rooms > 0 ? Math.round((block.occupied_rooms / block.total_rooms) * 100) : 0
  const statusColors = { pending: '#64748b', negotiating: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444' }
  const color = statusColors[block.status]

  return (
    <div style={{ ...cardStyle, borderColor: `${color}33` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🏨</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--foreground))' }}>{block.hotel_name}</span>
            <Badge label={block.status} color={color} />
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
            {block.room_type} • {block.hotel_address}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Total', val: block.total_rooms },
              { label: 'Confirmed', val: block.confirmed_rooms },
              { label: 'Occupied', val: block.occupied_rooms },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: 'hsl(var(--muted))', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Occupancy bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
              <span>Occupancy</span><span>{occupancy}%</span>
            </div>
            <div style={{ height: 6, background: 'hsl(var(--muted))', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${occupancy}%`, background: occupancy > 80 ? '#10b981' : occupancy > 50 ? '#f59e0b' : '#64748b', borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {block.rate_per_night && (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>
              ₹{block.rate_per_night.toLocaleString()}<span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>/night</span>
            </div>
          )}
          {block.check_in_date && (
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              {new Date(block.check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {block.check_out_date ? new Date(block.check_out_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '?'}
            </div>
          )}
          {block.cutoff_date && (
            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
              Cutoff: {new Date(block.cutoff_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          )}
          {block.hotel_contact && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>👤 {block.hotel_contact}</div>}
          {block.hotel_phone && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>📞 {block.hotel_phone}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Guest Accommodation Table ────────────────────────────────────────────────

function AccomRow({ guest, onCheckIn, onCheckOut }: {
  guest: GuestAccommodation
  onCheckIn: (id: string) => void
  onCheckOut: (id: string) => void
}) {
  const cfg = ACCOM_STATUS[guest.status]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px 16px', borderBottom: '1px solid hsl(var(--border) / 0.2)', alignItems: 'center' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }}>{guest.guest_name}</span>
          {guest.is_vip && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>VIP</span>}
          {guest.is_complimentary && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }}>COMP</span>}
        </div>
        {guest.guest_phone && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>📞 {guest.guest_phone}</div>}
        {guest.special_requests && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚠️ {guest.special_requests}</div>}
      </div>
      <div style={{ fontSize: 13, color: 'hsl(var(--foreground))' }}>
        {guest.room_number ? `Room ${guest.room_number}` : '—'}
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{guest.room_block?.hotel_name ?? guest.room_type ?? '—'}</div>
      </div>
      <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
        {guest.check_in_date ? new Date(guest.check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
        <span style={{ color: 'hsl(var(--muted-foreground))' }}> → </span>
        {guest.check_out_date ? new Date(guest.check_out_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
      </div>
      <div>
        {guest.cost ? <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>₹{guest.cost.toLocaleString()}</div> : <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>—</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Badge label={cfg.label} color={cfg.color} />
        {guest.status === 'confirmed' && (
          <button onClick={() => onCheckIn(guest.id)} style={microBtn('#10b981')}>Check In</button>
        )}
        {guest.status === 'checked_in' && (
          <button onClick={() => onCheckOut(guest.id)} style={microBtn('#64748b')}>Check Out</button>
        )}
      </div>
    </div>
  )
}

// ─── F&B Card ─────────────────────────────────────────────────────────────────

function FnbCard({ plan, onStatusChange }: { plan: FnbPlan; onStatusChange: (id: string, s: string) => void }) {
  const statusColors: Record<FnbStatus, string> = {
    planning: '#64748b', confirmed: '#10b981', in_progress: '#f59e0b', completed: '#475569', cancelled: '#ef4444',
  }
  const color = statusColors[plan.status]
  const dietary = plan.dietary_counts ?? {}

  return (
    <div style={{ ...cardStyle, borderColor: `${color}33` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          {FNB_MEAL_ICONS[plan.meal_type] ?? '🍽️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--foreground))' }}>{plan.name}</span>
            <Badge label={plan.status} color={color} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            {plan.scheduled_time && <span>🕐 {new Date(plan.scheduled_time).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
            {plan.location && <span>📍 {plan.location}</span>}
            <span>👥 {plan.pax_count} pax</span>
            <span>🍽️ {plan.menu_style.replace('_', ' ')}</span>
            {plan.vendor && <span>🏢 {plan.vendor.name}</span>}
          </div>
          {Object.keys(dietary).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {Object.entries(dietary).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                  {k.replace('_', ' ')}: {v}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {plan.total_cost && <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))' }}>₹{plan.total_cost.toLocaleString()}</div>}
          {plan.cost_per_head && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>₹{plan.cost_per_head.toLocaleString()}/head</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {plan.status === 'planning' && <button onClick={() => onStatusChange(plan.id, 'confirmed')} style={microBtn('#10b981')}>Confirm</button>}
            {plan.status === 'confirmed' && <button onClick={() => onStatusChange(plan.id, 'in_progress')} style={microBtn('#f59e0b')}>Start</button>}
            {plan.status === 'in_progress' && <button onClick={() => onStatusChange(plan.id, 'completed')} style={microBtn('#475569')}>Done</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── VIP Row ──────────────────────────────────────────────────────────────────

function VipRow({ vip, onStatusChange }: { vip: VipGuest; onStatusChange: (id: string, s: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const statusColors: Record<VipStatus, string> = {
    pending: '#64748b', confirmed: '#3b82f6', arrived: '#10b981', completed: '#475569', cancelled: '#ef4444',
  }
  const color = statusColors[vip.status]

  return (
    <div style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {VIP_TYPE_ICONS[vip.guest_type] ?? '👤'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--foreground))' }}>{vip.guest_name}</span>
            {vip.designation && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{vip.designation}</span>}
            {vip.company && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>• {vip.company}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Badge label={vip.status} color={color} />
            {vip.transport_needed && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>🚗 Transport</span>}
            {vip.security_needed && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🔒 Security</span>}
            {vip.gift_arranged && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>🎁 Gift</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {vip.assigned_to && (
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
              👤 <span style={{ color: 'hsl(var(--foreground))' }}>{vip.assigned_to.full_name}</span>
            </div>
          )}
          {vip.status === 'confirmed' && <button onClick={e => { e.stopPropagation(); onStatusChange(vip.id, 'arrived') }} style={microBtn('#10b981')}>Mark Arrived</button>}
          <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 56, paddingBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {vip.arrival_time && <InfoChip label="Arrival" value={new Date(vip.arrival_time).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} />}
          {vip.flight_details && <InfoChip label="Flight" value={vip.flight_details} />}
          {vip.dietary_notes && <InfoChip label="Dietary" value={vip.dietary_notes} />}
          {vip.protocol_notes && <InfoChip label="Protocol" value={vip.protocol_notes} />}
          {vip.requirements && <InfoChip label="Requirements" value={vip.requirements} />}
        </div>
      )}
    </div>
  )
}

// ─── Transport Row ────────────────────────────────────────────────────────────

function TransportRow({ booking, onStatusChange }: { booking: TransportBooking; onStatusChange: (id: string, s: string) => void }) {
  const statusColors: Record<TransportStatus, string> = {
    scheduled: '#64748b', confirmed: '#3b82f6', dispatched: '#f59e0b',
    completed: '#10b981', cancelled: '#ef4444', no_show: '#64748b',
  }
  const color = statusColors[booking.status]
  const pickupTime = new Date(booking.pickup_time)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {VEHICLE_ICONS[booking.vehicle_type] ?? '🚗'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }}>{booking.passenger_name}</span>
          <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>({booking.passenger_count} pax)</span>
          <Badge label={booking.status} color={color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
          <span style={{ color: 'hsl(var(--foreground))' }}>{booking.pickup_location}</span>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>
          <span style={{ color: 'hsl(var(--foreground))' }}>{booking.dropoff_location}</span>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
          <span>🕐 {pickupTime.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {booking.vehicle_number && <span>🔢 {booking.vehicle_number}</span>}
          {booking.driver_name && <span>👤 {booking.driver_name}</span>}
          {booking.driver_phone && <span>📞 {booking.driver_phone}</span>}
          {booking.vendor && <span>🏢 {booking.vendor.name}</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
        {booking.cost ? <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>₹{booking.cost.toLocaleString()}</div> : null}
        <div style={{ display: 'flex', gap: 6 }}>
          {booking.status === 'scheduled' && <button onClick={() => onStatusChange(booking.id, 'confirmed')} style={microBtn('#3b82f6')}>Confirm</button>}
          {booking.status === 'confirmed' && <button onClick={() => onStatusChange(booking.id, 'dispatched')} style={microBtn('#f59e0b')}>Dispatch</button>}
          {booking.status === 'dispatched' && <button onClick={() => onStatusChange(booking.id, 'completed')} style={microBtn('#10b981')}>Complete</button>}
        </div>
      </div>
    </div>
  )
}

// ─── Small Helpers ────────────────────────────────────────────────────────────

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'hsl(var(--card))', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'hsl(var(--foreground))' }}>{value}</div>
    </div>
  )
}

function microBtn(color: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${color}55`, background: `${color}18`, color, whiteSpace: 'nowrap',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'accommodation' | 'fnb' | 'vip' | 'transport'

interface EventOption { id: string; name: string; date?: string }

export default function HospitalityPage() {
  const { token } = useAuth()

  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Event selector
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [eventsLoading, setEventsLoading] = useState(true)

  // Data sections
  const [roomBlocks, setRoomBlocks] = useState<RoomBlock[]>([])
  const [accommodation, setAccommodation] = useState<GuestAccommodation[]>([])
  const [fnb, setFnb] = useState<FnbPlan[]>([])
  const [vips, setVips] = useState<VipGuest[]>([])
  const [transport, setTransport] = useState<TransportBooking[]>([])
  const [loading, setLoading] = useState(false)

  // Load events list
  useEffect(() => {
    if (!token) return
    setEventsLoading(true)
    fetch(`${API}/events?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const list: EventOption[] = Array.isArray(d) ? d : (d.data ?? [])
        setEvents(list)
        if (list.length > 0) setEventId(list[0].id)
      })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }, [token])

  // Load hospitality data for selected event
  const loadData = useCallback(async (eid: string) => {
    if (!token || !eid) return
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [rb, ac, fb, vi, tr] = await Promise.all([
        fetch(`${API}/hospitality/events/${eid}/room-blocks`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/hospitality/events/${eid}/accommodation`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/hospitality/events/${eid}/fnb`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/hospitality/events/${eid}/vips`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/hospitality/events/${eid}/transport`, { headers }).then(r => r.ok ? r.json() : []),
      ])
      setRoomBlocks(Array.isArray(rb) ? rb : (rb.data ?? []))
      setAccommodation(Array.isArray(ac) ? ac : (ac.data ?? []))
      setFnb(Array.isArray(fb) ? fb : (fb.data ?? []))
      setVips(Array.isArray(vi) ? vi : (vi.data ?? []))
      setTransport(Array.isArray(tr) ? tr : (tr.data ?? []))
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (eventId) loadData(eventId)
  }, [eventId, loadData])

  // ── API mutations ──────────────────────────────────────────────────────────

  const handleCheckIn = useCallback(async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/hospitality/accommodation/${id}/checkin`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setAccommodation(acc => acc.map(a => a.id === id ? { ...a, status: 'checked_in' as AccomStatus } : a))
    } catch { /* silent */ }
  }, [token])

  const handleCheckOut = useCallback(async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/hospitality/accommodation/${id}/checkout`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setAccommodation(acc => acc.map(a => a.id === id ? { ...a, status: 'checked_out' as AccomStatus } : a))
    } catch { /* silent */ }
  }, [token])

  const handleFnbStatus = useCallback(async (id: string, status: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/hospitality/fnb/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setFnb(f => f.map(p => p.id === id ? { ...p, status: status as FnbStatus } : p))
    } catch { /* silent */ }
  }, [token])

  const handleVipStatus = useCallback(async (id: string, status: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/hospitality/vips/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setVips(v => v.map(p => p.id === id ? { ...p, status: status as VipStatus } : p))
    } catch { /* silent */ }
  }, [token])

  const handleTransportStatus = useCallback(async (id: string, status: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/hospitality/transport/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setTransport(t => t.map(b => b.id === id ? { ...b, status: status as TransportStatus } : b))
    } catch { /* silent */ }
  }, [token])

  // Stats
  const totalRooms = roomBlocks.reduce((s, b) => s + b.total_rooms, 0)
  const occupiedRooms = roomBlocks.reduce((s, b) => s + b.occupied_rooms, 0)
  const checkedIn = accommodation.filter(a => a.status === 'checked_in').length
  const confirmedVips = vips.filter(v => v.status === 'confirmed' || v.status === 'arrived').length
  const pendingTransport = transport.filter(t => t.status === 'scheduled').length
  const confirmedFnb = fnb.filter(f => f.status === 'confirmed' || f.status === 'completed').length
  const totalFnbPax = fnb.reduce((s, f) => s + f.pax_count, 0)

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',       label: '🏠 Overview' },
    { key: 'accommodation',  label: '🏨 Accommodation', count: accommodation.length },
    { key: 'fnb',            label: '🍽️ F&B', count: fnb.length },
    { key: 'vip',            label: '⭐ VIP', count: vips.length },
    { key: 'transport',      label: '🚗 Transport', count: transport.length },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '32px 40px 0', borderBottom: '1px solid hsl(var(--border) / 0.4)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Hospitality</h1>
            <p style={{ margin: '4px 0 0', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>
              Accommodation, F&B, VIP management & transport coordination
            </p>
          </div>

          {/* Event selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {eventsLoading ? (
              <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Loading events…</div>
            ) : events.length === 0 ? (
              <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No events found</div>
            ) : (
              <>
                <label htmlFor="hosp-event-select" style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                  Event
                </label>
                <select
                  id="hosp-event-select"
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: '7px 32px 7px 12px',
                    borderRadius: 8, border: '1px solid hsl(var(--border) / 0.6)',
                    background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
                    cursor: 'pointer', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                    minWidth: 200, maxWidth: 320,
                  }}
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.date ? ` — ${new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}` : ''}
                    </option>
                  ))}
                </select>
              </>
            )}

            {loading && (
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid hsl(var(--border))',
                borderTopColor: 'hsl(var(--primary))',
                animation: 'spin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            )}
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatTile icon="🏨" label="Total Rooms" value={totalRooms} sub={`${occupiedRooms} occupied`} accent="#6366f1" />
          <StatTile icon="🛌" label="Checked In" value={checkedIn} sub={`of ${accommodation.length}`} accent="#10b981" />
          <StatTile icon="⭐" label="VIP Guests" value={vips.length} sub={`${confirmedVips} confirmed`} accent="#fbbf24" />
          <StatTile icon="🍽️" label="F&B Sessions" value={fnb.length} sub={`${totalFnbPax} total pax`} accent="#ec4899" />
          <StatTile icon="✅" label="F&B Confirmed" value={confirmedFnb} sub={`of ${fnb.length} sessions`} accent="#10b981" />
          <StatTile icon="🚗" label="Pending Transfers" value={pendingTransport} sub={`of ${transport.length} total`} accent="#f59e0b" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px 10px 0 0',
                border: '1px solid hsl(var(--border) / 0.5)',
                borderBottom: activeTab === tab.key ? '2px solid hsl(var(--primary))' : '1px solid rgba(255,255,255,0.08)',
                background: activeTab === tab.key ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: activeTab === tab.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                  background: activeTab === tab.key ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--border) / 0.5)',
                  color: activeTab === tab.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 40px 40px', position: 'relative' }}>

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'hsl(var(--background) / 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 20, borderRadius: 8, backdropFilter: 'blur(2px)',
          }}>
            <div style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '3px solid hsl(var(--border))', borderTopColor: 'hsl(var(--primary))',
                animation: 'spin 0.7s linear infinite', margin: '0 auto 10px',
              }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Loading hospitality data…</div>
            </div>
          </div>
        )}

        {/* Empty state when no event selected */}
        {!eventsLoading && !eventId && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'hsl(var(--muted-foreground))' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏨</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 8 }}>Select an Event</div>
            <div style={{ fontSize: 14 }}>Choose an event from the dropdown above to view hospitality data.</div>
          </div>
        )}

        {/* ── Overview ────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            {/* Room Blocks */}
            <div style={{ marginBottom: 32 }}>
              <SectionHeader title="Hotel Room Blocks" count={roomBlocks.length} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {roomBlocks.map(block => (
                  <RoomBlockCard key={block.id} block={block} onStatusChange={(id, s) => setRoomBlocks(b => b.map(r => r.id === id ? { ...r, status: s as any } : r))} />
                ))}
              </div>
            </div>

            {/* Upcoming F&B */}
            <div style={{ marginBottom: 32 }}>
              <SectionHeader title="Upcoming F&B Sessions" count={fnb.filter(f => f.status !== 'completed').length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fnb.filter(f => f.status !== 'completed' && f.status !== 'cancelled').map(plan => (
                  <FnbCard key={plan.id} plan={plan} onStatusChange={handleFnbStatus} />
                ))}
              </div>
            </div>

            {/* VIP Alert strip */}
            {vips.some(v => v.status === 'confirmed' && v.arrival_time && new Date(v.arrival_time) < new Date(Date.now() + 3600000 * 3)) && (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 10 }}>⚠️ VIP Arrivals in Next 3 Hours</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vips
                    .filter(v => v.status === 'confirmed' && v.arrival_time && new Date(v.arrival_time) < new Date(Date.now() + 3600000 * 3))
                    .map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        <span>{VIP_TYPE_ICONS[v.guest_type]}</span>
                        <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{v.guest_name}</span>
                        {v.arrival_time && <span style={{ color: 'hsl(var(--muted-foreground))' }}>@ {new Date(v.arrival_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                        {v.assigned_to && <span style={{ color: 'hsl(var(--muted-foreground))' }}>Handler: {v.assigned_to.full_name}</span>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pending transport */}
            <div>
              <SectionHeader title="Upcoming Transfers" count={transport.filter(t => !['completed','cancelled'].includes(t.status)).length} />
              <div>
                {transport.filter(t => !['completed','cancelled'].includes(t.status)).slice(0, 4).map(b => (
                  <TransportRow key={b.id} booking={b} onStatusChange={handleTransportStatus} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Accommodation ────────────────────────────────────────────────── */}
        {activeTab === 'accommodation' && (
          <div>
            {/* Status summary pills */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {(Object.keys(ACCOM_STATUS) as AccomStatus[]).map(s => {
                const count = accommodation.filter(a => a.status === s).length
                if (!count) return null
                return <span key={s} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: `${ACCOM_STATUS[s].color}18`, color: ACCOM_STATUS[s].color, fontWeight: 600 }}>{ACCOM_STATUS[s].label}: {count}</span>
              })}
            </div>

            <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                <span>Guest</span><span>Room</span><span>Dates</span><span>Cost</span><span>Status</span>
              </div>
              {accommodation.map(guest => (
                <AccomRow key={guest.id} guest={guest} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} />
              ))}
            </div>
          </div>
        )}

        {/* ── F&B ─────────────────────────────────────────────────────────── */}
        {activeTab === 'fnb' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Total cost summary */}
            <div style={{ ...cardStyle, display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Total F&B Budget</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                  ₹{fnb.reduce((s, f) => s + (f.total_cost ?? 0), 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Total Covers</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{totalFnbPax}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Sessions</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1' }}>{fnb.length}</div>
              </div>
            </div>

            {fnb.map(plan => (
              <FnbCard key={plan.id} plan={plan} onStatusChange={handleFnbStatus} />
            ))}
          </div>
        )}

        {/* ── VIP ─────────────────────────────────────────────────────────── */}
        {activeTab === 'vip' && (
          <div>
            <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: 12, padding: '8px 20px' }}>
              {vips.map(vip => (
                <VipRow key={vip.id} vip={vip} onStatusChange={handleVipStatus} />
              ))}
            </div>
          </div>
        )}

        {/* ── Transport ────────────────────────────────────────────────────── */}
        {activeTab === 'transport' && (
          <div>
            {/* Status summary */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {(['scheduled','confirmed','dispatched','completed','cancelled'] as TransportStatus[]).map(s => {
                const count = transport.filter(t => t.status === s).length
                if (!count) return null
                const c = { scheduled: '#64748b', confirmed: '#3b82f6', dispatched: '#f59e0b', completed: '#10b981', cancelled: '#ef4444', no_show: '#64748b' }[s]
                return <span key={s} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: `${c}18`, color: c, fontWeight: 600 }}>{s}: {count}</span>
              })}
            </div>

            <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: 12, padding: '8px 20px' }}>
              {transport.map(booking => (
                <TransportRow key={booking.id} booking={booking} onStatusChange={handleTransportStatus} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>{count}</span>
      )}
    </div>
  )
}
