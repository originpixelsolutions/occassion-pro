'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Key, Webhook, Plug, Activity, Plus, Copy, Trash2, RotateCw,
  CheckCircle2, XCircle, AlertCircle, Clock, ChevronRight,
  Eye, EyeOff, ExternalLink, RefreshCw, Zap, Shield, Globe,
  MessageSquare, CreditCard, Calendar, Video, Mail, Phone,
  BellRing, ShoppingBag, Play, Pause, Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─────────── TYPES ──────────────────────────────────────────
type Tab = 'integrations' | 'webhooks' | 'api-keys' | 'logs'

interface Integration {
  id: string
  provider: string
  name: string
  description: string
  category: string
  status: 'connected' | 'disconnected' | 'error'
  last_tested?: string
  badge?: string
}

interface WebhookEndpoint {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  total: number
  success: number
  failed: number
  last_triggered?: string
}

interface ApiKey {
  id: string
  name: string
  prefix: string
  last4: string
  key_preview?: string
  scopes: string[]
  environment: 'live' | 'sandbox'
  last_used?: string
  usage_count: number
  created_at: string
  is_active: boolean
}

interface DeliveryLog {
  id: string
  webhook_name?: string
  webhook?: string
  event_type: string
  status: 'success' | 'failed' | 'pending'
  response_status: number
  duration_ms: number
  created_at?: string
  ts?: string
}

// ─────────── PROVIDER CONFIG ────────────────────────────────
const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  whatsapp:        <MessageSquare className="w-5 h-5" />,
  razorpay:        <CreditCard className="w-5 h-5" />,
  google_calendar: <Calendar className="w-5 h-5" />,
  zoom:            <Video className="w-5 h-5" />,
  sendgrid:        <Mail className="w-5 h-5" />,
  twilio:          <Phone className="w-5 h-5" />,
  stripe:          <ShoppingBag className="w-5 h-5" />,
  slack:           <BellRing className="w-5 h-5" />,
}

const PROVIDER_COLORS: Record<string, string> = {
  whatsapp:        'from-green-500/20 to-green-600/10 border-green-500/20',
  razorpay:        'from-blue-500/20 to-blue-600/10 border-blue-500/20',
  google_calendar: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20',
  zoom:            'from-sky-500/20 to-sky-600/10 border-sky-500/20',
  sendgrid:        'from-teal-500/20 to-teal-600/10 border-teal-500/20',
  twilio:          'from-red-500/20 to-red-600/10 border-red-500/20',
  stripe:          'from-violet-500/20 to-violet-600/10 border-violet-500/20',
  slack:           'from-orange-500/20 to-orange-600/10 border-orange-500/20',
}

// ─────────── SUBCOMPONENTS ───────────────────────────────────

function StatusBadge({ status }: { status: Integration['status'] }) {
  if (status === 'connected')    return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Connected</span>
  if (status === 'error')        return <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3 h-3" /> Error</span>
  return <span className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="w-3 h-3" /> Disconnected</span>
}

function DeliveryStatusPill({ status }: { status: DeliveryLog['status'] }) {
  const cfg = {
    success: 'bg-emerald-500/15 text-emerald-400',
    failed:  'bg-red-500/15 text-red-400',
    pending: 'bg-yellow-500/15 text-yellow-400',
  }[status]
  return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', cfg)}>{status}</span>
}

function WebhookSuccessBar({ success, total }: { success: number; total: number }) {
  const pct = total > 0 ? Math.round((success / total) * 100) : 100
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/40">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 98 ? 'bg-emerald-500' : pct >= 90 ? 'bg-yellow-500' : 'bg-red-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded text-muted-foreground hover:text-foreground/80 transition-colors" title={copied ? 'Copied!' : 'Copy'}>
      <Copy className="w-3.5 h-3.5" />
    </button>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted/40', className)} />
}

// ─────────── INTEGRATIONS TAB ────────────────────────────────
function IntegrationsTab({ token }: { token: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/integrations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setIntegrations(Array.isArray(data) ? data : (data.integrations ?? data.data ?? []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [load, token])

  const handleConnect = async (provider: string) => {
    setActionLoading(provider)
    try {
      await fetch(`${API}/integrations/${provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      await load()
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  const handleDisconnect = async (provider: string) => {
    setActionLoading(provider)
    try {
      await fetch(`${API}/integrations/${provider}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  const handleTest = async (provider: string) => {
    setActionLoading(`test_${provider}`)
    try {
      await fetch(`${API}/integrations/${provider}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-44" />)}
      </div>
    )
  }

  const categories = [...new Set(integrations.map(i => i.category))]

  return (
    <div className="space-y-8">
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">No integrations available.</p>
      )}
      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{cat}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.filter(i => i.category === cat).map(intg => {
              const acting = actionLoading === intg.provider || actionLoading === `test_${intg.provider}`
              return (
                <div
                  key={intg.id}
                  className={cn(
                    'relative rounded-xl border bg-gradient-to-br p-4 cursor-pointer transition-all hover:scale-[1.02]',
                    PROVIDER_COLORS[intg.provider] ?? 'from-white/5 to-white/0 border-border/60',
                    selectedProvider === intg.provider && 'ring-2 ring-white/20',
                  )}
                  onClick={() => setSelectedProvider(selectedProvider === intg.provider ? null : intg.provider)}
                >
                  {intg.badge && (
                    <span className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">{intg.badge}</span>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-foreground">
                      {PROVIDER_ICONS[intg.provider] ?? <Plug className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{intg.name}</p>
                      <StatusBadge status={intg.status} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{intg.description}</p>
                  {intg.last_tested && (
                    <p className="text-[10px] text-muted-foreground">Tested {intg.last_tested}</p>
                  )}
                  <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                    {intg.status === 'connected' ? (
                      <>
                        <button
                          onClick={() => handleTest(intg.provider)}
                          disabled={acting}
                          className="flex-1 py-1.5 text-[11px] rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-foreground/80 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {acting && actionLoading === `test_${intg.provider}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Test
                        </button>
                        <button
                          onClick={() => handleDisconnect(intg.provider)}
                          disabled={acting}
                          className="flex-1 py-1.5 text-[11px] rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {acting && actionLoading === intg.provider ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(intg.provider)}
                        disabled={acting}
                        className="w-full py-1.5 text-[11px] rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors text-primary font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />} Connect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────── WEBHOOKS TAB ─────────────────────────────────────
function WebhooksTab({ token }: { token: string }) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<WebhookEndpoint | null>(null)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/integrations/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setWebhooks(Array.isArray(data) ? data : (data.webhooks ?? data.data ?? []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [load, token])

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) return
    setCreating(true)
    try {
      await fetch(`${API}/integrations/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), url: newUrl.trim(), events: [] }),
      })
      setNewName(''); setNewUrl(''); setShowNew(false)
      await load()
    } catch { /* silent */ } finally { setCreating(false) }
  }

  const handleDelete = async (id: string) => {
    setActionId(id)
    try {
      await fetch(`${API}/integrations/webhooks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setWebhooks(p => p.filter(w => w.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch { /* silent */ } finally { setActionId(null) }
  }

  const handleToggle = async (wh: WebhookEndpoint) => {
    setActionId(wh.id)
    try {
      await fetch(`${API}/integrations/webhooks/${wh.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !wh.is_active }),
      })
      await load()
    } catch { /* silent */ } finally { setActionId(null) }
  }

  const handleTest = async (id: string) => {
    setActionId(`test_${id}`)
    try {
      await fetch(`${API}/integrations/webhooks/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { /* silent */ } finally { setActionId(null) }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    )
  }

  return (
    <div className="flex gap-5">
      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{webhooks.length} endpoint{webhooks.length !== 1 ? 's' : ''} configured</p>
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Endpoint
          </button>
        </div>

        {showNew && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold">New Webhook Endpoint</h4>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name (e.g. CRM Sync)"
              className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="Endpoint URL"
              className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-foreground text-xs font-medium disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />} Create Endpoint
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-muted/40 text-foreground/80 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {webhooks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No webhook endpoints configured.</p>
        )}

        {webhooks.map(wh => (
          <div
            key={wh.id}
            className={cn(
              'rounded-xl border p-4 cursor-pointer transition-all hover:border-border/80',
              selected?.id === wh.id ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/20',
            )}
            onClick={() => setSelected(selected?.id === wh.id ? null : wh)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', wh.is_active ? 'bg-emerald-400' : 'bg-muted')} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{wh.name}</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{wh.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleTest(wh.id)}
                  disabled={actionId === `test_${wh.id}`}
                  className="p-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors disabled:opacity-50"
                  title="Test"
                >
                  {actionId === `test_${wh.id}` ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <Play className="w-3 h-3 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => handleToggle(wh)}
                  disabled={actionId === wh.id}
                  className="p-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors disabled:opacity-50"
                  title={wh.is_active ? 'Pause' : 'Resume'}
                >
                  {actionId === wh.id ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : wh.is_active ? <Pause className="w-3 h-3 text-muted-foreground" /> : <Play className="w-3 h-3 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => handleDelete(wh.id)}
                  disabled={!!actionId}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-sm font-bold text-foreground tabular-nums">{(wh.total ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-sm font-bold text-emerald-400 tabular-nums">{(wh.success ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Success</p>
              </div>
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-sm font-bold text-red-400 tabular-nums">{wh.failed ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>

            <div className="mt-3">
              <WebhookSuccessBar success={wh.success ?? 0} total={wh.total ?? 0} />
            </div>

            {(wh.events ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {wh.events.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded-full bg-muted/25 border border-border/40 text-[10px] text-muted-foreground font-mono">{e}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Event type reference panel */}
      <div className="w-72 shrink-0">
        <div className="sticky top-0 rounded-xl border border-border/40 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Event Types</h4>
          {[
            { cat: 'Events',     types: ['event.created', 'event.updated', 'event.cancelled', 'event.completed'] },
            { cat: 'Payments',   types: ['payment.received', 'payment.failed', 'invoice.overdue'] },
            { cat: 'Operations', types: ['guest.checked_in', 'vendor.confirmed', 'staff.assigned', 'task.completed'] },
            { cat: 'Support',    types: ['ticket.created', 'ticket.escalated', 'ticket.resolved'] },
          ].map(group => (
            <div key={group.cat} className="mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{group.cat}</p>
              {group.types.map(t => (
                <div key={t} className="flex items-center gap-2 py-1">
                  <div className="w-1 h-1 rounded-full bg-muted shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-mono">{t}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────── API KEYS TAB ─────────────────────────────────────
function ApiKeysTab({ token }: { token: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEnv, setNewEnv] = useState<'live' | 'sandbox'>('live')
  const [newScopes, setNewScopes] = useState<string[]>(['read'])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/integrations/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setKeys(Array.isArray(data) ? data : (data.keys ?? data.data ?? []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [load, token])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setCreateError('')
    try {
      const res = await fetch(`${API}/integrations/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), environment: newEnv, scopes: newScopes }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setCreateError(e.message ?? 'Failed to create key')
        return
      }
      const created = await res.json()
      // Show the full key once — it won't be retrievable again
      if (created.key || created.full_key) setNewKeyValue(created.key ?? created.full_key)
      setNewName(''); setShowNew(false)
      await load()
    } catch { setCreateError('Network error') } finally { setCreating(false) }
  }

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      await fetch(`${API}/integrations/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      setKeys(p => p.map(k => k.id === id ? { ...k, is_active: false } : k))
    } catch { /* silent */ } finally { setRevokingId(null) }
  }

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
  }

  return (
    <div className="space-y-4">
      {/* Security notice + create button */}
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 flex-1 mr-6">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">API keys grant programmatic access to your OccasionPro data. Keep them secure — never commit them to version control or expose them in client-side code.</p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setNewKeyValue(null); setCreateError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Create Key
        </button>
      </div>

      {/* New key revealed */}
      {newKeyValue && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-400 mb-1">Copy your new API key — it won't be shown again</p>
            <code className="text-xs text-foreground font-mono break-all">{newKeyValue}</code>
          </div>
          <CopyButton value={newKeyValue} />
          <button onClick={() => setNewKeyValue(null)} className="text-muted-foreground hover:text-foreground"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {showNew && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold">New API Key</h4>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Key name (e.g. Mobile App v2)"
            className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <div className="flex gap-3">
            <select
              value={newEnv}
              onChange={e => setNewEnv(e.target.value as 'live' | 'sandbox')}
              className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground/80 focus:outline-none"
            >
              <option value="live">Live</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">Scopes:</p>
          <div className="flex flex-wrap gap-2">
            {['read', 'write', 'admin', 'webhooks'].map(s => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newScopes.includes(s)}
                  onChange={e => setNewScopes(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                  className="rounded"
                />
                <span className="text-xs text-muted-foreground">{s}</span>
              </label>
            ))}
          </div>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-foreground text-xs font-medium disabled:opacity-50"
            >
              {creating && <Loader2 className="w-3 h-3 animate-spin" />} Generate Key
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-muted/40 text-foreground/80 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Keys table */}
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No API keys created yet.</p>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Name</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Key</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Scopes</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Env</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Last Used</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Requests</th>
                <th className="text-right text-[11px] text-muted-foreground font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id} className={cn('border-b border-border/25 hover:bg-muted/20 transition-colors', !key.is_active && 'opacity-40')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full', key.is_active ? 'bg-emerald-400' : 'bg-muted')} />
                      <span className="text-sm font-medium text-foreground">{key.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      {key.key_preview ?? `${key.prefix ?? ''}••••••••${key.last4 ?? ''}`}
                      <CopyButton value={key.key_preview ?? `${key.prefix ?? ''}...${key.last4 ?? ''}`} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(key.scopes ?? []).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium',
                      key.environment === 'live' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                    )}>
                      {key.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{key.last_used ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{(key.usage_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {key.is_active && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                          className="p-1.5 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Revoke"
                        >
                          {revokingId === key.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────── LOGS TAB ─────────────────────────────────────────
function LogsTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/integrations/logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : (data.logs ?? data.data ?? []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [load, token])

  const handleRetry = async (id: string) => {
    setRetryingId(id)
    try {
      await fetch(`${API}/integrations/deliveries/${id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } catch { /* silent */ } finally { setRetryingId(null) }
  }

  const formatTs = (log: DeliveryLog) => {
    if (log.ts) return log.ts
    if (log.created_at) {
      return new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
    return '—'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Recent webhook deliveries</p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs text-foreground/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No delivery logs found.</p>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Webhook</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Event</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Status</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">HTTP</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Duration</th>
                <th className="text-left text-[11px] text-muted-foreground font-medium px-4 py-3">Time</th>
                <th className="text-right text-[11px] text-muted-foreground font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-border/25 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{log.webhook_name ?? log.webhook ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{log.event_type}</td>
                  <td className="px-4 py-3"><DeliveryStatusPill status={log.status} /></td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-mono', log.response_status >= 200 && log.response_status < 300 ? 'text-emerald-400' : 'text-red-400')}>
                      {log.response_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{log.duration_ms.toLocaleString()}ms</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatTs(log)}</td>
                  <td className="px-4 py-3 text-right">
                    {log.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(log.id)}
                        disabled={retryingId === log.id}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {retryingId === log.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────── MAIN PAGE ────────────────────────────────────────
export default function IntegrationsPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('integrations')

  // Dashboard counts from the integrations dashboard endpoint
  const [dashboard, setDashboard] = useState<{
    connected?: number
    total?: number
    activeWebhooks?: number
    totalWebhooks?: number
    activeKeys?: number
    successRate?: number
  }>({})
  const [dashLoading, setDashLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setDashLoading(true)
    fetch(`${API}/integrations/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => setDashboard(d ?? {}))
      .catch(() => {})
      .finally(() => setDashLoading(false))
  }, [token])

  const TABS = [
    { id: 'integrations' as Tab, label: 'Integrations',  icon: Plug,     count: dashboard.total },
    { id: 'webhooks'     as Tab, label: 'Webhooks',      icon: Webhook,  count: dashboard.totalWebhooks },
    { id: 'api-keys'     as Tab, label: 'API Keys',      icon: Key,      count: dashboard.activeKeys },
    { id: 'logs'         as Tab, label: 'Delivery Logs', icon: Activity, count: null },
  ]

  const stats = [
    { label: 'Connected Apps',   value: dashLoading ? '…' : `${dashboard.connected ?? 0}/${dashboard.total ?? 0}`,      icon: Plug,     color: 'text-emerald-400' },
    { label: 'Active Webhooks',  value: dashLoading ? '…' : `${dashboard.activeWebhooks ?? 0}/${dashboard.totalWebhooks ?? 0}`, icon: Webhook,  color: 'text-blue-400' },
    { label: 'Active API Keys',  value: dashLoading ? '…' : (dashboard.activeKeys ?? 0),                                 icon: Key,      color: 'text-violet-400' },
    { label: 'Delivery Success', value: dashLoading ? '…' : `${dashboard.successRate ?? 100}%`,                          icon: Activity, color: (dashboard.successRate ?? 100) >= 98 ? 'text-emerald-400' : 'text-yellow-400' },
  ]

  if (!token) return null

  return (
    <div className="h-full overflow-y-auto bg-[#060b14]">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">API & Integration Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Connect third-party tools, manage webhooks and control API access</p>
          </div>
          <a href="https://docs.occasionpro.in/api" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs text-foreground/80 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> API Docs
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center">
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit border border-border/40">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t.id ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count != null && (
                <span className="px-1.5 py-0.5 rounded-full bg-muted/60 text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'integrations' && <IntegrationsTab token={token} />}
        {tab === 'webhooks'     && <WebhooksTab token={token} />}
        {tab === 'api-keys'     && <ApiKeysTab token={token} />}
        {tab === 'logs'         && <LogsTab token={token} />}

      </div>
    </div>
  )
}
