'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Wallet, Loader2, TrendingUp, TrendingDown, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetItem {
  item_id: string
  menu_id: string
  name: string
  category?: string
  dietary_type: string
  unit: string
  estimated_quantity: number
  actual_quantity: number
  cost_per_unit: number
  estimated_cost: number
  actual_cost: number
  variance: number
}

interface BudgetData {
  items: BudgetItem[]
  totals: {
    estimated: number
    actual: number
    variance: number
    variance_pct: number
  }
}

export function FnbBudgetCard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api.get<BudgetData>(`/fnb/events/${eventId}/reports/budget`).catch(() => null)
    setData(d)
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  const exportCsv = () => {
    if (!data) return
    const rows = [
      'item,category,unit,estimated_qty,actual_qty,cost_per_unit,estimated_cost,actual_cost,variance',
      ...data.items.map(r =>
        `"${r.name}","${r.category ?? ''}",${r.unit},${r.estimated_quantity},${r.actual_quantity},${r.cost_per_unit},${r.estimated_cost},${r.actual_cost},${r.variance}`
      ),
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'fnb_budget.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No budget data available.</p>

  const overBudget = data.totals.variance > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground flex-1">F&B Budget Summary</h2>
        <button onClick={load} className="p-1.5 border border-border rounded-lg hover:bg-accent transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-background border border-border rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Estimated Budget</p>
          <p className="text-2xl font-bold text-blue-400">₹{data.totals.estimated.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Actual Cost</p>
          <p className="text-2xl font-bold text-foreground">₹{data.totals.actual.toLocaleString('en-IN')}</p>
        </div>
        <div className={cn('rounded-xl p-5 text-center border', overBudget ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20')}>
          <p className="text-xs text-muted-foreground mb-1">Variance</p>
          <div className="flex items-center justify-center gap-2">
            {overBudget ? <TrendingUp className="w-5 h-5 text-red-400" /> : <TrendingDown className="w-5 h-5 text-emerald-400" />}
            <p className={cn('text-2xl font-bold', overBudget ? 'text-red-400' : 'text-emerald-400')}>
              {overBudget ? '+' : ''}₹{Math.abs(data.totals.variance).toLocaleString('en-IN')}
            </p>
          </div>
          <p className={cn('text-xs mt-1', overBudget ? 'text-red-400' : 'text-emerald-400')}>
            {overBudget ? '+' : ''}{data.totals.variance_pct}% {overBudget ? 'over budget' : 'under budget'}
          </p>
        </div>
      </div>

      {/* Visual budget bar */}
      {data.totals.estimated > 0 && (
        <div className="bg-background border border-border rounded-xl p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Budget utilisation</span>
            <span>{Math.min(999, Math.round((data.totals.actual / data.totals.estimated) * 100))}%</span>
          </div>
          <div className="h-3 bg-border rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-400' : 'bg-emerald-400')}
              style={{ width: `${Math.min(100, (data.totals.actual / data.totals.estimated) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Items breakdown */}
      {data.items.length > 0 && (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Act. Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rate</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Act. Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Var.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map(item => (
                  <tr key={item.item_id} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[180px]">{item.name}</p>
                      {item.category && <p className="text-muted-foreground mt-0.5">{item.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.estimated_quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right">{item.actual_quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.cost_per_unit > 0 ? `₹${item.cost_per_unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.estimated_cost > 0 ? `₹${item.estimated_cost.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.actual_cost > 0 ? `₹${item.actual_cost.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.variance === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn('flex items-center justify-end gap-0.5', item.variance > 0 ? 'text-red-400' : 'text-emerald-400')}>
                          {item.variance > 0 ? '+' : ''}₹{Math.abs(item.variance).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-card/50">
                  <td className="px-4 py-3 font-semibold text-sm" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{data.totals.estimated.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{data.totals.actual.toLocaleString('en-IN')}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', data.totals.variance > 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {data.totals.variance > 0 ? '+' : ''}₹{Math.abs(data.totals.variance).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
