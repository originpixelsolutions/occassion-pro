'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  Plus, Loader2, Pencil, Trash2, ChevronDown, ChevronUp,
  UtensilsCrossed, Check, X, Leaf, Beef,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MenuItem {
  id: string
  name: string
  description?: string
  category?: string
  dietary_type: 'veg' | 'non_veg' | 'vegan' | 'jain' | 'gluten_free' | 'dairy_free'
  allergens: string[]
  estimated_quantity?: number
  actual_quantity?: number
  unit: string
  cost_per_unit?: number
  sort_order: number
  notes?: string
}

interface Menu {
  id: string
  name: string
  description?: string
  meal_type: string
  is_active: boolean
  sort_order: number
  items?: { count: number }[]
}

const MEAL_TYPES = [
  'breakfast','brunch','lunch','hi_tea','dinner','cocktail','buffet',
  'food_stall','live_counter','dessert_counter','bar','mocktail_counter',
  'welcome_drink','midnight_snack','custom',
]

const DIETARY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  veg:         { icon: Leaf, color: 'text-green-400', label: 'Veg' },
  non_veg:     { icon: Beef, color: 'text-red-400',   label: 'Non-Veg' },
  vegan:       { icon: Leaf, color: 'text-emerald-400', label: 'Vegan' },
  jain:        { icon: Leaf, color: 'text-yellow-400', label: 'Jain' },
  gluten_free: { icon: Leaf, color: 'text-blue-400',  label: 'GF' },
  dairy_free:  { icon: Leaf, color: 'text-purple-400', label: 'DF' },
}

export function MenuBuilder({ eventId }: { eventId: string }) {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<Record<string, MenuItem[]>>({})
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [editMenu, setEditMenu] = useState<Menu | null>(null)
  const [menuForm, setMenuForm] = useState({ name: '', description: '', meal_type: 'custom', sort_order: 0 })
  const [showItemForm, setShowItemForm] = useState<string | null>(null) // menuId
  const [itemForm, setItemForm] = useState({
    name: '', description: '', category: '', dietary_type: 'veg',
    allergens: '', estimated_quantity: '', unit: 'serving', cost_per_unit: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadMenus = useCallback(async () => {
    setLoading(true)
    const data = await api.get<Menu[]>(`/fnb/events/${eventId}/menus`).catch(() => [])
    setMenus(data)
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadMenus() }, [loadMenus])

  const loadItems = async (menuId: string) => {
    if (menuItems[menuId]) return
    const data = await api.get<MenuItem[]>(`/fnb/menus/${menuId}/items`).catch(() => [])
    setMenuItems(prev => ({ ...prev, [menuId]: data }))
  }

  const toggleMenu = async (menuId: string) => {
    if (expandedMenu === menuId) { setExpandedMenu(null); return }
    setExpandedMenu(menuId)
    await loadItems(menuId)
  }

  const saveMenu = async () => {
    setSaving(true)
    try {
      if (editMenu) {
        await api.patch(`/fnb/menus/${editMenu.id}`, menuForm)
      } else {
        await api.post(`/fnb/events/${eventId}/menus`, menuForm)
      }
      setShowMenuForm(false); setEditMenu(null)
      setMenuForm({ name: '', description: '', meal_type: 'custom', sort_order: 0 })
      await loadMenus()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('Delete this menu and all its items?')) return
    await api.delete(`/fnb/menus/${id}`).catch(console.error)
    await loadMenus()
  }

  const saveItem = async (menuId: string) => {
    setSaving(true)
    try {
      await api.post(`/fnb/menus/${menuId}/items`, {
        ...itemForm,
        event_id: eventId,
        allergens: itemForm.allergens ? itemForm.allergens.split(',').map(s => s.trim()) : [],
        estimated_quantity: itemForm.estimated_quantity ? Number(itemForm.estimated_quantity) : null,
        cost_per_unit: itemForm.cost_per_unit ? Number(itemForm.cost_per_unit) : null,
      })
      setShowItemForm(null)
      setItemForm({ name: '', description: '', category: '', dietary_type: 'veg', allergens: '', estimated_quantity: '', unit: 'serving', cost_per_unit: '', notes: '' })
      const data = await api.get<MenuItem[]>(`/fnb/menus/${menuId}/items`).catch(() => [])
      setMenuItems(prev => ({ ...prev, [menuId]: data }))
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const deleteItem = async (menuId: string, itemId: string) => {
    await api.delete(`/fnb/items/${itemId}`).catch(console.error)
    setMenuItems(prev => ({ ...prev, [menuId]: (prev[menuId] ?? []).filter(i => i.id !== itemId) }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {menus.length} menu{menus.length !== 1 ? 's' : ''}
        </h2>
        <button
          onClick={() => { setShowMenuForm(true); setEditMenu(null); setMenuForm({ name: '', description: '', meal_type: 'custom', sort_order: 0 }) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Add Menu
        </button>
      </div>

      {/* Menu form */}
      {showMenuForm && (
        <div className="bg-background border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editMenu ? 'Edit Menu' : 'New Menu'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
              placeholder="Menu name *"
              value={menuForm.name}
              onChange={e => setMenuForm(p => ({ ...p, name: e.target.value }))}
            />
            <select
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
              value={menuForm.meal_type}
              onChange={e => setMenuForm(p => ({ ...p, meal_type: e.target.value }))}
            >
              {MEAL_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={menuForm.description}
            onChange={e => setMenuForm(p => ({ ...p, description: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowMenuForm(false); setEditMenu(null) }} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              onClick={saveMenu}
              disabled={!menuForm.name || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {editMenu ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Menus list */}
      {menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <UtensilsCrossed className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No menus yet. Create your first menu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {menus.map(menu => (
            <div key={menu.id} className="bg-background border border-border rounded-xl overflow-hidden">
              {/* Menu header */}
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggleMenu(menu.id)} className="flex-1 flex items-center gap-3 text-left">
                  {expandedMenu === menu.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{menu.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {menu.meal_type.replace(/_/g, ' ')}
                      {menu.items?.[0]?.count != null && ` · ${menu.items[0].count} items`}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditMenu(menu); setMenuForm({ name: menu.name, description: menu.description ?? '', meal_type: menu.meal_type, sort_order: menu.sort_order }); setShowMenuForm(true) }}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteMenu(menu.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Items */}
              {expandedMenu === menu.id && (
                <div className="border-t border-border">
                  <div className="p-3 space-y-2">
                    {(menuItems[menu.id] ?? []).map(item => {
                      const d = DIETARY_ICONS[item.dietary_type] ?? DIETARY_ICONS.veg
                      const DIcon = d.icon
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card">
                          <DIcon className={cn('w-3.5 h-3.5 shrink-0', d.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.category && `${item.category} · `}
                              {item.estimated_quantity && `Est. ${item.estimated_quantity} ${item.unit}`}
                              {item.cost_per_unit && ` · ₹${item.cost_per_unit}`}
                            </p>
                          </div>
                          <button onClick={() => deleteItem(menu.id, item.id)} className="p-1 rounded hover:bg-accent transition-colors shrink-0">
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      )
                    })}

                    {/* Add item form */}
                    {showItemForm === menu.id ? (
                      <div className="bg-card border border-border rounded-xl p-3 space-y-2 mt-2">
                        <p className="text-xs font-semibold">Add Item</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm col-span-2" placeholder="Item name *" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} />
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" placeholder="Category" value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} />
                          <select className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" value={itemForm.dietary_type} onChange={e => setItemForm(p => ({ ...p, dietary_type: e.target.value }))}>
                            {Object.entries(DIETARY_ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" placeholder="Est. quantity" type="number" value={itemForm.estimated_quantity} onChange={e => setItemForm(p => ({ ...p, estimated_quantity: e.target.value }))} />
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" placeholder="Unit (serving, kg…)" value={itemForm.unit} onChange={e => setItemForm(p => ({ ...p, unit: e.target.value }))} />
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" placeholder="Cost per unit (₹)" type="number" value={itemForm.cost_per_unit} onChange={e => setItemForm(p => ({ ...p, cost_per_unit: e.target.value }))} />
                          <input className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm" placeholder="Allergens (comma-separated)" value={itemForm.allergens} onChange={e => setItemForm(p => ({ ...p, allergens: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowItemForm(null)} className="px-2.5 py-1 border border-border rounded-lg text-xs hover:bg-accent transition-colors">Cancel</button>
                          <button onClick={() => saveItem(menu.id)} disabled={!itemForm.name || saving} className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowItemForm(menu.id)}
                        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary/50 hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add item
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
