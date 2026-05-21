'use client'
import { use, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Zap, UtensilsCrossed, Wine, ChefHat, FlaskConical, Leaf,
  Package, TrendingUp, Download, CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const MENU_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400',
  submitted_to_vendor: 'bg-blue-500/10 text-blue-400',
  vendor_confirmed: 'bg-amber-500/10 text-amber-400',
  finalised: 'bg-emerald-500/10 text-emerald-400',
}

export default function FnbReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [overview, setOverview] = useState<any>(null)
  const [budget, setBudget] = useState<any>(null)
  const [wastage, setWastage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token || !tenantId) return
    const h = { Authorization: `Bearer ${session.access_token}`, 'x-tenant-id': tenantId }
    Promise.all([
      fetch(`${API}/fnb/events/${eventId}/overview`, { headers: h }).then(r => r.json()),
      fetch(`${API}/fnb/events/${eventId}/budget`, { headers: h }).then(r => r.json()),
      fetch(`${API}/fnb/events/${eventId}/wastage`, { headers: h }).then(r => r.json()),
    ]).then(([ov, bud, was]) => {
      setOverview(ov)
      setBudget(bud)
      setWastage(was)
    }).catch(console.error).finally(() => setLoading(false))
  }, [eventId, session, tenantId])

  const printReport = () => {
    window.print()
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl" />)}
    </div>
  )

  const stats = overview?.stats ?? {}
  const dietary = overview?.dietary ?? {}
  const totals = budget?.totals ?? { food: 0, beverages: 0, grand_total: 0 }
  const wastageSum = wastage?.summary ?? {}

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold">F&B Full Report</h2>
        </div>
        <button
          onClick={printReport}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Print / Export
        </button>
      </div>

      {/* Executive Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Executive Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total F&B Cost', value: formatCurrency(totals.grand_total), color: 'text-cyan-400' },
            { label: 'Food Cost', value: formatCurrency(totals.food), color: 'text-orange-400' },
            { label: 'Beverages', value: formatCurrency(totals.beverages), color: 'text-purple-400' },
            { label: 'Menu Sessions', value: `${stats.confirmed_menus ?? 0}/${stats.total_menus ?? 0} finalised`, color: 'text-emerald-400' },
            { label: 'Stations', value: stats.total_stations ?? 0, color: 'text-blue-400' },
            { label: 'Staff Needed', value: stats.total_staff_needed ?? 0, color: 'text-indigo-400' },
            { label: 'Pending Tastings', value: stats.pending_tasting ?? 0, color: 'text-amber-400' },
            { label: 'Avg Wastage', value: wastageSum.avg_wastage_pct != null ? `${wastageSum.avg_wastage_pct}%` : 'N/A', color: 'text-rose-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center bg-background rounded-lg p-3 border border-border">
              <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu Sessions */}
      {(overview?.menus ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-sm">Menu Sessions</h3>
          </div>
          <div className="divide-y divide-border">
            {overview.menus.map((menu: any) => (
              <div key={menu.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{menu.name}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', MENU_STATUS_COLORS[menu.status] ?? MENU_STATUS_COLORS.draft)}>
                      {menu.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{menu.meal_type?.replace(/-/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">{menu.service_style}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {menu.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {menu.start_time}{menu.end_time && `–${menu.end_time}`}</span>}
                    {menu.pax_count && <span>{menu.pax_count} pax</span>}
                  </div>
                </div>
                {menu.total_food_cost > 0 && (
                  <span className="font-semibold tabular-nums text-sm">{formatCurrency(menu.total_food_cost)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dietary */}
      {dietary.total_guests > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm">Dietary Requirements</h3>
            <span className="text-xs text-muted-foreground ml-auto">{dietary.total_guests} confirmed guests</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {[
              { label: 'Veg', value: dietary.veg_count, color: 'text-emerald-400' },
              { label: 'Vegan', value: dietary.vegan_count, color: 'text-green-400' },
              { label: 'Jain', value: dietary.jain_count, color: 'text-lime-400' },
              { label: 'Halal', value: dietary.halal_count, color: 'text-amber-400' },
              { label: 'Non-Veg', value: dietary.non_veg_count, color: 'text-rose-400' },
              { label: 'Gluten-Free', value: dietary.gluten_free_count, color: 'text-blue-400' },
              { label: 'Allergies', value: dietary.has_allergies_count, color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-background rounded-lg p-2 border border-border">
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {(dietary.all_allergens ?? []).length > 0 && (
            <div className="mt-3 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Allergens present: {dietary.all_allergens.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Beverages */}
      {(overview?.beverages ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wine className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold text-sm">Beverage Packages</h3>
          </div>
          <div className="space-y-2">
            {overview.beverages.map((bev: any) => (
              <div key={bev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{bev.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{bev.type?.replace(/-/g, ' ')}</p>
                </div>
                {bev.total_cost > 0 && <p className="text-sm font-semibold tabular-nums">{formatCurrency(bev.total_cost)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stations */}
      {(overview?.stations ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChefHat className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Service Stations ({overview.stations.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {overview.stations.map((s: any) => (
              <div key={s.id} className="px-3 py-2 bg-background rounded-lg border border-border text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2 capitalize">{s.station_type}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.assigned_staff_count} staff</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasting */}
      {(overview?.tasting ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Tasting Sessions</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['scheduled','completed','cancelled','rescheduled'] as const).map(status => {
              const count = overview.tasting.filter((t: any) => t.status === status).length
              return (
                <div key={status} className="text-center bg-background rounded-lg p-3 border border-border">
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{status}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Wastage */}
      {(wastage?.items ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-sm">Consumption & Wastage Report</h3>
            <span className="text-xs text-muted-foreground ml-auto">Avg: {wastageSum.avg_wastage_pct}%</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background/50 border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Planned</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Consumed</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Wastage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wastage.items.slice(0, 10).map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-sm">{item.item_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{item.planned_quantity ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{item.actual_quantity_consumed ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={cn('font-semibold tabular-nums',
                      Number(item.wastage_pct) > 25 ? 'text-rose-400' :
                      Number(item.wastage_pct) > 10 ? 'text-amber-400' : 'text-emerald-400')}>
                      {item.wastage_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
