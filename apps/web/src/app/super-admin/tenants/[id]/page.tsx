'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Users, Calendar, Wallet, Package,
  Brain, Shield, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, RefreshCw, Loader2, Settings, Trash2,
  CreditCard, Server, MessageSquare, TrendingDown, TrendingUp,
  Activity, Clock, Globe, HardDrive,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtBytes(b: number) {
  if (!b) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
function fmtRelative(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PLAN_CLS: Record<string, string> = {
  starter:      'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  growth:       'text-blue-400 bg-blue-400/10 border-blue-400/20',
  professional: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  enterprise:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
}
const STATUS_CLS: Record<string, string> = {
  active:    'text-emerald-400 bg-emerald-400/10',
  suspended: 'text-red-400 bg-red-400/10',
  trial:     'text-amber-400 bg-amber-400/10',
  churned:   'text-zinc-500 bg-zinc-500/10',
}
const CHURN_CLS: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400',
  medium: 'text-amber-400', low: 'text-emerald-400', none: 'text-zinc-500',
}

interface TenantDetail {
  tenant: Record<string, any>
  users: any[]
  recentEvents: any[]
  moduleSettings: any[]
  paymentConfig: Record<string, any> | null
  aiConfig: Record<string, any> | null
  healthScore: Record<string, any> | null
  supportNotes: any[]
}

type Tab = 'overview' | 'users' | 'events' | 'modules' | 'billing' | 'ai' | 'notes'

// ─── Modal: Suspend ───────────────────────────────────────────────────────────

function SuspendModal({ tenantId, tenantName, onClose, onDone }: {
  tenantId: string; tenantName: string
  onClose: () => void; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-border rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-400/10 flex items-center justify-center">
            <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Suspend Tenant</h3>
            <p className="text-xs text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for suspension (required)..."
          rows={3}
          className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-border/50 rounded-lg hover:bg-card transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Suspend'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Plan Override ─────────────────────────────────────────────────────

function PlanModal({ tenantId, current, onClose, onDone }: {
  tenantId: string; current: string
  onClose: () => void; onDone: () => void
}) {
  const [plan, setPlan] = useState(current)
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try {
      await fetch(`${API}/super-admin/tenants/${tenantId}/plan-override`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, reason, until: until || undefined }),
      })
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-border rounded-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-sm font-bold mb-4">Override Subscription Plan</h3>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500">
              {['starter','growth','professional','enterprise','custom'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Override Until (optional)</label>
            <input type="date" value={until} onChange={e => setUntil(e.target.value)}
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              placeholder="Reason for override..." />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-border/50 rounded-lg hover:bg-card transition-colors">Cancel</button>
          <button onClick={submit} disabled={loading || !reason.trim()}
            className="flex-1 py-2 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [suspendModal, setSuspendModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [storageInput, setStorageInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/tenants/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const reactivate = async () => {
    await fetch(`${API}/super-admin/tenants/${id}/reactivate`, {
      method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
    })
    load()
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await fetch(`${API}/super-admin/tenant-notes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: id, note: noteText }),
      })
      setNoteText('')
      load()
    } finally { setSavingNote(false) }
  }

  const setQuota = async () => {
    const gb = parseFloat(storageInput)
    if (isNaN(gb)) return
    await fetch(`${API}/super-admin/tenants/${id}/quota`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota_gb: gb }),
    })
    setStorageInput('')
    load()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-card/30 rounded w-40" />
        <div className="h-32 bg-card/30 rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card/30 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground text-sm">Tenant not found</p>
        <Link href="/super-admin/tenants" className="text-violet-400 hover:underline text-xs">← Back to tenants</Link>
      </div>
    )
  }

  const { tenant, users, recentEvents, moduleSettings, paymentConfig, aiConfig, healthScore, supportNotes } = data
  const isSuspended = tenant.status === 'suspended'

  const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'users', label: `Users (${users.length})`, icon: Users },
    { id: 'events', label: `Events (${recentEvents.length})`, icon: Calendar },
    { id: 'modules', label: 'Modules', icon: Package },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'ai', label: 'AI Config', icon: Brain },
    { id: 'notes', label: `Notes (${supportNotes.length})`, icon: MessageSquare },
  ]

  const health = healthScore?.score ?? tenant.health_score ?? 0
  const healthColor = health >= 70 ? 'text-emerald-400' : health >= 40 ? 'text-amber-400' : 'text-red-400'
  const healthBg = health >= 70 ? 'bg-emerald-400' : health >= 40 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/super-admin/tenants" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Tenants
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-foreground">{tenant.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize border ${STATUS_CLS[tenant.status] ?? STATUS_CLS.active}`}>
                  {tenant.status}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize border ${PLAN_CLS[tenant.plan] ?? PLAN_CLS.starter}`}>
                  {tenant.plan}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {tenant.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{tenant.country}</span>}
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Joined {fmtDate(tenant.created_at)}</span>
                {tenant.churn_risk && tenant.churn_risk !== 'none' && (
                  <span className={`flex items-center gap-1 font-medium ${CHURN_CLS[tenant.churn_risk]}`}>
                    <TrendingDown className="w-3 h-3" />Churn: {tenant.churn_risk}
                  </span>
                )}
              </div>
              {isSuspended && tenant.suspended_reason && (
                <div className="mt-2 text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-400/20">
                  Suspended: {tenant.suspended_reason}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={load} className="p-2 rounded-lg border border-border/50 hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPlanModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-violet-500/30 text-violet-400 rounded-lg hover:bg-violet-500/10 transition-colors">
              <CreditCard className="w-3.5 h-3.5" /> Plan
            </button>
            {isSuspended ? (
              <button onClick={reactivate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
              </button>
            ) : (
              <button onClick={() => setSuspendModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-600/20 transition-colors">
                <AlertTriangle className="w-3.5 h-3.5" /> Suspend
              </button>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Users', value: fmt(users.length), icon: Users, color: 'text-blue-400' },
            { label: 'Events', value: fmt(recentEvents.length), icon: Calendar, color: 'text-violet-400' },
            { label: 'Health Score', value: health > 0 ? `${health}/100` : '—', icon: Activity, color: healthColor },
            { label: 'Storage', value: fmtBytes(tenant.storage_used_bytes ?? 0), icon: HardDrive, color: 'text-emerald-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-background/50 border border-border/40 rounded-xl p-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Health bar */}
        {health > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Health Score</span>
              <span className={`font-semibold ${healthColor}`}>{healthScore?.grade ?? (health >= 70 ? 'A' : health >= 40 ? 'C' : 'F')}</span>
            </div>
            <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${healthBg}`} style={{ width: `${health}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-border/40">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                tab === id ? 'border-violet-500 text-violet-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant Info</h3>
                {[
                  ['ID', tenant.id],
                  ['Email', tenant.email ?? '—'],
                  ['Plan', tenant.plan],
                  ['Status', tenant.status],
                  ['Country', tenant.country ?? '—'],
                  ['Created', fmtDate(tenant.created_at)],
                  ['Trial Ends', fmtDate(tenant.trial_ends_at)],
                  ['Storage Used', fmtBytes(tenant.storage_used_bytes ?? 0)],
                  ['Storage Quota', fmtBytes(tenant.storage_quota_bytes ?? 0)],
                  ['Churn Risk', tenant.churn_risk ?? 'none'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-1.5 border-b border-border/20">
                    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                    <span className="text-xs text-foreground font-medium text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Storage Override</h3>
                <div className="bg-background/50 border border-border/40 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-3">Current quota: {fmtBytes(tenant.storage_quota_bytes ?? 0)}</p>
                  <div className="flex gap-2">
                    <input
                      type="number" placeholder="New quota (GB)" value={storageInput}
                      onChange={e => setStorageInput(e.target.value)}
                      className="flex-1 text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button onClick={setQuota} className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
                      Set
                    </button>
                  </div>
                </div>
                {healthScore?.risk_reasons?.length > 0 && (
                  <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 mt-3">
                    <h4 className="text-xs font-semibold text-amber-400 mb-2">Risk Factors</h4>
                    <ul className="space-y-1">
                      {healthScore.risk_reasons.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-amber-300/70 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-400/50 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="space-y-2">
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No users found</p>
              ) : users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2.5 px-3 bg-background/50 border border-border/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">{u.full_name ?? u.email}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email} · {u.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Last login</p>
                    <p className="text-[10px] text-foreground">{fmtRelative(u.last_sign_in_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Events ── */}
          {tab === 'events' && (
            <div className="space-y-2">
              {recentEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No events found</p>
              ) : recentEvents.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2.5 px-3 bg-background/50 border border-border/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">{e.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{e.event_type?.replace(/_/g, ' ')} · {e.status}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(e.start_date)}</p>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center pt-2">Showing last 10 events</p>
            </div>
          )}

          {/* ── Modules ── */}
          {tab === 'modules' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Module settings inherited from plan unless overridden here.</p>
              {moduleSettings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Using plan defaults — no overrides set</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {moduleSettings.map(m => (
                    <div key={m.module_name} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${m.is_enabled ? 'border-emerald-500/20 bg-emerald-400/5' : 'border-border/30 bg-background/30'}`}>
                      <span className="text-xs font-medium capitalize">{m.module_name.replace(/_/g, ' ')}</span>
                      {m.is_enabled
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        : <XCircle className="w-3.5 h-3.5 text-zinc-600" />
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Billing ── */}
          {tab === 'billing' && (
            <div className="space-y-4">
              {[
                { label: 'Plan', value: tenant.plan },
                { label: 'Payment Enabled', value: paymentConfig?.payment_enabled ? 'Yes' : 'No' },
                { label: 'Test Mode', value: paymentConfig?.test_mode ? 'Yes' : 'No' },
                { label: 'Uses Platform Keys', value: paymentConfig?.use_platform_keys ? 'Yes' : 'No' },
                { label: 'Last Payment', value: fmtDate(paymentConfig?.last_payment_at) },
                { label: 'Next Billing', value: fmtDate(paymentConfig?.next_billing_date) },
                { label: 'Grace Period', value: paymentConfig?.grace_period_days != null ? `${paymentConfig.grace_period_days} days` : '—' },
                { label: 'Auto-Suspend After', value: paymentConfig?.auto_suspend_days != null ? `${paymentConfig.auto_suspend_days} days` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── AI Config ── */}
          {tab === 'ai' && (
            <div className="space-y-3">
              {[
                { label: 'AI Enabled', value: aiConfig?.ai_api_enabled ? 'Yes' : 'No' },
                { label: 'Provider', value: aiConfig?.provider ?? '—' },
                { label: 'Model', value: aiConfig?.model_name ?? '—' },
                { label: 'Tokens Used', value: fmt(aiConfig?.tokens_used) },
                { label: 'Token Limit', value: fmt(aiConfig?.tokens_limit) },
                {
                  label: 'Usage',
                  value: aiConfig?.tokens_used && aiConfig?.tokens_limit
                    ? `${Math.round((aiConfig.tokens_used / aiConfig.tokens_limit) * 100)}%`
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Notes ── */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add an internal note about this tenant..."
                  rows={2}
                  className="flex-1 text-xs bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                />
                <button
                  onClick={addNote}
                  disabled={savingNote || !noteText.trim()}
                  className="px-4 py-2 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                </button>
              </div>
              {supportNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No notes yet</p>
              ) : (
                <div className="space-y-2">
                  {supportNotes.map(note => (
                    <div key={note.id} className="bg-background/50 border border-border/30 rounded-xl p-3">
                      <p className="text-xs text-foreground leading-relaxed">{note.note}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {note.category && <span className="capitalize">{note.category} · </span>}
                        {fmtDate(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {suspendModal && (
        <SuspendModal
          tenantId={id}
          tenantName={tenant.name}
          onClose={() => setSuspendModal(false)}
          onDone={() => { setSuspendModal(false); load() }}
        />
      )}
      {planModal && (
        <PlanModal
          tenantId={id}
          current={tenant.plan}
          onClose={() => setPlanModal(false)}
          onDone={() => { setPlanModal(false); load() }}
        />
      )}
    </div>
  )
}
