'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Printer, FileText, Award, Tag, LayoutGrid, List,
  CheckCircle2, Clock, AlertCircle, Edit3, Trash2, Loader2,
  ExternalLink, RefreshCw, Search, Filter, ImageIcon,
  Package, ArrowRight, X,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  try { return JSON.parse(localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`) ?? '{}')?.access_token ?? '' } catch { return '' }
}
function getTenantId() {
  try { return localStorage.getItem('tenantId') ?? '' } catch { return '' }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrintItem {
  id: string
  item_name: string
  item_type: string
  design_status: string
  quantity: number
  unit_cost: number | null
  total_cost: number | null
  currency: string
  paper_size: string
  paper_type: string
  finish: string
  color_mode: string
  design_file_url: string | null
  proof_url: string | null
  design_due_date: string | null
  print_due_date: string | null
  delivery_date: string | null
  vendor_id: string | null
  vendors: { name: string } | null
  notes: string | null
  created_at: string
}

interface Stats {
  totalItems: number
  totalQuantity: number
  totalCost: number
  pendingApproval: number
  statusCounts: Record<string, number>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_TYPES = [
  { value: 'invitation', label: 'Invitation', icon: '💌' },
  { value: 'menu_card', label: 'Menu Card', icon: '🍽️' },
  { value: 'seating_chart', label: 'Seating Chart', icon: '🗺️' },
  { value: 'place_card', label: 'Place Card', icon: '🪑' },
  { value: 'name_badge', label: 'Name Badge', icon: '🪪' },
  { value: 'programme', label: 'Programme', icon: '📋' },
  { value: 'signage', label: 'Signage', icon: '🪧' },
  { value: 'banner', label: 'Banner', icon: '🎏' },
  { value: 'table_number', label: 'Table Number', icon: '🔢' },
  { value: 'thank_you_card', label: 'Thank You Card', icon: '💝' },
  { value: 'favour_tag', label: 'Favour Tag', icon: '🏷️' },
  { value: 'envelope', label: 'Envelope', icon: '✉️' },
  { value: 'direction_sign', label: 'Direction Sign', icon: '➡️' },
  { value: 'welcome_board', label: 'Welcome Board', icon: '👋' },
  { value: 'backdrop_print', label: 'Backdrop Print', icon: '🖼️' },
  { value: 'other', label: 'Other', icon: '📦' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  not_started:        { label: 'Not Started',          color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',     dot: 'bg-zinc-400' },
  in_design:          { label: 'In Design',             color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',     dot: 'bg-blue-400' },
  design_review:      { label: 'Awaiting Approval',     color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400 animate-pulse' },
  design_approved:    { label: 'Design Approved',       color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  sent_to_print:      { label: 'Sent to Print',         color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', dot: 'bg-violet-400' },
  printing:           { label: 'Printing',              color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',    dot: 'bg-cyan-400 animate-pulse' },
  ready_for_collection: { label: 'Ready for Collection', color: 'text-teal-400 bg-teal-400/10 border-teal-400/20',   dot: 'bg-teal-400' },
  delivered:          { label: 'Delivered',             color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  cancelled:          { label: 'Cancelled',             color: 'text-red-400 bg-red-400/10 border-red-400/20',       dot: 'bg-red-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function fmtCurrency(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

function PrintItemModal({
  item, eventId, onClose, onSaved,
}: {
  item: PrintItem | null
  eventId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    item_name: item?.item_name ?? '',
    item_type: item?.item_type ?? 'invitation',
    quantity: item?.quantity ?? 1,
    design_status: item?.design_status ?? 'not_started',
    paper_size: item?.paper_size ?? 'A5',
    paper_type: item?.paper_type ?? 'matte',
    finish: item?.finish ?? 'none',
    color_mode: item?.color_mode ?? 'full_color',
    unit_cost: item?.unit_cost ?? '',
    design_file_url: item?.design_file_url ?? '',
    proof_url: item?.proof_url ?? '',
    design_due_date: item?.design_due_date ?? '',
    print_due_date: item?.print_due_date ?? '',
    delivery_date: item?.delivery_date ?? '',
    notes: item?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const up = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.item_name.trim()) return
    setSaving(true)
    try {
      const tok = getToken(); const tid = getTenantId()
      const payload = {
        ...form,
        event_id: eventId,
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        design_file_url: form.design_file_url || null,
        proof_url: form.proof_url || null,
        design_due_date: form.design_due_date || null,
        print_due_date: form.print_due_date || null,
        delivery_date: form.delivery_date || null,
        notes: form.notes || null,
      }
      const url = item ? `${API}/printing/items/${item.id}` : `${API}/printing/items`
      const method = item ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${tok}`, 'x-tenant-id': tid, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch { alert('Save failed') }
    finally { setSaving(false) }
  }

  const typeInfo = ITEM_TYPES.find(t => t.value === form.item_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/60 sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{item ? 'Edit Print Item' : 'Add Print Item'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Item name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Item Name *</label>
            <input className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.item_name} onChange={e => up('item_name', e.target.value)} placeholder="e.g. Wedding Invitation Suite" />
          </div>
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Item Type</label>
            <div className="grid grid-cols-4 gap-2">
              {ITEM_TYPES.slice(0, 8).map(t => (
                <button key={t.value} onClick={() => up('item_type', t.value)} className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${form.item_type === t.value ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-border'}`}>
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
            <select className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 mt-1" value={form.item_type} onChange={e => up('item_type', e.target.value)}>
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          {/* Quantity & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <input type="number" min={1} className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.quantity} onChange={e => up('quantity', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.design_status} onChange={e => up('design_status', e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {/* Print specs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Paper Size</label>
              <select className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.paper_size} onChange={e => up('paper_size', e.target.value)}>
                {['A4','A5','A6','DL','4x6in','5x7in','Business Card','Custom'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Paper Type</label>
              <select className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.paper_type} onChange={e => up('paper_type', e.target.value)}>
                {['matte','glossy','silk','kraft','recycled','cardstock','velvet'].map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Finish</label>
              <select className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.finish} onChange={e => up('finish', e.target.value)}>
                {['none','lamination','spot_uv','foiling','emboss','deboss','die_cut'].map(f => <option key={f} value={f} className="capitalize">{f.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unit Cost (INR)</label>
              <input type="number" min={0} className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.unit_cost} onChange={e => up('unit_cost', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {/* Design file links */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Design Files (External Links)</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Design File URL</label>
              <input className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.design_file_url} onChange={e => up('design_file_url', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Print Proof URL</label>
              <input className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={form.proof_url} onChange={e => up('proof_url', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'design_due_date', label: 'Design Due' },
              { key: 'print_due_date', label: 'Print Due' },
              { key: 'delivery_date', label: 'Delivery Date' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input type="date" className="w-full bg-muted/50 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50" value={(form as Record<string, string>)[key]} onChange={e => up(key, e.target.value)} />
              </div>
            ))}
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 resize-none" rows={2} value={form.notes} onChange={e => up('notes', e.target.value)} placeholder="Special instructions, branding notes..." />
          </div>
        </div>
        <div className="p-6 border-t border-border/60 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/60 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || !form.item_name.trim()} className="px-6 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {item ? 'Update' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function PrintItemCard({ item, onEdit, onDelete }: { item: PrintItem; onEdit: () => void; onDelete: () => void }) {
  const typeInfo = ITEM_TYPES.find(t => t.value === item.item_type)
  const isOverdue = item.print_due_date && new Date(item.print_due_date) < new Date() && item.design_status !== 'delivered'

  return (
    <div className={`bg-card/60 border ${isOverdue ? 'border-red-500/30' : 'border-border/60'} rounded-2xl p-5 hover:border-border transition-all`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted/60 rounded-xl flex items-center justify-center text-xl">
            {typeInfo?.icon ?? '📦'}
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{item.item_name}</p>
            <p className="text-xs text-muted-foreground">{typeInfo?.label ?? item.item_type} · {item.quantity.toLocaleString()} pcs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.design_status} />
        </div>
      </div>

      {/* Specs row */}
      <div className="flex gap-2 flex-wrap mb-3">
        {[item.paper_size, item.paper_type, item.finish !== 'none' ? item.finish : null, item.color_mode].filter(Boolean).map((s, i) => (
          <span key={i} className="px-2 py-0.5 text-[10px] text-muted-foreground bg-muted/50 border border-border/40 rounded-full capitalize">{(s ?? '').replace('_', ' ')}</span>
        ))}
      </div>

      {/* Files */}
      {(item.design_file_url || item.proof_url) && (
        <div className="flex gap-2 mb-3">
          {item.design_file_url && (
            <a href={item.design_file_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20">
              <ImageIcon className="w-3 h-3" /> Design File <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {item.proof_url && (
            <a href={item.proof_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
              <FileText className="w-3 h-3" /> Proof <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Dates & Cost */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {item.print_due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
              <Clock className="w-3 h-3" /> Due: {fmtDate(item.print_due_date)}
            </span>
          )}
          {item.vendors?.name && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> {item.vendors.name}
            </span>
          )}
        </div>
        {item.total_cost != null && (
          <span className="font-semibold text-foreground">{fmtCurrency(item.total_cost)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
        <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 bg-muted/50 rounded-lg border border-border/40 hover:border-border transition-all">
          <Edit3 className="w-3 h-3" /> Edit
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/40 hover:border-red-500/30 transition-all ml-auto">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintingPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [items, setItems] = useState<PrintItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item: PrintItem | null }>({ open: false, item: null })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const load = useCallback(async () => {
    setLoading(true)
    const tok = getToken(); const tid = getTenantId()
    const headers = { Authorization: `Bearer ${tok}`, 'x-tenant-id': tid }
    try {
      const [itemsRes, statsRes] = await Promise.all([
        fetch(`${API}/printing/events/${eventId}/items`, { headers }),
        fetch(`${API}/printing/events/${eventId}/stats`, { headers }),
      ])
      if (itemsRes.ok) setItems(await itemsRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch {}
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function deleteItem(id: string) {
    if (!confirm('Delete this print item?')) return
    const tok = getToken(); const tid = getTenantId()
    await fetch(`${API}/printing/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}`, 'x-tenant-id': tid },
    })
    setItems(p => p.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => {
    if (filterType && i.item_type !== filterType) return false
    if (filterStatus && i.design_status !== filterStatus) return false
    if (search && !i.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalBudget = stats?.totalCost ?? 0
  const approved = (stats?.statusCounts?.['design_approved'] ?? 0) + (stats?.statusCounts?.['delivered'] ?? 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Printer className="w-5 h-5 text-violet-400" /> Printing & Stationery
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all printed collateral — invitations, menus, signage, badges & more</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground border border-border/60 rounded-xl"><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={() => setModal({ open: true, item: null })}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl font-medium"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Items', value: stats?.totalItems ?? 0, sub: `${stats?.totalQuantity ?? 0} pieces`, color: 'text-violet-400 bg-violet-400/10' },
          { label: 'Pending Approval', value: stats?.pendingApproval ?? 0, sub: 'Awaiting sign-off', color: 'text-amber-400 bg-amber-400/10' },
          { label: 'Total Print Budget', value: fmtCurrency(totalBudget), sub: 'All items combined', color: 'text-emerald-400 bg-emerald-400/10' },
          { label: 'Approved / Delivered', value: approved, sub: 'Design confirmed', color: 'text-teal-400 bg-teal-400/10' },
        ].map(s => (
          <div key={s.label} className="bg-card/60 border border-border/60 rounded-2xl p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-violet-500/50" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-muted/50 border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 text-foreground" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <select className="bg-muted/50 border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 text-foreground" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex gap-1 bg-card/60 border border-border/60 rounded-xl p-1">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 text-violet-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <Printer className="w-10 h-10 opacity-30" />
          <p className="text-sm">No print items yet. Add your first item to get started.</p>
          <button onClick={() => setModal({ open: true, item: null })} className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300">
            <Plus className="w-4 h-4" /> Add Print Item
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <PrintItemCard
              key={item.id}
              item={item}
              onEdit={() => setModal({ open: true, item })}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                {['Item', 'Type', 'Qty', 'Status', 'Print Due', 'Cost', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const typeInfo = ITEM_TYPES.find(t => t.value === item.item_type)
                return (
                  <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{item.item_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{typeInfo?.icon} {typeInfo?.label}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.design_status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(item.print_due_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.total_cost != null ? fmtCurrency(item.total_cost) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setModal({ open: true, item })} className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-1 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-muted/50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <PrintItemModal
          item={modal.item}
          eventId={eventId}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load() }}
        />
      )}
    </div>
  )
}
