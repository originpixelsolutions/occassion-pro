'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, TrendingUp, TrendingDown, RefreshCw, Loader2,
  AlertTriangle, CheckCircle2, Clock, Edit2, X, Save, Tag,
  Plus, Trash2, Search, ChevronDown,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  if (typeof window === 'undefined') return ''
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('supabase') && k.includes('auth')) {
        const p = JSON.parse(localStorage.getItem(k) ?? '{}')
        return p?.access_token ?? p?.access_token ?? ''
      }
    }
  } catch {}
  return ''
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function fmt(n: number) { return new Intl.NumberFormat('en-IN').format(n) }
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SubSummary {
  total_tenants: number
  active_subscriptions: number
  trialing: number
  trials_expiring_7d: number
  monthly_revenue: number
  annual_revenue: number
  plan_distribution: Record<string, number>
  churn_risk_count: number
  conversion_rate: number
}

interface TenantSub {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  plan_name: string
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'suspended'
  mrr: number
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  razorpay_subscription_id: string | null
}

interface DiscountCode {
  id: string
  code: string
  discount_pct: number
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
}

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  trialing:  'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  past_due:  'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  cancelled: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
  suspended: 'bg-red-500/15 text-red-400 border border-red-500/20',
}

const PLAN_STYLE: Record<string, string> = {
  starter:      'text-zinc-300',
  growth:       'text-blue-300',
  professional: 'text-violet-300',
  enterprise:   'text-amber-300',
  custom:       'text-emerald-300',
}

const PLANS = ['starter', 'growth', 'professional', 'enterprise', 'custom']

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [summary, setSummary] = useState<SubSummary | null>(null)
  const [tenants, setTenants] = useState<TenantSub[]>([])
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [overrideModal, setOverrideModal] = useState<{ tenant: TenantSub; plan: string } | null>(null)
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [newCode, setNewCode] = useState<{ code: string; discount_pct: number; max_uses: string; expires_at: string } | null>(null)
  const [savingCode, setSavingCode] = useState(false)
  const [activeTab, setActiveTab] = useState<'subs' | 'codes'>('subs')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, tenantsData, codesData] = await Promise.allSettled([
        api<SubSummary>('/super-admin/subscriptions/summary'),
        api<TenantSub[]>('/super-admin/subscriptions'),
        api<DiscountCode[]>('/super-admin/discount-codes'),
      ])
      if (summaryData.status === 'fulfilled') setSummary(summaryData.value)
      if (tenantsData.status === 'fulfilled') setTenants(tenantsData.value ?? [])
      if (codesData.status === 'fulfilled') setCodes(codesData.value ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const applyOverride = async () => {
    if (!overrideModal) return
    setOverrideSaving(true)
    try {
      await api(`/super-admin/tenants/${overrideModal.tenant.tenant_id}/plan`, {
        method: 'POST',
        body: JSON.stringify({ plan: overrideModal.plan }),
      })
      setTenants(prev => prev.map(t =>
        t.tenant_id === overrideModal.tenant.tenant_id ? { ...t, plan_name: overrideModal.plan } : t
      ))
      setOverrideModal(null)
    } finally {
      setOverrideSaving(false)
    }
  }

  const createCode = async () => {
    if (!newCode) return
    setSavingCode(true)
    try {
      const created = await api<DiscountCode>('/super-admin/discount-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.code.toUpperCase(),
          discount_pct: Number(newCode.discount_pct),
          max_uses: newCode.max_uses ? Number(newCode.max_uses) : null,
          expires_at: newCode.expires_at || null,
        }),
      })
      setCodes(prev => [created, ...prev])
      setNewCode(null)
    } finally {
      setSavingCode(false)
    }
  }

  const toggleCode = async (id: string, active: boolean) => {
    await api(`/super-admin/discount-codes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: active }),
    })
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c))
  }

  const deleteCode = async (id: string) => {
    if (!confirm('Delete this discount code?')) return
    await api(`/super-admin/discount-codes/${id}`, { method: 'DELETE' })
    setCodes(prev => prev.filter(c => c.id !== id))
  }

  const filtered = tenants.filter(t => {
    const matchSearch = search === '' ||
      t.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
      t.tenant_slug.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const planDist = summary?.plan_distribution ?? {}
  const totalPlanCount = Object.values(planDist).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Subscriptions & Billing</h1>
          <p className="text-xs text-zinc-500 mt-0.5">MRR tracking, plan management, trial conversions</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Monthly Revenue</p>
            <p className="text-2xl font-bold text-white">{fmtCurrency(summary.monthly_revenue)}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{fmtCurrency(summary.annual_revenue)} ARR</p>
          </div>
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Active Subscriptions</p>
            <p className="text-2xl font-bold text-emerald-400">{fmt(summary.active_subscriptions)}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{fmt(summary.trialing)} trialing</p>
          </div>
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Trials Expiring</p>
            <p className="text-2xl font-bold text-amber-400">{fmt(summary.trials_expiring_7d)}</p>
            <p className="text-[10px] text-zinc-600 mt-1">next 7 days</p>
          </div>
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold text-violet-400">{summary.conversion_rate.toFixed(1)}%</p>
            <p className="text-[10px] text-zinc-600 mt-1">{fmt(summary.churn_risk_count)} churn risk</p>
          </div>
        </div>
      )}

      {/* Plan Distribution */}
      {summary && totalPlanCount > 0 && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-zinc-400 mb-3">Plan Distribution</p>
          <div className="flex gap-3 flex-wrap">
            {PLANS.filter(p => planDist[p] > 0).map(plan => (
              <div key={plan} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold capitalize ${PLAN_STYLE[plan] ?? 'text-zinc-300'}`}>{plan}</span>
                    <span className="text-[10px] text-zinc-500">{planDist[plan] ?? 0} tenants</span>
                  </div>
                  <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${((planDist[plan] ?? 0) / totalPlanCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
        {(['subs', 'codes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'subs' ? 'Subscriptions' : 'Discount Codes'}
          </button>
        ))}
      </div>

      {activeTab === 'subs' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tenants…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelled</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Tenant', 'Plan', 'Status', 'MRR', 'Trial / Period End', 'Razorpay ID', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-600 mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-600">No subscriptions found</td>
                  </tr>
                ) : filtered.map(t => (
                  <tr key={t.tenant_id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">{t.tenant_name}</p>
                      <p className="text-zinc-600 text-[10px]">{t.tenant_slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold capitalize ${PLAN_STYLE[t.plan_name] ?? 'text-zinc-300'}`}>
                        {t.plan_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[t.status] ?? 'bg-zinc-500/15 text-zinc-400'}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">{t.mrr > 0 ? fmtCurrency(t.mrr) : '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {t.trial_ends_at
                        ? <span className="text-blue-400">{fmtDate(t.trial_ends_at)}</span>
                        : t.current_period_end
                          ? fmtDate(t.current_period_end)
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono text-[10px]">
                      {t.razorpay_subscription_id
                        ? <span className="text-violet-400">{t.razorpay_subscription_id.slice(0, 16)}…</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setOverrideModal({ tenant: t, plan: t.plan_name })}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'codes' && (
        <div className="space-y-4">
          {/* New code form */}
          {newCode ? (
            <div className="bg-[#111118] border border-violet-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-3">New Discount Code</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Code</label>
                  <input
                    value={newCode.code}
                    onChange={e => setNewCode(n => ({ ...n!, code: e.target.value.toUpperCase() }))}
                    placeholder="LAUNCH50"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono uppercase focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Discount %</label>
                  <input
                    type="number" min={1} max={100}
                    value={newCode.discount_pct}
                    onChange={e => setNewCode(n => ({ ...n!, discount_pct: Number(e.target.value) }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Max Uses (blank = ∞)</label>
                  <input
                    type="number" min={1}
                    value={newCode.max_uses}
                    onChange={e => setNewCode(n => ({ ...n!, max_uses: e.target.value }))}
                    placeholder="∞"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Expires At</label>
                  <input
                    type="date"
                    value={newCode.expires_at}
                    onChange={e => setNewCode(n => ({ ...n!, expires_at: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={createCode}
                  disabled={savingCode || !newCode.code}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {savingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Create Code
                </button>
                <button onClick={() => setNewCode(null)} className="px-3 py-1.5 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewCode({ code: '', discount_pct: 20, max_uses: '', expires_at: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium border border-violet-500/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Discount Code
            </button>
          )}

          {/* Codes table */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Code', 'Discount', 'Uses', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No discount codes yet</td>
                  </tr>
                ) : codes.map(c => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono font-bold text-white">{c.code}</td>
                    <td className="px-4 py-3 text-violet-400 font-semibold">{c.discount_pct}% off</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {c.expires_at ? fmtDate(c.expires_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCode(c.id, !c.is_active)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                          c.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                            : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/25'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteCode(c.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Override Plan</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{overrideModal.tenant.tenant_name}</p>
              </div>
              <button onClick={() => setOverrideModal(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 mb-5">
              {PLANS.map(plan => (
                <label
                  key={plan}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    overrideModal.plan === plan
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan}
                    checked={overrideModal.plan === plan}
                    onChange={() => setOverrideModal(m => m ? { ...m, plan } : null)}
                    className="sr-only"
                  />
                  <span className={`capitalize font-semibold text-sm ${PLAN_STYLE[plan] ?? 'text-zinc-300'}`}>{plan}</span>
                  {overrideModal.tenant.plan_name === plan && (
                    <span className="ml-auto text-[10px] text-zinc-500">current</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyOverride}
                disabled={overrideSaving || overrideModal.plan === overrideModal.tenant.plan_name}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {overrideSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply Override
              </button>
              <button onClick={() => setOverrideModal(null)} className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
