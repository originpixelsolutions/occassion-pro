'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Ticket, ScanLine, UtensilsCrossed, Loader2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardData {
  token_stats: {
    total_tokens: number
    tokens_issued: number
    tokens_redeemed: number
    tokens_unissued: number
    total_batches: number
    redemption_rate: number
  }
  top_items: Array<{ item_id: string; name: string; category: string; total: number }>
  station_breakdown: Record<string, number>
  active_stations: number
  total_servings: number
  batches: Array<{ id: string; batch_name: string; total_tokens: number; tokens_issued: number; tokens_redeemed: number }>
}

export function FnbDashboardWidgets({ eventId }: { eventId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<DashboardData>(`/fnb/events/${eventId}/dashboard`)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [eventId])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No F&B data available.</p>

  const { token_stats, top_items, station_breakdown, active_stations, total_servings } = data

  return (
    <div className="space-y-6">
      {/* Token KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Tokens',  value: token_stats.total_tokens,    color: 'text-zinc-300' },
          { label: 'Issued',        value: token_stats.tokens_issued,   color: 'text-blue-400' },
          { label: 'Redeemed',      value: token_stats.tokens_redeemed, color: 'text-emerald-400' },
          { label: 'Unissued',      value: token_stats.tokens_unissued, color: 'text-zinc-500' },
          { label: 'Redemption %',  value: `${token_stats.redemption_rate}%`, color: 'text-violet-400' },
          { label: 'Total Servings',value: total_servings,              color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-background border border-border rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Items */}
        <div className="bg-background border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold">Top Consumed Items</h3>
          </div>
          {top_items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No consumption logged yet</p>
          ) : (
            <div className="space-y-2">
              {top_items.slice(0, 8).map((item, i) => {
                const max = top_items[0]?.total ?? 1
                return (
                  <div key={item.item_id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{item.total}</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all"
                          style={{ width: `${(item.total / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Station Breakdown */}
        <div className="bg-background border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <UtensilsCrossed className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">Station Breakdown</h3>
            <span className="ml-auto text-xs text-muted-foreground">{active_stations} active</span>
          </div>
          {Object.keys(station_breakdown).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No station data yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(station_breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([station, count]) => {
                  const max = Math.max(...Object.values(station_breakdown))
                  return (
                    <div key={station} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium truncate">{station}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">{count} servings</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Batch summary */}
      {data.batches.length > 0 && (
        <div className="bg-background border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Ticket className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Token Batches</h3>
          </div>
          <div className="space-y-2">
            {data.batches.map(batch => {
              const issuedPct = batch.total_tokens > 0 ? (batch.tokens_issued / batch.total_tokens) * 100 : 0
              const redeemedPct = batch.tokens_issued > 0 ? (batch.tokens_redeemed / batch.tokens_issued) * 100 : 0
              return (
                <div key={batch.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{batch.batch_name}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{batch.total_tokens} total</span>
                      <span className="text-xs text-blue-400">{batch.tokens_issued} issued</span>
                      <span className="text-xs text-emerald-400">{batch.tokens_redeemed} redeemed</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{Math.round(redeemedPct)}% redeemed</p>
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
