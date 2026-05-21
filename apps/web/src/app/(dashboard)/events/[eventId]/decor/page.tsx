'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Palette, Plus, Brain, AlertTriangle, AlertCircle, Loader2,
  ExternalLink, Trash2, Pencil, ChevronDown, Tag, DollarSign,
  Sparkles, Link2, Package, Flower2, Lightbulb,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ZoneType = 'entrance'|'mandap'|'stage'|'dining_area'|'lounge'|'photo_booth'|'bar'|'dessert_table'|'kids_zone'|'ceremony'|'reception'|'cocktail_area'|'other'
type ZoneStatus = 'planning'|'confirmed'|'in_progress'|'installed'|'dismantled'
type ItemCategory = 'floral'|'draping'|'lighting'|'furniture'|'props'|'centrepiece'|'backdrop'|'signage'|'candles'|'balloon'|'fabric'|'greenery'|'water_feature'|'stationary_props'|'other'
type ItemStatus = 'pending'|'ordered'|'confirmed'|'delivered'|'installed'|'returned'|'cancelled'
type ItemSource = 'vendor'|'rental'|'purchase'|'client_provided'|'in_house'

interface Zone {
  id: string
  zone_name: string
  zone_type: ZoneType
  description?: string
  color_palette?: string[]
  theme?: string
  budget?: number
  actual_cost?: number
  currency: string
  status: ZoneStatus
  sort_order: number
  items?: { id: string; status: string; unit_cost?: number; quantity: number }[]
}

interface DecorItem {
  id: string
  zone_id?: string
  item_name: string
  item_category: ItemCategory
  reference_images?: string[]
  quantity: number
  unit: string
  source: ItemSource
  vendor?: { id: string; name: string }
  unit_cost?: number
  total_cost?: number
  currency: string
  status: ItemStatus
  delivery_date?: string
  installation_time?: string
  notes?: string
  tags?: string[]
  zone?: { id: string; zone_name: string }
}

interface DecorStats {
  total_zones: number
  total_items: number
  confirmed_items: number
  pending_items: number
  total_budget: number
  total_item_cost: number
  upcoming_deliveries: number
  alerts: Array<{ severity: string; message: string }>
}

// ── Config ─────────────────────────────────────────────────────────────────────

const ZONE_TYPE_CONFIG: Record<ZoneType, { label: string; icon: string }> = {
  entrance:       { label: 'Entrance',        icon: '🚪' },
  mandap:         { label: 'Mandap',          icon: '🕌' },
  stage:          { label: 'Stage',           icon: '🎭' },
  dining_area:    { label: 'Dining Area',     icon: '🍽️' },
  lounge:         { label: 'Lounge',          icon: '🛋️' },
  photo_booth:    { label: 'Photo Booth',     icon: '📸' },
  bar:            { label: 'Bar',             icon: '🍸' },
  dessert_table:  { label: 'Dessert Table',   icon: '🎂' },
  kids_zone:      { label: 'Kids Zone',       icon: '🎠' },
  ceremony:       { label: 'Ceremony',        icon: '💒' },
  reception:      { label: 'Reception',       icon: '🥂' },
  cocktail_area:  { label: 'Cocktail Area',   icon: '🍾' },
  other:          { label: 'Other',           icon: '🏛️' },
}

const ZONE_STATUS_CONFIG: Record<ZoneStatus, { label: string; color: string }> = {
  planning:       { label: 'Planning',    color: 'text-gray-400 bg-gray-400/10' },
  confirmed:      { label: 'Confirmed',   color: 'text-blue-400 bg-blue-400/10' },
  in_progress:    { label: 'In Progress', color: 'text-amber-400 bg-amber-400/10' },
  installed:      { label: 'Installed',   color: 'text-emerald-400 bg-emerald-400/10' },
  dismantled:     { label: 'Dismantled',  color: 'text-gray-500 bg-gray-500/10' },
}

const ITEM_CATEGORY_CONFIG: Record<ItemCategory, { label: string; icon: string }> = {
  floral:          { label: 'Floral',           icon: '🌸' },
  draping:         { label: 'Draping',          icon: '🎀' },
  lighting:        { label: 'Lighting',         icon: '💡' },
  furniture:       { label: 'Furniture',        icon: '🪑' },
  props:           { label: 'Props',            icon: '🎪' },
  centrepiece:     { label: 'Centrepiece',      icon: '🌺' },
  backdrop:        { label: 'Backdrop',         icon: '🖼️' },
  signage:         { label: 'Signage',          icon: '🪧' },
  candles:         { label: 'Candles',          icon: '🕯️' },
  balloon:         { label: 'Balloons',         icon: '🎈' },
  fabric:          { label: 'Fabric',           icon: '🧶' },
  greenery:        { label: 'Greenery',         icon: '🌿' },
  water_feature:   { label: 'Water Feature',    icon: '💧' },
  stationary_props:{ label: 'Stationary Props', icon: '📦' },
  other:           { label: 'Other',            icon: '✨' },
}

const ITEM_STATUS_CONFIG: Record<ItemStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'text-gray-400 bg-gray-400/10' },
  ordered:    { label: 'Ordered',    color: 'text-blue-400 bg-blue-400/10' },
  confirmed:  { label: 'Confirmed',  color: 'text-violet-400 bg-violet-400/10' },
  delivered:  { label: 'Delivered',  color: 'text-amber-400 bg-amber-400/10' },
  installed:  { label: 'Installed',  color: 'text-emerald-400 bg-emerald-400/10' },
  returned:   { label: 'Returned',   color: 'text-gray-500 bg-gray-500/10' },
  cancelled:  { label: 'Cancelled',  color: 'text-red-400 bg-red-400/10' },
}

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

// ── Add Zone Modal ─────────────────────────────────────────────────────────────

function AddZoneModal({ onClose, onSave, eventId }: { onClose: () => void; onSave: (z: Record<string, unknown>) => void; eventId: string }) {
  const [form, setForm] = useState<Record<string, unknown>>({ event_id: eventId, zone_type: 'entrance', status: 'planning', currency: 'INR' })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Add Décor Zone</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Zone Name *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Grand Entrance Arch" value={(form.zone_name as string) ?? ''}
                onChange={e => set('zone_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Zone Type</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.zone_type as string} onChange={e => set('zone_type', e.target.value)}>
                {Object.entries(ZONE_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Theme</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Rustic Boho" value={(form.theme as string) ?? ''}
                onChange={e => set('theme', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Budget (INR)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="0" value={(form.budget as number) ?? ''}
                onChange={e => set('budget', parseFloat(e.target.value) || undefined)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.status as string} onChange={e => set('status', e.target.value)}>
                {Object.entries(ZONE_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              value={(form.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
          <button onClick={() => { if (form.zone_name) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Add Zone</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({ onClose, onSave, eventId, zones }: { onClose: () => void; onSave: (i: Record<string, unknown>) => void; eventId: string; zones: Zone[] }) {
  const [form, setForm] = useState<Record<string, unknown>>({
    event_id: eventId,
    item_category: 'floral',
    status: 'pending',
    source: 'vendor',
    quantity: 1,
    unit: 'piece',
    currency: 'INR',
    reference_images: [],
  })
  const [refLink, setRefLink] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const addRefLink = () => {
    if (!refLink) return
    set('reference_images', [...((form.reference_images as string[]) ?? []), refLink])
    setRefLink('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Add Décor Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* External link only note */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            Reference images are external links only (Google Drive, Pinterest, Dropbox etc.)
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Item Name *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. White Rose Centrepiece" value={(form.item_name as string) ?? ''}
                onChange={e => set('item_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.item_category as string} onChange={e => set('item_category', e.target.value)}>
                {Object.entries(ITEM_CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Zone</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={(form.zone_id as string) ?? ''} onChange={e => set('zone_id', e.target.value || undefined)}>
                <option value="">No zone</option>
                {zones.map(z => <option key={z.id} value={z.id}>{ZONE_TYPE_CONFIG[z.zone_type]?.icon} {z.zone_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Quantity</label>
              <input type="number" min={1} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={(form.quantity as number) ?? 1} onChange={e => set('quantity', parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Unit Cost (INR)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="0" value={(form.unit_cost as number) ?? ''}
                onChange={e => set('unit_cost', parseFloat(e.target.value) || undefined)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Source</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.source as string} onChange={e => set('source', e.target.value)}>
                {['vendor','rental','purchase','client_provided','in_house'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Delivery Date</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={(form.delivery_date as string) ?? ''} onChange={e => set('delivery_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.status as string} onChange={e => set('status', e.target.value)}>
                {Object.entries(ITEM_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Reference image links */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Reference Images (external links)</label>
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="https://drive.google.com/..." value={refLink} onChange={e => setRefLink(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRefLink()} />
              <button onClick={addRefLink} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Add</button>
            </div>
            {((form.reference_images as string[]) ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {(form.reference_images as string[]).map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <Link2 className="w-3 h-3 text-violet-400" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-violet-400">{url}</a>
                    <button onClick={() => set('reference_images', (form.reference_images as string[]).filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-300 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
          <button onClick={() => { if (form.item_name) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Add Item</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DecorPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [activeTab, setActiveTab] = useState<'items' | 'zones'>('items')
  const [zones, setZones] = useState<Zone[]>([])
  const [items, setItems] = useState<DecorItem[]>([])
  const [stats, setStats] = useState<DecorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddZone, setShowAddZone] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1] ?? '' : ''
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') ?? '' : ''
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const h = getHeaders()
      const itemQs = new URLSearchParams()
      if (categoryFilter !== 'all') itemQs.set('category', categoryFilter)
      if (zoneFilter !== 'all') itemQs.set('zone_id', zoneFilter)

      const [zRes, iRes, sRes] = await Promise.all([
        fetch(`${API}/decor/events/${eventId}/zones`, { headers: h }),
        fetch(`${API}/decor/events/${eventId}/items?${itemQs}`, { headers: h }),
        fetch(`${API}/decor/events/${eventId}/stats`, { headers: h }),
      ])
      if (zRes.ok) setZones(await zRes.json())
      if (iRes.ok) setItems(await iRes.json())
      if (sRes.ok) setStats(await sRes.json())
    } catch {}
    setLoading(false)
  }, [eventId, categoryFilter, zoneFilter, getHeaders, API])

  useEffect(() => { loadData() }, [loadData])

  const handleAddZone = async (body: Record<string, unknown>) => {
    try { const r = await fetch(`${API}/decor/zones`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }); if (r.ok) loadData() } catch {}
  }
  const handleAddItem = async (body: Record<string, unknown>) => {
    try { const r = await fetch(`${API}/decor/items`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }); if (r.ok) loadData() } catch {}
  }
  const handleDeleteZone = async (id: string) => {
    if (!confirm('Delete this zone? All items in it will be unassigned.')) return
    try { await fetch(`${API}/decor/zones/${id}`, { method: 'DELETE', headers: getHeaders() }); loadData() } catch {}
  }
  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return
    try { await fetch(`${API}/decor/items/${id}`, { method: 'DELETE', headers: getHeaders() }); loadData() } catch {}
  }
  const handleUpdateItemStatus = async (id: string, status: ItemStatus) => {
    try { const r = await fetch(`${API}/decor/items/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status }) }); if (r.ok) loadData() } catch {}
  }

  const smartAlerts = stats?.alerts ?? []
  const budgetOverrun = stats && stats.total_budget > 0 && stats.total_item_cost > stats.total_budget

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Palette className="w-6 h-6 text-violet-400" />
            Décor Management
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Zones, items, reference images, vendor sourcing</p>
        </div>
        <button
          onClick={() => activeTab === 'items' ? setShowAddItem(true) : setShowAddZone(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add {activeTab === 'items' ? 'Item' : 'Zone'}
        </button>
      </div>

      {/* Smart Alerts */}
      {smartAlerts.length > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Smart Décor Alerts</span>
          </div>
          <div className="space-y-2">
            {smartAlerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs ${a.severity === 'high' ? 'text-red-300' : 'text-amber-300'}`}>
                {a.severity === 'high' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />}
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Zones', value: stats.total_zones, color: 'text-white' },
            { label: 'Total Items', value: stats.total_items, color: 'text-white' },
            { label: 'Confirmed', value: stats.confirmed_items, color: 'text-emerald-400' },
            { label: 'Pending', value: stats.pending_items, color: 'text-amber-400' },
            { label: 'Budget', value: formatCurrency(stats.total_budget), color: 'text-white', small: true },
            { label: 'Items Cost', value: formatCurrency(stats.total_item_cost), color: budgetOverrun ? 'text-red-400' : 'text-emerald-400', small: true },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className={`${kpi.small ? 'text-base' : 'text-2xl'} font-bold ${kpi.color} truncate`}>{kpi.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['items', 'zones'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {tab === 'items' ? '✨ All Items' : '🏛️ Zones'}
          </button>
        ))}
      </div>

      {/* Filters (items tab) */}
      {activeTab === 'items' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs ${categoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>All</button>
            {Object.entries(ITEM_CATEGORY_CONFIG).map(([k, v]) => (
              <button key={k} onClick={() => setCategoryFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs ${categoryFilter === k ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <select className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
            value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
            <option value="all">All Zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.zone_name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>
      ) : activeTab === 'items' ? (
        items.length === 0 ? (
          <div className="text-center py-20">
            <Flower2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No décor items added yet</p>
            <button onClick={() => setShowAddItem(true)} className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm">Add First Item</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map(item => {
              const catConf = ITEM_CATEGORY_CONFIG[item.item_category]
              const statusConf = ITEM_STATUS_CONFIG[item.status]
              return (
                <div key={item.id} className="bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{catConf?.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{item.item_name}</div>
                        <div className="text-xs text-gray-500">{catConf?.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status dropdown */}
                      <div className="relative group">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${statusConf.color}`}>
                          {statusConf.label} <ChevronDown className="w-2.5 h-2.5" />
                        </span>
                        <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                          {Object.entries(ITEM_STATUS_CONFIG).map(([k, v]) => (
                            <button key={k} onClick={() => handleUpdateItemStatus(item.id, k as ItemStatus)}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl">
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center justify-between">
                      <span>Qty: {item.quantity} {item.unit}</span>
                      {item.unit_cost && <span className="font-medium text-gray-300">{formatCurrency(item.unit_cost * item.quantity, item.currency)}</span>}
                    </div>
                    {item.zone && <div className="flex items-center gap-1"><Tag className="w-3 h-3" /> {item.zone.zone_name}</div>}
                    {item.vendor && <div className="flex items-center gap-1"><Package className="w-3 h-3" /> {item.vendor.name}</div>}
                    {item.delivery_date && <div className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Delivery: {new Date(item.delivery_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>}
                  </div>

                  {/* Reference image links */}
                  {(item.reference_images ?? []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                      {item.reference_images!.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 truncate">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          Reference {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* ── Zones Tab ── */
        zones.length === 0 ? (
          <div className="text-center py-20">
            <Palette className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No zones defined yet</p>
            <button onClick={() => setShowAddZone(true)} className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm">Add First Zone</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {zones.map(zone => {
              const typeConf = ZONE_TYPE_CONFIG[zone.zone_type]
              const statusConf = ZONE_STATUS_CONFIG[zone.status]
              const zoneItemCount = zone.items?.length ?? 0
              const confirmedCount = zone.items?.filter(i => ['confirmed','delivered','installed'].includes(i.status)).length ?? 0
              const zoneCost = zone.items?.reduce((s, i) => s + ((i.unit_cost ?? 0) * i.quantity), 0) ?? 0
              return (
                <div key={zone.id} className="bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeConf?.icon}</span>
                      <div>
                        <div className="font-medium">{zone.zone_name}</div>
                        <div className="text-xs text-gray-500">{typeConf?.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusConf.color}`}>{statusConf.label}</span>
                      <button onClick={() => handleDeleteZone(zone.id)} className="p-1 text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {zone.theme && <div className="text-xs text-violet-400 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />{zone.theme}</div>}

                  {/* Color palette swatches */}
                  {(zone.color_palette ?? []).length > 0 && (
                    <div className="flex gap-1.5 mb-3">
                      {zone.color_palette!.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-gray-700 shadow" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>{zoneItemCount} items ({confirmedCount} confirmed)</div>
                    {zone.budget && <div className={`text-right font-medium ${zoneCost > zone.budget ? 'text-red-400' : 'text-gray-300'}`}>{formatCurrency(zoneCost, zone.currency)} / {formatCurrency(zone.budget, zone.currency)}</div>}
                  </div>

                  {/* Progress bar */}
                  {zoneItemCount > 0 && (
                    <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(confirmedCount / zoneItemCount) * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {showAddZone && <AddZoneModal eventId={eventId} onClose={() => setShowAddZone(false)} onSave={handleAddZone} />}
      {showAddItem && <AddItemModal eventId={eventId} zones={zones} onClose={() => setShowAddItem(false)} onSave={handleAddItem} />}
    </div>
  )
}
