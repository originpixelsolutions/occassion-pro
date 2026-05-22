'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Loader2, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

interface PaymentConfig {
  enabled_providers: string[]
  platform_razorpay_key_id?: string
  platform_razorpay_key_secret?: string
  platform_test_mode: boolean
}

const ALL_PROVIDERS = [
  { id: 'razorpay',  name: 'Razorpay',  region: 'India', color: 'text-blue-400' },
  { id: 'stripe',    name: 'Stripe',    region: 'Global', color: 'text-violet-400' },
  { id: 'payu',      name: 'PayU',      region: 'India', color: 'text-amber-400' },
  { id: 'cashfree',  name: 'Cashfree',  region: 'India', color: 'text-emerald-400' },
  { id: 'paypal',    name: 'PayPal',    region: 'Global', color: 'text-blue-400' },
  { id: 'instamojo', name: 'Instamojo', region: 'India', color: 'text-pink-400' },
  { id: 'manual',    name: 'Manual/Offline', region: 'Always on', color: 'text-zinc-400' },
]

export default function PaymentConfigPage() {
  const [config, setConfig] = useState<PaymentConfig>({
    enabled_providers: ['razorpay','stripe','payu','cashfree','paypal','instamojo','manual'],
    platform_test_mode: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/payment-config`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setConfig(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/super-admin/payment-config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const toggleProvider = (id: string) => {
    if (id === 'manual') return // manual is always on
    setConfig(c => ({
      ...c,
      enabled_providers: c.enabled_providers.includes(id)
        ? c.enabled_providers.filter(p => p !== id)
        : [...c.enabled_providers, id],
    }))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Payment Config</h1>
          </div>
          <p className="text-sm text-muted-foreground">Control which payment providers tenants can connect</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Platform test mode */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Platform Test Mode</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Affects platform SaaS billing only. Tenant payment providers have separate test modes.
            </p>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, platform_test_mode: !c.platform_test_mode }))}
            className="text-violet-400"
          >
            {config.platform_test_mode
              ? <ToggleRight className="w-8 h-8" />
              : <ToggleLeft className="w-8 h-8 text-zinc-600" />
            }
          </button>
        </div>
      </div>

      {/* Platform Razorpay Keys */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
        <p className="text-sm font-semibold text-foreground mb-1">Platform Razorpay (SaaS Billing)</p>
        <p className="text-xs text-muted-foreground mb-4">
          Used only for OccasionPro subscription billing. Not visible to tenants.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Key ID</label>
            <input
              value={config.platform_razorpay_key_id ?? ''}
              onChange={e => setConfig(c => ({ ...c, platform_razorpay_key_id: e.target.value }))}
              placeholder="rzp_live_..."
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Key Secret</label>
            <input
              type="password"
              value={config.platform_razorpay_key_secret ?? ''}
              onChange={e => setConfig(c => ({ ...c, platform_razorpay_key_secret: e.target.value }))}
              placeholder="••••••••••••••••"
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Provider toggles */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
        <p className="text-sm font-semibold text-foreground mb-1">Tenant Available Providers</p>
        <p className="text-xs text-muted-foreground mb-4">
          Tenants can only connect providers enabled here. Manual/Offline is always available.
        </p>
        <div className="space-y-2">
          {ALL_PROVIDERS.map(p => {
            const enabled = config.enabled_providers.includes(p.id)
            const locked = p.id === 'manual'
            return (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${enabled ? 'border-violet-500/20 bg-violet-500/5' : 'border-border/30 bg-background/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${enabled ? 'bg-violet-500/20' : 'bg-zinc-800'} flex items-center justify-center`}>
                    <span className={`text-[11px] font-bold ${enabled ? p.color : 'text-zinc-600'}`}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.region}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleProvider(p.id)}
                  disabled={locked}
                  className={`${locked ? 'cursor-default opacity-60' : ''}`}
                >
                  {enabled
                    ? <ToggleRight className={`w-7 h-7 ${locked ? 'text-zinc-500' : 'text-violet-400'}`} />
                    : <ToggleLeft className="w-7 h-7 text-zinc-600" />
                  }
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
      >
        {saving
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : saved
          ? '✓ Saved'
          : <><Save className="w-4 h-4" /> Save Configuration</>
        }
      </button>
    </div>
  )
}
