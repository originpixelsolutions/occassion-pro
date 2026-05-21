'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { DollarSign, TrendingUp, TrendingDown, CheckCircle, Lock } from 'lucide-react'
import { useBudgetRecon, useFinalizeBudget } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function VarianceBadge({ variance, pct }: { variance: number; pct: number }) {
  const over = variance > 0
  return (
    <div className={cn(
      'flex items-center gap-1 text-xs font-medium',
      over ? 'text-red-400' : 'text-emerald-400',
    )}>
      {over ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {over ? '+' : ''}{fmt(variance)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
    </div>
  )
}

export default function PostEventBudgetPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = useBudgetRecon(tenant, eventId)
  const finalize = useFinalizeBudget(tenant, eventId)
  const [showConfirm, setShowConfirm] = useState(false)

  const summary = data?.summary ?? {}
  const categories: any[] = data?.categories ?? []
  const isFinalized = data?.is_finalized ?? false

  const totalBudgeted = summary.total_budgeted ?? 0
  const totalActual = summary.total_actual ?? 0
  const totalVariance = totalActual - totalBudgeted
  const variancePct = totalBudgeted > 0 ? ((totalVariance / totalBudgeted) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Budget Reconciliation</h1>
            <p className="text-white/40 text-sm mt-0.5">Final budget vs actual spend comparison</p>
          </div>
          {!isFinalized ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm hover:bg-indigo-400 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Finalize Budget
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
              <Lock className="w-4 h-4" />
              Budget Finalized
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs text-white/40 mb-1">Total Budgeted</div>
            <div className="text-2xl font-bold text-white">{fmt(totalBudgeted)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs text-white/40 mb-1">Total Actual</div>
            <div className="text-2xl font-bold text-white">{fmt(totalActual)}</div>
          </div>
          <div className={cn(
            'rounded-xl border p-4',
            totalVariance > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5',
          )}>
            <div className="text-xs text-white/40 mb-1">Variance</div>
            <div className={cn('text-2xl font-bold', totalVariance > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)}
            </div>
            <div className={cn('text-xs mt-0.5', totalVariance > 0 ? 'text-red-400/70' : 'text-emerald-400/70')}>
              {variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}% vs budget
            </div>
          </div>
        </div>

        {/* Categories table */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Category</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Budgeted</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Actual</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Variance</th>
                <th className="px-4 py-3 text-xs text-white/40 font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(5)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">
                    No budget data found
                  </td>
                </tr>
              ) : (
                categories.map((cat: any) => {
                  const variance = (cat.actual ?? 0) - (cat.budgeted ?? 0)
                  const utilPct = cat.budgeted > 0 ? Math.min(((cat.actual ?? 0) / cat.budgeted) * 100, 200) : 0
                  const over = variance > 0
                  return (
                    <tr key={cat.category} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white/80 capitalize">
                        {cat.category}
                      </td>
                      <td className="px-4 py-3 text-right text-white/60">{fmt(cat.budgeted ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-white/80">{fmt(cat.actual ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <VarianceBadge variance={variance} pct={cat.budgeted > 0 ? (variance / cat.budgeted) * 100 : 0} />
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-emerald-500')}
                              style={{ width: `${Math.min(utilPct, 100)}%` }}
                            />
                          </div>
                          <span className={cn('text-xs', over ? 'text-red-400' : 'text-white/50')}>
                            {utilPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Finalize confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-white">Finalize Budget?</h3>
            <p className="text-sm text-white/50">
              This locks the budget reconciliation. No further edits will be allowed after finalization.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
                Cancel
              </button>
              <button
                onClick={() => { finalize.mutate(); setShowConfirm(false) }}
                disabled={finalize.isPending}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-60"
              >
                {finalize.isPending ? 'Finalizing…' : 'Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
