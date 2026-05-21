'use client'
import { useState, useCallback, useEffect } from 'react'
import { Package, AlertTriangle, Plus, Search, Box, TrendingDown, Edit2, Trash2, X, ChevronRight, BarChart3, Tag, MapPin, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

const CATEGORIES = ['Audio/Visual', 'Furniture', 'Decor', 'Catering', 'Lighting', 'Tents', 'Tableware', 'Fabric', 'Electrical', 'Other']
const CAT_COLORS: Record<string, string> = {
  'Audio/Visual': 'bg-blue-500/10 text-blue-400',
  'Furniture': 'bg-amber-500/10 text-amber-400',
  'Decor': 'bg-pink-500/10 text-pink-400',
  'Catering': 'bg-orange-500/10 text-orange-400',
  'Lighting': 'bg-yellow-500/10 text-yellow-400',
  'Tents': 'bg-green-500/10 text-green-400',
  'Tableware': 'bg-purple-500/10 text-purple-400',
  'Fabric': 'bg-rose-500/10 text-rose-400',
  'Electrical': 'bg-cyan-500/10 text-cyan-400',
  'Other': 'bg-muted/60 text-muted-foreground',
}

interface Item {
  id: string; name: string; sku: string; category: string
  quantity_available: number; quantity_total: number; reorder_level: number
  unit: string; unit_cost: number; location: string; is_active: boolean
  description?: string; warehouse?: string
}

function ItemModal({ item, token, onClose, onSaved }: { item?: Item | null; token: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: item?.name ?? '', sku: item?.sku ?? '', category: item?.category ?? 'Other',
    quantity_available: item?.quantity_available ?? 0, quantity_total: item?.quantity_total ?? 0,
    reorder_level: item?.reorder_level ?? 10, unit: item?.unit ?? 'pcs',
    unit_cost: item?.unit_cost ?? 0, location: item?.location ?? '', warehouse: item?.warehouse ?? '',
    description: item?.description ?? '', is_active: item?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const method = item ? 'PATCH' : 'POST'
    const url = item ? `${API}/inventory/${item.id}` : `${API}/inventory`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) })
    setSaving(false); onSaved(); onClose()
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  )
  const inp = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-sm">{item ? 'Edit Item' : 'Add Inventory Item'}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Item Name *"><input className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LED Spotlight" /></F>
            <F label="SKU"><input className={inp} value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. LED-001" /></F>
          </div>
          <F label="Category">
            <select className={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </F>
          <div className="grid grid-cols-3 gap-4">
            <F label="Total Qty"><input type="number" min={0} className={inp} value={form.quantity_total} onChange={e => setForm(p => ({ ...p, quantity_total: +e.target.value, quantity_available: Math.min(p.quantity_available, +e.target.value) }))} /></F>
            <F label="Available"><input type="number" min={0} className={inp} value={form.quantity_available} onChange={e => setForm(p => ({ ...p, quantity_available: +e.target.value }))} /></F>
            <F label="Reorder Level"><input type="number" min={0} className={inp} value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: +e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Unit"><input className={inp} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="pcs / sets / rolls" /></F>
            <F label="Unit Cost (₹)"><input type="number" min={0} className={inp} value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: +e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Location"><input className={inp} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Shelf A-3" /></F>
            <F label="Warehouse"><input className={inp} value={form.warehouse} onChange={e => setForm(p => ({ ...p, warehouse: e.target.value }))} placeholder="e.g. Main Warehouse" /></F>
          </div>
          <F label="Description"><textarea className={inp + ' resize-none'} rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></F>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={cn("w-9 h-5 rounded-full transition-colors relative", form.is_active ? 'bg-primary' : 'bg-muted')} onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}>
              <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", form.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-xs text-muted-foreground">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemDetail({ item, token, onClose, onUpdate }: { item: Item; token: string; onClose: () => void; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const stockPct = item.quantity_total > 0 ? Math.round((item.quantity_available / item.quantity_total) * 100) : 0
  const isLow = item.quantity_available <= item.reorder_level
  const totalValue = item.quantity_available * item.unit_cost

  async function remove() {
    if (!confirm(`Delete "${item.name}"?`)) return
    await fetch(`${API}/inventory/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onUpdate(); onClose()
  }

  if (editing) return <ItemModal item={item} token={token} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onUpdate() }} />

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={remove} className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLow && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400">Low stock — reorder soon</p>
          </div>
        )}
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", CAT_COLORS[item.category] ?? CAT_COLORS['Other'])}>
          <Tag className="w-3 h-3" />{item.category}
        </div>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}

        {/* Stock bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Stock Level</span>
            <span className={cn("font-medium", isLow ? 'text-amber-400' : 'text-emerald-400')}>{stockPct}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", isLow ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${stockPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.quantity_available} available</span>
            <span>{item.quantity_total} total</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'SKU', value: item.sku || '—', icon: Hash },
            { label: 'Unit', value: item.unit, icon: Box },
            { label: 'Unit Cost', value: `₹${item.unit_cost.toLocaleString()}`, icon: BarChart3 },
            { label: 'Total Value', value: `₹${totalValue.toLocaleString()}`, icon: TrendingDown },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
              <div className="flex items-center gap-1.5">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <p className="text-sm font-medium truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {(item.location || item.warehouse) && (
          <div className="flex items-start gap-2 p-3 bg-muted/20 rounded-lg">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              {item.warehouse && <p className="text-xs font-medium">{item.warehouse}</p>}
              {item.location && <p className="text-xs text-muted-foreground">{item.location}</p>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", item.is_active ? 'bg-emerald-400' : 'bg-muted-foreground')} />
          <span className="text-xs text-muted-foreground">{item.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
    </div>
  )
}

function ItemRow({ item, selected, onClick }: { item: Item; selected: boolean; onClick: () => void }) {
  const isLow = item.quantity_available <= item.reorder_level
  const stockPct = item.quantity_total > 0 ? Math.round((item.quantity_available / item.quantity_total) * 100) : 0

  return (
    <tr onClick={onClick} className={cn("border-b border-border cursor-pointer transition-colors hover:bg-accent/30", selected && "bg-primary/5")}>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.sku || 'No SKU'}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", CAT_COLORS[item.category] ?? CAT_COLORS['Other'])}>{item.category}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <div>
            <p className={cn("text-sm font-medium", isLow ? 'text-amber-400' : '')}>{item.quantity_available} {item.unit}</p>
            <div className="w-20 h-1.5 bg-border rounded-full mt-1">
              <div className={cn("h-full rounded-full", isLow ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${Math.min(stockPct, 100)}%` }} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.reorder_level} {item.unit}</td>
      <td className="px-4 py-3 text-sm">₹{(item.quantity_available * item.unit_cost).toLocaleString()}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.location || '—'}</td>
      <td className="px-4 py-3">
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground", selected && "text-primary")} />
      </td>
    </tr>
  )
}

export default function InventoryPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: res, loading, refetch } = useApi<{ data: Item[]; count: number }>('/inventory', token)
  const items = res?.data ?? []

  const filtered = items.filter(i => {
    const matchCat = catFilter === 'All' || i.category === catFilter
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLow = !showLowStock || i.quantity_available <= i.reorder_level
    return matchCat && matchSearch && matchLow
  })

  const totalItems = items.length
  const lowStockCount = items.filter(i => i.quantity_available <= i.reorder_level).length
  const totalValue = items.reduce((s, i) => s + i.quantity_available * i.unit_cost, 0)
  const categories = new Set(items.map(i => i.category)).size

  const fmt = (n: number) => n >= 1e7 ? `₹${(n/1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n/1e3).toFixed(0)}K` : `₹${n}`

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold">Inventory</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Warehouse & equipment management</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" />Add Item
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Items', value: totalItems, icon: Package, color: 'text-blue-400' },
              { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Total Value', value: fmt(totalValue), icon: BarChart3, color: 'text-emerald-400' },
              { label: 'Categories', value: categories, icon: Tag, color: 'text-violet-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCatFilter('All')} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", catFilter === 'All' ? 'bg-primary text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>All</button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap", catFilter === c ? 'bg-primary text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{c}</button>
              ))}
            </div>
            <button onClick={() => setShowLowStock(p => !p)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors", showLowStock ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-muted-foreground hover:text-foreground')}>
              <AlertTriangle className="w-3.5 h-3.5" />Low Stock
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Package className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm font-medium">No items found</p>
              <p className="text-xs text-muted-foreground mt-1">Add items to your inventory</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {['Item', 'Category', 'Stock', 'Reorder At', 'Value', 'Location', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <ItemRow key={item.id} item={item} selected={selected?.id === item.id} onClick={() => setSelected(p => p?.id === item.id ? null : item)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <ItemDetail item={selected} token={token} onClose={() => setSelected(null)} onUpdate={() => { refetch(); setSelected(null) }} />
      )}

      {showCreate && <ItemModal token={token} onClose={() => setShowCreate(false)} onSaved={refetch} />}
    </div>
  )
}
