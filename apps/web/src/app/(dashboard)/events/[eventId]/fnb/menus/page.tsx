'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, UtensilsCrossed,
  Leaf, AlertTriangle, X, Check, GripVertical, Users, Clock,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const MEAL_TYPES = ['breakfast','lunch','dinner','hi-tea','cocktails','brunch','welcome-drinks','midnight-snacks','custom']
const SERVICE_STYLES = ['buffet','plated','food-stations','cocktail','family-style','live-stations']
const MENU_STATUSES = ['draft','submitted_to_vendor','vendor_confirmed','finalised']
const ITEM_CATEGORIES = ['starter','main','dessert','beverage','bread','salad','live-station','snack','soup','side']
const CUISINES = ['Indian','Continental','Chinese','Italian','Mexican','Mediterranean','Japanese','Thai','Lebanese','Custom']

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400',
  submitted_to_vendor: 'bg-blue-500/10 text-blue-400',
  vendor_confirmed: 'bg-amber-500/10 text-amber-400',
  finalised: 'bg-emerald-500/10 text-emerald-400',
}

const CATEGORY_COLORS: Record<string, string> = {
  starter: 'bg-blue-500/10 text-blue-400',
  main: 'bg-orange-500/10 text-orange-400',
  dessert: 'bg-pink-500/10 text-pink-400',
  beverage: 'bg-purple-500/10 text-purple-400',
  bread: 'bg-amber-500/10 text-amber-400',
  salad: 'bg-green-500/10 text-green-400',
  'live-station': 'bg-cyan-500/10 text-cyan-400',
  snack: 'bg-yellow-500/10 text-yellow-400',
  soup: 'bg-rose-500/10 text-rose-400',
  side: 'bg-indigo-500/10 text-indigo-400',
}

interface MenuFormProps {
  initial?: any
  eventId: string
  onSave: (data: any) => void
  onClose: () => void
  loading: boolean
}

function MenuForm({ initial, eventId, onSave, onClose, loading }: MenuFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    meal_type: initial?.meal_type ?? 'dinner',
    service_style: initial?.service_style ?? 'buffet',
    session_name: initial?.session_name ?? '',
    start_time: initial?.start_time ?? '',
    end_time: initial?.end_time ?? '',
    pax_count: initial?.pax_count ?? '',
    status: initial?.status ?? 'draft',
    notes: initial?.notes ?? '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Menu' : 'New Menu Session'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Menu Name *</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. Day 1 Gala Dinner"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Meal Type</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.meal_type}
                onChange={e => setForm(p => ({ ...p, meal_type: e.target.value }))}
              >
                {MEAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Service Style</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.service_style}
                onChange={e => setForm(p => ({ ...p, service_style: e.target.value }))}
              >
                {SERVICE_STYLES.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pax Count</label>
              <input type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.pax_count} onChange={e => setForm(p => ({ ...p, pax_count: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {MENU_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Custom Label</label>
              <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="Override display name" value={form.session_name} onChange={e => setForm(p => ({ ...p, session_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={2} placeholder="Vendor notes, special instructions..." value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name || loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Saving...' : (initial ? 'Update' : 'Create Menu')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ItemFormProps {
  initial?: any
  menuId: string
  eventId: string
  onSave: (data: any) => void
  onClose: () => void
  loading: boolean
}

function ItemForm({ initial, onSave, onClose, loading }: ItemFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'main',
    cuisine_type: initial?.cuisine_type ?? '',
    is_veg: initial?.is_veg ?? false,
    is_vegan: initial?.is_vegan ?? false,
    is_gluten_free: initial?.is_gluten_free ?? false,
    is_halal: initial?.is_halal ?? false,
    is_jain: initial?.is_jain ?? false,
    allergens: (initial?.allergens ?? []).join(', '),
    unit: initial?.unit ?? 'per_person',
    quantity_per_pax: initial?.quantity_per_pax ?? '',
    total_quantity: initial?.total_quantity ?? '',
    unit_cost: initial?.unit_cost ?? '',
    notes: initial?.notes ?? '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Item' : 'Add Menu Item'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Item Name *</label>
              <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. Grilled Salmon" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cuisine</label>
              <input list="cuisine-list" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. Indian" value={form.cuisine_type} onChange={e => setForm(p => ({ ...p, cuisine_type: e.target.value }))} />
              <datalist id="cuisine-list">{CUISINES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>

          {/* Dietary flags */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Dietary Flags</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'is_veg', label: 'Veg', color: 'emerald' },
                { key: 'is_vegan', label: 'Vegan', color: 'green' },
                { key: 'is_gluten_free', label: 'GF', color: 'blue' },
                { key: 'is_halal', label: 'Halal', color: 'amber' },
                { key: 'is_jain', label: 'Jain', color: 'lime' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setForm(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                    form[key as keyof typeof form]
                      ? `bg-${color}-500/20 border-${color}-500/40 text-${color}-400`
                      : 'bg-background border-border text-muted-foreground'
                  )}
                >
                  {form[key as keyof typeof form] && '✓ '}{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Allergens (comma-separated)</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="nuts, dairy, shellfish, egg, soy, wheat"
              value={form.allergens} onChange={e => setForm(p => ({ ...p, allergens: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                {['per_person','per_piece','per_kg','per_litre','per_platter'].map(u => (
                  <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Qty/Pax</label>
              <input type="number" step="0.001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.quantity_per_pax} onChange={e => setForm(p => ({ ...p, quantity_per_pax: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Unit Cost (₹)</label>
              <input type="number" step="0.01" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description / Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => {
              const allergens = form.allergens.split(',').map(a => a.trim()).filter(Boolean)
              onSave({ ...form, allergens })
            }}
            disabled={!form.name || loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Saving...' : (initial ? 'Update' : 'Add Item')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DietaryIcons({ item }: { item: any }) {
  return (
    <span className="flex gap-1">
      {item.is_veg && <span className="w-4 h-4 rounded-sm bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">V</span>}
      {item.is_vegan && <span className="w-4 h-4 rounded-sm bg-green-500/20 text-green-400 text-[10px] flex items-center justify-center font-bold">Vn</span>}
      {item.is_gluten_free && <span className="w-4 h-4 rounded-sm bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-bold">GF</span>}
      {item.is_halal && <span className="w-4 h-4 rounded-sm bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">H</span>}
      {item.is_jain && <span className="w-4 h-4 rounded-sm bg-lime-500/20 text-lime-400 text-[10px] flex items-center justify-center font-bold">J</span>}
    </span>
  )
}

export default function FnbMenusPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [menus, setMenus] = useState<any[]>([])
  const [items, setItems] = useState<Record<string, any[]>>({})
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [menuModal, setMenuModal] = useState<{ open: boolean; editing?: any }>({ open: false })
  const [itemModal, setItemModal] = useState<{ open: boolean; menuId?: string; editing?: any }>({ open: false })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`,
    'x-tenant-id': tenantId ?? '',
    'Content-Type': 'application/json',
  }), [session, tenantId])

  const loadMenus = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const r = await fetch(`${API}/fnb/events/${eventId}/menus`, { headers: headers() })
    const data = await r.json()
    setMenus(data)
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { loadMenus() }, [loadMenus])

  const loadItems = async (menuId: string) => {
    const r = await fetch(`${API}/fnb/menus/${menuId}/items`, { headers: headers() })
    const data = await r.json()
    setItems(prev => ({ ...prev, [menuId]: data }))
  }

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev)
      if (next.has(menuId)) { next.delete(menuId) }
      else { next.add(menuId); loadItems(menuId) }
      return next
    })
  }

  const saveMenu = async (form: any) => {
    setSaving(true)
    try {
      const url = menuModal.editing
        ? `${API}/fnb/menus/${menuModal.editing.id}`
        : `${API}/fnb/events/${eventId}/menus`
      await fetch(url, {
        method: menuModal.editing ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      })
      await loadMenus()
      setMenuModal({ open: false })
    } finally { setSaving(false) }
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('Delete this menu and all its items?')) return
    await fetch(`${API}/fnb/menus/${id}`, { method: 'DELETE', headers: headers() })
    await loadMenus()
  }

  const saveItem = async (form: any) => {
    setSaving(true)
    try {
      const url = itemModal.editing
        ? `${API}/fnb/items/${itemModal.editing.id}`
        : `${API}/fnb/menus/${itemModal.menuId}/items`
      await fetch(url, {
        method: itemModal.editing ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify({ ...form, event_id: eventId }),
      })
      if (itemModal.menuId) await loadItems(itemModal.menuId)
      setItemModal({ open: false })
    } finally { setSaving(false) }
  }

  const deleteItem = async (itemId: string, menuId: string) => {
    if (!confirm('Remove this item?')) return
    await fetch(`${API}/fnb/items/${itemId}`, { method: 'DELETE', headers: headers() })
    await loadItems(menuId)
  }

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-orange-400" /> Menus & Items
        </h2>
        <button
          onClick={() => setMenuModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Add Menu Session
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <UtensilsCrossed className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No menus yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add your first menu session — breakfast, lunch, dinner, or custom</p>
          <button onClick={() => setMenuModal({ open: true })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Add Menu Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {menus.map(menu => {
            const expanded = expandedMenus.has(menu.id)
            const menuItems = items[menu.id] ?? []
            const byCategory = menuItems.reduce((acc: Record<string, any[]>, item) => {
              acc[item.category] = acc[item.category] ?? []
              acc[item.category].push(item)
              return acc
            }, {})

            return (
              <div key={menu.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Menu header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleMenu(menu.id)}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{menu.name}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[menu.status])}>
                        {menu.status?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs bg-accent/50 px-2 py-0.5 rounded-full capitalize">
                        {menu.meal_type?.replace(/-/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{menu.service_style}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {menu.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {menu.start_time}{menu.end_time && ` – ${menu.end_time}`}</span>}
                      {menu.pax_count && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {menu.pax_count} pax</span>}
                      {menu.total_food_cost > 0 && <span className="font-medium text-foreground">{formatCurrency(menu.total_food_cost)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setItemModal({ open: true, menuId: menu.id }) }}
                      className="px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-accent transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Item
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuModal({ open: true, editing: menu }) }}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMenu(menu.id) }}
                      className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Items */}
                {expanded && (
                  <div className="border-t border-border">
                    {menuItems.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No items in this menu yet</p>
                        <button
                          onClick={() => setItemModal({ open: true, menuId: menu.id })}
                          className="px-3 py-1.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 inline mr-1" /> Add first item
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 space-y-4">
                        {Object.entries(byCategory).map(([category, catItems]) => (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLORS[category] ?? 'bg-zinc-500/10 text-zinc-400')}>
                                {category.replace(/-/g, ' ')}
                              </span>
                              <span className="text-xs text-muted-foreground">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-1">
                              {catItems.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background hover:bg-accent/30 group transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium truncate">{item.name}</span>
                                      <DietaryIcons item={item} />
                                      {item.cuisine_type && <span className="text-xs text-muted-foreground">{item.cuisine_type}</span>}
                                    </div>
                                    {item.allergens?.length > 0 && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span className="text-xs text-amber-400">{item.allergens.join(', ')}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {item.unit_cost && <p className="text-xs font-medium tabular-nums">{formatCurrency(item.unit_cost)}/{item.unit?.replace(/_/g, ' ')}</p>}
                                    {item.total_cost > 0 && <p className="text-xs text-muted-foreground tabular-nums">Total: {formatCurrency(item.total_cost)}</p>}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setItemModal({ open: true, menuId: menu.id, editing: item })}
                                      className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => deleteItem(item.id, menu.id)}
                                      className="p-1 text-muted-foreground hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {/* Add item inline */}
                        <button
                          onClick={() => setItemModal({ open: true, menuId: menu.id })}
                          className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add item
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {menuModal.open && (
        <MenuForm
          initial={menuModal.editing}
          eventId={eventId}
          onSave={saveMenu}
          onClose={() => setMenuModal({ open: false })}
          loading={saving}
        />
      )}

      {itemModal.open && (
        <ItemForm
          initial={itemModal.editing}
          menuId={itemModal.menuId ?? ''}
          eventId={eventId}
          onSave={saveItem}
          onClose={() => setItemModal({ open: false })}
          loading={saving}
        />
      )}
    </div>
  )
}
