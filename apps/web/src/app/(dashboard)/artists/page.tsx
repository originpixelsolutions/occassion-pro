'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiderType = 'technical' | 'hospitality' | 'security' | 'transport' | 'accommodation'

interface Artist {
  id: string
  name: string
  stage_name?: string
  genre?: string
  category: string
  nationality?: string
  profile_image_url?: string
  agent_name?: string
  agent_email?: string
  agent_phone?: string
  base_fee?: number
  currency: string
  tags?: string[]
  bio?: string
  social_links?: Record<string, string>
  created_at?: string
}

type BookingStatus = 'enquiry' | 'negotiating' | 'booked' | 'confirmed' | 'on_site' | 'performed' | 'cancelled' | 'no_show'
type FeeStatus = 'quoted' | 'negotiating' | 'agreed' | 'advance_paid' | 'fully_paid' | 'disputed'

interface ArtistBooking {
  id: string
  set_name?: string
  set_type: string
  start_time?: string
  duration_minutes: number
  stage?: string
  set_order: number
  fee?: number
  currency: string
  fee_status: FeeStatus
  advance_amount?: number
  balance_due?: number
  contract_signed: boolean
  status: BookingStatus
  notes?: string
  artist: Artist
  riders?: RiderItem[]
  itinerary?: ItineraryItem[]
  event?: { id: string; name: string; date?: string }
}

interface RiderItem {
  id: string
  rider_type: RiderType
  item: string
  quantity: number
  specification?: string
  is_mandatory: boolean
  fulfilled: boolean
  fulfilled_by?: { full_name: string }
  notes?: string
}

interface ItineraryItem {
  id: string
  activity: string
  activity_type: string
  scheduled_time: string
  duration_minutes: number
  location?: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_STATUS: Record<BookingStatus, { label: string; color: string }> = {
  enquiry:    { label: 'Enquiry',     color: 'hsl(var(--muted-foreground))' },
  negotiating:{ label: 'Negotiating', color: '#f59e0b' },
  booked:     { label: 'Booked',      color: '#3b82f6' },
  confirmed:  { label: 'Confirmed',   color: '#10b981' },
  on_site:    { label: 'On Site',     color: '#22c55e' },
  performed:  { label: 'Performed',   color: '#475569' },
  cancelled:  { label: 'Cancelled',   color: '#ef4444' },
  no_show:    { label: 'No Show',     color: 'hsl(var(--muted-foreground))' },
}

const FEE_STATUS: Record<FeeStatus, { label: string; color: string }> = {
  quoted:      { label: 'Quoted',      color: 'hsl(var(--muted-foreground))' },
  negotiating: { label: 'Negotiating', color: '#f59e0b' },
  agreed:      { label: 'Agreed',      color: '#3b82f6' },
  advance_paid:{ label: 'Adv. Paid',   color: '#8b5cf6' },
  fully_paid:  { label: 'Fully Paid',  color: '#10b981' },
  disputed:    { label: 'Disputed',    color: '#ef4444' },
}

const CATEGORY_ICONS: Record<string, string> = {
  performer: '🎤', dj: '🎧', band: '🎸', comedian: '😄', speaker: '🎙️',
  emcee: '🎤', dancer: '💃', acrobat: '🎪', magician: '🪄', celebrity: '⭐', other: '🎭',
}

const CATEGORY_LIST = [
  { value: 'performer', label: 'Performer' },
  { value: 'dj',        label: 'DJ' },
  { value: 'band',      label: 'Band' },
  { value: 'comedian',  label: 'Comedian' },
  { value: 'speaker',   label: 'Speaker' },
  { value: 'emcee',     label: 'Emcee / MC' },
  { value: 'dancer',    label: 'Dancer' },
  { value: 'celebrity', label: 'Celebrity' },
  { value: 'other',     label: 'Other' },
]

const RIDER_TYPE_COLORS: Record<RiderType, string> = {
  technical: '#3b82f6', hospitality: '#ec4899', security: '#ef4444',
  transport: '#f59e0b', accommodation: '#8b5cf6',
}

const ACTIVITY_ICONS: Record<string, string> = {
  travel: '🚗', arrival: '✈️', check_in: '🏨', soundcheck: '🎛️', meet_greet: '🤝',
  performance: '🎤', interview: '🎙️', dinner: '🍽️', departure: '🛫', other: '📋',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1000000 ? `₹${(n / 1000000).toFixed(1)}M` : `₹${(n / 1000).toFixed(0)}K`
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${color}55`, background: `${color}18`, color, display: 'inline-block',
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {label}
    </span>
  )
}

function ArtistAvatar({ artist, size = 48 }: { artist: Artist; size?: number }) {
  const initials = artist.stage_name
    ? artist.stage_name.slice(0, 2).toUpperCase()
    : artist.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const radius = size <= 40 ? 10 : 14
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 800, color: 'hsl(var(--foreground))', flexShrink: 0, letterSpacing: '-0.5px',
    }}>
      {artist.profile_image_url
        ? <img src={artist.profile_image_url} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }} alt={artist.name} />
        : initials}
    </div>
  )
}

function ArtistCard({ artist, onSelect, isSelected, onDelete }: {
  artist: Artist
  onSelect: () => void
  isSelected: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
        border: `1px solid ${isSelected ? '#6366f1' : 'hsl(var(--border) / 0.5)'}`,
        borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ArtistAvatar artist={artist} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {artist.stage_name ?? artist.name}
                </span>
                <span style={{ fontSize: 13 }}>{CATEGORY_ICONS[artist.category] ?? '🎭'}</span>
              </div>
              {artist.stage_name && (
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{artist.name}</div>
              )}
              {artist.genre && (
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>{artist.genre}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))',
                textTransform: 'capitalize',
              }}>{artist.category}</span>
              {artist.base_fee && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  {fmt(artist.base_fee)}
                </span>
              )}
            </div>
          </div>

          {(artist.agent_name || artist.nationality) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {artist.agent_name && (
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>🤝 {artist.agent_name}</span>
              )}
              {artist.nationality && (
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>🌍 {artist.nationality}</span>
              )}
            </div>
          )}

          {artist.tags && artist.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {artist.tags.slice(0, 4).map(tag => (
                <span key={tag} style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RiderPanel({ riders, bookingId, onFulfill, loading }: {
  riders: RiderItem[]
  bookingId: string
  onFulfill: (id: string) => void
  loading: boolean
}) {
  const byType = (Object.keys(RIDER_TYPE_COLORS) as RiderType[]).reduce((acc, type) => {
    acc[type] = riders.filter(r => r.rider_type === type)
    return acc
  }, {} as Record<RiderType, RiderItem[]>)

  const mandatory = riders.filter(r => r.is_mandatory)
  const fulfilled = mandatory.filter(r => r.fulfilled)
  const pct = mandatory.length ? Math.round((fulfilled.length / mandatory.length) * 100) : 100

  if (loading) return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading rider requirements…</div>

  return (
    <div>
      <div style={{ marginBottom: 20, background: 'hsl(var(--card))', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Mandatory Rider Fulfillment</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: pct === 100 ? '#10b981' : '#f59e0b' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: 'hsl(var(--muted))', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#f59e0b', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
          {fulfilled.length} of {mandatory.length} mandatory items fulfilled
        </div>
      </div>

      {(Object.entries(byType) as [RiderType, RiderItem[]][]).map(([type, items]) => {
        if (!items.length) return null
        const color = RIDER_TYPE_COLORS[type]
        return (
          <div key={type} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {type} Rider ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px',
                  background: item.fulfilled ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${item.fulfilled ? 'rgba(16,185,129,0.2)' : 'hsl(var(--border) / 0.4)'}`,
                  borderRadius: 8, opacity: item.fulfilled ? 0.75 : 1,
                }}>
                  <div
                    style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                      border: `2px solid ${item.fulfilled ? '#10b981' : item.is_mandatory ? '#ef4444' : 'hsl(var(--border))'}`,
                      background: item.fulfilled ? '#10b981' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !item.fulfilled ? 'pointer' : 'default',
                    }}
                    onClick={() => !item.fulfilled && onFulfill(item.id)}
                  >
                    {item.fulfilled && <span style={{ color: 'hsl(var(--foreground))', fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{item.item}</span>
                      {item.quantity > 1 && <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>×{item.quantity}</span>}
                      {item.is_mandatory && !item.fulfilled && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>REQUIRED</span>}
                    </div>
                    {item.specification && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{item.specification}</div>}
                    {item.fulfilled && item.fulfilled_by && (
                      <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>✓ Fulfilled by {item.fulfilled_by.full_name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ItineraryPanel({ items, onStatusChange, loading }: {
  items: ItineraryItem[]
  onStatusChange: (id: string, s: string) => void
  loading: boolean
}) {
  if (loading) return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading itinerary…</div>

  return (
    <div>
      {items.map((item, idx) => {
        const time = new Date(item.scheduled_time)
        const statusColor = { pending: '#64748b', confirmed: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' }[item.status] ?? '#64748b'
        const endTime = new Date(time.getTime() + item.duration_minutes * 60000)

        return (
          <div key={item.id} style={{ display: 'flex', gap: 14, paddingBottom: 16, position: 'relative' }}>
            {idx < items.length - 1 && (
              <div style={{ position: 'absolute', left: 21, top: 36, width: 2, height: 'calc(100% - 20px)', background: 'hsl(var(--muted))', zIndex: 0 }} />
            )}
            <div style={{ width: 52, flexShrink: 0, textAlign: 'right', paddingTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                {endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
            <div style={{ width: 30, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: statusColor,
                border: '2px solid hsl(var(--background))', boxShadow: `0 0 0 3px ${statusColor}33`,
              }} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>{ACTIVITY_ICONS[item.activity_type] ?? '📋'}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }}>{item.activity}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: `${statusColor}22`, color: statusColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {item.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                <span>⏱ {item.duration_minutes}min</span>
                {item.location && <span>📍 {item.location}</span>}
              </div>
              {item.notes && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>{item.notes}</div>}
              {item.status === 'confirmed' && (
                <button
                  onClick={() => onStatusChange(item.id, 'completed')}
                  style={{ marginTop: 6, padding: '3px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #10b98155', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                >
                  Mark Done
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Add Artist Modal ─────────────────────────────────────────────────────────

function AddArtistModal({ token, onClose, onCreated }: {
  token: string
  onClose: () => void
  onCreated: (artist: Artist) => void
}) {
  const [form, setForm] = useState({
    name: '', stage_name: '', category: 'performer', genre: '',
    nationality: '', agent_name: '', agent_email: '', agent_phone: '',
    base_fee: '', currency: 'INR', bio: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Artist name is required')
    setLoading(true)
    setError('')
    try {
      const body: any = { ...form }
      if (form.base_fee) body.base_fee = Number(form.base_fee)
      else delete body.base_fee
      const res = await fetch(`${API}/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to add artist')
      const data = await res.json()
      onCreated(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'hsl(var(--foreground))',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 20, padding: '32px', width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Add Artist to Registry</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
          Add a new artist or talent to your roster for future bookings.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>ARTIST NAME *</label>
              <input style={field} placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>STAGE NAME</label>
              <input style={field} placeholder="e.g. DJ PRITHVI" value={form.stage_name} onChange={e => setForm(f => ({ ...f, stage_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>CATEGORY *</label>
              <select style={field} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORY_LIST.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>GENRE / STYLE</label>
              <input style={field} placeholder="e.g. Bollywood Pop" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>NATIONALITY</label>
              <input style={field} placeholder="e.g. Indian" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>AGENT NAME</label>
              <input style={field} placeholder="Agent / manager name" value={form.agent_name} onChange={e => setForm(f => ({ ...f, agent_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>AGENT EMAIL</label>
              <input style={field} type="email" placeholder="agent@agency.com" value={form.agent_email} onChange={e => setForm(f => ({ ...f, agent_email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>AGENT PHONE</label>
              <input style={field} placeholder="+91 98765 00000" value={form.agent_phone} onChange={e => setForm(f => ({ ...f, agent_phone: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>BASE FEE</label>
              <input style={field} type="number" placeholder="0" value={form.base_fee} onChange={e => setForm(f => ({ ...f, base_fee: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>CURRENCY</label>
              <select style={field} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>BIO / NOTES</label>
              <textarea style={{ ...field, minHeight: 72, resize: 'vertical' }} placeholder="Short bio or booking notes…" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
            </div>
          </div>

          {error && <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--muted-foreground))', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: 'hsl(var(--foreground))', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Adding…' : 'Add Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DetailTab = 'info' | 'rider' | 'itinerary'

export default function ArtistsPage() {
  const { token } = useAuth()

  // Registry state
  const [artists, setArtists] = useState<Artist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Detail / booking state (for selected artist's active booking in an event context)
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const [activeBooking, setActiveBooking] = useState<ArtistBooking | null>(null)
  const [riders, setRiders] = useState<RiderItem[]>([])
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load artist registry ──────────────────────────────────────────────────

  const loadArtists = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`${API}/artists?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load artists')
      const data = await res.json()
      const list: Artist[] = Array.isArray(data) ? data : (data.data ?? [])
      setArtists(list)
      if (!selectedId && list.length > 0) setSelectedId(list[0].id)
    } catch {
      setArtists([])
    } finally {
      setLoading(false)
    }
  }, [token, search, categoryFilter])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(loadArtists, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [loadArtists])

  // ── Load booking detail when artist selected ──────────────────────────────

  const loadBookingDetail = useCallback(async (bookingId: string) => {
    if (!token || !bookingId) return
    setDetailLoading(true)
    try {
      const res = await fetch(`${API}/artists/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setActiveBooking(data)
      setRiders(data.riders ?? [])
      setItinerary(data.itinerary ?? [])
    } finally {
      setDetailLoading(false)
    }
  }, [token])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleFulfillRider = useCallback(async (riderId: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/artists/riders/${riderId}/fulfill`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      setRiders(prev => prev.map(r => r.id === riderId ? { ...r, fulfilled: true, fulfilled_by: { full_name: 'You' } } : r))
    } catch { /* silent */ }
  }, [token])

  const handleItineraryStatus = useCallback(async (itemId: string, status: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/artists/itinerary/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      setItinerary(prev => prev.map(i => i.id === itemId ? { ...i, status: status as any } : i))
    } catch { /* silent */ }
  }, [token])

  const handleBookingStatusChange = useCallback(async (bookingId: string, status: string) => {
    if (!token) return
    try {
      await fetch(`${API}/artists/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (activeBooking?.id === bookingId) {
        setActiveBooking(prev => prev ? { ...prev, status: status as BookingStatus } : null)
      }
    } catch { /* silent */ }
  }, [token, activeBooking])

  const handleDeleteArtist = useCallback(async (id: string) => {
    if (!token || !confirm('Remove this artist from the registry?')) return
    try {
      await fetch(`${API}/artists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setArtists(prev => prev.filter(a => a.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch { /* silent */ }
  }, [token, selectedId])

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedArtist = artists.find(a => a.id === selectedId) ?? null

  const stats = {
    total: artists.length,
    withAgent: artists.filter(a => a.agent_name).length,
    avgFee: artists.filter(a => a.base_fee).length
      ? Math.round(artists.filter(a => a.base_fee).reduce((s, a) => s + (a.base_fee ?? 0), 0) / artists.filter(a => a.base_fee).length)
      : 0,
    byCategory: CATEGORY_LIST.slice(0, 4).map(c => ({
      label: c.label, icon: CATEGORY_ICONS[c.value] ?? '🎭',
      count: artists.filter(a => a.category === c.value).length,
    })).filter(c => c.count > 0),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Artist & Talent</h1>
            <p style={{ margin: '4px 0 0', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>
              Talent registry — profiles, riders, itineraries & bookings
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid hsl(var(--primary) / 0.5)', background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Artist
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Artists', value: artists.length, color: '#6366f1' },
            { label: 'With Agent', value: stats.withAgent, color: '#3b82f6' },
            { label: 'Avg Base Fee', value: stats.avgFee ? fmt(stats.avgFee) : '—', color: 'hsl(var(--foreground))' },
            { label: 'Categories', value: new Set(artists.map(a => a.category)).size, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{loading ? '—' : value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: 'calc(100vh - 220px)', overflow: 'hidden' }}>

        {/* Left: Artist list */}
        <div style={{ borderRight: '1px solid hsl(var(--border) / 0.4)', overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Filters */}
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Search artists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)',
                borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'hsl(var(--foreground))',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ value: '', label: 'All' }, ...CATEGORY_LIST.slice(0, 5)].map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategoryFilter(c.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${categoryFilter === c.value ? '#6366f1' : 'hsl(var(--border) / 0.5)'}`,
                    background: categoryFilter === c.value ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: categoryFilter === c.value ? '#6366f1' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {CATEGORY_ICONS[c.value] ?? ''} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Registry ({loading ? '…' : artists.length} artists)
          </div>

          {loading ? (
            <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Loading artists…</div>
          ) : artists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎤</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No artists found</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                {search || categoryFilter ? 'Try adjusting your filters.' : 'Add your first artist to get started.'}
              </div>
              {!search && !categoryFilter && (
                <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #6366f155', background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Add Artist
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {artists.map(artist => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  isSelected={selectedId === artist.id}
                  onSelect={() => {
                    setSelectedId(artist.id)
                    setDetailTab('info')
                    setActiveBooking(null)
                    setRiders([])
                    setItinerary([])
                  }}
                  onDelete={handleDeleteArtist}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        <div style={{ overflowY: 'auto' }}>
          {selectedArtist ? (
            <div>
              {/* Artist header */}
              <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border) / 0.4)', background: 'rgba(99,102,241,0.05)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <ArtistAvatar artist={selectedArtist} size={56} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--foreground))', marginBottom: 4 }}>
                      {selectedArtist.stage_name ?? selectedArtist.name}
                    </div>
                    {selectedArtist.stage_name && (
                      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>a.k.a. {selectedArtist.name}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <Badge label={selectedArtist.category} color="#6366f1" />
                      {selectedArtist.genre && <Badge label={selectedArtist.genre} color="#64748b" />}
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'hsl(var(--muted-foreground))', flexWrap: 'wrap' }}>
                      {selectedArtist.nationality && <span>🌍 {selectedArtist.nationality}</span>}
                      {selectedArtist.base_fee && <span>💰 Base {fmt(selectedArtist.base_fee)}</span>}
                      {selectedArtist.agent_name && <span>🤝 {selectedArtist.agent_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedArtist.agent_phone && (
                      <a href={`tel:${selectedArtist.agent_phone}`} style={{ ...actionBtn('#64748b'), textDecoration: 'none' }}>
                        📞 Agent
                      </a>
                    )}
                    {selectedArtist.agent_email && (
                      <a href={`mailto:${selectedArtist.agent_email}`} style={{ ...actionBtn('#3b82f6'), textDecoration: 'none' }}>
                        ✉️ Email
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteArtist(selectedArtist.id)}
                      style={{ ...actionBtn('#ef4444'), background: 'rgba(239,68,68,0.1)' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ padding: '0 32px', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', gap: 4 }}>
                {([
                  { id: 'info',      label: '📄 Profile' },
                  { id: 'rider',     label: `🎛️ Rider${activeBooking ? ` (${riders.length})` : ''}` },
                  { id: 'itinerary', label: `📋 Itinerary${activeBooking ? ` (${itinerary.length})` : ''}` },
                ] as { id: DetailTab; label: string }[]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    style={{
                      padding: '12px 18px', background: 'transparent',
                      border: 'none', borderBottom: `2px solid ${detailTab === tab.id ? '#6366f1' : 'transparent'}`,
                      color: detailTab === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      fontSize: 14, fontWeight: detailTab === tab.id ? 700 : 500, cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '24px 32px' }}>
                {/* Info tab */}
                {detailTab === 'info' && (
                  <div>
                    {selectedArtist.bio && (
                      <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Bio</div>
                        <div style={{ fontSize: 14, color: 'hsl(var(--foreground))', lineHeight: 1.6 }}>{selectedArtist.bio}</div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[
                        { label: 'Full Name',     value: selectedArtist.name },
                        { label: 'Stage Name',    value: selectedArtist.stage_name ?? '—' },
                        { label: 'Category',      value: selectedArtist.category },
                        { label: 'Genre / Style', value: selectedArtist.genre ?? '—' },
                        { label: 'Nationality',   value: selectedArtist.nationality ?? '—' },
                        { label: 'Currency',      value: selectedArtist.currency },
                        { label: 'Base Fee',      value: selectedArtist.base_fee ? `${selectedArtist.currency} ${selectedArtist.base_fee.toLocaleString()}` : '—' },
                        { label: 'Agent',         value: selectedArtist.agent_name ?? '—' },
                        { label: 'Agent Email',   value: selectedArtist.agent_email ?? '—' },
                        { label: 'Agent Phone',   value: selectedArtist.agent_phone ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'hsl(var(--card))', borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {selectedArtist.tags && selectedArtist.tags.length > 0 && (
                      <div style={{ marginTop: 16, background: 'hsl(var(--card))', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Tags</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {selectedArtist.tags.map(tag => (
                            <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 20, padding: '16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 6 }}>📌 Booking Tip</div>
                      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                        To view this artist&apos;s rider requirements and itinerary, open the event they are booked for and navigate to the Artist module from there.
                      </div>
                    </div>
                  </div>
                )}

                {/* Rider tab — requires active booking context */}
                {detailTab === 'rider' && (
                  activeBooking ? (
                    <RiderPanel
                      riders={riders}
                      bookingId={activeBooking.id}
                      onFulfill={handleFulfillRider}
                      loading={detailLoading}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'hsl(var(--muted-foreground))' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>🎛️</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No active booking selected</div>
                      <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
                        Rider requirements are tied to specific event bookings. Open an event and navigate to its Artist Management section to view and fulfil rider items.
                      </div>
                    </div>
                  )
                )}

                {/* Itinerary tab — requires active booking context */}
                {detailTab === 'itinerary' && (
                  activeBooking ? (
                    <ItineraryPanel
                      items={itinerary}
                      onStatusChange={handleItineraryStatus}
                      loading={detailLoading}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'hsl(var(--muted-foreground))' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No active booking selected</div>
                      <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
                        Itinerary items are linked to specific event bookings. Open the relevant event&apos;s Artist Management section to manage the run-of-show schedule.
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--muted-foreground))', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 48 }}>🎤</div>
              <div style={{ fontSize: 16 }}>{loading ? 'Loading…' : 'Select an artist to view their profile'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Add Artist Modal */}
      {showAddModal && (
        <AddArtistModal
          token={token ?? ''}
          onClose={() => setShowAddModal(false)}
          onCreated={artist => {
            setArtists(prev => [artist, ...prev])
            setSelectedId(artist.id)
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}
