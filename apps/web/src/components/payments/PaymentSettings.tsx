'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, CheckCircle, AlertCircle, ExternalLink, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD']

const PROVIDERS: { value: string; label: string; fields: { key: string; label: string; type: string; placeholder: string }[] }[] = [
  {
    value: 'razorpay', label: 'Razorpay',
    fields: [
      { key: 'key_id',     label: 'Key ID',     type: 'text',     placeholder: 'rzp_live_...' },
      { key: 'key_secret', label: 'Key Secret', type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    value: 'stripe', label: 'Stripe',
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'text',     placeholder: 'pk_live_...' },
      { key: 'secret_key',      label: 'Secret Key',      type: 'password', placeholder: 'sk_live_...' },
    ],
  },
  {
    value: 'cashfree', label: 'Cashfree',
    fields: [
      { key: 'app_id',      label: 'App ID',      type: 'text',     placeholder: '...' },
      { key: 'secret_key',  label: 'Secret Key',  type: 'password', placeholder: '••••••••' },
      { key: 'environment', label: 'Environment', type: 'text',     placeholder: 'sandbox or production' },
    ],
  },
  {
    value: 'payumoney', label: 'PayU Money',
    fields: [
      { key: 'merchant_key', label: 'Merchant Key', type: 'text',     placeholder: '...' },
      { key: 'salt',         label: 'Salt',         type: 'password', placeholder: '••••••••' },
      { key: 'environment',  label: 'Environment',  type: 'text',     placeholder: 'sandbox or production' },
    ],
  },
  {
    value: 'instamojo', label: 'Instamojo',
    fields: [
      { key: 'api_key',    label: 'API Key',    type: 'text',     placeholder: '...' },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: '••••••••' },
      { key: 'salt',       label: 'Webhook Salt', type: 'password', placeholder: '••••••••' },
      { key: 'environment',label: 'Environment', type: 'text',     placeholder: 'sandbox or production' },
    ],
  },
  {
    value: 'manual', label: 'Manual / Offline',
    fields: [
      { key: 'instructions', label: 'Payment Instructions', type: 'text', placeholder: 'Please transfer to bank account...' },
      { key: 'bank_details', label: 'Bank Details',         type: 'text', placeholder: 'Bank name, account number...' },
      { key: 'upi_id',       label: 'UPI ID',               type: 'text', placeholder: 'example@upi' },
    ],
  },
]

export default function PaymentSettings({ eventId }: { eventId: string }) {
  const { session } = useAuth()
  const [settings, setSettings] = useState<any>(null)
  const [gateways, setGateways] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'event' | 'gateway'>('event')
  const [gwForm, setGwForm] = useState<{ provider: string; display_name: string; config: Record<string, string>; webhook_secret: string; is_active: boolean; is_default: boolean }>({
    provider: 'razorpay', display_name: '', config: {}, webhook_secret: '', is_active: true, is_default: false,
  })
  const [eventForm, setEventForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const tenantId = (session as any)?.user?.user_metadata?.tenant_id

  const load = useCallback(async () => {
    if (!session?.access_token) return
    const [settingsRes, gatewaysRes] = await Promise.all([
      fetch(`${API}/api/v1/events/${eventId}/payments/settings`, { headers: headers() }),
      tenantId ? fetch(`${API}/api/v1/tenants/${tenantId}/gateways`, { headers: headers() }) : Promise.resolve(null),
    ])
    const s = await settingsRes.json()
    const g = gatewaysRes ? await gatewaysRes.json() : []
    setSettings(s)
    setGateways(Array.isArray(g) ? g : [])
    if (s) {
      setEventForm({
        gateway_id: s.gateway_id ?? '',
        currency: s.currency ?? 'INR',
        payment_title: s.payment_title ?? '',
        payment_description: s.payment_description ?? '',
        success_redirect_url: s.success_redirect_url ?? '',
        failure_redirect_url: s.failure_redirect_url ?? '',
        collect_gst: s.collect_gst ?? false,
        gst_percentage: s.gst_percentage ?? '',
        convenience_fee_pct: s.convenience_fee_pct ?? '',
        is_payments_enabled: s.is_payments_enabled ?? false,
      })
    }
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const saveEventSettings = async () => {
    setSaving(true)
    await fetch(`${API}/api/v1/events/${eventId}/payments/settings`, {
      method: 'POST', headers: headers(), body: JSON.stringify(eventForm),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    await load()
  }

  const saveGateway = async () => {
    if (!tenantId) return
    setSaving(true)
    await fetch(`${API}/api/v1/tenants/${tenantId}/gateways`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ...gwForm }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    setGwForm({ provider: 'razorpay', display_name: '', config: {}, webhook_secret: '', is_active: true, is_default: false })
    await load()
  }

  const testGateway = async (id: string) => {
    setTesting(id)
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/gateways/${id}/test`, { method: 'POST', headers: headers() })
    const data = await res.json()
    setTestResult(data); setTesting(null)
    setTimeout(() => setTestResult(null), 5000)
  }

  const deleteGateway = async (id: string) => {
    if (!confirm('Remove this gateway?')) return
    await fetch(`${API}/api/v1/tenants/${tenantId}/gateways/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const selectedProvider = PROVIDERS.find(p => p.value === gwForm.provider)
  const EF = (k: string, v: any) => setEventForm((f: any) => ({ ...f, [k]: v }))
  const GF = (k: string, v: any) => setGwForm((f: any) => ({ ...f, [k]: v }))
  const GC = (k: string, v: string) => setGwForm(f => ({ ...f, config: { ...f.config, [k]: v } }))

  if (loading) return <div className="text-muted-foreground text-sm text-center py-12">Loading…</div>

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([['event', 'Event Settings'], ['gateway', 'Payment Gateways']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSection === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Event Settings ── */}
      {activeSection === 'event' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Event Payment Settings</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">Enable Payments</span>
              <div onClick={() => EF('is_payments_enabled', !eventForm.is_payments_enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${eventForm.is_payments_enabled ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${eventForm.is_payments_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Gateway</label>
              <select value={eventForm.gateway_id} onChange={e => EF('gateway_id', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select gateway…</option>
                {gateways.map(g => <option key={g.id} value={g.id}>{g.display_name} ({g.provider})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
              <select value={eventForm.currency} onChange={e => EF('currency', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Page Title</label>
            <input value={eventForm.payment_title} onChange={e => EF('payment_title', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Event Registration" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea value={eventForm.payment_description} onChange={e => EF('payment_description', e.target.value)}
              rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Success Redirect URL</label>
              <input value={eventForm.success_redirect_url} onChange={e => EF('success_redirect_url', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Failure Redirect URL</label>
              <input value={eventForm.failure_redirect_url} onChange={e => EF('failure_redirect_url', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={eventForm.collect_gst} onChange={e => EF('collect_gst', e.target.checked)} className="w-4 h-4 rounded accent-primary" id="gst-toggle" />
              <label htmlFor="gst-toggle" className="text-sm text-foreground cursor-pointer">Collect GST</label>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">GST %</label>
              <input type="number" min="0" max="100" disabled={!eventForm.collect_gst} value={eventForm.gst_percentage} onChange={e => EF('gst_percentage', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Convenience Fee %</label>
              <input type="number" min="0" value={eventForm.convenience_fee_pct} onChange={e => EF('convenience_fee_pct', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={saveEventSettings} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ── Gateway Settings ── */}
      {activeSection === 'gateway' && (
        <div className="space-y-5">
          {/* Existing gateways */}
          {gateways.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Configured Gateways</h3>
              </div>
              <div className="divide-y divide-border">
                {gateways.map(g => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <span className="font-medium text-sm text-foreground">{g.display_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">({g.provider})</span>
                      {g.is_default && <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>}
                      {!g.is_active && <span className="ml-2 text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult && testing === null && (
                        <span className={`text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                          {testResult.success ? '✓ Connected' : `✗ ${testResult.error}`}
                        </span>
                      )}
                      <button onClick={() => testGateway(g.id)} disabled={testing === g.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-background border border-border rounded-lg hover:bg-accent transition-colors">
                        <Zap className="w-3 h-3" />
                        {testing === g.id ? 'Testing…' : 'Test'}
                      </button>
                      <button onClick={() => deleteGateway(g.id)} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add gateway form */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">Add / Update Gateway</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
                <select value={gwForm.provider} onChange={e => GF('provider', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
                <input value={gwForm.display_name} onChange={e => GF('display_name', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Razorpay Production" />
              </div>
            </div>

            {selectedProvider?.fields.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type} value={gwForm.config[f.key] ?? ''} onChange={e => GC(f.key, e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder={f.placeholder} />
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook Secret</label>
              <input type="password" value={gwForm.webhook_secret} onChange={e => GF('webhook_secret', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono" placeholder="Webhook signing secret" />
            </div>

            <div className="flex items-center gap-6">
              {[['is_active', 'Active'], ['is_default', 'Set as Default']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(gwForm as any)[k]} onChange={e => GF(k, e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-foreground">{l}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={saveGateway} disabled={saving || !gwForm.display_name}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Gateway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
