'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search, Download, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Clock, RefreshCw, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:             { label: 'Pending',           color: 'bg-yellow-500/10 text-yellow-400',  icon: Clock },
  initiated:           { label: 'Initiated',         color: 'bg-blue-500/10 text-blue-400',      icon: Clock },
  paid:                { label: 'Paid',              color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle },
  failed:              { label: 'Failed',            color: 'bg-red-500/10 text-red-400',         icon: XCircle },
  cancelled:           { label: 'Cancelled',         color: 'bg-slate-500/10 text-slate-400',    icon: XCircle },
  refunded:            { label: 'Refunded',          color: 'bg-purple-500/10 text-purple-400',  icon: RefreshCw },
  partially_refunded:  { label: 'Part. Refunded',    color: 'bg-orange-500/10 text-orange-400',  icon: RefreshCw },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-muted text-muted-foreground', icon: AlertCircle }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

export default function OrdersList({ eventId }: { eventId: string }) {
  const { session } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [refundModal, setRefundModal] = useState<{ order: any } | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const load = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`${API}/api/v1/events/${eventId}/payments/orders?${params}`, { headers: headers() })
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [eventId, session, search, statusFilter, page, headers])

  useEffect(() => { load() }, [load])

  const exportCSV = async () => {
    const res = await fetch(`${API}/api/v1/events/${eventId}/payments/orders/export/csv`, { headers: headers() })
    const csv = await res.text()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const submitRefund = async () => {
    if (!refundModal) return
    setRefunding(true)
    await fetch(`${API}/api/v1/events/${eventId}/payments/orders/${refundModal.order.id}/refunds`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ amount: Number(refundAmount), reason: refundReason }),
    })
    setRefundModal(null); setRefunding(false)
    await load()
  }

  const STATUSES = Object.keys(STATUS_CONFIG)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, email, order ref…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm hover:bg-accent transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="w-8" />
              <th className="text-left py-3 px-4 font-medium">Order Ref</th>
              <th className="text-left py-3 px-4 font-medium">Guest</th>
              <th className="text-right py-3 px-4 font-medium">Amount</th>
              <th className="text-center py-3 px-4 font-medium">Status</th>
              <th className="text-right py-3 px-4 font-medium">Date</th>
              <th className="text-center py-3 px-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No orders found</td></tr>
            )}
            {orders.map(o => (
              <>
                <tr
                  key={o.id}
                  className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <td className="pl-4 text-muted-foreground">
                    {expanded === o.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-foreground">{o.order_ref}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-foreground">{o.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{o.guest_email}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-foreground">
                    ₹{Number(o.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-center"><StatusBadge status={o.status} /></td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                    {o.status === 'paid' && (
                      <button
                        onClick={() => { setRefundModal({ order: o }); setRefundAmount(String(o.total_amount)) }}
                        className="text-xs px-2 py-1 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr key={`${o.id}-detail`} className="bg-muted/20">
                    <td colSpan={7} className="px-8 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground">Provider Order ID</p>
                          <p className="font-mono text-foreground mt-0.5">{o.provider_order_id ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Method</p>
                          <p className="text-foreground mt-0.5 capitalize">{o.payment_method ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Paid At</p>
                          <p className="text-foreground mt-0.5">{o.paid_at ? new Date(o.paid_at).toLocaleString('en-IN') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Breakdown</p>
                          <p className="text-foreground mt-0.5">
                            Subtotal ₹{Number(o.subtotal).toFixed(2)}
                            {Number(o.discount_amount) > 0 && ` · Disc −₹${Number(o.discount_amount).toFixed(2)}`}
                            {Number(o.gst_amount) > 0 && ` · GST ₹${Number(o.gst_amount).toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                      {o.line_items?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Line Items</p>
                          <div className="flex flex-wrap gap-2">
                            {(o.line_items as any[]).map((li: any, i: number) => (
                              <span key={i} className="text-xs bg-background border border-border rounded-lg px-2 py-1">
                                {li.name} × {li.qty} @ ₹{li.unit_price}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page}</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors">Prev</button>
          <button disabled={orders.length < 20} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors">Next</button>
        </div>
      </div>

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Initiate Refund</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Order {refundModal.order.order_ref}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Refund Amount (₹)</label>
                <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Max: ₹{Number(refundModal.order.total_amount).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason</label>
                <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button onClick={() => setRefundModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors">Cancel</button>
              <button onClick={submitRefund} disabled={refunding || !refundAmount} className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors">
                {refunding ? 'Processing…' : 'Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
