'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Zap, Trash2, CheckCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const PROVIDERS = [
  {
    value: 'razorpay', label: 'Razorpay', logo: '🏦',
    fields: [
      { key: 'key_id',     label: 'Key ID',     type: 'text',     placeholder: 'rzp_live_...' },
      { key: 'key_secret', label: 'Key Secret', type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    value: 'stripe', label: 'Stripe', logo: '💳',
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'text',     placeholder: 'pk_live_...' },
      { key: 'secret_key',      label: 'Secret Key',      type: 'password', placeholder: 'sk_live_...' },
    ],
  },
  {
    value: 'cashfree', label: 'Cashfree', logo: '💰',
    fields: [
      { key: 'app_id',      label: 'App ID',      type: 'text',     placeholder: '...' },
      { key: 'secret_key',  label: 'Secret Key',  type: 'password', placeholder: '••••••••' },
      { key: 'environment', label: 'Environment', type: 'text',     placeholder: 'production' },
    ],
  },
  {
    value: 'payumoney', label: 'PayU Money', logo: '💸',
    fields: [
      { key: 'merchant_key', label: 'Merchant Key', type: 'text',     placeholder: '...' },
      { key: 'salt',         label: 'Salt',         type: 'password', placeholder: '••••••••' },
      { key: 'environment',  label: 'Environment',  type: 'text',     placeholder: 'production' },
    ],
  },
  {
    value: 'instamojo', label: 'Instamojo', logo: '📱',
    fields: [
      { key: 'api_key',     label: 'API Key',     type: 'text',     placeholder: '...' },
      { key: 'auth_token',  label: 'Auth Token',  type: 'password', placeholder: '••••••••' },
      { key: 'salt',        label: 'Webhook Salt',type: 'password', placeholder: '••••••••' },
      { key: 'environment', label: 'Environment', type: 'text',     placeholder: 'production' },
    ],
  },
  {
    value: 'manual', label: 'Manual / Offline', logo: '✍️',
    fields: [
      { key: 'instructions', label: 'Payment Instructions', type: 'text', placeholder: 'Transfer to bank account...' },
      { key: 'bank_details', label: 'Bank Details',         type: 'text', placeholder: 'Bank name, IFSC, account...' },
      { key: 'upi_id',       label: 'UPI ID',               type: 'text', placeholder: 'example@upi' },
    ],
  },
]

export default function GatewaySettingsPage() {
  const { session } = useAuth()
  const [gateways, setGateways] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState('razorpay')
  const [form, setForm] = useState<{ display_name: string; config: Record<string, string>; webhook_secret: string; is_active: boolean; is_default: boolean }>({
    display_name: '', config: {}, webhook_secret: '', is_active: true, is_default: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({})

  const tenantId = (session as any)?.user?.user_metadata?.tenant_id
  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/gateways`, { headers: headers() })
    const data = await res.json()
    setGateways(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    await fetch(`${API}/api/v1/tenants/${tenantId}/gateways`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ provider: activeProvider, ...form }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setForm({ display_name: '', config: {}, webhook_secret: '', is_active: true, is_default: false })
    await load()
  }

  const test = async (id: string) => {
    setTesting(id)
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/gateways/${id}/test`, { method: 'POST', headers: headers() })
    const data = await res.json()
    setTestResults(r => ({ ...r, [id]: data }))
    setTesting(null)
  }

  const del = async (id: string) => {
    if (!confirm('Remove this gateway?')) return
    await fetch(`${API}/api/v1/tenants/${tenantId}/gateways/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const provider = PROVIDERS.find(p => p.value === activeProvider)!
  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const C = (k: string, v: string) => setForm(f => ({ ...f, config: { ...f.config, [k]: v } }))

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
  )

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Payment Gateways</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure payment providers for ticket sales across your events. Credentials are encrypted at rest.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
        <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-medium text-foreground">AES-256-GCM Encrypted.</span>
          <span className="text-muted-foreground ml-1">All gateway credentials are encrypted before storage. Keys are never logged or exposed in responses.</span>
        </div>
      </div>

      {/* Configured gateways */}
      {gateways.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Configured Gateways</h2>
          </div>
          <div className="divide-y divide-border">
            {gateways.map(g => {
              const tr = testResults[g.id]
              return (
                <div key={g.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{PROVIDERS.find(p => p.value === g.provider)?.logo ?? '💳'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{g.display_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">({g.provider})</span>
                        {g.is_default && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>}
                        {!g.is_active && <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Inactive</span>}
                      </div>
                      {tr && (
                        <div className={`text-xs mt-0.5 ${tr.success ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tr.success ? '✓ Connection verified' : `✗ ${tr.error}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => test(g.id)} disabled={testing === g.id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-background border border-border rounded-lg hover:bg-accent transition-colors">
                      <Zap className="w-3 h-3" />
                      {testing === g.id ? 'Testing…' : 'Test'}
                    </button>
                    <button onClick={() => del(g.id)} className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add gateway */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-foreground">Add Payment Gateway</h2>

        {/* Provider selector */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => setActiveProvider(p.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                activeProvider === p.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <span className="text-xl">{p.logo}</span>
              <span className="text-xs font-medium text-foreground leading-tight">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Display name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name *</label>
          <input value={form.display_name} onChange={e => F('display_name', e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={`e.g. ${provider.label} Production`} />
        </div>

        {/* Provider-specific fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {provider.fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input type={f.type} value={form.config[f.key] ?? ''} onChange={e => C(f.key, e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={f.placeholder} autoComplete="off" />
            </div>
          ))}
        </div>

        {/* Webhook secret */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook Secret</label>
          <input type="password" value={form.webhook_secret} onChange={e => F('webhook_secret', e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your webhook signing secret" autoComplete="off" />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-6">
          {[['is_active', 'Active'], ['is_default', 'Set as Default Gateway']].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(form as any)[k]} onChange={e => F(k, e.target.checked)} className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm text-foreground">{l}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={save} disabled={saving || !form.display_name}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Gateway'}
          </button>
        </div>
      </div>
    </div>
  )
}
