'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

interface Analytics {
  signupTrend: Record<string, number>
  revenueByMonth: Record<string, number>
  planCounts: Record<string, number>
  eventsByType: Record<string, number>
  topTenants: Array<{ name: string; events: number; revenue: number }>
}

function BarChartSimple({ data, color = '#7c3aed' }: { data: Record<string, number>; color?: string }) {
  const entries = Object.entries(data).slice(-12)
  if (!entries.length) return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="flex items-end gap-1 h-24">
      {entries.map(([k, v]) => (
        <div key={k} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-sm transition-all hover:opacity-90"
            style={{ height: `${(v / max) * 88}px`, background: color, minHeight: v > 0 ? '2px' : '0' }}
          />
          <span className="text-[8px] text-zinc-600 rotate-45 origin-left whitespace-nowrap hidden group-hover:block absolute -bottom-4 text-[9px] text-muted-foreground">
            {k.slice(-5)} {v}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtCurrency(n: number) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes] = await Promise.all([
        fetch(`${API}/super-admin/overview`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ])
      if (ovRes.ok) {
        const ov = await ovRes.json()
        setData({
          signupTrend:    ov.signupTrend ?? {},
          revenueByMonth: ov.revenueByMonth ?? {},
          planCounts:     ov.summary?.planCounts ?? {},
          eventsByType:   ov.eventsByType ?? {},
          topTenants:     ov.topTenants ?? [],
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Analytics & Monitoring</h1>
          </div>
          <p className="text-sm text-muted-foreground">Platform-wide metrics and growth</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-card/30 border border-border/30 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-foreground">Tenant Signups</h2>
              </div>
              <BarChartSimple data={data?.signupTrend ?? {}} color="#7c3aed" />
              <div className="flex justify-between mt-3">
                {Object.entries(data?.signupTrend ?? {}).slice(-6).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{k.slice(-5)}</p>
                    <p className="text-xs font-semibold text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-foreground">Revenue by Month</h2>
              </div>
              <BarChartSimple data={data?.revenueByMonth ?? {}} color="#10b981" />
              <div className="flex justify-between mt-3">
                {Object.entries(data?.revenueByMonth ?? {}).slice(-6).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{k.slice(-5)}</p>
                    <p className="text-xs font-semibold text-foreground">{fmtCurrency(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Plan Distribution + Top Tenants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Plan Distribution</h2>
              {data?.planCounts && Object.entries(data.planCounts).length ? (
                <div className="space-y-2.5">
                  {Object.entries(data.planCounts).map(([plan, count]) => {
                    const total = Object.values(data.planCounts).reduce((a, b) => a + b, 0)
                    const pct = total ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="capitalize text-muted-foreground">{plan}</span>
                          <span className="font-semibold text-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-border/50 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </div>

            <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Top Tenants by Events</h2>
              {data?.topTenants?.length ? (
                <div className="space-y-2">
                  {data.topTenants.slice(0, 8).map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                        <span className="text-foreground font-medium">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{t.events} events</span>
                        <span className="text-foreground font-semibold">{fmtCurrency(t.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
