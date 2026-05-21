'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Package, Plus, Pencil, Trash2, X, AlertTriangle, TrendingDown } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function ConsumptionForm({ initial, menus, onSave, onClose, loading }: any) {
  const [form, setForm] = useState({
    menu_id: initial?.menu_id ?? '',
    item_name: initial?.item_name ?? '',
    planned_quantity: initial?.planned_quantity ?? '',
    actual_quantity_consumed: initial?.actual_quantity_consumed ?? '',
    leftover_quantity: initial?.leftover_quantity ?? '',
    wastage_notes: initial?.wastage_notes ?? '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Log' : 'Log Consumption'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Menu Session</label>
            <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              value={form.menu_id} onChange={e => setForm(p => ({ ...p, menu_id: e.target.value }))}>
              <option value="">— Select menu —</option>
              {menus.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Item Name *</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. Paneer Butter Masala" value={form.item_name}
              onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Planned Qty</label>
              <input type="number" step="0.001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.planned_quantity} onChange={e => setForm(p => ({ ...p, planned_quantity: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Consumed</label>
              <input type="number" step="0.001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.actual_quantity_consumed} onChange={e => setForm(p => ({ ...p, actual_quantity_consumed: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Leftover</label>
              <input type="number" step="0.001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="0" value={form.leftover_quantity} onChange={e => setForm(p => ({ ...p, leftover_quantity: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Wastage Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={2} placeholder="Why was food wasted? Ordered too much, guests preferred other dishes..."
              value={form.wastage_notes} onChange={e => setForm(p => ({ ...p, wastage_notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.item_name || loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Saving...' : (initial ? 'Update' : 'Log Item')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FnbConsumptionPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [menus, setMenus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`, 'x-tenant-id': tenantId ?? '', 'Content-Type': 'application/json',
  }), [session, tenantId])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const [logsR, menusR] = await Promise.all([
      fetch(`${API}/fnb/events/${eventId}/consumption`, { headers: headers() }),
      fetch(`${API}/fnb/events/${eventId}/menus`, { headers: headers() }),
    ])
    setLogs(await logsR.json())
    setMenus(await menusR.json())
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async (form: any) => {
    setSaving(true)
    try {
      const url = modal.editing ? `${API}/fnb/consumption/${modal.editing.id}` : `${API}/fnb/events/${eventId}/consumption`
      await fetch(url, { method: modal.editing ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(form) })
      await load()
      setModal({ open: false })
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this log?')) return
    await fetch(`${API}/fnb/consumption/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const avgWastage = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + Number(l.wastage_pct ?? 0), 0) / logs.length * 100) / 100
    : 0

  const highWastage = logs.filter(l => Number(l.wastage_pct ?? 0) > 25)

  if (loading) return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-rose-400" />
          <h2 className="text-lg font-bold">Consumption Log</h2>
          {logs.length > 0 && <span className="text-sm text-muted-foreground">· Avg wastage: {avgWastage}%</span>}
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Log Item
        </button>
      </div>

      {highWastage.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{highWastage.length} item{highWastage.length !== 1 ? 's' : ''} with &gt;25% wastage: {highWastage.map(l => l.item_name).join(', ')}</p>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No consumption logged yet</p>
          <p className="text-sm text-muted-foreground mb-4">Log post-event food consumption to track wastage and optimise future orders</p>
          <button onClick={() => setModal({ open: true })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Log First Item
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Planned</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Consumed</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Leftover</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Wastage</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map(log => {
                const wastage = Number(log.wastage_pct ?? 0)
                const wastageColor = wastage > 25 ? 'text-rose-400' : wastage > 10 ? 'text-amber-400' : 'text-emerald-400'
                return (
                  <tr key={log.id} className="hover:bg-accent/30 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium">{log.item_name}</p>
                      {log.menu?.name && <p className="text-xs text-muted-foreground">{log.menu.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{log.planned_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{log.actual_quantity_consumed ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{log.leftover_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-semibold tabular-nums', wastageColor)}>{wastage}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => setModal({ open: true, editing: log })}
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => del(log.id)}
                          className="p-1 text-muted-foreground hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <ConsumptionForm initial={modal.editing} menus={menus} onSave={save} onClose={() => setModal({ open: false })} loading={saving} />
      )}
    </div>
  )
}
