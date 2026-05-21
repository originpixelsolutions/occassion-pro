'use client'

import { useState, useEffect, useCallback } from 'react'
import { Layers, Search, RefreshCw, Save, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

interface TenantSummary { id: string; name: string; plan: string; plan_modules: string[] }

const ALL_MODULES = [
  { key: 'crm',           label: 'CRM & Sales',           group: 'Core' },
  { key: 'events',        label: 'Event Management',       group: 'Core' },
  { key: 'guests',        label: 'Guest Management',       group: 'Core' },
  { key: 'runsheet',      label: 'Runsheet / Timeline',    group: 'Core' },
  { key: 'budget',        label: 'Budget & Finance',       group: 'Finance' },
  { key: 'invoices',      label: 'Invoices & Billing',     group: 'Finance' },
  { key: 'payments',      label: 'Payments',               group: 'Finance' },
  { key: 'vendors',       label: 'Vendor Management',      group: 'Operations' },
  { key: 'inventory',     label: 'Inventory & Warehouse',  group: 'Operations' },
  { key: 'floor_plan',    label: 'Floor Plan Editor',      group: 'Operations' },
  { key: 'fnb',           label: 'F&B Management',         group: 'Operations' },
  { key: 'accommodation', label: 'Accommodation',          group: 'Operations' },
  { key: 'transport',     label: 'Transport & Logistics',  group: 'Operations' },
  { key: 'staff',         label: 'Staff & HR',             group: 'Workforce' },
  { key: 'checkin',       label: 'Check-in & QR',          group: 'Workforce' },
  { key: 'artist',        label: 'Artist Management',      group: 'Entertainment' },
  { key: 'conference',    label: 'Conference Module',      group: 'Entertainment' },
  { key: 'marketing',     label: 'Marketing & Comms',      group: 'Marketing' },
  { key: 'whatsapp',      label: 'WhatsApp Integration',   group: 'Marketing' },
  { key: 'post_event',    label: 'Post-Event Module',      group: 'Analytics' },
  { key: 'analytics',     label: 'Analytics & Reports',    group: 'Analytics' },
  { key: 'ai_assistant',  label: 'AI Assistant',           group: 'AI' },
  { key: 'client_portal', label: 'Client Portal',          group: 'Portals' },
  { key: 'vendor_portal', label: 'Vendor Portal',          group: 'Portals' },
]

const GROUPS = Array.from(new Set(ALL_MODULES.map(m => m.group)))

export default function ModulesPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<TenantSummary | null>(null)
  const [overrides, setOverrides] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/tenants?limit=200`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.tenants ?? []
        setTenants(list)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectTenant = async (t: TenantSummary) => {
    setSelected(t)
    // load current module overrides for this tenant
    try {
      const res = await fetch(`${API}/super-admin/tenants/${t.id}/modules`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setOverrides(data.enabled_modules ?? t.plan_modules ?? [])
      } else {
        setOverrides(t.plan_modules ?? [])
      }
    } catch {
      setOverrides(t.plan_modules ?? [])
    }
  }

  const toggle = (key: string) => {
    setOverrides(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(`${API}/super-admin/tenants/${selected.id}/modules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_modules: overrides }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const filtered = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Module Control</h1>
          </div>
          <p className="text-sm text-muted-foreground">Enable or disable specific modules per tenant (overrides plan defaults)</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-5 h-[calc(100vh-200px)]">
        {/* Tenant list */}
        <div className="w-64 flex-shrink-0 flex flex-col">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-card/60 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? (
              [...Array(6)].map((_, i) => <div key={i} className="h-12 bg-card/30 rounded-xl animate-pulse" />)
            ) : filtered.map(t => (
              <button
                key={t.id}
                onClick={() => selectTenant(t)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === t.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-border/30 hover:bg-card/60'}`}
              >
                <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{t.plan}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Module grid */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Layers className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Select a tenant</p>
              <p className="text-xs text-muted-foreground">to configure their module access</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">{selected.name}</h2>
                  <p className="text-[11px] text-muted-foreground">{overrides.length}/{ALL_MODULES.length} modules enabled</p>
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? '✓ Saved' : <><Save className="w-3.5 h-3.5" /> Save</>}
                </button>
              </div>

              <div className="space-y-5">
                {GROUPS.map(group => (
                  <div key={group}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{group}</p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {ALL_MODULES.filter(m => m.group === group).map(mod => {
                        const enabled = overrides.includes(mod.key)
                        return (
                          <button
                            key={mod.key}
                            onClick={() => toggle(mod.key)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                              enabled
                                ? 'border-violet-500/30 bg-violet-500/10'
                                : 'border-border/30 bg-background/20 opacity-50'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? 'bg-violet-400' : 'bg-zinc-600'}`} />
                            <span className={`text-[11px] font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {mod.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
