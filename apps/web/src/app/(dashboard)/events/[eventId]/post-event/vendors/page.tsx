'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { RefreshCw, CreditCard, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useVendorSettlements, useSyncSettlements, useMarkSettlementPaid } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10', icon: Clock },
  paid: { label: 'Paid', color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle },
  disputed: { label: 'Disputed', color: 'text-red-400 bg-red-500/10', icon: AlertTriangle },
}

function MarkPaidModal({ settlement, onClose, tenant, eventId }: {
  settlement: any; onClose: () => void; tenant: string; eventId: string
}) {
  const markPaid = useMarkSettlementPaid(tenant, eventId)
  const [method, setMethod] = useState('bank_transfer')
  const [receipt, setReceipt] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    markPaid.mutate(
      { settlementId: settlement.id, data: { payment_method: method, receipt_url: receipt || undefined, notes: notes || undefined } },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Mark as Paid</h3>
          <p className="text-sm text-white/40 mt-0.5">{settlement.vendor_name} — {fmt(settlement.final_amount ?? settlement.agreed_amount)}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Payment Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Receipt URL (optional)</label>
            <input
              value={receipt}
              onChange={e => setReceipt(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={markPaid.isPending}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-60"
            >
              {markPaid.isPending ? 'Saving…' : 'Mark Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function VendorSettlementsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = useVendorSettlements(tenant, eventId)
  const sync = useSyncSettlements(tenant, eventId)
  const [paying, setPaying] = useState<any | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const settlements: any[] = data?.settlements ?? []
  const totals = data?.totals ?? {}

  const filtered = filterStatus === 'all' ? settlements : settlements.filter(s => s.payment_status === filterStatus)

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Vendor Settlements</h1>
            <p className="text-white/40 text-sm mt-0.5">Settle all vendor payments and close accounts</p>
          </div>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 border border-white/[0.08] hover:bg-white/[0.05]"
          >
            <RefreshCw className={cn('w-4 h-4', sync.isPending && 'animate-spin')} />
            Sync
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Agreed', value: fmt(totals.total_agreed ?? 0), color: 'text-white' },
            { label: 'Total Settled', value: fmt(totals.total_settled ?? 0), color: 'text-emerald-400' },
            { label: 'Outstanding', value: fmt(totals.outstanding ?? 0), color: 'text-amber-400' },
            { label: 'Disputed', value: fmt(totals.disputed ?? 0), color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-xs text-white/40 mb-1">{s.label}</div>
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {['all', 'pending', 'paid', 'disputed'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs capitalize transition-colors border',
                filterStatus === f
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-white/40 border-white/[0.06] hover:text-white/60',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Service</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Agreed</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Final</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Status</th>
                <th className="px-4 py-3 text-xs text-white/40 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(6)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">
                    No settlements found
                  </td>
                </tr>
              ) : (
                filtered.map((s: any) => {
                  const cfg = STATUS_CONFIG[s.payment_status] ?? STATUS_CONFIG.pending
                  const Icon = cfg.icon
                  return (
                    <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white/80">{s.vendor_name}</div>
                        {s.contact_person && <div className="text-xs text-white/30">{s.contact_person}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/50 capitalize">{s.service_type ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-white/60">{fmt(s.agreed_amount ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {fmt(s.final_amount ?? s.agreed_amount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full w-fit', cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.payment_status === 'pending' && (
                          <button
                            onClick={() => setPaying(s)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                          >
                            <CreditCard className="w-3 h-3" />
                            Pay
                          </button>
                        )}
                        {s.payment_status === 'paid' && s.payment_method && (
                          <span className="text-xs text-white/30 capitalize">{s.payment_method.replace('_', ' ')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {paying && (
        <MarkPaidModal
          settlement={paying}
          onClose={() => setPaying(null)}
          tenant={tenant}
          eventId={eventId}
        />
      )}
    </div>
  )
}
