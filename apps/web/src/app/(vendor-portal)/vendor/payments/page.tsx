'use client'

import { useEffect, useState } from 'react'

interface PaymentMilestone {
  id: string
  assignment_id: string
  event_name: string
  tenant_name: string
  description: string
  amount: number
  currency_code: string
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed'
  due_date?: string
  paid_at?: string
  notes?: string
}

interface PaymentSummary {
  total_earned: number
  pending_amount: number
  processing_amount: number
  currency_code: string
}

const MILESTONE_STATUS_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  pending:    { badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',    dot: 'bg-zinc-500',    label: 'Pending' },
  approved:   { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400',   label: 'Approved' },
  processing: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    dot: 'bg-blue-400',    label: 'Processing' },
  paid:       { badge: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400',   label: 'Paid' },
  failed:     { badge: 'bg-red-500/15 text-red-400 border-red-500/30',       dot: 'bg-red-400',     label: 'Failed' },
}

function fmtCurrency(amount: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function PaymentsPage() {
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([])
  const [summary, setSummary] = useState<PaymentSummary>({ total_earned: 0, pending_amount: 0, processing_amount: 0, currency_code: 'INR' })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return
    fetch('/api/v1/vendor-portal/payments', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: PaymentMilestone[]) => {
        setMilestones(data)
        const paid = data.filter(m => m.status === 'paid')
        const pending = data.filter(m => ['pending', 'approved'].includes(m.status))
        const processing = data.filter(m => m.status === 'processing')
        setSummary({
          total_earned: paid.reduce((s, m) => s + m.amount, 0),
          pending_amount: pending.reduce((s, m) => s + m.amount, 0),
          processing_amount: processing.reduce((s, m) => s + m.amount, 0),
          currency_code: data[0]?.currency_code ?? 'INR',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? milestones : milestones.filter(m => m.status === filter)
  const FILTERS = ['all', 'pending', 'approved', 'processing', 'paid', 'failed']

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Payments</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Payment milestones across all your assignments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total earned"
          value={fmtCurrency(summary.total_earned, summary.currency_code)}
          sub="from paid milestones"
          accent="text-green-400"
        />
        <SummaryCard
          label="Awaiting payment"
          value={fmtCurrency(summary.pending_amount, summary.currency_code)}
          sub="pending or approved"
          accent="text-amber-400"
        />
        <SummaryCard
          label="In processing"
          value={fmtCurrency(summary.processing_amount, summary.currency_code)}
          sub="being transferred"
          accent="text-blue-400"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {f === 'all' ? 'All' : MILESTONE_STATUS_STYLES[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Milestones list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <svg className="w-8 h-8 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-zinc-500 text-sm">No payments found</p>
          <p className="text-zinc-600 text-xs mt-1">Payment milestones will appear here once organisers create them</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const style = MILESTONE_STATUS_STYLES[m.status] ?? MILESTONE_STATUS_STYLES.pending
            return (
              <div key={m.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  {/* Status indicator */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{m.description || 'Payment milestone'}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{m.tenant_name} · {m.event_name}</p>
                        {m.notes && (
                          <p className="text-zinc-600 text-xs mt-1 line-clamp-1">{m.notes}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-white text-base font-semibold">{fmtCurrency(m.amount, m.currency_code)}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                    </div>

                    {/* Dates row */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/70">
                      {m.due_date && (
                        <div>
                          <p className="text-zinc-600 text-[10px] uppercase tracking-wide">Due date</p>
                          <p className="text-zinc-400 text-xs mt-0.5">{fmtDate(m.due_date)}</p>
                        </div>
                      )}
                      {m.paid_at && (
                        <div>
                          <p className="text-zinc-600 text-[10px] uppercase tracking-wide">Paid on</p>
                          <p className="text-green-400 text-xs mt-0.5">{fmtDate(m.paid_at)}</p>
                        </div>
                      )}
                      {m.status === 'paid' && (
                        <div className="ml-auto flex items-center gap-1">
                          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-400 text-[10px]">Payment received</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bank details reminder */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-zinc-400 text-xs font-medium">Ensure your bank details are up to date</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            Payments are disbursed to your registered bank account.{' '}
            <a href="/vendor/profile" className="text-violet-400 hover:text-violet-300 transition-colors">Update bank details →</a>
          </p>
        </div>
      </div>
    </div>
  )
}
