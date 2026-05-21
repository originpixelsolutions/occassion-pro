'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { BarChart2, Loader2, TrendingUp, TrendingDown, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReportItem {
  item_id: string
  name: string
  category?: string
  dietary_type: string
  unit: string
  estimated_quantity: number
  total_served: number
  variance: number
  variance_pct: number | null
  total_cost: number
  cost_per_unit: number
}

interface StationBreakdown {
  [station: string]: { [itemId: string]: number }
}

interface ConsumptionData {
  items: ReportItem[]
  station_breakdown: StationBreakdown
  totals: { total_items: number; total_served: number; total_cost: number }
}

const DIETARY_COLORS: Record<string, string> = {
  veg: 'bg-green-500/20 text-green-400',
  non_veg: 'bg-red-500/20 text-red-400',
  vegan: 'bg-emerald-500/20 text-emerald-400',
  jain: 'bg-yellow-500/20 text-yellow-400',
  gluten_free: 'bg-blue-500/20 text-blue-400',
  dairy_free: 'bg-purple-500/20 text-purple-400',
}

export function ConsumptionReport({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ConsumptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'served' | 'variance' | 'cost'>('served')

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api.get<ConsumptionData>(`/fnb/events/${eventId}/reports/consumption`).catch(() => null)
    setData(d)
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  const exportCsv = () => {
    if (!data) return
    const rows = [
      'item,category,dietary,estimated,served,variance,variance_pct,cost_per_unit,total_cost',
      ...data.items.map(r =>
        `"${r.name}","${r.category ?? ''}",${r.dietary_type},${r.estimated_quantity},${r.total_served},${r.variance},${r.variance_pct ?? ''},${r.cost_per_unit},${r.total_cost}`
      ),
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'consumption_report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No consumption data available.</p>

  const sorted = [...data.items].sort((a, b) => {
    if (sortBy === 'served')   return b.total_served - a.total_served
    if (sortBy === 'variance') return Math.abs(b.variance) - Math.abs(a.variance)
    return b.total_cost - a.total_cost
  })

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {(['served', 'variance', 'cost'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors capitalize',
                sortBy === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'served' ? 'By Served' : s === 'variance' ? 'By Variance' : 'By Cost'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="p-1.5 border border-border rounded-lg hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{data.totals.total_served}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Served</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{data.totals.total_items}</p>
          <p className="text-xs text-muted-foreground mt-1">Menu Items</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">₹{data.totals.total_cost.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
        </div>
      </div>

      {/* Items table */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <BarChart2 className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No consumption logged yet.</p>
        </div>
      ) : (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Served</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Variance</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(item => (
                  <tr key={item.item_id} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[180px]">{item.name}</p>
                      <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-0.5', DIETARY_COLORS[item.dietary_type] ?? 'bg-zinc-500/20 text-zinc-400')}>
                        {item.dietary_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.estimated_quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.total_served} {item.unit}</td>
                    <td className="px-4 py-3 text-right">
                      {item.variance === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn('flex items-center justify-end gap-1', item.variance > 0 ? 'text-red-400' : 'text-emerald-400')}>
                          {item.variance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {item.variance > 0 ? '+' : ''}{item.variance}
                          {item.variance_pct != null && ` (${item.variance_pct > 0 ? '+' : ''}${item.variance_pct}%)`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.total_cost > 0 ? `₹${item.total_cost.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station breakdown */}
      {Object.keys(data.station_breakdown).length > 0 && (
        <div className="bg-background border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">By Station</h3>
          <div className="space-y-3">
            {Object.entries(data.station_breakdown).map(([station, items]) => {
              const total = Object.values(items).reduce((s, n) => s + n, 0)
              return (
                <div key={station} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-32 truncate">{station}</span>
                  <div className="flex-1 h-5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400/60 rounded-full flex items-center justify-end pr-2"
                         style={{ width: `${Math.min(100, (total / data.totals.total_served) * 100)}%` }}>
                      <span className="text-[10px] text-white font-medium">{total}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
