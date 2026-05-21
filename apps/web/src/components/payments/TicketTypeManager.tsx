'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, GripVertical, CheckCircle, XCircle,
  Ticket, Crown, Zap, Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const CATEGORIES = [
  { value: 'general',       label: 'General',        icon: Ticket },
  { value: 'vip',           label: 'VIP',             icon: Crown },
  { value: 'early_bird',    label: 'Early Bird',      icon: Zap },
  { value: 'group',         label: 'Group',           icon: Users },
  { value: 'press',         label: 'Press',           icon: Ticket },
  { value: 'speaker',       label: 'Speaker',         icon: Ticket },
  { value: 'sponsor',       label: 'Sponsor',         icon: Ticket },
  { value: 'staff',         label: 'Staff',           icon: Ticket },
  { value: 'complimentary', label: 'Complimentary',   icon: Ticket },
]

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-500/10 text-slate-400',
  vip: 'bg-amber-500/10 text-amber-400',
  early_bird: 'bg-emerald-500/10 text-emerald-400',
  group: 'bg-blue-500/10 text-blue-400',
  press: 'bg-purple-500/10 text-purple-400',
  speaker: 'bg-indigo-500/10 text-indigo-400',
  sponsor: 'bg-orange-500/10 text-orange-400',
  staff: 'bg-cyan-500/10 text-cyan-400',
  complimentary: 'bg-rose-500/10 text-rose-400',
}

const EMPTY_FORM = {
  name: '', description: '', category: 'general', price: '',
  currency: 'INR', total_quantity: '', min_per_order: '1', max_per_order: '10',
  sale_starts_at: '', sale_ends_at: '', is_active: true, is_visible: true,
}

export default function TicketTypeManager({ eventId }: { eventId: string }) {
  const { session } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const load = useCallback(async () => {
    if (!session?.access_token) return
    const res = await fetch(`${API}/api/v1/events/${eventId}/payments/ticket-types`, { headers: headers() })
    const data = await res.json()
    setTickets(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [eventId, session, headers])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true) }
  const openEdit = (t: any) => {
    setForm({
      name: t.name, description: t.description ?? '', category: t.category,
      price: String(t.price), currency: t.currency, total_quantity: t.total_quantity ?? '',
      min_per_order: String(t.min_per_order), max_per_order: String(t.max_per_order),
      sale_starts_at: t.sale_starts_at ? t.sale_starts_at.slice(0, 16) : '',
      sale_ends_at:   t.sale_ends_at   ? t.sale_ends_at.slice(0, 16)   : '',
      is_active: t.is_active, is_visible: t.is_visible,
    })
    setEditId(t.id); setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      ...form,
      price: Number(form.price),
      total_quantity: form.total_quantity ? Number(form.total_quantity) : null,
      min_per_order: Number(form.min_per_order),
      max_per_order: Number(form.max_per_order),
      sale_starts_at: form.sale_starts_at || null,
      sale_ends_at:   form.sale_ends_at   || null,
    }
    const url = editId
      ? `${API}/api/v1/events/${eventId}/payments/ticket-types/${editId}`
      : `${API}/api/v1/events/${eventId}/payments/ticket-types`
    await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(payload) })
    await load()
    setShowForm(false); setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this ticket type?')) return
    await fetch(`${API}/api/v1/events/${eventId}/payments/ticket-types/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const arr = [...tickets]
    const fromIdx = arr.findIndex(t => t.id === dragging)
    const toIdx   = arr.findIndex(t => t.id === targetId)
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    setTickets(arr)
    setDragging(null); setDragOver(null)
    await fetch(`${API}/api/v1/events/${eventId}/payments/ticket-types/reorder`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ordered_ids: arr.map(t => t.id) }),
    })
  }

  const F = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  if (loading) return <div className="text-muted-foreground text-sm text-center py-12">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ticket Types</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder · click to edit</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Ticket Type
        </button>
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {tickets.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No ticket types yet. Add your first ticket type to start selling.
          </div>
        )}
        {tickets.map(t => {
          const sold = t.sold_quantity ?? 0
          const total = t.total_quantity
          const pct = total ? (sold / total) * 100 : 0
          const catColor = CATEGORY_COLORS[t.category] ?? 'bg-slate-500/10 text-slate-400'
          return (
            <div
              key={t.id}
              draggable
              onDragStart={() => setDragging(t.id)}
              onDragOver={e => { e.preventDefault(); setDragOver(t.id) }}
              onDrop={() => handleDrop(t.id)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              className={`bg-card border rounded-xl p-4 transition-all ${
                dragOver === t.id ? 'border-primary ring-1 ring-primary' : 'border-border'
              } ${!t.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-1 cursor-grab flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{t.category}</span>
                    {!t.is_active && <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Inactive</span>}
                    {!t.is_visible && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">Hidden</span>}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground text-sm">
                      {Number(t.price) === 0 ? 'Free' : `₹${Number(t.price).toLocaleString('en-IN')}`}
                    </span>
                    {total !== null ? (
                      <span>{sold} / {total} sold</span>
                    ) : (
                      <span>{sold} sold · Unlimited</span>
                    )}
                    <span>Min {t.min_per_order} – Max {t.max_per_order} per order</span>
                  </div>
                  {total !== null && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden w-48">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{editId ? 'Edit' : 'Add'} Ticket Type</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. General Admission" />
              </div>
              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => F('description', e.target.value)}
                  rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              {/* Category + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                  <select value={form.category} onChange={e => F('category', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Price (₹)</label>
                  <input type="number" min="0" step="1" value={form.price} onChange={e => F('price', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                </div>
              </div>
              {/* Quantity + Order limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Total Qty</label>
                  <input type="number" min="0" value={form.total_quantity} onChange={e => F('total_quantity', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="∞" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Min / Order</label>
                  <input type="number" min="1" value={form.min_per_order} onChange={e => F('min_per_order', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Max / Order</label>
                  <input type="number" min="1" value={form.max_per_order} onChange={e => F('max_per_order', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {/* Sale window */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Sale Starts</label>
                  <input type="datetime-local" value={form.sale_starts_at} onChange={e => F('sale_starts_at', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Sale Ends</label>
                  <input type="datetime-local" value={form.sale_ends_at} onChange={e => F('sale_ends_at', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {/* Toggles */}
              <div className="flex gap-6">
                {[['is_active', 'Active'], ['is_visible', 'Visible on portal']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any)[key]} onChange={e => F(key, e.target.checked)}
                      className="w-4 h-4 rounded accent-primary" />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
