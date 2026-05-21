'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Plus, Search, MapPin, Users, Wallet, X, ChevronRight,
  Grid3X3, List, LayoutGrid, Clock, CheckCircle2, Edit2, Trash2,
  Globe, Phone, Mail, Tag, ArrowRight, RefreshCw, AlertCircle, Star,
  ChevronDown, RotateCcw, AlertTriangle, Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import EventTypePicker from '@/components/events/EventTypePicker'
import EventTypeBadge from '@/components/events/EventTypeBadge'
import CurrencySelect from '@/components/events/CurrencySelect'
import TimezoneSelect from '@/components/events/TimezoneSelect'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function useApi(token: string) {
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  return {
    get: (p: string) => fetch(`${API}/v1${p}`, { headers: h }).then(r => r.json()),
    post: (p: string, b: any) => fetch(`${API}/v1${p}`, { method: 'POST', headers: h, body: JSON.stringify(b) }).then(r => r.json()),
    patch: (p: string, b: any) => fetch(`${API}/v1${p}`, { method: 'PATCH', headers: h, body: JSON.stringify(b) }).then(r => r.json()),
    del: (p: string) => fetch(`${API}/v1${p}`, { method: 'DELETE', headers: h }).then(r => r.json()),
  }
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted/40', className)} />
}

function formatINR(n: number) {
  if (!n) return '—'
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`
  return `₹${n}`
}

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-500/15 text-gray-400 border-gray-500/20',
  active:    'bg-green-500/15 text-green-400 border-green-500/20',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/20',
  on_hold:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
}

const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding', emoji: '💍' },
  { value: 'corporate', label: 'Corporate', emoji: '🏢' },
  { value: 'concert', label: 'Concert', emoji: '🎵' },
  { value: 'conference', label: 'Conference', emoji: '🎙️' },
  { value: 'birthday', label: 'Birthday', emoji: '🎂' },
  { value: 'exhibition', label: 'Exhibition', emoji: '🖼️' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'festival', label: 'Festival', emoji: '🎉' },
  { value: 'gala', label: 'Gala Dinner', emoji: '🥂' },
  { value: 'product_launch', label: 'Product Launch', emoji: '🚀' },
  { value: 'religious', label: 'Religious', emoji: '🙏' },
  { value: 'virtual', label: 'Virtual', emoji: '💻' },
  { value: 'hybrid', label: 'Hybrid', emoji: '🌐' },
  { value: 'other', label: 'Other', emoji: '📅' },
]

const STATUS_FILTERS = ['all', 'draft', 'active', 'completed', 'on_hold', 'cancelled']

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b']

// ── Create Event Modal ─────────────────────────────────────────────────────

function CreateEventModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: (e: any) => void }) {
  const api = useApi(token)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', event_type_id: '', start_date: '', end_date: '',
    venue_name: '', city: '', expected_guests: '', budget: '',
    color: COLORS[0], description: '', client_name: '', client_email: '',
    currency_code: 'INR', timezone: 'Asia/Kolkata',
  })
  const [selectedEventType, setSelectedEventType] = useState<any>(null)

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.name) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        expected_guests: form.expected_guests ? parseInt(form.expected_guests) : null,
        budget: form.budget ? parseFloat(form.budget) : null,
        event_type_id: form.event_type_id || undefined,
      }
      const data = await api.post('/events', payload)
      if (data.id || data.event?.id) {
        onCreated(data.event ?? data)
        onClose()
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold">Create New Event</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-3 shrink-0">
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(step / 2) * 100}%` }} />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Event Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Sharma Wedding Reception 2026"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Event Type</label>
                <EventTypePicker
                  value={form.event_type_id || null}
                  onChange={(id, type) => { set('event_type_id', id || ''); setSelectedEventType(type || null) }}
                />
                {selectedEventType && (
                  <div className="mt-1.5">
                    <EventTypeBadge eventType={selectedEventType} size="sm" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</label>
                  <input type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Date</label>
                  <input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Event Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => set('color', c)}
                      className={cn('w-7 h-7 rounded-full transition-all', form.color === c && 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Venue / Location</label>
                  <input value={form.venue_name} onChange={e => set('venue_name', e.target.value)}
                    placeholder="Grand Ballroom, Taj Hotel"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">City</label>
                  <input value={form.city} onChange={e => set('city', e.target.value)}
                    placeholder="Mumbai"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Expected Guests</label>
                  <input type="number" value={form.expected_guests} onChange={e => set('expected_guests', e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Budget (₹)</label>
                  <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)}
                    placeholder="500000"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client Name</label>
                <input value={form.client_name} onChange={e => set('client_name', e.target.value)}
                  placeholder="Rajesh Sharma"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client Email</label>
                <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)}
                  placeholder="rajesh@example.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Currency</label>
                  <CurrencySelect
                    value={form.currency_code}
                    onChange={v => set('currency_code', v)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Timezone</label>
                  <TimezoneSelect
                    value={form.timezone}
                    onChange={v => set('timezone', v)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description / Notes</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  rows={3} placeholder="Brief about the event…"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={!form.name}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
              Continue →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : '✓ Create Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Event Card ─────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: any; onClick: () => void }) {
  const typeEmoji = EVENT_TYPES.find(t => t.value === event.event_type)?.emoji ?? '📅'
  return (
    <div onClick={onClick}
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all cursor-pointer group space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
            style={{ backgroundColor: (event.color ?? '#6366f1') + '20' }}>
            {typeEmoji}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{event.name}</h3>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{event.event_type?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0', STATUS_STYLE[event.status] ?? STATUS_STYLE.draft)}>
          {event.status}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {event.start_date && (
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            {new Date(event.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {event.end_date && ` – ${new Date(event.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </div>
        )}
        {(event.venue_name || event.city) && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {[event.venue_name, event.city].filter(Boolean).join(', ')}
          </div>
        )}
        {event.expected_guests && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {event.expected_guests.toLocaleString()} expected guests
          </div>
        )}
      </div>

      {event.budget && (
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Budget</span>
          <span className="text-xs font-semibold text-green-400">
            {formatINR(event.budget)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({ event, token, onClose, onUpdate }: { event: any; token: string; onClose: () => void; onUpdate: () => void }) {
  const api = useApi(token)
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'team' | 'vendors' | 'tasks'>('overview')

  useEffect(() => {
    setLoading(true)
    api.get(`/events/${event.id}`)
      .then(d => setDetail(d.event ?? d))
      .finally(() => setLoading(false))
  }, [event.id])

  const typeEmoji = EVENT_TYPES.find(t => t.value === event.event_type)?.emoji ?? '📅'

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-xl h-full bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start gap-3 shrink-0"
          style={{ borderTopColor: event.color ?? '#6366f1', borderTopWidth: 3 }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: (event.color ?? '#6366f1') + '20' }}>
            {typeEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{event.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border', STATUS_STYLE[event.status] ?? STATUS_STYLE.draft)}>
                {event.status}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{event.event_type?.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href={`/events/${event.id}`} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'team', label: 'Team' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'tasks', label: 'Tasks' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={cn('px-4 py-3 text-xs font-medium border-b-2 transition-colors',
                tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : tab === 'overview' ? (
            <div className="space-y-5">
              {/* Key info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Start Date', value: event.start_date ? new Date(event.start_date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'TBD', icon: CalendarDays },
                  { label: 'End Date', value: event.end_date ? new Date(event.end_date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'TBD', icon: Clock },
                  { label: 'Venue', value: [event.venue_name, event.city].filter(Boolean).join(', ') || 'Not set', icon: MapPin },
                  { label: 'Expected Guests', value: event.expected_guests?.toLocaleString() ?? 'Not set', icon: Users },
                  { label: 'Budget', value: formatINR(event.budget), icon: Wallet },
                  { label: 'Client', value: event.client_name || 'Not set', icon: Star },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-background border border-border rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{label}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>

              {(detail?.description || event.description) && (
                <div className="bg-background border border-border rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-sm leading-relaxed text-foreground/80">{detail?.description ?? event.description}</p>
                </div>
              )}

              {event.client_email && (
                <div className="bg-background border border-border rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Client Contact</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{event.client_email}</div>
                    {event.client_phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{event.client_phone}</div>}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'team' ? (
            <div>
              {(detail?.assignments ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No team members assigned</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(detail?.assignments ?? []).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {a.profiles?.full_name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.profiles?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{a.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'vendors' ? (
            <div>
              {(detail?.vendors ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No vendors assigned</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(detail?.vendors ?? []).map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.vendors?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{v.service_description}</p>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border', STATUS_STYLE[v.status] ?? STATUS_STYLE.draft)}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {(detail?.tasks ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No tasks created</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(detail?.tasks ?? []).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                      <div className={cn('w-4 h-4 rounded border-2 shrink-0', t.status === 'done' ? 'bg-green-500 border-green-500' : 'border-border')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', t.status === 'done' && 'line-through text-muted-foreground')}>{t.title}</p>
                        {t.due_date && <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.due_date).toLocaleDateString()}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">{t.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <Link href={`/events/${event.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors">
            Open Full View <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const api = useApi(token)

  const [events, setEvents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('event_type', typeFilter)
      params.set('limit', '50')
      const data = await api.get(`/events?${params}`)
      setEvents(data?.data ?? data?.events ?? [])
      setTotal(data?.count ?? data?.total ?? 0)
    } finally { setLoading(false) }
  }, [token, search, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  function handleCreated(e: any) {
    setEvents(prev => [e, ...prev])
    setTotal(t => t + 1)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Events</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} total events</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>

        {/* Filters row */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filters */}
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground')}>
                {s}
              </button>
            ))}
            {/* View toggle */}
            <div className="flex gap-1 ml-auto bg-background border border-border rounded-lg p-0.5">
              <button onClick={() => setView('grid')} className={cn('p-1.5 rounded', view === 'grid' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setView('list')} className={cn('p-1.5 rounded', view === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={cn('gap-4', view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
            {Array.from({ length: 6 }).map((_, i) => <Sk key={i} className={view === 'grid' ? 'h-44 rounded-xl' : 'h-20 rounded-xl'} />)}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-medium">No events found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first event to get started'}
              </p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> New Event
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {events.map(event => {
                const typeEmoji = EVENT_TYPES.find(t => t.value === event.event_type)?.emoji ?? '📅'
                return (
                  <button key={event.id} onClick={() => setSelectedEvent(event)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors text-left group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: (event.color ?? '#6366f1') + '20' }}>
                      {typeEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{event.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {event.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{new Date(event.start_date).toLocaleDateString()}</span>}
                        {(event.venue_name || event.city) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[event.venue_name, event.city].filter(Boolean).join(', ')}</span>}
                        {event.expected_guests && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.expected_guests.toLocaleString()}</span>}
                      </div>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0', STATUS_STYLE[event.status] ?? STATUS_STYLE.draft)}>
                      {event.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trash panel */}
      <TrashPanel token={token} onRestore={load} />

      {/* Modals */}
      {showCreate && <CreateEventModal token={token} onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {selectedEvent && (
        <DetailPanel event={selectedEvent} token={token} onClose={() => setSelectedEvent(null)} onUpdate={load} />
      )}
    </div>
  )
}

// ── Trash Panel ───────────────────────────────────────────────────────────────

interface DeletedEvent {
  id: string
  name: string
  category: string
  status: string
  start_date: string | null
  deleted_at: string
  days_until_purge: number
}

function TrashPanel({ token, onRestore }: { token: string; onRestore: () => void }) {
  const [open, setOpen]             = useState(false)
  const [items, setItems]           = useState<DeletedEvent[]>([])
  const [loading, setLoading]       = useState(false)
  const [actionId, setActionId]     = useState<string | null>(null)
  const [confirmPerm, setConfirmPerm] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}/v1/events/deleted`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { if (open) load() }, [open, load])

  async function restore(id: string) {
    setActionId(id)
    try {
      await fetch(`${API}/v1/events/${id}/restore`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      load()
      onRestore()
    } finally {
      setActionId(null)
    }
  }

  async function permDelete(id: string) {
    setActionId(id)
    try {
      await fetch(`${API}/v1/events/${id}/permanent`, {
        method:  'DELETE',
        headers: {
          Authorization:      `Bearer ${token}`,
          'x-confirm-delete': 'true',
        },
      })
      load()
      setConfirmPerm(null)
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Deleted Events</span>
          {!open && items.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20">
              {items.length}
            </span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-border/40 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading deleted events…</span>
            </div>
          ) : !items.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No deleted events</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Deleted events are kept for 30 days, then permanently removed.
              </p>
              {items.map(ev => (
                <div key={ev.id} className="flex items-center gap-4 p-3.5 rounded-xl border border-border/40 bg-background/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{ev.category?.replace('_', ' ')}</span>
                      {ev.start_date && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{new Date(ev.start_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Days until purge */}
                  <div className={cn(
                    'shrink-0 text-xs px-2 py-1 rounded-lg border font-medium',
                    ev.days_until_purge <= 3
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : ev.days_until_purge <= 7
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-muted/30 text-muted-foreground border-border/40'
                  )}>
                    {ev.days_until_purge === 0 ? 'Purges today' : `${ev.days_until_purge}d left`}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => restore(ev.id)}
                      disabled={actionId === ev.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                      title="Restore event"
                    >
                      {actionId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmPerm(ev.id)}
                      disabled={actionId === ev.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete permanently"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permanent delete confirmation overlay */}
      {confirmPerm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Permanently?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will remove the event and all its data forever. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => permDelete(confirmPerm)}
                disabled={actionId === confirmPerm}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionId === confirmPerm
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <AlertTriangle className="w-3.5 h-3.5" />}
                Delete Forever
              </button>
              <button
                onClick={() => setConfirmPerm(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
