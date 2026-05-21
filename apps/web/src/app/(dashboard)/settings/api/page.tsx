'use client'
import { useState, useEffect } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
import { formatDate, cn } from '@/lib/utils'
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, Check,
  Webhook, Globe, ShieldCheck, AlertTriangle, Activity,
  RefreshCw, ChevronDown, ChevronRight, Clock, Zap,
  RotateCcw, CheckCircle2, XCircle, Pause, Play,
  Info, Code2, Lock,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ApiKey {
  id: string; name: string; key_prefix: string; key_hint: string
  scopes: string[]; environment: 'live' | 'test'; status: string
  approval_status: string; rate_limit_rpm: number; rate_limit_daily: number
  last_used_at: string | null; usage_count: number; expires_at: string | null
  created_at: string; description?: string
}

interface Webhook {
  id: string; name: string; url: string; events: string[]; status: string
  last_triggered_at: string | null; last_success_at: string | null
  last_failure_at: string | null; failure_count: number; created_at: string
}

interface Delivery {
  id: string; event_type: string; status: string; response_code: number | null
  response_ms: number | null; error_message: string | null; attempt: number; delivered_at: string
}

interface Scope {
  scope: string; category: string; description: string; is_sensitive: boolean
}

// ─────────────────────────────────────────────
// Scope groups for display
// ─────────────────────────────────────────────
const SCOPE_COLORS: Record<string, string> = {
  Events: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Guests: 'bg-green-500/10 text-green-400 border-green-500/20',
  Vendors: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Finance: 'bg-red-500/10 text-red-400 border-red-500/20',
  Team: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Analytics: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  AI: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Webhooks: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function ScopeBadge({ scope, category }: { scope: string; category: string }) {
  return (
    <span className={cn(
      'inline-flex text-xs px-2 py-0.5 rounded-full border font-mono',
      SCOPE_COLORS[category] ?? 'bg-muted text-muted-foreground border-border'
    )}>
      {scope}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:           'bg-green-500/10 text-green-400',
    pending_approval: 'bg-yellow-500/10 text-yellow-400',
    suspended:        'bg-orange-500/10 text-orange-400',
    revoked:          'bg-red-500/10 text-red-400',
    success:          'bg-green-500/10 text-green-400',
    failed:           'bg-red-500/10 text-red-400',
    pending:          'bg-blue-500/10 text-blue-400',
    paused:           'bg-yellow-500/10 text-yellow-400',
    disabled:         'bg-red-500/10 text-red-400',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize font-medium', colors[status] ?? 'bg-muted text-muted-foreground')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ─────────────────────────────────────────────
// Create Key Modal
// ─────────────────────────────────────────────
function CreateKeyModal({ scopes, onCreated, onClose }: {
  scopes: Scope[]
  onCreated: (key: ApiKey & { raw_key: string }) => void
  onClose: () => void
}) {
  const api = useApiClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [environment, setEnvironment] = useState<'live' | 'test'>('live')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['events:read'])
  const [rateLimitRpm, setRateLimitRpm] = useState(60)
  const [rateLimitDaily, setRateLimitDaily] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const grouped = scopes.reduce<Record<string, Scope[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    )
  }

  const hasSensitive = selectedScopes.some(s =>
    scopes.find(sc => sc.scope === s)?.is_sensitive
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!selectedScopes.length) { setError('Select at least one scope'); return }
    setLoading(true); setError('')
    try {
      const data = await api.post('/api-config/keys', {
        name: name.trim(), description, environment,
        scopes: selectedScopes, rate_limit_rpm: rateLimitRpm, rate_limit_daily: rateLimitDaily,
      })
      onCreated(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2"><Key className="w-5 h-5 text-primary" /> Create API Key</h2>
          <p className="text-xs text-muted-foreground mt-1">The raw key will only be shown once — store it securely.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name + env */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Key Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Production Integration"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Environment</label>
              <select value={environment} onChange={e => setEnvironment(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
                <option value="live">Live</option>
                <option value="test">Test</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What will this key be used for?"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {/* Rate limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Rate Limit (RPM)</label>
              <input type="number" value={rateLimitRpm} min={1} max={1000}
                onChange={e => setRateLimitRpm(+e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Daily Limit</label>
              <input type="number" value={rateLimitDaily} min={100} max={100000}
                onChange={e => setRateLimitDaily(+e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-xs font-medium mb-3">Permissions (Scopes)</label>
            <div className="space-y-3">
              {Object.entries(grouped).map(([category, scopeList]) => (
                <div key={category} className="bg-background rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{category}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {scopeList.map(s => (
                      <label key={s.scope} className={cn(
                        'flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs',
                        selectedScopes.includes(s.scope) ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                      )}>
                        <input type="checkbox" checked={selectedScopes.includes(s.scope)}
                          onChange={() => toggleScope(s.scope)}
                          className="mt-0.5 accent-primary shrink-0" />
                        <div>
                          <span className="font-mono text-[10px]">{s.scope}</span>
                          {s.is_sensitive && <span className="ml-1 text-[9px] text-orange-400">sensitive</span>}
                          <p className="text-muted-foreground mt-0.5 text-[10px]">{s.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasSensitive && (
            <div className="flex gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-yellow-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              This key includes sensitive scopes and will require admin approval before activation.
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Raw Key Display Modal (shown once after creation)
// ─────────────────────────────────────────────
function RawKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="font-bold">API Key Created</h2>
              <p className="text-xs text-muted-foreground">Copy your key now — it won't be shown again.</p>
            </div>
          </div>

          <div className="bg-background border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Store this key securely. You cannot view it after closing this dialog.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-foreground bg-muted rounded-lg px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {visible ? rawKey : rawKey.slice(0, 12) + '•'.repeat(24) + rawKey.slice(-4)}
              </code>
              <button onClick={() => setVisible(v => !v)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
                {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button onClick={copy} className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                copied ? 'bg-green-500/10 text-green-400' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}>
                {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
          </div>

          <button onClick={onClose} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            I've saved my key
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Create Webhook Modal
// ─────────────────────────────────────────────
function CreateWebhookModal({ availableEvents, onCreated, onClose }: {
  availableEvents: string[]
  onCreated: (wh: Webhook & { signing_secret: string }) => void
  onClose: () => void
}) {
  const api = useApiClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [sslVerify, setSslVerify] = useState(true)
  const [timeoutSec, setTimeoutSec] = useState(10)
  const [retryCnt, setRetryCnt] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const eventGroups = availableEvents.reduce<Record<string, string[]>>((acc, e) => {
    const [cat] = e.split('.')
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {})

  const toggleEvent = (ev: string) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!url.trim()) { setError('URL is required'); return }
    if (!selectedEvents.length) { setError('Select at least one event'); return }
    setLoading(true); setError('')
    try {
      const data = await api.post('/api-config/webhooks', {
        name: name.trim(), url: url.trim(), events: selectedEvents,
        ssl_verify: sslVerify, timeout_seconds: timeoutSec, retry_count: retryCnt,
      })
      onCreated(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create webhook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2"><Webhook className="w-5 h-5 text-primary" /> Create Webhook</h2>
          <p className="text-xs text-muted-foreground mt-1">OccasionPro will send POST requests to your URL with a signed payload.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Webhook Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Zapier Integration"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Endpoint URL *</label>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Timeout (sec)</label>
              <input type="number" value={timeoutSec} min={1} max={30}
                onChange={e => setTimeoutSec(+e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Retry Count</label>
              <input type="number" value={retryCnt} min={0} max={5}
                onChange={e => setRetryCnt(+e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sslVerify} onChange={e => setSslVerify(e.target.checked)} className="accent-primary" />
                <span className="text-xs">Verify SSL</span>
              </label>
            </div>
          </div>

          {/* Events */}
          <div>
            <label className="block text-xs font-medium mb-2">Events to Subscribe</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(eventGroups).map(([cat, evts]) => (
                <div key={cat} className="bg-background rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground capitalize">{cat}</p>
                    <button type="button" onClick={() => {
                      const all = evts.every(e => selectedEvents.includes(e))
                      if (all) setSelectedEvents(prev => prev.filter(e => !evts.includes(e)))
                      else setSelectedEvents(prev => [...new Set([...prev, ...evts])])
                    }} className="text-[10px] text-primary hover:underline">
                      {evts.every(e => selectedEvents.includes(e)) ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {evts.map(ev => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                        <input type="checkbox" checked={selectedEvents.includes(ev)}
                          onChange={() => toggleEvent(ev)} className="accent-primary" />
                        <span className="font-mono text-[10px]">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Signing Secret Modal
// ─────────────────────────────────────────────
function SigningSecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-bold">Webhook Created</h2>
            <p className="text-xs text-muted-foreground">Save your signing secret — shown only once.</p>
          </div>
        </div>
        <div className="bg-background border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <p className="text-xs text-yellow-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Store this secret securely to verify webhook signatures.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted rounded px-3 py-2 break-all">{secret}</code>
            <CopyButton text={secret} />
          </div>
        </div>
        <div className="bg-muted rounded-xl p-4 text-xs space-y-1.5">
          <p className="font-semibold">Verify signatures with HMAC-SHA256:</p>
          <pre className="text-muted-foreground overflow-x-auto">{`const sig = req.headers['x-occasionpro-signature']
const expected = 'sha256=' + hmac('sha256', secret, body)
if (sig !== expected) throw new Error('Invalid signature')`}</pre>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          I've saved the secret
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ApiSettingsPage() {
  const api = useApiClient()
  const [tab, setTab] = useState<'keys' | 'webhooks' | 'docs'>('keys')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [scopes, setScopes] = useState<Scope[]>([])
  const [availableEvents, setAvailableEvents] = useState<string[]>([])
  const [selectedDeliveries, setSelectedDeliveries] = useState<{ webhookId: string; items: Delivery[] } | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [pendingRawKey, setPendingRawKey] = useState<string | null>(null)
  const [showCreateWebhook, setShowCreateWebhook] = useState(false)
  const [pendingSecret, setPendingSecret] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [keysData, whData, scopesData, eventsData] = await Promise.all([
        api.get('/api-config/keys').catch(() => []),
        api.get('/api-config/webhooks').catch(() => []),
        api.get('/api-config/scopes').catch(() => []),
        api.get('/api-config/webhooks/events').catch(() => []),
      ])
      setKeys(keysData ?? [])
      setWebhooks(whData ?? [])
      setScopes(scopesData ?? [])
      setAvailableEvents(eventsData ?? [])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyCreated = (key: ApiKey & { raw_key: string }) => {
    setKeys(prev => [key, ...prev])
    setPendingRawKey(key.raw_key)
    setShowCreateKey(false)
  }

  const handleWebhookCreated = (wh: Webhook & { signing_secret: string }) => {
    setWebhooks(prev => [wh, ...prev])
    setPendingSecret(wh.signing_secret)
    setShowCreateWebhook(false)
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await api.delete(`/api-config/keys/${id}`)
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' } : k))
  }

  const toggleWebhook = async (wh: Webhook) => {
    const newStatus = wh.status === 'active' ? 'paused' : 'active'
    await api.patch(`/api-config/webhooks/${wh.id}`, { status: newStatus })
    setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, status: newStatus } : w))
  }

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    await api.delete(`/api-config/webhooks/${id}`)
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  const loadDeliveries = async (webhookId: string) => {
    if (selectedDeliveries?.webhookId === webhookId) { setSelectedDeliveries(null); return }
    const data = await api.get(`/api-config/webhooks/${webhookId}/deliveries`)
    setSelectedDeliveries({ webhookId, items: data ?? [] })
  }

  const retryDelivery = async (deliveryId: string) => {
    await api.post(`/api-config/webhooks/deliveries/${deliveryId}/retry`, {})
    if (selectedDeliveries) {
      const wh = webhooks.find(w => w.id === selectedDeliveries.webhookId)
      if (wh) await loadDeliveries(wh.id)
    }
  }

  const activeKeys = keys.filter(k => k.status === 'active')
  const pendingKeys = keys.filter(k => k.approval_status === 'pending')
  const activeWebhooks = webhooks.filter(w => w.status === 'active')

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" /> API & Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage API keys, webhooks and external integrations</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Keys', value: activeKeys.length, icon: Key, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Pending Approval', value: pendingKeys.length, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Active Webhooks', value: activeWebhooks.length, icon: Zap, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Total Endpoints', value: webhooks.length, icon: Globe, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {(['keys', 'webhooks', 'docs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-xs font-medium transition-colors capitalize',
                tab === t ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
              {t === 'keys' && <Key className="w-3.5 h-3.5" />}
              {t === 'webhooks' && <Webhook className="w-3.5 h-3.5" />}
              {t === 'docs' && <Code2 className="w-3.5 h-3.5" />}
              {t === 'keys' ? 'API Keys' : t === 'webhooks' ? 'Webhooks' : 'Documentation'}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ─── API KEYS TAB ─── */}
          {tab === 'keys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">API Keys ({keys.length})</p>
                <button onClick={() => setShowCreateKey(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Key
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-background rounded-xl animate-pulse border border-border" />
                ))}</div>
              ) : keys.length === 0 ? (
                <div className="py-12 text-center">
                  <Key className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No API keys yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Create your first key to start integrating</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {keys.map(key => (
                    <div key={key.id} className={cn(
                      'bg-background border rounded-xl p-4 transition-colors',
                      key.status === 'revoked' ? 'border-border opacity-50' : 'border-border hover:border-primary/30'
                    )}>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{key.name}</p>
                            <StatusBadge status={key.status} />
                            {key.approval_status === 'pending' && (
                              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded-full">Awaiting approval</span>
                            )}
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full',
                              key.environment === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                            )}>
                              {key.environment}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-0.5">
                              {key.key_prefix}•••••••••••••{key.key_hint}
                            </code>
                            <CopyButton text={`${key.key_prefix}...${key.key_hint}`} />
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {key.scopes.slice(0, 6).map(s => {
                              const cat = scopes.find(sc => sc.scope === s)?.category ?? 'Other'
                              return <ScopeBadge key={s} scope={s} category={cat} />
                            })}
                            {key.scopes.length > 6 && (
                              <span className="text-xs text-muted-foreground">+{key.scopes.length - 6} more</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {key.usage_count.toLocaleString()} requests</span>
                            <span><Clock className="w-3 h-3 inline mr-1" />{key.rate_limit_rpm}/min · {key.rate_limit_daily.toLocaleString()}/day</span>
                            {key.last_used_at && <span>Last used {formatDate(key.last_used_at)}</span>}
                            {key.expires_at && <span className="text-orange-400">Expires {formatDate(key.expires_at)}</span>}
                          </div>
                        </div>
                        {key.status !== 'revoked' && (
                          <button onClick={() => revokeKey(key.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors shrink-0">
                            <Trash2 className="w-3 h-3" /> Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── WEBHOOKS TAB ─── */}
          {tab === 'webhooks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Webhooks ({webhooks.length})</p>
                <button onClick={() => setShowCreateWebhook(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Webhook
                </button>
              </div>

              {webhooks.length === 0 && !loading ? (
                <div className="py-12 text-center">
                  <Webhook className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No webhooks configured</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add a webhook to get notified of platform events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map(wh => (
                    <div key={wh.id} className="bg-background border border-border rounded-xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-semibold text-sm">{wh.name}</p>
                              <StatusBadge status={wh.status} />
                              {wh.failure_count > 0 && (
                                <span className="text-[10px] text-red-400">{wh.failure_count} failures</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                              <code className="text-xs font-mono text-muted-foreground truncate">{wh.url}</code>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {wh.events.slice(0, 5).map(e => (
                                <span key={e} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{e}</span>
                              ))}
                              {wh.events.length > 5 && (
                                <span className="text-xs text-muted-foreground">+{wh.events.length - 5}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {wh.last_success_at && <span className="text-green-400">✓ {formatDate(wh.last_success_at)}</span>}
                              {wh.last_failure_at && <span className="text-red-400">✗ {formatDate(wh.last_failure_at)}</span>}
                              {!wh.last_triggered_at && <span>Never triggered</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => loadDeliveries(wh.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
                              <Activity className="w-3 h-3" />
                              {selectedDeliveries?.webhookId === wh.id ? 'Hide' : 'Logs'}
                            </button>
                            <button onClick={() => toggleWebhook(wh)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">
                              {wh.status === 'active'
                                ? <><Pause className="w-3 h-3" /> Pause</>
                                : <><Play className="w-3 h-3" /> Resume</>}
                            </button>
                            <button onClick={() => deleteWebhook(wh.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Deliveries panel */}
                      {selectedDeliveries?.webhookId === wh.id && (
                        <div className="border-t border-border">
                          <div className="p-3 bg-background/50">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Recent Deliveries</p>
                            {selectedDeliveries.items.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">No deliveries yet</p>
                            ) : (
                              <div className="space-y-1.5">
                                {selectedDeliveries.items.map(d => (
                                  <div key={d.id} className="flex items-center gap-3 text-xs">
                                    {d.status === 'success'
                                      ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                                      : <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                                    <span className="font-mono text-muted-foreground w-32 truncate">{d.event_type}</span>
                                    <span className={d.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                                      {d.response_code ?? '—'}
                                    </span>
                                    <span className="text-muted-foreground">{d.response_ms ? `${d.response_ms}ms` : '—'}</span>
                                    <span className="text-muted-foreground flex-1 truncate">{formatDate(d.delivered_at)}</span>
                                    {d.status === 'failed' && (
                                      <button onClick={() => retryDelivery(d.id)}
                                        className="flex items-center gap-1 text-primary hover:underline">
                                        <RotateCcw className="w-3 h-3" /> Retry
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── DOCS TAB ─── */}
          {tab === 'docs' && (
            <div className="space-y-5 max-w-3xl">
              <div className="bg-background border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Authentication</h3>
                <p className="text-sm text-muted-foreground">Include your API key in every request using one of these methods:</p>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">{`# Option 1: x-api-key header (recommended)
curl https://api.occasionpro.com/v1/events \\
  -H "x-api-key: op_live_your_key_here"

# Option 2: Bearer token
curl https://api.occasionpro.com/v1/events \\
  -H "Authorization: Bearer op_live_your_key_here"`}</pre>
              </div>

              <div className="bg-background border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Rate Limits</h3>
                <p className="text-sm text-muted-foreground">Rate limits are enforced per API key. The following headers are returned with every response:</p>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">{`X-RateLimit-Limit: 60          # Your RPM limit
X-RateLimit-Remaining: 43      # Remaining in current window
X-RateLimit-Reset: 1716907200  # Unix timestamp of reset`}</pre>
                <p className="text-xs text-muted-foreground">When rate limited, a <code className="bg-muted px-1 rounded">429 Too Many Requests</code> response is returned with a <code className="bg-muted px-1 rounded">Retry-After</code> header.</p>
              </div>

              <div className="bg-background border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Webhook Verification</h3>
                <p className="text-sm text-muted-foreground">Verify the authenticity of webhook payloads using HMAC-SHA256:</p>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">{`// Node.js example
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

// Express handler
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-occasionpro-signature']
  const raw = JSON.stringify(req.body)
  if (!verifyWebhook(raw, sig, WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized')
  }
  // Process event...
  res.sendStatus(200)
})`}</pre>
              </div>

              <div className="bg-background border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold">Webhook Payload Format</h3>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">{`{
  "id": "evt_01abc...",
  "type": "guest.rsvp_changed",
  "created_at": "2026-05-17T12:00:00Z",
  "data": {
    "guest_id": "uuid",
    "event_id": "uuid",
    "rsvp_status": "confirmed",
    "previous_status": "pending"
  }
}`}</pre>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showCreateKey && (
        <CreateKeyModal scopes={scopes} onCreated={handleKeyCreated} onClose={() => setShowCreateKey(false)} />
      )}
      {pendingRawKey && (
        <RawKeyModal rawKey={pendingRawKey} onClose={() => setPendingRawKey(null)} />
      )}
      {showCreateWebhook && (
        <CreateWebhookModal availableEvents={availableEvents} onCreated={handleWebhookCreated} onClose={() => setShowCreateWebhook(false)} />
      )}
      {pendingSecret && (
        <SigningSecretModal secret={pendingSecret} onClose={() => setPendingSecret(null)} />
      )}
    </div>
  )
}
