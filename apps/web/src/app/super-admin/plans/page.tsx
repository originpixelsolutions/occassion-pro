'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package, RefreshCw, Loader2, Save, CheckCircle2, ToggleLeft,
  ToggleRight, Edit2, X, AlertTriangle,
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

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlanFeature {
  id: string
  plan_name: string
  feature_key: string
  is_enabled: boolean
  limit_value: number | null
  feature_label: string
  feature_description: string
  category: string
}

interface Plan {
  id: string
  name: string
  display_name: string
  price_monthly: number
  price_yearly: number
  is_active: boolean
  trial_days: number
}

const PLAN_ORDER = ['starter', 'growth', 'professional', 'enterprise', 'custom']

const PLAN_STYLE: Record<string, string> = {
  starter:      'text-zinc-300 border-zinc-500/30 bg-zinc-500/5',
  growth:       'text-blue-300 border-blue-500/30 bg-blue-500/5',
  professional: 'text-violet-300 border-violet-500/30 bg-violet-500/5',
  enterprise:   'text-amber-300 border-amber-500/30 bg-amber-500/5',
  custom:       'text-emerald-300 border-emerald-500/30 bg-emerald-500/5',
}

const CATEGORY_ORDER = ['events', 'users', 'storage', 'modules', 'ai', 'support', 'integrations', 'branding']

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PlanFeaturesPage() {
  const [features, setFeatures] = useState<PlanFeature[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string>('starter')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [feats, plansData] = await Promise.allSettled([
        apiFetch('/super-admin/plan-features'),
        apiFetch('/super-admin/plans'),
      ])
      if (feats.status === 'fulfilled') setFeatures(feats.value ?? [])
      if (plansData.status === 'fulfilled') {
        const sorted = (plansData.value ?? []).sort(
          (a: Plan, b: Plan) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name)
        )
        setPlans(sorted)
        if (sorted.length > 0 && !sorted.find((p: Plan) => p.name === selectedPlan)) {
          setSelectedPlan(sorted[0].name)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleFeature = async (feature: PlanFeature) => {
    const key = `${feature.plan_name}:${feature.feature_key}`
    setSaving(key)
    const newVal = !feature.is_enabled
    setFeatures(prev => prev.map(f =>
      f.id === feature.id ? { ...f, is_enabled: newVal } : f
    ))
    try {
      await apiFetch(`/super-admin/plan-features/${feature.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_enabled: newVal }),
      })
    } catch {
      // revert
      setFeatures(prev => prev.map(f => f.id === feature.id ? { ...f, is_enabled: !newVal } : f))
    } finally {
      setSaving(null)
    }
  }

  const updateLimit = async (feature: PlanFeature, value: string) => {
    const limit = value === '' ? null : Number(value)
    setFeatures(prev => prev.map(f => f.id === feature.id ? { ...f, limit_value: limit } : f))
    try {
      await apiFetch(`/super-admin/plan-features/${feature.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ limit_value: limit }),
      })
    } catch { /* silently fail */ }
  }

  const savePlan = async () => {
    if (!editPlan) return
    setSavingPlan(true)
    try {
      await apiFetch(`/super-admin/plans/${editPlan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          price_monthly: editPlan.price_monthly,
          price_yearly: editPlan.price_yearly,
          trial_days: editPlan.trial_days,
          is_active: editPlan.is_active,
        }),
      })
      setPlans(prev => prev.map(p => p.id === editPlan.id ? editPlan : p))
      setEditPlan(null)
    } finally {
      setSavingPlan(false)
    }
  }

  const planFeatures = features.filter(f => f.plan_name === selectedPlan)
  const categories = [...new Set(planFeatures.map(f => f.category))].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  )
  const currentPlan = plans.find(p => p.name === selectedPlan)

  return (
    <div className="p-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Plan Features</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Dynamically manage feature flags and limits per plan</p>
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

      {/* Plan selector tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {plans.map(plan => (
          <button
            key={plan.name}
            onClick={() => setSelectedPlan(plan.name)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPlan === plan.name
                ? PLAN_STYLE[plan.name] ?? 'text-zinc-300 border-zinc-500/30 bg-zinc-500/5'
                : 'text-zinc-500 border-white/[0.06] bg-transparent hover:border-white/[0.12]'
            }`}
          >
            {plan.display_name}
            <span className="opacity-60 font-normal">
              ₹{plan.price_monthly.toLocaleString('en-IN')}/mo
            </span>
          </button>
        ))}
      </div>

      {/* Plan pricing card */}
      {currentPlan && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 mb-5 flex items-center justify-between">
          <div className="flex gap-8">
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Monthly Price</p>
              <p className="text-sm font-bold text-white">₹{currentPlan.price_monthly.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Annual Price</p>
              <p className="text-sm font-bold text-white">₹{currentPlan.price_yearly.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Trial Days</p>
              <p className="text-sm font-bold text-white">{currentPlan.trial_days}d</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Status</p>
              <span className={`text-xs font-semibold ${currentPlan.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {currentPlan.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setEditPlan({ ...currentPlan })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Pricing
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(category => {
            const catFeatures = planFeatures.filter(f => f.category === category)
            return (
              <div key={category} className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.04]">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{category}</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {catFeatures.map(feature => {
                    const key = `${feature.plan_name}:${feature.feature_key}`
                    const isSaving = saving === key
                    return (
                      <div key={feature.id} className="px-4 py-3 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-zinc-300">{feature.feature_label}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{feature.feature_description}</p>
                        </div>

                        {/* Limit input */}
                        {feature.limit_value !== null || !feature.is_enabled ? null : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              defaultValue={feature.limit_value ?? ''}
                              onBlur={e => updateLimit(feature, e.target.value)}
                              placeholder="∞"
                              className="w-20 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300 text-right font-mono focus:outline-none focus:border-violet-500/50"
                            />
                          </div>
                        )}

                        {feature.limit_value !== null && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              defaultValue={feature.limit_value}
                              onBlur={e => updateLimit(feature, e.target.value)}
                              className="w-20 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300 text-right font-mono focus:outline-none focus:border-violet-500/50"
                            />
                            <span className="text-[10px] text-zinc-600">limit</span>
                          </div>
                        )}

                        {/* Toggle */}
                        <button
                          onClick={() => toggleFeature(feature)}
                          disabled={isSaving}
                          className="transition-all"
                        >
                          {isSaving ? (
                            <Loader2 className="w-8 h-5 animate-spin text-zinc-600" />
                          ) : feature.is_enabled ? (
                            <ToggleRight className="w-8 h-5 text-violet-400" />
                          ) : (
                            <ToggleLeft className="w-8 h-5 text-zinc-600" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Plan Pricing Modal */}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-white capitalize">Edit {editPlan.name} Plan</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Update pricing and trial settings</p>
              </div>
              <button onClick={() => setEditPlan(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Monthly Price (₹)</label>
                <input
                  type="number"
                  value={editPlan.price_monthly}
                  onChange={e => setEditPlan(p => ({ ...p!, price_monthly: Number(e.target.value) }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Annual Price (₹)</label>
                <input
                  type="number"
                  value={editPlan.price_yearly}
                  onChange={e => setEditPlan(p => ({ ...p!, price_yearly: Number(e.target.value) }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Trial Days</label>
                <input
                  type="number"
                  value={editPlan.trial_days}
                  onChange={e => setEditPlan(p => ({ ...p!, trial_days: Number(e.target.value) }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setEditPlan(p => ({ ...p!, is_active: !p!.is_active }))}
                >
                  {editPlan.is_active
                    ? <ToggleRight className="w-8 h-5 text-violet-400" />
                    : <ToggleLeft className="w-8 h-5 text-zinc-600" />}
                </button>
                <span className="text-xs text-zinc-400">Plan is active (visible to new signups)</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={savePlan}
                disabled={savingPlan}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
              <button onClick={() => setEditPlan(null)} className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
