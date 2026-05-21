'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Download, RefreshCw,
  Users, Wallet, BarChart3, Activity,
  Target, ChevronDown, ChevronUp, ArrowUpRight, Layers,
  Sparkles, Lock, DollarSign, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useApiClient } from '@/hooks/use-api-client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CrossEventKPIs {
  totalEvents: number; totalRevenue: number; totalExpenses: number
  grossProfit: number; marginPercent: number; totalGuests: number
  checkedIn: number; confirmationRate: number; checkInRate: number
  taskCompletionRate: number; avgRevenuePerEvent: number; avgGuestsPerEvent: number
}
interface CrossEventSummary {
  kpis: CrossEventKPIs
  eventsByType: Record<string, number>
  eventsByStatus: Record<string, number>
}
interface VendorSpend {
  totalVendorSpend: number; totalExpenseSpend: number
  vendorByServiceType: Array<{ serviceType: string; total: number; count: number }>
  expenseByCategory: Array<{ category: string; amount: number }>
}
interface GuestHeadcount {
  monthly: Array<{ month: string; invited: number; confirmed: number; checkedIn: number }>
  yoyComparison: Array<{ month: string; thisYear: number; lastYear: number }>
}
interface EventTypeRow {
  eventType: string; count: number; totalRevenue: number; totalGuests: number
  avgRevenue: number; avgGuests: number
}
interface EventRow {
  id: string; name: string; eventType: string; status: string; startDate: string
  expectedGuests: number; actualGuests: number; revenue: number; expenses: number
  profit: number; margin: number; taskCompletion: number; guestAttendance: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type Preset = 'this_year' | 'last_year' | 'this_quarter' | 'last_6_months' | 'custom'

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  switch (preset) {
    case 'this_year': return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) }
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'this_quarter': {
      const qs = Math.floor(m / 3) * 3
      return { from: new Date(y, qs, 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
    }
    case 'last_6_months': return { from: new Date(y, m - 5, 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
    default: return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) }
  }
}

const fmt = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000  ? `₹${(n / 1_00_000).toFixed(1)}L`
  : n >= 1_000     ? `₹${(n / 1_000).toFixed(1)}K`
  : `₹${n}`

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── SVG Charts ─────────────────────────────────────────────────────────────────

function SparkLine({ data, color = '#8B5CF6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1); const min = Math.min(...data, 0); const range = max - min || 1
  const W = 120; const H = 32
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-8"><polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} /></svg>
}

function HorizBar({ label, value, max, color = '#8B5CF6', suffix }: {
  label: string; value: number; max: number; color?: string; suffix?: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-zinc-400 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-24 text-xs text-zinc-200 text-right shrink-0">{suffix ?? fmt(value)}</span>
    </div>
  )
}

function MultiLineChart({ data, keys }: {
  data: Array<Record<string, any>>
  keys: Array<{ key: string; color: string; label: string }>
}) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No data</div>
  const W = 700; const H = 120; const PAD = 8
  const allVals = data.flatMap(d => keys.map(k => Number(d[k.key] ?? 0)))
  const max = Math.max(...allVals, 1)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full min-w-[400px] h-44">
        {[0, 0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={PAD} y1={H - f * H} x2={W - PAD} y2={H - f * H} stroke="#27272a" strokeWidth="1" />)}
        {keys.map(({ key, color }) => {
          if (data.length < 2) return null
          const pts = data.map((d, i) => `${PAD + (i / (data.length - 1)) * (W - PAD * 2)},${H - (Number(d[key] ?? 0) / max) * H}`).join(' ')
          return <polyline key={key} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
        })}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 8) !== 0) return null
          const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
          const mo = String(d.month ?? '').slice(5, 7)
          return <text key={i} x={x} y={H + 14} textAnchor="middle" fontSize="9" fill="#71717a">{mo ? (MO[parseInt(mo, 10) - 1] ?? mo) : d.month}</text>
        })}
      </svg>
      <div className="flex flex-wrap gap-4 mt-1">
        {keys.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded" style={{ background: color }} />
            <span className="text-xs text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupedBarChart({ data }: { data: Array<{ month: string; thisYear: number; lastYear: number }> }) {
  if (!data.length) return null
  const max = Math.max(...data.flatMap(d => [d.thisYear, d.lastYear]), 1)
  const W = 700; const H = 100; const PAD = 10
  const slotW = (W - PAD * 2) / data.length
  const bw = Math.min(slotW * 0.35, 14); const gap = Math.min(slotW * 0.06, 3)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full min-w-[400px] h-32">
        {[0, 0.5, 1].map(f => <line key={f} x1={PAD} y1={H - f * H} x2={W - PAD} y2={H - f * H} stroke="#27272a" strokeWidth="1" />)}
        {data.map((d, i) => {
          const cx = PAD + (i + 0.5) * slotW
          return (
            <g key={d.month}>
              <rect x={cx - bw - gap} y={H - (d.lastYear / max) * H} width={bw} height={(d.lastYear / max) * H} fill="#3f3f46" rx="2" />
              <rect x={cx + gap} y={H - (d.thisYear / max) * H} width={bw} height={(d.thisYear / max) * H} fill="#8B5CF6" rx="2" />
              <text x={cx} y={H + 14} textAnchor="middle" fontSize="8" fill="#71717a">{MO[parseInt(d.month, 10) - 1]}</text>
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 mt-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-zinc-600" /><span className="text-xs text-zinc-400">Last Year</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-violet-500" /><span className="text-xs text-zinc-400">This Year</span></div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = 'violet', sparkData }: {
  label: string; value: string; sub?: string
  icon: React.ComponentType<{ className?: string }>
  color?: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose'
  sparkData?: number[]
}) {
  const ic = { violet: 'text-violet-400 bg-violet-500/10', emerald: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10', sky: 'text-sky-400 bg-sky-500/10', rose: 'text-rose-400 bg-rose-500/10' }[color]
  const sc = { violet: '#8B5CF6', emerald: '#10b981', amber: '#f59e0b', sky: '#0ea5e9', rose: '#f43f5e' }[color]
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', ic)}><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <div className="flex items-end justify-between">
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
        {sparkData && sparkData.length >= 2 && <SparkLine data={sparkData} color={sc} />}
      </div>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div><h3 className="font-semibold text-zinc-100">{title}</h3>{subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Event Table ────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'revenue' | 'expenses' | 'profit' | 'margin' | 'taskCompletion' | 'actualGuests'

function EventTable({ rows }: { rows: EventRow[] }) {
  const [sk, setSk] = useState<SortKey>('revenue')
  const [sd, setSd] = useState<'asc' | 'desc'>('desc')
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const va = a[sk] as any; const vb = b[sk] as any
    if (typeof va === 'string') return sd === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sd === 'asc' ? va - vb : vb - va
  }), [rows, sk, sd])
  const toggle = (key: SortKey) => { if (sk === key) setSd(d => d === 'asc' ? 'desc' : 'asc'); else { setSk(key); setSd('desc') } }
  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <th onClick={() => toggle(k)} className="text-left text-xs text-zinc-500 uppercase tracking-wider pb-3 pr-4 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap">
      <div className="flex items-center gap-1">{label}{sk === k ? (sd === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}</div>
    </th>
  )
  const sc = (s: string) => ({ active: 'text-emerald-400 bg-emerald-500/10', completed: 'text-sky-400 bg-sky-500/10', planning: 'text-amber-400 bg-amber-500/10', cancelled: 'text-rose-400 bg-rose-500/10' }[s] ?? 'text-zinc-400 bg-zinc-700')
  if (!sorted.length) return <p className="text-sm text-zinc-500 py-4">No events in this range.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead><tr><Th label="Event" k="name" /><th className="text-left text-xs text-zinc-500 uppercase tracking-wider pb-3 pr-4">Status</th><Th label="Revenue" k="revenue" /><Th label="Expenses" k="expenses" /><Th label="Profit" k="profit" /><Th label="Margin" k="margin" /><Th label="Guests" k="actualGuests" /><Th label="Tasks %" k="taskCompletion" /></tr></thead>
        <tbody className="divide-y divide-zinc-800">
          {sorted.map(row => (
            <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
              <td className="py-3 pr-4"><div><p className="text-sm text-zinc-200 font-medium">{row.name}</p><p className="text-xs text-zinc-500">{row.eventType} · {row.startDate?.slice(0, 10)}</p></div></td>
              <td className="py-3 pr-4"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc(row.status))}>{row.status}</span></td>
              <td className="py-3 pr-4 text-sm text-zinc-200">{fmt(row.revenue)}</td>
              <td className="py-3 pr-4 text-sm text-zinc-400">{fmt(row.expenses)}</td>
              <td className={cn('py-3 pr-4 text-sm font-medium', row.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{row.profit >= 0 ? '+' : ''}{fmt(row.profit)}</td>
              <td className="py-3 pr-4"><div className="flex items-center gap-1.5"><div className="w-16 bg-zinc-800 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(row.margin, 100)}%` }} /></div><span className="text-xs text-zinc-400">{row.margin}%</span></div></td>
              <td className="py-3 pr-4 text-sm text-zinc-300">{row.actualGuests}<span className="text-xs text-zinc-600 ml-1">/ {row.expectedGuests}</span></td>
              <td className="py-3 pr-4"><div className="flex items-center gap-1.5"><div className="w-14 bg-zinc-800 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.taskCompletion}%` }} /></div><span className="text-xs text-zinc-400">{row.taskCompletion}%</span></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'This Year',    value: 'this_year'     },
  { label: 'This Quarter', value: 'this_quarter'  },
  { label: 'Last 6 Mo',   value: 'last_6_months' },
  { label: 'Last Year',   value: 'last_year'     },
  { label: 'Custom',      value: 'custom'        },
]

export default function AnalyticsDashboardPage() {
  const api = useApiClient()

  const [preset, setPreset] = useState<Preset>('this_year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [summary, setSummary] = useState<CrossEventSummary | null>(null)
  const [vendorSpend, setVendorSpend] = useState<VendorSpend | null>(null)
  const [headcount, setHeadcount] = useState<GuestHeadcount | null>(null)
  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([])
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])
  const [eventPerf, setEventPerf] = useState<EventRow[]>([])

  const { from, to } = useMemo(() => {
    if (preset === 'custom') {
      const now = new Date().toISOString().slice(0, 10)
      return { from: customFrom || now, to: customTo || now }
    }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, v, h, et, rt, ep] = await Promise.allSettled([
        api.get(`/analytics/cross-event?from=${from}&to=${to}`),
        api.get(`/analytics/vendor-spend?from=${from}&to=${to}`),
        api.get(`/analytics/guest-headcount?months=24`),
        api.get(`/analytics/event-types?from=${from}&to=${to}`),
        api.get(`/analytics/revenue-trends?months=12`),
        api.get(`/analytics/event-performance?limit=50`),
      ])
      if (s.status === 'fulfilled') setSummary(s.value as CrossEventSummary)
      if (v.status === 'fulfilled') setVendorSpend(v.value as VendorSpend)
      if (h.status === 'fulfilled') setHeadcount(h.value as GuestHeadcount)
      if (et.status === 'fulfilled') setEventTypes((et.value as any[]) ?? [])
      if (rt.status === 'fulfilled') setRevenueTrend((rt.value as any[]) ?? [])
      if (ep.status === 'fulfilled') setEventPerf((ep.value as any[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [api, from, to])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.getRaw(`/analytics/csv-export?from=${from}&to=${to}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${from}-to-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* non-fatal */ } finally { setExporting(false) }
  }

  const kpis = summary?.kpis
  const revSparkData = revenueTrend.map((r: any) => r.revenue ?? 0)

  // Vendor spend max for HorizBar
  const vendorMax = Math.max(...(vendorSpend?.vendorByServiceType.map(v => v.total) ?? [1]))
  const expMax    = Math.max(...(vendorSpend?.expenseByCategory.map(e => e.amount) ?? [1]))
  const etMax     = Math.max(...eventTypes.map(e => e.totalRevenue), 1)

  // Status/type breakdown colors
  const STATUS_COLORS: Record<string, string> = { active: '#10b981', completed: '#0ea5e9', planning: '#f59e0b', cancelled: '#f43f5e' }
  const TYPE_PALETTE = ['#8B5CF6','#06b6d4','#f59e0b','#10b981','#f43f5e','#3b82f6','#ec4899','#84cc16']

  const statusEntries = Object.entries(summary?.eventsByStatus ?? {})
  const statusMax = Math.max(...statusEntries.map(([, v]) => v), 1)
  const typeEntries = Object.entries(summary?.eventsByType ?? {})
  const typeMax = Math.max(...typeEntries.map(([, v]) => v), 1)

  return (
    <div className="flex-1 overflow-auto bg-zinc-950 min-h-screen text-zinc-100">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Business Intelligence</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Cross-event analytics · {from} → {to}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Period Presets ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  preset === p.value
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
              />
              <span className="text-xs text-zinc-600">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
          {loading && (
            <span className="text-xs text-zinc-600 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
            </span>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label="Total Revenue" icon={Wallet} color="violet"
            value={kpis ? fmt(kpis.totalRevenue) : '—'}
            sub={kpis ? `${kpis.totalEvents} events` : undefined}
            sparkData={revSparkData}
          />
          <KpiCard
            label="Gross Profit" icon={TrendingUp} color="emerald"
            value={kpis ? fmt(kpis.grossProfit) : '—'}
            sub={kpis ? `${kpis.marginPercent}% margin` : undefined}
          />
          <KpiCard
            label="Total Guests" icon={Users} color="sky"
            value={kpis ? kpis.totalGuests.toLocaleString() : '—'}
            sub={kpis ? `${kpis.checkInRate}% check-in` : undefined}
          />
          <KpiCard
            label="Avg Rev / Event" icon={BarChart3} color="amber"
            value={kpis ? fmt(kpis.avgRevenuePerEvent) : '—'}
            sub={kpis ? `~${Math.round(kpis.avgGuestsPerEvent)} guests/event` : undefined}
          />
          <KpiCard
            label="Task Completion" icon={Target} color="rose"
            value={kpis ? `${kpis.taskCompletionRate}%` : '—'}
            sub={kpis ? `${kpis.confirmationRate}% RSVP confirmed` : undefined}
          />
        </div>

        {/* ── Revenue Trend + Guest Headcount ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Section title="Revenue Trend" subtitle="Monthly revenue, expenses & profit">
            <MultiLineChart
              data={revenueTrend}
              keys={[
                { key: 'revenue',  color: '#8B5CF6', label: 'Revenue'  },
                { key: 'expenses', color: '#f43f5e', label: 'Expenses' },
                { key: 'profit',   color: '#10b981', label: 'Profit'   },
              ]}
            />
          </Section>

          <Section title="Guest Headcount YoY" subtitle="This year vs last year by month">
            {headcount?.yoyComparison?.length ? (
              <GroupedBarChart data={headcount.yoyComparison} />
            ) : (
              <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No data</div>
            )}
          </Section>
        </div>

        {/* ── Vendor Spend + Top Event Types ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Section title="Vendor Spend by Category" subtitle={vendorSpend ? `Total: ${fmt(vendorSpend.totalVendorSpend + vendorSpend.totalExpenseSpend)}` : undefined}>
            {vendorSpend ? (
              <div className="space-y-3">
                {vendorSpend.vendorByServiceType.slice(0, 6).map(v => (
                  <HorizBar key={v.serviceType} label={v.serviceType || 'Other'} value={v.total} max={vendorMax} color="#8B5CF6" />
                ))}
                {vendorSpend.expenseByCategory.slice(0, 4).map(e => (
                  <HorizBar key={e.category} label={e.category || 'Other'} value={e.amount} max={expMax} color="#06b6d4" />
                ))}
              </div>
            ) : <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>}
          </Section>

          <Section title="Top Event Types" subtitle="Revenue by category">
            {eventTypes.length ? (
              <div className="space-y-3">
                {eventTypes.slice(0, 8).map((et, i) => (
                  <HorizBar
                    key={et.eventType}
                    label={et.eventType || 'Unspecified'}
                    value={et.totalRevenue}
                    max={etMax}
                    color={TYPE_PALETTE[i % TYPE_PALETTE.length]}
                    suffix={`${fmt(et.totalRevenue)} · ${et.count}ev`}
                  />
                ))}
              </div>
            ) : <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>}
          </Section>
        </div>

        {/* ── Event Performance Matrix ── */}
        <Section
          title="Event Performance Matrix"
          subtitle={`${eventPerf.length} events in range`}
          action={
            <span className="text-xs text-zinc-600">Click column headers to sort</span>
          }
        >
          <EventTable rows={eventPerf} />
        </Section>

        {/* ── Status + Type Breakdowns ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Section title="Events by Status">
            {statusEntries.length ? (
              <div className="space-y-3">
                {statusEntries.map(([status, count]) => (
                  <HorizBar
                    key={status}
                    label={status}
                    value={count}
                    max={statusMax}
                    color={STATUS_COLORS[status] ?? '#8B5CF6'}
                    suffix={`${count} event${count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ) : <div className="h-20 flex items-center justify-center text-zinc-600 text-sm">No data</div>}
          </Section>

          <Section title="Events by Type">
            {typeEntries.length ? (
              <div className="space-y-3">
                {typeEntries.slice(0, 8).map(([type, count], i) => (
                  <HorizBar
                    key={type}
                    label={type || 'Unspecified'}
                    value={count}
                    max={typeMax}
                    color={TYPE_PALETTE[i % TYPE_PALETTE.length]}
                    suffix={`${count} event${count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ) : <div className="h-20 flex items-center justify-center text-zinc-600 text-sm">No data</div>}
          </Section>
        </div>
      </div>
    </div>
  )
}
