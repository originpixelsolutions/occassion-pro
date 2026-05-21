'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import { Wine, Plus, Pencil, Trash2, X, Clock, Users, BanIcon } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const BAR_TYPES = ['soft-bar','full-bar','beer-wine','mocktails-only','custom']
const BAR_TYPE_COLORS: Record<string, string> = {
  'soft-bar': 'bg-blue-500/10 text-blue-400',
  'full-bar': 'bg-purple-500/10 text-purple-400',
  'beer-wine': 'bg-amber-500/10 text-amber-400',
  'mocktails-only': 'bg-emerald-500/10 text-emerald-400',
  custom: 'bg-zinc-500/10 text-zinc-400',
}
const BAR_ICONS: Record<string, string> = {
  'soft-bar': '🥤', 'full-bar': '🍸', 'beer-wine': '🍷',
  'mocktails-only': '🍹', custom: '🍾',
}

interface BevFormProps {
  initial?: any
  onSave: (d: any) => void
  onClose: () => void
  loading: boolean
}

function BevForm({ initial, onSave, onClose, loading }: BevFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'soft-bar',
    duration_hours: initial?.duration_hours ?? '',
    price_per_pax: initial?.price_per_pax ?? '',
    total_cost: initial?.total_cost ?? '',
    bartender_count: initial?.bartender_count ?? 0,
    bar_opens_at: initial?.bar_opens_at ?? '',
    bar_closes_at: initial?.bar_closes_at ?? '',
    is_dry_event: initial?.is_dry_event ?? false,
    is_included_in_package: initial?.is_included_in_package ?? true,
    notes: initial?.notes ?? '',
    items: initial?.items ?? [],
  })

  const [newItem, setNewItem] = useState('')

  const addItem = () => {
    if (!newItem.trim()) return
    setForm(p => ({ ...p, items: [...p.items, { name: newItem.trim(), quantity_per_pax: 1, unit: 'per_person' }] }))
    setNewItem('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Beverage Package' : 'New Beverage Package'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Package Name *</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. Welcome Cocktail Bar" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bar Type</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {BAR_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bartenders</label>
              <input type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.bartender_count} onChange={e => setForm(p => ({ ...p, bartender_count: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Duration (hrs)</label>
              <input type="number" step="0.5" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="3" value={form.duration_hours} onChange={e => setForm(p => ({ ...p, duration_hours: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bar Opens</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.bar_opens_at} onChange={e => setForm(p => ({ ...p, bar_opens_at: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bar Closes</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.bar_closes_at} onChange={e => setForm(p => ({ ...p, bar_closes_at: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price/Pax (₹)</label>
              <input type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.price_per_pax} onChange={e => setForm(p => ({ ...p, price_per_pax: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Total Cost (₹)</label>
              <input type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.total_cost} onChange={e => setForm(p => ({ ...p, total_cost: e.target.value }))} />
            </div>
          </div>

          {/* Beverages list */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Included Beverages</label>
            <div className="space-y-1.5 mb-2">
              {form.items.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
                  <span className="text-sm flex-1">{item.name}</span>
                  <button onClick={() => setForm(p => ({ ...p, items: p.items.filter((_: any, j: number) => j !== i) }))}
                    className="text-muted-foreground hover:text-rose-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. Whisky, Beer, Soft Drinks" value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()} />
              <button onClick={addItem} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_dry_event} onChange={e => setForm(p => ({ ...p, is_dry_event: e.target.checked }))}
                className="rounded" />
              <span className="text-sm">Dry Event (no alcohol)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_included_in_package} onChange={e => setForm(p => ({ ...p, is_included_in_package: e.target.checked }))}
                className="rounded" />
              <span className="text-sm">Included in package</span>
            </label>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name || loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Saving...' : (initial ? 'Update' : 'Create Package')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FnbBeveragesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`, 'x-tenant-id': tenantId ?? '', 'Content-Type': 'application/json',
  }), [session, tenantId])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const r = await fetch(`${API}/fnb/events/${eventId}/beverages`, { headers: headers() })
    setPackages(await r.json())
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async (form: any) => {
    setSaving(true)
    try {
      const url = modal.editing ? `${API}/fnb/beverages/${modal.editing.id}` : `${API}/fnb/events/${eventId}/beverages`
      await fetch(url, { method: modal.editing ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(form) })
      await load()
      setModal({ open: false })
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this beverage package?')) return
    await fetch(`${API}/fnb/beverages/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const totalCost = packages.reduce((s, p) => s + Number(p.total_cost ?? 0), 0)

  if (loading) return <div className="space-y-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold">Beverage Packages</h2>
          {totalCost > 0 && <span className="text-sm text-muted-foreground">· {formatCurrency(totalCost)} total</span>}
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Add Package
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Wine className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No beverage packages</p>
          <p className="text-sm text-muted-foreground mb-4">Add bar packages — soft bar, full bar, mocktails, or custom</p>
          <button onClick={() => setModal({ open: true })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Add Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{BAR_ICONS[pkg.type] ?? '🍾'}</span>
                  <div>
                    <p className="font-medium">{pkg.name}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', BAR_TYPE_COLORS[pkg.type])}>
                      {pkg.type?.replace(/-/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setModal({ open: true, editing: pkg })} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(pkg.id)} className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {pkg.is_dry_event && (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-400">
                  <BanIcon className="w-3.5 h-3.5" /> Dry Event — no alcohol
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                {pkg.bar_opens_at && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" /> {pkg.bar_opens_at} – {pkg.bar_closes_at ?? '…'}
                  </div>
                )}
                {pkg.duration_hours && <div className="text-muted-foreground">{pkg.duration_hours}hr service</div>}
                {pkg.bartender_count > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3 h-3" /> {pkg.bartender_count} bartender{pkg.bartender_count !== 1 ? 's' : ''}
                  </div>
                )}
                {pkg.price_per_pax && <div className="text-muted-foreground">{formatCurrency(pkg.price_per_pax)}/pax</div>}
              </div>

              {/* Included items */}
              {Array.isArray(pkg.items) && pkg.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pkg.items.map((item: any, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-accent/50 rounded-full">
                      {typeof item === 'string' ? item : item.name}
                    </span>
                  ))}
                </div>
              )}

              {pkg.total_cost > 0 && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total cost</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(pkg.total_cost)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <BevForm initial={modal.editing} onSave={save} onClose={() => setModal({ open: false })} loading={saving} />
      )}
    </div>
  )
}
