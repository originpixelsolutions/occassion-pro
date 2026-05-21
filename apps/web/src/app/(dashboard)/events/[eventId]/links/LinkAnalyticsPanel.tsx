'use client'

import { useState, useEffect } from 'react'
import {
  X,
  BarChart2,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  TrendingUp,
  MousePointerClick,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShortLink {
  id: string
  code: string
  short_url: string
  destination_url: string
  link_type: string
  title: string | null
  total_clicks: number
  unique_clicks: number
}

interface AnalyticsData {
  total_clicks: number
  unique_clicks: number
  daily_clicks: Array<{ date: string; count: number }>
  device_breakdown: Array<{ device: string; count: number }>
  hourly_breakdown: Array<{ hour: number; count: number }>
}

interface Props {
  link: ShortLink
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DeviceIcon({ device }: { device: string }) {
  const cls = 'w-4 h-4'
  if (device === 'mobile') return <Smartphone className={cls} />
  if (device === 'tablet') return <Tablet className={cls} />
  return <Monitor className={cls} />
}

function MiniBarChart({ data, maxVal, color }: { data: number[]; maxVal: number; color: string }) {
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color} opacity-80`}
          style={{ height: maxVal > 0 ? `${Math.max(2, (v / maxVal) * 100)}%` : '2%' }}
          title={`${v}`}
        />
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LinkAnalyticsPanel({ link, onClose }: Props) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'daily' | 'hourly'>('daily')

  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/short-links/${link.id}/analytics`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [link.id, apiBase])

  // Derived chart data
  const dailyValues = (analytics?.daily_clicks || []).map(d => d.count)
  const dailyLabels = (analytics?.daily_clicks || []).map(d =>
    new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  )
  const hourlyValues = Array.from({ length: 24 }, (_, h) => {
    const match = analytics?.hourly_breakdown?.find(r => Number(r.hour) === h)
    return match ? match.count : 0
  })
  const maxDaily = Math.max(...dailyValues, 1)
  const maxHourly = Math.max(...hourlyValues, 1)

  const totalDeviceClicks = (analytics?.device_breakdown || []).reduce(
    (s, d) => s + d.count,
    0,
  ) || 1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0f0f1a] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {link.title || link.code}
              </h2>
              <a
                href={link.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                {link.short_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading analytics…
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white/40 text-xs mb-1.5">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Total Clicks
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(analytics?.total_clicks ?? link.total_clicks ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white/40 text-xs mb-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Unique
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(analytics?.unique_clicks ?? link.unique_clicks ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Chart tabs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Click Trend
                  </h3>
                  <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                    {(['daily', 'hourly'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          tab === t
                            ? 'bg-violet-600 text-white'
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {t === 'daily' ? 'Daily' : 'By Hour'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
                  {tab === 'daily' ? (
                    dailyValues.length === 0 ? (
                      <div className="text-center py-6 text-white/20 text-sm">
                        No click data yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <MiniBarChart
                          data={dailyValues}
                          maxVal={maxDaily}
                          color="bg-violet-500"
                        />
                        {/* X-axis labels — show every ~7th */}
                        <div className="flex justify-between text-xs text-white/20 px-0.5">
                          <span>{dailyLabels[0] || ''}</span>
                          <span>{dailyLabels[Math.floor(dailyLabels.length / 2)] || ''}</span>
                          <span>{dailyLabels[dailyLabels.length - 1] || ''}</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <MiniBarChart
                        data={hourlyValues}
                        maxVal={maxHourly}
                        color="bg-cyan-500"
                      />
                      <div className="flex justify-between text-xs text-white/20 px-0.5">
                        <span>12 AM</span>
                        <span>6 AM</span>
                        <span>12 PM</span>
                        <span>6 PM</span>
                        <span>11 PM</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Device breakdown */}
              <div>
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Device Breakdown
                </h3>
                {(analytics?.device_breakdown || []).length === 0 ? (
                  <div className="text-center py-4 text-white/20 text-sm bg-white/[0.02] rounded-xl border border-white/[0.05]">
                    No data yet
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(analytics?.device_breakdown || []).map(({ device, count }) => {
                      const pct = Math.round((count / totalDeviceClicks) * 100)
                      return (
                        <div key={device} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-white/70">
                              <DeviceIcon device={device} />
                              <span className="capitalize">{device}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/40 text-xs">{count.toLocaleString()}</span>
                              <span className="text-white font-medium text-xs w-8 text-right">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Destination URL */}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 space-y-1">
                <div className="text-xs text-white/30 uppercase tracking-wider">Destination</div>
                <a
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-400 hover:text-cyan-300 break-all flex items-start gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {link.destination_url}
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
