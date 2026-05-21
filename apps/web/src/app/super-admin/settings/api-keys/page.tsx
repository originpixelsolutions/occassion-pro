'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, Eye, EyeOff, Loader2, Save } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Setting {
  id: string
  key: string
  value: string | null
  description: string | null
  category: string
  is_sensitive: boolean
  has_value: boolean
}

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  payments: { label: 'Payments',  color: 'text-emerald-400' },
  email:    { label: 'Email',     color: 'text-blue-400'    },
  ai:       { label: 'AI',        color: 'text-violet-400'  },
  auth:     { label: 'Auth',      color: 'text-amber-400'   },
  general:  { label: 'General',   color: 'text-zinc-400'    },
}

const CATEGORY_ORDER = ['payments', 'email', 'ai', 'auth', 'general']

// ─── Single key row ───────────────────────────────────────────────────────────

function KeyRow({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const [value, setValue]     = useState('')
  const [show, setShow]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const save = async () => {
    if (!value.trim()) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`${API}/admin/system-settings/${encodeURIComponent(setting.key)}`, {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: value.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `${res.status}`)
      }
      setSavedOk(true)
      setValue('')
      setTimeout(() => setSavedOk(false), 2500)
      onSaved()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 px-5 border-b border-white/[0.05] last:border-0">
      {/* Key info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-mono font-semibold text-zinc-200">{setting.key}</code>
          {setting.is_sensitive && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              sensitive
            </span>
          )}
          {setting.has_value ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ set
            </span>
          ) : (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-white/[0.06]">
              not set
            </span>
          )}
        </div>
        {setting.description && (
          <p className="mt-0.5 text-xs text-zinc-600">{setting.description}</p>
        )}
        {!setting.is_sensitive && setting.value && (
          <p className="mt-1 text-xs font-mono text-zinc-500 break-all">{setting.value}</p>
        )}
        {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
      </div>

      {/* Input + Save */}
      <div className="flex items-center gap-2 sm:w-72">
        <div className="relative flex-1">
          <input
            type={setting.is_sensitive && !show ? 'password' : 'text'}
            placeholder={setting.has_value ? '(keep existing)' : 'Enter value…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5
                       text-sm text-zinc-200 font-mono placeholder:font-sans placeholder:text-zinc-700
                       focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20
                       transition-all pr-8"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          />
          {setting.is_sensitive && (
            <button
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              type="button"
              tabIndex={-1}
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <button
          onClick={save}
          disabled={!value.trim() || saving}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : savedOk ? (
            <Check className="w-3.5 h-3.5 text-emerald-300" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {savedOk ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/admin/system-settings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setSettings(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    ;(acc[s.category] ??= []).push(s)
    return acc
  }, {})

  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white">API Key Management</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Update service credentials live — no redeployment needed.
          Sensitive values are write-only and never displayed after saving.
          Changes propagate within 5 minutes.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading keys…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}{' '}
          <button onClick={fetchSettings} className="underline ml-2 hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {orderedCats.map((cat) => {
            const meta = CATEGORY_LABELS[cat] ?? { label: cat, color: 'text-zinc-400' }
            return (
              <section key={cat}>
                <h2 className={`text-[11px] font-semibold uppercase tracking-widest mb-2 ${meta.color}`}>
                  {meta.label}
                </h2>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  {grouped[cat].map((s) => (
                    <KeyRow key={s.key} setting={s} onSaved={fetchSettings} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
