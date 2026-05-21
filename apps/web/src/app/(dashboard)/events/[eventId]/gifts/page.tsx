'use client'
import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useApiClient } from '@/hooks/use-api-client'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import {
  Gift, Plus, ArrowLeft, Heart, Package, Wallet, CheckCircle2,
  Clock, Send, Search, Filter, Star, AlertTriangle, Edit2,
  Trash2, ExternalLink, Camera, BarChart3, MessageCircle,
  Copy, Check, ChevronDown, ChevronUp, RefreshCw, Inbox,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface GiftReceived {
  id: string; event_id: string; guest_id: string | null
  giver_name: string | null; giver_phone: string | null; giver_email: string | null
  gift_type: string; name: string; category: string; brand: string | null
  estimated_value: number | null; cash_amount: number | null; currency_code: string
  quantity: number; received_date: string; storage_location: string | null
  thank_you_sent: boolean; thank_you_sent_at: string | null; thank_you_channel: string | null
  notes: string | null; image_url: string | null
  guest?: { id: string; name: string; phone: string | null; email: string | null }
}

interface GiftItem {
  id: string; name: string; description: string | null; category: string
  brand: string | null; price: number | null; quantity_wanted: number
  quantity_received: number; priority: string; is_group_gift: boolean
  product_url: string | null; image_url: string | null
}

interface Registry {
  id: string; title: string; description: string | null
  is_public: boolean; allow_cash: boolean; cash_target: number | null
  currency_code: string; status: string
}

interface Summary {
  total_gifts: number; cash_gifts: number; physical_gifts: number
  total_estimated_value: number; total_cash_received: number
  pending_thankyou: number; thankyou_sent: number
}

// ─────────────────────────────────────────────
// Category meta
// ─────────────────────────────────────────────
const CATEGORIES = [
  'electronics','home_decor','kitchen','clothing','jewellery',
  'experience','cash','voucher','books','toys','wellness','travel','other'
]

const PRIORITY_COLORS: Record<string, string> = {
  must_have: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  low: 'bg-muted text-muted-foreground border-border',
}

const TYPE_COLORS: Record<string, string> = {
  physical: 'bg-blue-500/10 text-blue-400',
  cash: 'bg-green-500/10 text-green-400',
  voucher: 'bg-violet-500/10 text-violet-400',
  experience: 'bg-amber-500/10 text-amber-400',
  digital: 'bg-cyan-500/10 text-cyan-400',
}

// ─────────────────────────────────────────────
// Log Gift Modal
// ─────────────────────────────────────────────
function LogGiftModal({ onSave, onClose }: {
  onSave: (dto: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    giver_name: '', giver_phone: '', giver_email: '',
    gift_type: 'physical', name: '', category: 'other', brand: '',
    estimated_value: '', cash_amount: '', quantity: '1',
    received_date: new Date().toISOString().slice(0, 10),
    storage_location: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Gift name is required'); return }
    if (!form.giver_name.trim()) { setError('Giver name is required'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        estimated_value: form.estimated_value ? +form.estimated_value : null,
        cash_amount: form.gift_type === 'cash' ? +form.cash_amount : null,
        quantity: +form.quantity,
      })
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2"><Gift className="w-5 h-5 text-primary" /> Log Gift Received</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Giver */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Giver Name *</label>
              <input value={form.giver_name} onChange={e => set('giver_name', e.target.value)}
                placeholder="Guest or person's name"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Phone</label>
              <input value={form.giver_phone} onChange={e => set('giver_phone', e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Email</label>
              <input type="email" value={form.giver_email} onChange={e => set('giver_email', e.target.value)}
                placeholder="giver@email.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          {/* Gift details */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Gift Type</label>
              <select value={form.gift_type} onChange={e => set('gift_type', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                {['physical','cash','voucher','experience','digital'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Gift Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Dinner Set, Cash, ₹500 Amazon Voucher"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Brand</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="Optional brand"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Quantity</label>
              <input type="number" value={form.quantity} min={1}
                onChange={e => set('quantity', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {form.gift_type === 'cash' ? 'Cash Amount (₹)' : 'Estimated Value (₹)'}
              </label>
              <input type="number" step="0.01"
                value={form.gift_type === 'cash' ? form.cash_amount : form.estimated_value}
                onChange={e => set(form.gift_type === 'cash' ? 'cash_amount' : 'estimated_value', e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Date Received</label>
              <input type="date" value={form.received_date}
                onChange={e => set('received_date', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Storage Location</label>
              <input value={form.storage_location} onChange={e => set('storage_location', e.target.value)}
                placeholder="e.g. Box 3, Car boot"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Any notes about this gift…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Log Gift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Add Registry Item Modal
// ─────────────────────────────────────────────
function AddItemModal({ onSave, onClose }: {
  onSave: (dto: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: '', description: '', category: 'other', brand: '', price: '',
    quantity_wanted: '1', priority: 'medium', product_url: '', is_group_gift: false,
  })
  const [saving, setSaving] = useState(false)
  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, price: form.price ? +form.price : null, quantity_wanted: +form.quantity_wanted })
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Add to Wishlist</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Item Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder="e.g. KitchenAid Stand Mixer"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                {['must_have','high','medium','low'].map(p => <option key={p} value={p}>{p.replace('_',' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Price (₹)</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Qty Wanted</label>
              <input type="number" min={1} value={form.quantity_wanted}
                onChange={e => set('quantity_wanted', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Brand</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Product URL</label>
            <input type="url" value={form.product_url} onChange={e => set('product_url', e.target.value)}
              placeholder="https://amazon.in/..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_group_gift} onChange={e => set('is_group_gift', e.target.checked)} className="accent-primary" />
            <span className="text-sm">Group gift (multiple guests can contribute)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Adding…' : 'Add to Wishlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Thank You Panel
// ─────────────────────────────────────────────
function ThankYouPanel({ gifts, tenantId, onSent }: {
  gifts: GiftReceived[]
  tenantId: string
  onSent: () => void
}) {
  const api = useApiClient()
  const pending = gifts.filter(g => !g.thank_you_sent)
  const [selected, setSelected] = useState<string[]>([])
  const [channel, setChannel] = useState('whatsapp')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const templates: Record<string, string> = {
    whatsapp: 'Dear {{giver_name}}, thank you so much for the beautiful {{gift_name}}! Your thoughtfulness means the world to us. With love 💕',
    email: 'Dear {{giver_name}},\n\nThank you so much for the wonderful {{gift_name}}. Your generosity has made our celebration even more special.\n\nWith warmest regards',
    sms: 'Thank you {{giver_name}} for the {{gift_name}}! We truly appreciate your kindness. 🙏',
  }

  const toggleAll = () => {
    setSelected(s => s.length === pending.length ? [] : pending.map(g => g.id))
  }

  const generatePreview = (gift: GiftReceived) => {
    const tmpl = templates[channel]
    return tmpl
      .replace('{{giver_name}}', gift.giver_name ?? 'Friend')
      .replace('{{gift_name}}', gift.name)
  }

  const sendThankYou = async () => {
    if (!selected.length) return
    setSending(true)
    try {
      await api.post(`/events/${gifts[0]?.event_id}/gifts/thank-you/mark-sent`, {
        gift_ids: selected, channel,
      })
      onSent()
    } finally {
      setSending(false)
    }
  }

  if (pending.length === 0) {
    return (
      <div className="py-12 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-70" />
        <p className="font-semibold text-green-400">All thank-yous sent!</p>
        <p className="text-xs text-muted-foreground mt-1">Every guest has been thanked</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Channel selector */}
      <div className="flex gap-2">
        {['whatsapp','email','sms'].map(c => (
          <button key={c} onClick={() => setChannel(c)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
              channel === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
            )}>
            {c}
          </button>
        ))}
      </div>

      {/* Template preview */}
      <div className="bg-background border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Message Template</p>
        <p className="text-sm leading-relaxed">{templates[channel]}</p>
      </div>

      {/* Pending list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium">{pending.length} pending thank-yous</p>
          <button onClick={toggleAll} className="text-xs text-primary hover:underline">
            {selected.length === pending.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {pending.map(g => (
            <label key={g.id} className={cn(
              'flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors',
              selected.includes(g.id) ? 'bg-primary/5 border-primary/30' : 'bg-background border-border hover:bg-muted/50'
            )}>
              <input type="checkbox" checked={selected.includes(g.id)}
                onChange={() => setSelected(s => s.includes(g.id) ? s.filter(i => i !== g.id) : [...s, g.id])}
                className="mt-0.5 accent-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.giver_name ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{g.name}</p>
                {g.giver_phone && <p className="text-xs text-muted-foreground">{g.giver_phone}</p>}
              </div>
              <button type="button" onClick={e => { e.preventDefault(); setPreview(generatePreview(g)) }}
                className="text-xs text-primary hover:underline shrink-0">Preview</button>
            </label>
          ))}
        </div>
      </div>

      <button onClick={sendThankYou} disabled={!selected.length || sending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-600/90 disabled:opacity-50 transition-colors">
        <Send className="w-4 h-4" />
        {sending ? 'Marking…' : `Mark ${selected.length} as Thank-You Sent`}
      </button>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold">Message Preview</h3>
            <div className="bg-background rounded-xl p-4 text-sm whitespace-pre-wrap">{preview}</div>
            <button onClick={() => setPreview(null)} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function GiftsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const api = useApiClient()

  const [tab, setTab] = useState<'received' | 'wishlist' | 'thankyou' | 'analytics'>('received')
  const [gifts, setGifts] = useState<GiftReceived[]>([])
  const [items, setItems] = useState<GiftItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [expandedGift, setExpandedGift] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [gData, iData, sData] = await Promise.all([
        api.get(`/events/${eventId}/gifts`).catch(() => []),
        api.get(`/events/${eventId}/gifts/items`).catch(() => []),
        api.get(`/events/${eventId}/gifts/summary`).catch(() => null),
      ])
      setGifts(gData ?? [])
      setItems(iData ?? [])
      setSummary(sData)
    } finally {
      setLoading(false)
    }
  }

  const handleLogGift = async (dto: any) => {
    await api.post(`/events/${eventId}/gifts`, dto)
    setShowLog(false)
    await loadAll()
  }

  const handleAddItem = async (dto: any) => {
    await api.post(`/events/${eventId}/gifts/items`, dto)
    setShowAddItem(false)
    await loadAll()
  }

  const deleteGift = async (id: string) => {
    if (!confirm('Delete this gift record?')) return
    await api.delete(`/events/${eventId}/gifts/${id}`)
    setGifts(prev => prev.filter(g => g.id !== id))
    await loadAll()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Remove from wishlist?')) return
    await api.delete(`/events/${eventId}/gifts/items/${id}`)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filteredGifts = gifts.filter(g => {
    const matchSearch = !search ||
      (g.giver_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      g.name.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || g.gift_type === filterType
    return matchSearch && matchType
  })

  const pendingThankyou = gifts.filter(g => !g.thank_you_sent).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Gifts</span>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gifts Received', value: summary.total_gifts, icon: Gift, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Total Value', value: `₹${(summary.total_estimated_value + summary.total_cash_received).toLocaleString()}`, icon: Wallet, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Cash Received', value: `₹${summary.total_cash_received.toLocaleString()}`, icon: Wallet, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Thank-yous Pending', value: summary.pending_thankyou, icon: MessageCircle, color: pendingThankyou > 0 ? 'text-yellow-400' : 'text-green-400', bg: pendingThankyou > 0 ? 'bg-yellow-500/10' : 'bg-green-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bg)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {([
            { id: 'received', label: 'Gifts Received', icon: Package },
            { id: 'wishlist', label: 'Wishlist', icon: Star },
            { id: 'thankyou', label: `Thank You${pendingThankyou > 0 ? ` (${pendingThankyou})` : ''}`, icon: Heart },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap',
                tab === id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ─── GIFTS RECEIVED ─── */}
          {tab === 'received' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search gifts or givers…"
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                  <option value="">All Types</option>
                  {['physical','cash','voucher','experience','digital'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
                <button onClick={() => setShowLog(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5" /> Log Gift
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-background border border-border rounded-xl animate-pulse" />
                ))}</div>
              ) : filteredGifts.length === 0 ? (
                <div className="py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    {gifts.length === 0 ? 'No gifts logged yet' : 'No gifts match your filters'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGifts.map(gift => (
                    <div key={gift.id} className="bg-background border border-border rounded-xl overflow-hidden">
                      <div className="flex items-start gap-3 p-4">
                        <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0 text-lg">
                          {gift.gift_type === 'cash' ? '💵' : gift.gift_type === 'experience' ? '✨' : gift.gift_type === 'voucher' ? '🎟' : '🎁'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <p className="font-semibold text-sm truncate">{gift.name}</p>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full capitalize', TYPE_COLORS[gift.gift_type] ?? 'bg-muted text-muted-foreground')}>
                              {gift.gift_type}
                            </span>
                            {gift.thank_you_sent
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              : <Clock className="w-3.5 h-3.5 text-yellow-400" />}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>From: <span className="text-foreground">{gift.giver_name ?? 'Unknown'}</span></span>
                            {(gift.estimated_value || gift.cash_amount) && (
                              <span className="text-green-400 font-medium">
                                ₹{(gift.cash_amount ?? gift.estimated_value ?? 0).toLocaleString()}
                              </span>
                            )}
                            <span>{formatDate(gift.received_date)}</span>
                            {gift.storage_location && <span>📦 {gift.storage_location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setExpandedGift(prev => prev === gift.id ? null : gift.id)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
                            {expandedGift === gift.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteGift(gift.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {expandedGift === gift.id && (
                        <div className="px-4 pb-4 pt-0 border-t border-border text-xs text-muted-foreground space-y-1.5">
                          {gift.brand && <p><span className="font-medium text-foreground">Brand:</span> {gift.brand}</p>}
                          {gift.giver_phone && <p><span className="font-medium text-foreground">Phone:</span> {gift.giver_phone}</p>}
                          {gift.giver_email && <p><span className="font-medium text-foreground">Email:</span> {gift.giver_email}</p>}
                          {gift.quantity > 1 && <p><span className="font-medium text-foreground">Qty:</span> {gift.quantity}</p>}
                          {gift.notes && <p><span className="font-medium text-foreground">Notes:</span> {gift.notes}</p>}
                          {gift.thank_you_sent_at && (
                            <p className="text-green-400">
                              ✓ Thank-you sent via {gift.thank_you_channel} on {formatDate(gift.thank_you_sent_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── WISHLIST ─── */}
          {tab === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Gift Wishlist ({items.length} items)</p>
                <button onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <Star className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No wishlist items yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add items guests can reference when choosing gifts</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map(item => (
                    <div key={item.id} className={cn(
                      'bg-background border rounded-xl p-4 space-y-2',
                      item.quantity_received >= item.quantity_wanted ? 'border-green-500/20 opacity-70' : 'border-border'
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.product_url && (
                            <a href={item.product_url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button onClick={() => deleteItem(item.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', PRIORITY_COLORS[item.priority])}>
                          {item.priority.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">{item.category.replace('_', ' ')}</span>
                        {item.is_group_gift && <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full">Group gift</span>}
                        {item.price && <span className="text-xs text-green-400">₹{item.price.toLocaleString()}</span>}
                      </div>
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{item.quantity_received}/{item.quantity_wanted} received</span>
                          {item.quantity_received >= item.quantity_wanted && (
                            <span className="text-green-400">✓ Fulfilled</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (item.quantity_received / item.quantity_wanted) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── THANK YOU ─── */}
          {tab === 'thankyou' && (
            <ThankYouPanel
              gifts={gifts}
              tenantId=""
              onSent={loadAll}
            />
          )}

          {/* ─── ANALYTICS ─── */}
          {tab === 'analytics' && summary && (
            <div className="space-y-5">
              {/* Value breakdown */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Physical Gifts', count: summary.physical_gifts, pct: summary.total_gifts ? Math.round((summary.physical_gifts / summary.total_gifts) * 100) : 0, color: 'bg-blue-500' },
                  { label: 'Cash Gifts', count: summary.cash_gifts, pct: summary.total_gifts ? Math.round((summary.cash_gifts / summary.total_gifts) * 100) : 0, color: 'bg-green-500' },
                  { label: 'Other', count: summary.total_gifts - summary.physical_gifts - summary.cash_gifts, pct: summary.total_gifts ? Math.round(((summary.total_gifts - summary.physical_gifts - summary.cash_gifts) / summary.total_gifts) * 100) : 0, color: 'bg-violet-500' },
                ].map(({ label, count, pct, color }) => (
                  <div key={label} className="bg-background border border-border rounded-xl p-4">
                    <p className="text-sm font-medium mb-1">{label}</p>
                    <p className="text-2xl font-bold tabular-nums mb-2">{count}</p>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pct}% of total</p>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-3">Gifts by Category</p>
                <div className="space-y-2">
                  {Object.entries(
                    gifts.reduce<Record<string, number>>((acc, g) => {
                      acc[g.category] = (acc[g.category] ?? 0) + 1
                      return acc
                    }, {})
                  ).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <p className="text-xs w-28 capitalize truncate">{cat.replace(/_/g, ' ')}</p>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${(count / gifts.length) * 100}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground w-6 text-right">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thank-you progress */}
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-3">Thank-You Progress</p>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                        className="text-green-400"
                        strokeDasharray={`${summary.total_gifts ? (summary.thankyou_sent / summary.total_gifts) * 100 : 0} 100`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm font-bold">
                        {summary.total_gifts ? Math.round((summary.thankyou_sent / summary.total_gifts) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span>{summary.thankyou_sent} thank-yous sent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-yellow-400" />
                      <span>{summary.pending_thankyou} still pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showLog && <LogGiftModal onSave={handleLogGift} onClose={() => setShowLog(false)} />}
      {showAddItem && <AddItemModal onSave={handleAddItem} onClose={() => setShowAddItem(false)} />}
    </div>
  )
}
