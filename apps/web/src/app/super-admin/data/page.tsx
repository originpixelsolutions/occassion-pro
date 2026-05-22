'use client'

import { useState, useEffect, useCallback } from 'react'
import { Database, RefreshCw, HardDrive, TrendingUp } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

interface TenantStorage {
  id: string
  name: string
  plan: string
  storage_used_gb: number
  storage_quota_gb: number
  file_count: number
  last_upload: string | null
}

interface StorageOverview {
  total_used_gb: number
  total_quota_gb: number
  total_files: number
  tenants: TenantStorage[]
}

function fmtGB(gb: number) {
  if (gb < 0.001) return `${Math.round(gb * 1024 * 1024)} KB`
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`
  return `${gb.toFixed(2)} GB`
}

function StorageBar({ used, quota, warning = 80 }: { used: number; quota: number; warning?: number }) {
  const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= warning ? 'bg-amber-500' : 'bg-violet-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{pct.toFixed(0)}%</span>
    </div>
  )
}

export default function DataStoragePage() {
  const [data, setData] = useState<StorageOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'used' | 'quota' | 'pct' | 'files'>('pct')
  const [quotaEdit, setQuotaEdit] = useState<{ id: string; value: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/storage`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveQuota = async () => {
    if (!quotaEdit) return
    setSaving(true)
    try {
      await fetch(`${API}/super-admin/tenants/${quotaEdit.id}/quota`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_quota_gb: quotaEdit.value }),
      })
      await load()
      setQuotaEdit(null)
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...(data?.tenants ?? [])].sort((a, b) => {
    if (sortBy === 'used')  return b.storage_used_gb - a.storage_used_gb
    if (sortBy === 'quota') return b.storage_quota_gb - a.storage_quota_gb
    if (sortBy === 'files') return b.file_count - a.file_count
    // pct
    const pa = a.storage_quota_gb > 0 ? a.storage_used_gb / a.storage_quota_gb : 0
    const pb = b.storage_quota_gb > 0 ? b.storage_used_gb / b.storage_quota_gb : 0
    return pb - pa
  })

  const platformPct = data && data.total_quota_gb > 0
    ? (data.total_used_gb / data.total_quota_gb) * 100
    : 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">Data & Storage</h1>
          </div>
          <p className="text-sm text-muted-foreground">Storage usage across all tenants</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Platform overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card/60 border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-violet-400" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Used</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{fmtGB(data?.total_used_gb ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">of {fmtGB(data?.total_quota_gb ?? 0)} allocated</p>
          <StorageBar used={data?.total_used_gb ?? 0} quota={data?.total_quota_gb ?? 1} />
        </div>
        <div className="bg-card/60 border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Platform Usage</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{platformPct.toFixed(1)}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">of total allocated quota</p>
        </div>
        <div className="bg-card/60 border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-400" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Files</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{(data?.total_files ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">across {data?.tenants?.length ?? 0} tenants</p>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {([['pct','Usage %'], ['used','Used'], ['quota','Quota'], ['files','Files']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${sortBy === k ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-border/30 text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tenant storage table */}
      <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30 bg-background/30">
              {['Tenant', 'Plan', 'Used', 'Quota', 'Usage', 'Files', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted/30 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : sorted.map(t => {
              const pct = t.storage_quota_gb > 0 ? (t.storage_used_gb / t.storage_quota_gb) * 100 : 0
              const isEditing = quotaEdit?.id === t.id
              return (
                <tr key={t.id} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground capitalize">{t.plan}</td>
                  <td className="px-4 py-3 text-[11px] text-foreground font-mono">{fmtGB(t.storage_used_gb)}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={quotaEdit.value}
                          onChange={e => setQuotaEdit({ id: t.id, value: Number(e.target.value) })}
                          className="w-16 text-xs bg-background border border-violet-500/50 rounded px-1.5 py-1 focus:outline-none"
                        />
                        <span className="text-[10px] text-muted-foreground">GB</span>
                        <button onClick={saveQuota} disabled={saving} className="text-[10px] text-violet-400 hover:text-violet-300">✓</button>
                        <button onClick={() => setQuotaEdit(null)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-mono">{fmtGB(t.storage_quota_gb)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-32">
                    <StorageBar used={t.storage_used_gb} quota={t.storage_quota_gb} />
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{t.file_count.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setQuotaEdit({ id: t.id, value: t.storage_quota_gb })}
                      className="text-[10px] text-violet-400 hover:text-violet-300"
                    >
                      Edit Quota
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
