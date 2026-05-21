'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Plus, Search, X, Star, Loader2, Edit2, Trash2,
  Phone, Mail, Globe, MapPin, Tag, CheckCircle2,
  Camera, Music2, Utensils, Flower2, Car, Mic2,
  Video, Palette, Package, Users, Truck, Sparkles
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

type Vendor = {
  id: string
  name: string
  category: string
  subcategory?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  website?: string
  city?: string
  rating?: number
  review_count?: number
  base_price?: number
  price_unit?: string
  is_active: boolean
  is_verified: boolean
  tags?: string[]
  description?: string
  portfolio_url?: string
  created_at: string
}

const VENDOR_CATEGORIES = [
  { id: 'photography', label: 'Photography', icon: Camera, color: 'text-violet-400 bg-violet-500/10' },
  { id: 'videography', label: 'Videography', icon: Video, color: 'text-blue-400 bg-blue-500/10' },
  { id: 'catering', label: 'Catering', icon: Utensils, color: 'text-amber-400 bg-amber-500/10' },
  { id: 'music', label: 'Music & DJ', icon: Music2, color: 'text-pink-400 bg-pink-500/10' },
  { id: 'decor', label: 'Decor & Florals', icon: Flower2, color: 'text-rose-400 bg-rose-500/10' },
  { id: 'transport', label: 'Transport', icon: Car, color: 'text-cyan-400 bg-cyan-500/10' },
  { id: 'emcee', label: 'Emcee / Host', icon: Mic2, color: 'text-orange-400 bg-orange-500/10' },
  { id: 'makeup', label: 'Hair & Makeup', icon: Palette, color: 'text-fuchsia-400 bg-fuchsia-500/10' },
  { id: 'equipment', label: 'Equipment', icon: Package, color: 'text-slate-400 bg-slate-500/10' },
  { id: 'entertainment', label: 'Entertainment', icon: Sparkles, color: 'text-yellow-400 bg-yellow-500/10' },
  { id: 'staffing', label: 'Staffing', icon: Users, color: 'text-emerald-400 bg-emerald-500/10' },
  { id: 'logistics', label: 'Logistics', icon: Truck, color: 'text-teal-400 bg-teal-500/10' },
]

const PRICE_UNITS = ['per event', 'per day', 'per hour', 'per person', 'per plate', 'per km', 'fixed']

function VendorModal({ token, vendor, onClose, onSaved }: {
  token: string; vendor?: Vendor | null; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: vendor?.name ?? '',
    category: vendor?.category ?? '',
    subcategory: vendor?.subcategory ?? '',
    contact_name: vendor?.contact_name ?? '',
    contact_phone: vendor?.contact_phone ?? '',
    contact_email: vendor?.contact_email ?? '',
    website: vendor?.website ?? '',
    city: vendor?.city ?? '',
    base_price: vendor?.base_price ?? 0,
    price_unit: vendor?.price_unit ?? 'per event',
    description: vendor?.description ?? '',
    portfolio_url: vendor?.portfolio_url ?? '',
    is_active: vendor?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.category) { setError('Category is required'); return }
    setSaving(true)
    try {
      const url = vendor ? `${API}/vendors/${vendor.id}` : `${API}/vendors`
      const r = await fetch(url, {
        method: vendor ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, base_price: Number(form.base_price) }),
      })
      if (!r.ok) throw new Error('Failed to save')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{vendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Vendor / Business Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select category</option>
                {VENDOR_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Base Price (INR)</label>
              <input type="number" value={form.base_price} onChange={e => set('base_price', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price Unit</label>
              <select value={form.price_unit} onChange={e => set('price_unit', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
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
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Website</label>
              <input value={form.website} onChange={e => set('website', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="https://" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Portfolio URL</label>
              <input value={form.portfolio_url} onChange={e => set('portfolio_url', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="https://instagram.com/..." />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {vendor ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VendorDetail({ vendor, token, onClose, onUpdate }: {
  vendor: Vendor; token: string; onClose: () => void; onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const cat = VENDOR_CATEGORIES.find(c => c.id === vendor.category)

  const deleteVendor = async () => {
    if (!confirm('Delete this vendor?')) return
    await fetch(`${API}/vendors/${vendor.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onClose(); onUpdate()
  }

  return (
    <>
      {editing && <VendorModal token={token} vendor={vendor} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onUpdate() }} />}
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', cat?.color)}>
              {cat && <cat.icon className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
                {vendor.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground">{cat?.label}</p>
              {vendor.rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn('w-3 h-3', i < Math.round(vendor.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-border')} />
                  ))}
                  <span className="text-xs text-muted-foreground">{vendor.rating} ({vendor.review_count ?? 0})</span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={deleteVendor} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pricing */}
          {vendor.base_price && (
            <div className="bg-background border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Starting Price</p>
              <p className="text-xl font-bold text-primary">{formatINR(vendor.base_price)}</p>
              <p className="text-xs text-muted-foreground">{vendor.price_unit}</p>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</p>
            {vendor.contact_name && <p className="text-sm font-medium">{vendor.contact_name}</p>}
            {vendor.city && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{vendor.city}</div>}
            {vendor.contact_phone && <a href={`tel:${vendor.contact_phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Phone className="w-3.5 h-3.5" />{vendor.contact_phone}</a>}
            {vendor.contact_email && <a href={`mailto:${vendor.contact_email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" />{vendor.contact_email}</a>}
            {vendor.website && <a href={vendor.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Globe className="w-3.5 h-3.5" />Website</a>}
          </div>

          {/* Description */}
          {vendor.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">About</p>
              <p className="text-sm text-muted-foreground">{vendor.description}</p>
            </div>
          )}

          {/* Tags */}
          {vendor.tags && vendor.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {vendor.tags.map(t => (
                <span key={t} className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}

          {/* Status badges */}
          <div className="flex gap-2">
            <span className={cn('text-xs px-2 py-1 rounded', vendor.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
              {vendor.is_active ? 'Active' : 'Inactive'}
            </span>
            {vendor.is_verified && <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Verified</span>}
          </div>
        </div>
      </div>
    </>
  )
}

function VendorCard({ vendor, onClick }: { vendor: Vendor; onClick: () => void }) {
  const cat = VENDOR_CATEGORIES.find(c => c.id === vendor.category)
  return (
    <div onClick={onClick} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cat?.color)}>
            {cat && <cat.icon className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-semibold text-sm truncate">{vendor.name}</p>
              {vendor.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground">{cat?.label}</p>
          </div>
        </div>
      </div>
      {vendor.city && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{vendor.city}</div>}
      {vendor.rating && (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn('w-3 h-3', i < Math.round(vendor.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-border')} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{vendor.rating}</span>
        </div>
      )}
      {vendor.base_price && (
        <p className="text-xs font-semibold text-primary">{formatINR(vendor.base_price)}<span className="font-normal text-muted-foreground"> {vendor.price_unit}</span></p>
      )}
    </div>
  )
}

export default function VendorsPage() {
  const { token } = useAuth()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: vendorsData, loading, refetch } = useApi<{ data: Vendor[] }>('/vendors', token ?? '')
  const vendors: Vendor[] = vendorsData?.data ?? []

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    return (!q || v.name.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q))
      && (categoryFilter === 'all' || v.category === categoryFilter)
      && (cityFilter === 'all' || v.city === cityFilter)
      && (!verifiedOnly || v.is_verified)
  })

  const uniqueCities = [...new Set(vendors.map(v => v.city).filter(Boolean))]
  const catCounts: Record<string, number> = {}
  vendors.forEach(v => { catCounts[v.category] = (catCounts[v.category] ?? 0) + 1 })

  useEffect(() => {
    if (selectedVendor) {
      const updated = vendors.find(v => v.id === selectedVendor.id)
      if (updated) setSelectedVendor(updated)
    }
  }, [vendors])

  return (
    <div className="flex h-full">
      {/* Left: category filter sidebar */}
      <div className="w-48 shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button onClick={() => setCategoryFilter('all')}
            className={cn('w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
              categoryFilter === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <span>All Vendors</span>
            <span className="text-[10px] bg-accent px-1 rounded">{vendors.length}</span>
          </button>
          {VENDOR_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
              className={cn('w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                categoryFilter === cat.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              <div className="flex items-center gap-2">
                <cat.icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </div>
              {catCounts[cat.id] && <span className="text-[10px] bg-accent px-1 rounded">{catCounts[cat.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
          <div>
            <h1 className="font-semibold text-sm">Vendors</h1>
            <p className="text-[10px] text-muted-foreground">{filtered.length} of {vendors.length} vendors</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search vendors..." />
            </div>
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
              <option value="all">All Cities</option>
              {uniqueCities.map(c => <option key={c} value={c!}>{c}</option>)}
            </select>
            <button onClick={() => setVerifiedOnly(v => !v)}
              className={cn('h-8 px-3 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5',
                verifiedOnly ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'border-border text-muted-foreground hover:bg-accent')}>
              <CheckCircle2 className="w-3 h-3" /> Verified
            </button>
            <button onClick={() => setShowCreate(true)}
              className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Vendor
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} onClick={() => setSelectedVendor(vendor)} />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No vendors found</p>
                <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-primary hover:underline">Add your first vendor</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedVendor && (
        <div className="w-80 border-l border-border shrink-0 flex flex-col">
          <VendorDetail vendor={selectedVendor} token={token ?? ''} onClose={() => setSelectedVendor(null)} onUpdate={refetch} />
        </div>
      )}

      {showCreate && <VendorModal token={token ?? ''} onClose={() => setShowCreate(false)} onSaved={refetch} />}
    </div>
  )
}
