'use client'

/**
 * Vendor Portal — Payments
 * GET /vendor-portal/payments → list of payment records for completed assignments
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign, CheckCircle2, Clock, Loader2, AlertCircle,
  CalendarDays, CreditCard, TrendingUp,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface Payment {
  id: string
  event_name: string
  service_description: string | null
  agreed_amount: number
  currency_code: string
  payment_status: string
  payment_date: string | null
  event_date: string | null
  payment_reference: string | null
}

interface PaymentSummary {
  total_earned: number
  total_pending: number
  payment_count: number
  pending_count: number
  payments: Payment[]
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  partial: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  overdue: 'text-red-400 bg-red-500/10 border-red-500/20',
}

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VendorPaymentsPage() {
  const router = useRouter()
  const [data, setData]       = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState<'all' | 'paid' | 'pending'>('all')

  useEffect(() => {
    const session = localStorage.getItem('vp_session')
    if (!session) { router.replace('/vendor/login'); return }

    fetch(`${API}/vendor-portal/payments`, { headers: { 'X-Vendor-Session': session } })
      .then(r => {
        if (r.status === 401) { router.replace('/vendor/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setError('Failed to load payments.'))
      .finally(() => setLoading(false))
  }, [router])

  const payments = (data?.payments ?? []).filter(p => {
    if (filter === 'paid')    return p.payment_status === 'paid'
    if (filter === 'pending') return ['pending','overdue','partial'].includes(p.payment_status)
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Payments</h1>
        <p className="text-sm text-zinc-500 mt-1">Track earnings from your event assignments.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 col-span-2 md:col-span-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {formatCurrency(data.total_earned)}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Total Earned</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-400">
              {formatCurrency(data.total_pending)}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Pending</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-bold text-white">{data.payment_count}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Total Payments</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5">
        {(['all', 'paid', 'pending'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'paid' ? 'Received' : 'Pending'}
          </button>
        ))}
      </div>

      {/* Payment List */}
      {payments.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <CreditCard className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No payments found.</p>
          <p className="text-xs text-zinc-600 mt-1">
            {filter === 'all'
              ? 'Complete event assignments to earn payments.'
              : `No ${filter} payments.`}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {payments.map(p => (
              <div key={p.id} className="px-4 py-4 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  p.payment_status === 'paid' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                }`}>
                  {p.payment_status === 'paid'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <Clock className="w-4 h-4 text-amber-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.event_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.service_description && (
                      <span className="text-xs text-zinc-500 truncate">{p.service_description}</span>
                    )}
                    <span className="text-xs text-zinc-600 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(p.event_date)}
                    </span>
                  </div>
                  {p.payment_reference && (
                    <p className="text-xs text-zinc-600 mt-0.5 font-mono">Ref: {p.payment_reference}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${p.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatCurrency(p.agreed_amount, p.currency_code)}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium capitalize ${PAYMENT_STATUS_COLORS[p.payment_status] ?? 'text-zinc-400 bg-zinc-800'}`}>
                      {p.payment_status}
                    </span>
                  </div>
                  {p.payment_date && (
                    <p className="text-xs text-zinc-600 mt-1">{formatDate(p.payment_date)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank details reminder */}
      {data && data.total_pending > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-300">Payment Processing</p>
          </div>
          <p className="text-xs text-zinc-500">
            Ensure your bank details are up to date in your{' '}
            <button
              onClick={() => router.push('/vendor/profile')}
              className="text-cyan-400 hover:underline"
            >
              profile settings
            </button>{' '}
            to receive payments promptly.
          </p>
        </div>
      )}
    </div>
  )
}
