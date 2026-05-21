'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Plus, Search, X, MapPin, Users, Star, Loader2,
  Edit2, Trash2, Phone, Mail, Globe, Building2,
  CheckSquare, DollarSign, Image, Calendar, Wifi,
  Car, Utensils, Tv, Wind, Dumbbell, Coffee
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function formatINR(n: number) {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

type Venue = {
  id: string
  name: string
  location: string
  city: string
  state?: string
  capacity_min?: number
  capacity_max: number
  pricing_per_day?: number
  pricing_per_hour?: number
  venue_type?: string
  amenities?: string[]
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  website?: string
  rating?: number
  is_active: boolean
  description?: string
  images?: string[]
  created_at: string
}

const VENUE_TYPES = [
  'Hotel', 'Banquet Hall', 'Convention Center', 'Outdoor', 'Beach',
  'Garden', 'Rooftop', 'Heritage', 'Resort', 'Stadium', 'Auditorium', 'Other'
]

const AMENITIES_LIST = [
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'parking', label: 'Parking', icon: Car },
  { id: 'catering', label: 'Catering', icon: Utensils },
  { id: 'av', label: 'A/V Setup', icon: Tv },
  { id: 'ac', label: 'A/C', icon: Wind },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'cafe', label: 'Café', icon: Coffee },
]

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Goa', 'Other']

function VenueModal({ token, venue, onClose, onSaved }: {
  token: string; venue?: Venue | null; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: venue?.name ?? '',
    location: venue?.location ?? '',
    city: venue?.city ?? '',
    state: venue?.state ?? '',
    capacity_min: venue?.capacity_min ?? 0,
    capacity_max: venue?.capacity_max ?? 100,
    pricing_per_day: venue?.pricing_per_day ?? 0,
    pricing_per_hour: venue?.pricing_per_hour ?? 0,
    venue_type: venue?.venue_type ?? '',
    contact_name: venue?.contact_name ?? '',
    contact_phone: venue?.contact_phone ?? '',
    contact_email: venue?.contact_email ?? '',
    website: venue?.website ?? '',
    description: venue?.description ?? '',
    amenities: venue?.amenities ?? [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const toggleAmenity = (id: string) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(id) ? f.amenities.filter(a => a !== id) : [...f.amenities, id]
    }))
  }

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const url = venue ? `${API}/venues/${venue.id}` : `${API}/venues`
      const r = await fetch(url, {
        method: venue ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          capacity_min: Number(form.capacity_min),
          capacity_max: Number(form.capacity_max),
          pricing_per_day: Number(form.pricing_per_day),
          pricing_per_hour: Number(form.pricing_per_hour),
        }),
      })
      if (!r.ok) throw new Error('Failed to save')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{venue ? 'Edit Venue' : 'Add Venue'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Venue Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select value={form.venue_type} onChange={e => set('venue_type', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select type</option>
                {VENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">City</label>
              <select value={form.city} onChange={e => set('city', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select city</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Address</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Capacity</label>
              <input type="number" value={form.capacity_min} onChange={e => set('capacity_min', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Capacity</label>
              <input type="number" value={form.capacity_max} onChange={e => set('capacity_max', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price / Day (INR)</label>
              <input type="number" value={form.pricing_per_day} onChange={e => set('pricing_per_day', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price / Hour (INR)</label>
              <input type="number" value={form.pricing_per_hour} onChange={e => set('pricing_per_hour', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contact Name</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contact Phone</label>
              <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Website</label>
              <input value={form.website} onChange={e => set('website', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="https://" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-2 block">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {AMENITIES_LIST.map(a => (
                  <button key={a.id} type="button" onClick={() => toggleAmenity(a.id)}
                    className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                      form.amenities.includes(a.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50')}>
                    <a.icon className="w-3 h-3" />{a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {venue ? 'Save Changes' : 'Add Venue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VenueDetail({ venue, token, onClose, onUpdate }: {
  venue: Venue; token: string; onClose: () => void; onUpdate: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'events'>('overview')
  const [editing, setEditing] = useState(false)

  const deleteVenue = async () => {
    if (!confirm('Delete this venue?')) return
    await fetch(`${API}/venues/${venue.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onClose(); onUpdate()
  }

  const amenityIcons: Record<string, any> = {
    wifi: Wifi, parking: Car, catering: Utensils, av: Tv, ac: Wind, gym: Dumbbell, cafe: Coffee
  }

  return (
    <>
      {editing && <VenueModal token={token} venue={venue} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onUpdate() }} />}
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{venue.name}</h3>
              <p className="text-xs text-muted-foreground">{venue.venue_type} · {venue.city}</p>
              {venue.rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn('w-3 h-3', i < Math.round(venue.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-border')} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">{venue.rating}</span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={deleteVenue} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="flex border-b border-border px-4">
          {(['overview', 'events'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('py-2.5 px-3 text-xs font-medium capitalize border-b-2 transition-colors',
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'overview' && (
            <>
              {/* Capacity & Pricing */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Capacity</p>
                  <p className="text-sm font-bold">{venue.capacity_min ? `${venue.capacity_min}–` : ''}{venue.capacity_max}</p>
                  <p className="text-xs text-muted-foreground">guests</p>
                </div>
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Pricing</p>
                  {venue.pricing_per_day ? <p className="text-sm font-bold text-primary">{formatINR(venue.pricing_per_day)}<span className="text-xs font-normal text-muted-foreground">/day</span></p> : null}
                  {venue.pricing_per_hour ? <p className="text-xs text-muted-foreground">{formatINR(venue.pricing_per_hour)}/hr</p> : null}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{venue.location}{venue.city ? `, ${venue.city}` : ''}</span>
                </div>
              </div>

              {/* Contact */}
              {(venue.contact_name || venue.contact_phone || venue.contact_email) && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</p>
                  {venue.contact_name && <p className="text-sm">{venue.contact_name}</p>}
                  {venue.contact_phone && <a href={`tel:${venue.contact_phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Phone className="w-3.5 h-3.5" />{venue.contact_phone}</a>}
                  {venue.contact_email && <a href={`mailto:${venue.contact_email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" />{venue.contact_email}</a>}
                  {venue.website && <a href={venue.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Globe className="w-3.5 h-3.5" />Website</a>}
                </div>
              )}

              {/* Amenities */}
              {venue.amenities && venue.amenities.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {venue.amenities.map(a => {
                      const am = AMENITIES_LIST.find(x => x.id === a)
                      if (!am) return null
                      return (
                        <span key={a} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          <am.icon className="w-3 h-3" />{am.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              {venue.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-sm text-muted-foreground">{venue.description}</p>
                </div>
              )}
            </>
          )}
          {tab === 'events' && (
            <div className="text-center py-10">
              <Calendar className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Events at this venue will appear here</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function VenueCard({ venue, onClick }: { venue: Venue; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{venue.name}</p>
          <p className="text-xs text-muted-foreground truncate">{venue.venue_type} · {venue.city}</p>
        </div>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded shrink-0', venue.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
          {venue.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{venue.capacity_max}</span>
        {venue.location && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{venue.city}</span>}
      </div>
      {venue.pricing_per_day && (
        <p className="text-xs font-semibold text-primary">{formatINR(venue.pricing_per_day)}<span className="font-normal text-muted-foreground">/day</span></p>
      )}
      {venue.amenities && venue.amenities.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {venue.amenities.slice(0, 4).map(a => {
            const am = AMENITIES_LIST.find(x => x.id === a)
            if (!am) return null
            return <span key={a} className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">{am.label}</span>
          })}
          {venue.amenities.length > 4 && <span className="text-[10px] text-muted-foreground">+{venue.amenities.length - 4}</span>}
        </div>
      )}
    </div>
  )
}

export default function VenuesPage() {
  const { token } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: venuesData, loading, refetch } = useApi<{ data: Venue[] }>('/venues', token ?? '')
  const venues: Venue[] = venuesData?.data ?? []

  const filtered = venues.filter(v => {
    const q = search.toLowerCase()
    return (!q || v.name.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q))
      && (typeFilter === 'all' || v.venue_type === typeFilter)
      && (cityFilter === 'all' || v.city === cityFilter)
  })

  const uniqueCities = [...new Set(venues.map(v => v.city).filter(Boolean))]
  const uniqueTypes = [...new Set(venues.map(v => v.venue_type).filter(Boolean))]

  useEffect(() => {
    if (selectedVenue) {
      const updated = venues.find(v => v.id === selectedVenue.id)
      if (updated) setSelectedVenue(updated)
    }
  }, [venues])

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
          <div>
            <h1 className="font-semibold text-sm">Venues</h1>
            <p className="text-[10px] text-muted-foreground">{venues.length} venues in directory</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search venues..." />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
              <option value="all">All Types</option>
              {uniqueTypes.map(t => <option key={t} value={t!}>{t}</option>)}
            </select>
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
              <option value="all">All Cities</option>
              {uniqueCities.map(c => <option key={c} value={c!}>{c}</option>)}
            </select>
            <button onClick={() => setShowCreate(true)}
              className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Venue
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-border border-b border-border shrink-0">
          {[
            { label: 'Total Venues', value: venues.length, icon: Building2 },
            { label: 'Active', value: venues.filter(v => v.is_active).length, icon: CheckSquare },
            { label: 'Cities', value: uniqueCities.length, icon: MapPin },
            { label: 'Avg Capacity', value: venues.length > 0 ? Math.round(venues.reduce((s, v) => s + v.capacity_max, 0) / venues.length) : 0, icon: Users },
          ].map(stat => (
            <div key={stat.label} className="bg-card px-4 py-3 flex items-center gap-3">
              <stat.icon className="w-4 h-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-sm font-bold">{stat.value}</p></div>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-4">
              {filtered.map(venue => (
                <VenueCard key={venue.id} venue={venue} onClick={() => setSelectedVenue(venue)} />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No venues found</p>
                <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-primary hover:underline">Add your first venue</button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedVenue && (
        <div className="w-80 border-l border-border shrink-0 flex flex-col">
          <VenueDetail venue={selectedVenue} token={token ?? ''} onClose={() => setSelectedVenue(null)} onUpdate={refetch} />
        </div>
      )}
      {showCreate && <VenueModal token={token ?? ''} onClose={() => setShowCreate(false)} onSaved={refetch} />}
    </div>
  )
}
