'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Loader2, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react'

function cpFetch(path: string) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { ...(session ? { 'X-Client-Session': session } : {}) },
  })
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-zinc-500/10 text-zinc-400',
    sent: 'bg-blue-500/10 text-blue-400',
    paid: 'bg-emerald-500/10 text-emerald-400',
    overdue: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-zinc-500/10 text-zinc-500',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}

export default function ClientBudgetPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }

    cpFetch(`/client-portal/events/${eventId}/budget`)
      .then(r => {
        if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [eventId, tenant])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!data) return <p className="text-zinc-500 text-sm">Budget information unavailable.</p>

  const fmt = (n: number) => `${data.currency_code || ''} ${Number(n || 0).toLocaleString('en-IN')}`

  // view_only — summary only
  if (data.access_level === 'view_only') {
    const { summary } = data
    const paidPct = summary.total > 0 ? (summary.paid / summary.total) * 100 : 0
    return (
      <div className="space-y-5">
        <h2 className="font-semibold text-lg">Budget Summary</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: fmt(summary.total), color: 'text-zinc-300' },
            { label: 'Paid', value: fmt(summary.paid), color: 'text-emerald-400' },
            { label: 'Outstanding', value: fmt(summary.outstanding), color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#13131a] border border-white/8 rounded-xl p-4 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#13131a] border border-white/8 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Payment progress</span>
            <span>{paidPct.toFixed(0)}% paid</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, paidPct)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // collaborator — category breakdown
  if (data.access_level === 'collaborator') {
    const categories = Object.entries(data.by_category || {})
    return (
      <div className="space-y-5">
        <h2 className="font-semibold text-lg">Budget by Category</h2>
        <div className="space-y-2">
          {categories.map(([cat, vals]: any) => (
            <div key={cat} className="bg-[#13131a] border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-sm capitalize">{cat.replace(/_/g, ' ')}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">Est: <span className="text-zinc-300">{Number(vals.estimated).toLocaleString()}</span></span>
                  <span className="text-zinc-500">Act: <span className="text-zinc-300">{Number(vals.actual).toLocaleString()}</span></span>
                </div>
              </div>
              <div className="space-y-1.5">
                {vals.lines.map((line: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 truncate max-w-[60%]">{line.description}</span>
                    <span className={line.status === 'paid' ? 'text-emerald-400' : 'text-zinc-400'}>
                      {Number(line.actual_amount || line.estimated_amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // full_access — lines + invoices
  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-lg">Full Budget</h2>

      {/* Budget lines */}
      {data.budget_lines?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">Budget Lines</h3>
          <div className="bg-[#13131a] border border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Description</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Category</th>
                  <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Estimated</th>
                  <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Actual</th>
                </tr>
              </thead>
              <tbody>
                {data.budget_lines.map((line: any) => (
                  <tr key={line.id} className="border-b border-white/4 last:border-0">
                    <td className="px-4 py-2.5 text-zinc-300">{line.description}</td>
                    <td className="px-4 py-2.5 text-zinc-500 capitalize text-xs">{line.category}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">{Number(line.estimated_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-300">{Number(line.actual_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices */}
      {data.invoices?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">Invoices</h3>
          <div className="space-y-2">
            {data.invoices.map((inv: any) => (
              <div key={inv.id} className="bg-[#13131a] border border-white/8 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <p className="text-xs text-zinc-500">{inv.vendor_name}</p>
                  {inv.due_date && (
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-sm shrink-0">
                  {inv.currency_code} {Number(inv.total_amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
