'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Save, Settings2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

interface PlatformSettings {
  platform_name: string; support_email: string; max_file_size_mb: number
  allowed_file_types: string; default_currency: string; default_timezone: string
  maintenance_mode: boolean; registration_open: boolean
  auto_suspend_days: number; trial_days_default: number
  storage_quota_gb_default: number; max_events_default: number | null
}

const DEFAULT: PlatformSettings = {
  platform_name: 'OccasionPro',
  support_email: 'support@occasionpro.app',
  max_file_size_mb: 50,
  allowed_file_types: 'image/*,application/pdf,video/*',
  default_currency: 'INR',
  default_timezone: 'Asia/Kolkata',
  maintenance_mode: false,
  registration_open: true,
  auto_suspend_days: 30,
  trial_days_default: 14,
  storage_quota_gb_default: 10,
  max_events_default: null,
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/platform-settings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setSettings({ ...DEFAULT, ...await res.json() })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/super-admin/platform-settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }))

  const fields: Array<{
    label: string; key: keyof PlatformSettings; type: 'text' | 'number' | 'toggle'
    placeholder?: string; description?: string
  }> = [
    { label: 'Platform Name', key: 'platform_name', type: 'text' },
    { label: 'Support Email', key: 'support_email', type: 'text' },
    { label: 'Default Currency', key: 'default_currency', type: 'text', placeholder: 'INR' },
    { label: 'Default Timezone', key: 'default_timezone', type: 'text', placeholder: 'Asia/Kolkata' },
    { label: 'Max File Size (MB)', key: 'max_file_size_mb', type: 'number' },
    { label: 'Default Trial Days', key: 'trial_days_default', type: 'number' },
    { label: 'Auto-Suspend After (days)', key: 'auto_suspend_days', type: 'number', description: 'Days of payment overdue before auto-suspend triggers' },
    { label: 'Default Storage Quota (GB)', key: 'storage_quota_gb_default', type: 'number' },
    { label: 'Maintenance Mode', key: 'maintenance_mode', type: 'toggle', description: 'Displays maintenance page to all tenants' },
    { label: 'Registration Open', key: 'registration_open', type: 'toggle', description: 'Allow new tenants to sign up' },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Platform Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">Global platform configuration</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-card/60 border border-border/50 rounded-2xl p-5 space-y-4 mb-5">
        {fields.map(f => (
          <div key={f.key} className={f.type === 'toggle' ? 'flex items-center justify-between' : ''}>
            {f.type === 'toggle' ? (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  {f.description && <p className="text-[11px] text-muted-foreground">{f.description}</p>}
                </div>
                <button
                  onClick={() => set(f.key, !settings[f.key] as PlatformSettings[typeof f.key])}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings[f.key] ? 'bg-violet-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[f.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </>
            ) : (
              <>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">{f.label}</label>
                {f.description && <p className="text-[10px] text-muted-foreground mb-1">{f.description}</p>}
                <input
                  type={f.type}
                  value={(settings[f.key] as string | number) ?? ''}
                  onChange={e => set(f.key, (f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value) as PlatformSettings[typeof f.key])}
                  placeholder={f.placeholder}
                  className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {settings.maintenance_mode && (
        <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-xs text-red-400 font-medium">
          ⚠ Maintenance mode is ON — all tenant dashboards show a maintenance page
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Saved' : <><Save className="w-4 h-4" /> Save Settings</>}
      </button>
    </div>
  )
}
