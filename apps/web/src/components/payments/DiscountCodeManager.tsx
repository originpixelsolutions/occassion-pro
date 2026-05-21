'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Copy, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const EMPTY: any = {
  code: '', description: '', discount_type: 'percentage', discount_value: '',
  max_discount_cap: '', min_order_value: '', usage_limit: '', per_user_limit: '1',
  valid_from: '', valid_until: '', is_active: true,
}

export default function DiscountCodeManager({ eventId }: { eventId: string }) {
  const { session } = useAuth()
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const load = useCallback(async () => {
    if (!session?.access_token) return
    const res = await fetch(`${API}/api/v1/events/${eventId}/payments/discount-codes`, { headers: headers() })
    const data = await res.json()
    setCodes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [eventId, session, headers])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm({ ...EMPTY }); setEditId(null); setShowForm(true) }
  const openEdit = (c: any) => {
    setForm({
      code: c.code, description: c.description ?? '', discount_type: c.discount_type,
      discount_value: String(c.discount_value), max_discount_cap: c.max_discount_cap ?? '',
      min_order_value: c.min_order_value ?? '', usage_limit: c.usage_limit ?? '',
      per_user_limit: String(c.per_user_limit), valid_from: c.valid_from ? c.valid_from.slice(0, 16) : '',
      valid_until: c.valid_until ? c.valid_until.slice(0, 16) : '', is_active: c.is_active,
    })
    setEditId(c.id); setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      ...form,
      discount_value: Number(form.discount_value),
      max_discount_cap: form.max_discount_cap ? Number(form.max_discount_cap) : null,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      per_user_limit: Number(form.per_user_limit),
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    }
    const url = editId
      ? `${API}/api/v1/events/${eventId}/payments/discount-codes/${editId}`
      : `${API}/api/v1/events/${eventId}/payments/discount-codes`
    await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(payload) })
    await load(); setShowForm(false); setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this discount code?')) return
    await fetch(`${API}/api/v1/events/${eventId}/payments/discount-codes/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const copy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const F = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const randomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    F('code', Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  if (loading) return <div className="text-muted-foreground text-sm text-center py-12">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Discount Codes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Percentage or fixed-amount codes for ticket purchases</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Code
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {codes.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No discount codes yet
          </div>
        )}
        {codes.map(c => {
          const usagePct = c.usage_limit ? (c.usage_count / c.usage_limit) * 100 : null
          const expired = c.valid_until && new Date(c.valid_until) < new Date()
          return (
            <div key={c.id} className={`bg-card border rounded-xl p-4 ${!c.is_active || expired ? 'opacity-60' : 'border-border'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-foreground tracking-wider">{c.code}</span>
                    <button onClick={() => copy(c.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {copied === c.code ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-primary">
                  {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                </span>
                {c.max_discount_cap && <span className="text-xs text-muted-foreground">max ₹{c.max_discount_cap}</span>}
                {!c.is_active && <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Inactive</span>}
                {expired && <span className="text-xs bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">Expired</span>}
              </div>

              <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Used: {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</span>
                  {c.min_order_value && <span>Min order ₹{c.min_order_value}</span>}
                </div>
                {usagePct !== null && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(usagePct, 100)}%` }} />
                  </div>
                )}
                {c.valid_until && (
                  <span>Expires {new Date(c.valid_until).toLocaleDateString('en-IN')}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{editId ? 'Edit' : 'Create'} Discount Code</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Code */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Code *</label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={e => F('code', e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="SUMMER20" />
                  <button type="button" onClick={randomCode} className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:bg-accent transition-colors">Random</button>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <input value={form.description} onChange={e => F('description', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Summer discount" />
              </div>
              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Discount Type</label>
                  <select value={form.discount_type} onChange={e => F('discount_type', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Value {form.discount_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input type="number" min="0" value={form.discount_value} onChange={e => F('discount_value', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {/* Cap + Min */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Discount Cap (₹)</label>
                  <input type="number" min="0" value={form.max_discount_cap} onChange={e => F('max_discount_cap', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Order Value (₹)</label>
                  <input type="number" min="0" value={form.min_order_value} onChange={e => F('min_order_value', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Optional" />
                </div>
              </div>
              {/* Usage + Per user */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Usage Limit</label>
                  <input type="number" min="0" value={form.usage_limit} onChange={e => F('usage_limit', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Unlimited" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Per User Limit</label>
                  <input type="number" min="1" value={form.per_user_limit} onChange={e => F('per_user_limit', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {/* Valid window */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Valid From</label>
                  <input type="datetime-local" value={form.valid_from} onChange={e => F('valid_from', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Valid Until</label>
                  <input type="datetime-local" value={form.valid_until} onChange={e => F('valid_until', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => F('is_active', e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                <span className="text-sm text-foreground">Active</span>
              </label>
            </div>
            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.code || !form.discount_value} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
