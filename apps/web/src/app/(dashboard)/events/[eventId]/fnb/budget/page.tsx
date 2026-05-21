'use client'
import { use, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import { BarChart3, TrendingUp, UtensilsCrossed, Wine } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const CATEGORY_COLORS: Record<string, string> = {
  starter: 'bg-blue-500', main: 'bg-orange-500', dessert: 'bg-pink-500',
  beverage: 'bg-purple-500', salad: 'bg-green-500', soup: 'bg-rose-500',
  bread: 'bg-amber-500', snack: 'bg-yellow-500', 'live-station': 'bg-cyan-500', side: 'bg-indigo-500',
}

export default function FnbBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [budget, setBudget] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token || !tenantId) return
    fetch(`${API}/fnb/events/${eventId}/budget`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then(setBudget)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [eventId, session, tenantId])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl" />)}
    </div>
  )

  const totals = budget?.totals ?? { food: 0, beverages: 0, grand_total: 0 }
  const menus: any[] = budget?.menu_breakdown ?? []
  const beverages: any[] = budget?.beverages ?? []

  const maxMenuCost = Math.max(...menus.map(m => Number(m.total_food_cost ?? 0)), 1)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-bold">F&B Budget Breakdown</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400" />
            <p className="text-xs text-muted-foreground">Food Cost</p>
          </div>
          <p className="text-xl font-bold text-orange-400 tabular-nums">{formatCurrency(totals.food)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Wine className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-xs text-muted-foreground">Beverage Cost</p>
          </div>
          <p className="text-xl font-bold text-purple-400 tabular-nums">{formatCurrency(totals.beverages)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <p className="text-xs text-muted-foreground">Grand Total</p>
          </div>
          <p className="text-xl font-bold text-cyan-400 tabular-nums">{formatCurrency(totals.grand_total)}</p>
        </div>
      </div>

      {/* Per-menu breakdown */}
      {menus.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Cost by Menu Session</h3>
          <div className="space-y-4">
            {menus.map(menu => {
              const cost = Number(menu.total_food_cost ?? 0)
              const pct = maxMenuCost > 0 ? (cost / maxMenuCost) * 100 : 0
              const categories = menu.by_category ?? {}
              const categoryEntries = Object.entries(categories).sort(([, a], [, b]) => Number(b) - Number(a))

              return (
                <div key={menu.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium">{menu.name}</span>
                      <span className="text-xs text-muted-foreground ml-2 capitalize">{menu.meal_type?.replace(/-/g, ' ')}</span>
                      {menu.pax_count && <span className="text-xs text-muted-foreground ml-2">· {menu.pax_count} pax</span>}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(cost)}</span>
                  </div>
                  {/* Bar */}
                  <div className="h-2 bg-background rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-orange-500/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Category breakdown */}
                  {categoryEntries.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {categoryEntries.map(([cat, catCost]) => (
                        <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[cat] ?? 'bg-zinc-500')} />
                          <span className="capitalize">{cat}</span>
                          <span className="tabular-nums">{formatCurrency(Number(catCost))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Beverage breakdown */}
      {beverages.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Beverage Packages</h3>
          <div className="space-y-3">
            {beverages.map((bev, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{bev.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{bev.type?.replace(/-/g, ' ')}</p>
                </div>
                <div className="text-right">
                  {bev.price_per_pax && <p className="text-xs text-muted-foreground">{formatCurrency(bev.price_per_pax)}/pax</p>}
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(bev.total_cost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {menus.length === 0 && beverages.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No F&B costs yet</p>
          <p className="text-sm text-muted-foreground">Add menu items with unit costs to see a full budget breakdown</p>
        </div>
      )}
    </div>
  )
}
