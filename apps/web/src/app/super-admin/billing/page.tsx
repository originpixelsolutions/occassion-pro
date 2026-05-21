'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Edit2, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

interface Plan {
  id: string; name: string; display_name: string; price_monthly: number
  price_yearly: number; max_events: number | null; max_users: number | null
  max_storage_gb: number | null; modules: string[]; is_active: boolean
  is_custom: boolean; trial_days: number
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'border-zinc-500/30 bg-zinc-500/5',
  growth: 'border-blue-500/30 bg-blue-500/5',
  professional: 'border-violet-500/30 bg-violet-500/5',
  enterprise: 'border-amber-500/30 bg-amber-500/5',
  custom: 'border-emerald-500/30 bg-emerald-500/5',
}

const ALL_MODULES = [
  'crm','finance','guests','vendors','venues','inventory','artists','hospitality',
  'production','workforce','marketing','communication','documents','analytics','ai',
  'fnb','surveys','health-safety','legal','media','decor','printing','gifts','gst',
]

const DEFAULT_PLAN: Omit<Plan, 'id'> = {
  name: '', display_name: '', price_monthly: 0, price_yearly: 0,
  max_events: null, max_users: null, max_storage_gb: null,
  modules: [], is_active: true, is_custom: false, trial_days: 14,
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Plan> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/plans`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setPlans(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const url = editing.id ? `${API}/super-admin/plans/${editing.id}` : `${API}/super-admin/plans`
      await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      await load()
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan? Tenants on this plan will not be affected.')) return
    await fetch(`${API}/super-admin/plans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    await load()
  }

  const toggleModule = (mod: string) => {
    const mods = editing?.modules ?? []
    setEditing(e => ({ ...e, modules: mods.includes(mod) ? mods.filter(m => m !== mod) : [...mods, mod] }))
  }

  const fmtCurrency = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Subscription Plans</h1>
          </div>
          <p className="text-sm text-muted-foreground">Define what each plan includes and costs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setEditing({ ...DEFAULT_PLAN })} className="flex items-center gap-2 text-xs font-semibold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-500 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-card/30 border border-border/30 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`border rounded-2xl p-5 ${PLAN_COLORS[plan.name] ?? 'border-border/50 bg-card/60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{plan.display_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{plan.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!plan.is_active && (
                    <span className="text-[9px] font-bold text-zinc-500 bg-zinc-500/10 border border-zinc-500/20 px-1.5 py-0.5 rounded">INACTIVE</span>
                  )}
                  <button onClick={() => setEditing(plan)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-violet-400 hover:bg-violet-400/10 transition-colors">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => deletePlan(plan.id)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-background/40 rounded-lg p-2 text-center">
                  <p className="text-base font-bold text-foreground">{fmtCurrency(plan.price_monthly)}</p>
                  <p className="text-[9px] text-muted-foreground">/ month</p>
                </div>
                <div className="bg-background/40 rounded-lg p-2 text-center">
                  <p className="text-base font-bold text-foreground">{fmtCurrency(plan.price_yearly)}</p>
                  <p className="text-[9px] text-muted-foreground">/ year</p>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>Events: <span className="text-foreground font-medium">{plan.max_events ?? 'Unlimited'}</span></p>
                <p>Users: <span className="text-foreground font-medium">{plan.max_users ?? 'Unlimited'}</span></p>
                <p>Storage: <span className="text-foreground font-medium">{plan.max_storage_gb ? `${plan.max_storage_gb} GB` : 'Unlimited'}</span></p>
                <p>Trial: <span className="text-foreground font-medium">{plan.trial_days} days</span></p>
              </div>

              {plan.modules?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {plan.modules.slice(0, 5).map(m => (
                    <span key={m} className="text-[9px] bg-background/60 border border-border/30 px-1.5 py-0.5 rounded text-muted-foreground">{m}</span>
                  ))}
                  {plan.modules.length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{plan.modules.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl my-4">
            <h3 className="text-base font-bold mb-5">{editing.id ? 'Edit Plan' : 'Create Plan'}</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Name (slug)', key: 'name', placeholder: 'professional' },
                { label: 'Display Name', key: 'display_name', placeholder: 'Professional' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
                  <input
                    value={(editing as Record<string, unknown>)[key] as string ?? ''}
                    onChange={e => setEditing(ev => ({ ...ev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              ))}
              {[
                { label: 'Monthly Price (₹)', key: 'price_monthly' },
                { label: 'Yearly Price (₹)', key: 'price_yearly' },
                { label: 'Max Events (blank=unlimited)', key: 'max_events' },
                { label: 'Max Users (blank=unlimited)', key: 'max_users' },
                { label: 'Max Storage GB', key: 'max_storage_gb' },
                { label: 'Trial Days', key: 'trial_days' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={(editing as Record<string, unknown>)[key] as string ?? ''}
                    onChange={e => setEditing(ev => ({ ...ev, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              ))}
            </div>

            {/* Module toggles */}
            <div className="mb-4">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 block">Included Modules</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MODULES.map(mod => {
                  const included = editing.modules?.includes(mod)
                  return (
                    <button
                      key={mod}
                      onClick={() => toggleModule(mod)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-all font-medium ${included ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'text-zinc-600 border-zinc-700/50 hover:border-zinc-600'}`}
                    >
                      {mod}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing(ev => ({ ...ev, is_active: e.target.checked }))} className="rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={editing.is_custom ?? false} onChange={e => setEditing(ev => ({ ...ev, is_custom: e.target.checked }))} className="rounded" />
                Custom Plan
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all">Cancel</button>
              <button onClick={save} disabled={saving || !editing.name} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-all disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
