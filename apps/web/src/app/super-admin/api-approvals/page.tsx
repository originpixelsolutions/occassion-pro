'use client'
import { useState, useEffect } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
import { formatDate, cn } from '@/lib/utils'
import {
  Key, CheckCircle2, XCircle, Clock, AlertTriangle,
  Building2, User, ShieldCheck, Activity, RefreshCw,
} from 'lucide-react'

interface PendingKey {
  id: string; name: string; key_prefix: string; key_hint: string
  scopes: string[]; environment: string; description: string | null
  rate_limit_rpm: number; rate_limit_daily: number
  created_at: string; created_by: string | null
  tenant: { id: string; name: string; slug: string }
}

const SCOPE_COLORS: Record<string, string> = {
  'events:read': 'bg-blue-500/10 text-blue-400',
  'events:write': 'bg-blue-500/15 text-blue-300',
  'events:delete': 'bg-red-500/10 text-red-400',
  'guests:read': 'bg-green-500/10 text-green-400',
  'guests:write': 'bg-green-500/15 text-green-300',
  'guests:delete': 'bg-red-500/10 text-red-400',
  'finance:read': 'bg-orange-500/10 text-orange-400',
  'finance:write': 'bg-red-500/10 text-red-400',
  'team:write': 'bg-violet-500/10 text-violet-400',
  'admin:read': 'bg-pink-500/10 text-pink-400',
  'admin:write': 'bg-rose-500/10 text-rose-400',
}

const SENSITIVE = ['events:delete','guests:delete','finance:write','team:write','admin:read','admin:write']

export default function ApiApprovalsPage() {
  const api = useApiClient()
  const [items, setItems] = useState<PendingKey[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState<{ id: string; reason: string } | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/super-admin/api-keys/pending')
      setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const approve = async (id: string) => {
    setProcessing(id)
    try {
      await api.post(`/super-admin/api-keys/${id}/approve`, { approved: true })
      setItems(prev => prev.filter(k => k.id !== id))
    } finally {
      setProcessing(null)
    }
  }

  const reject = async () => {
    if (!rejectionNote) return
    setProcessing(rejectionNote.id)
    try {
      await api.post(`/super-admin/api-keys/${rejectionNote.id}/approve`, {
        approved: false,
        rejection_reason: rejectionNote.reason || 'Rejected by administrator',
      })
      setItems(prev => prev.filter(k => k.id !== rejectionNote.id))
      setRejectionNote(null)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> API Key Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review API key requests that include sensitive scopes
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{items.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Review</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">
            {new Set(items.map(i => i.tenant.id)).size}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Tenants</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">
            {items.filter(i => i.scopes.some(s => SENSITIVE.includes(s))).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">High-Sensitivity</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-50" />
          <p className="font-semibold">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">No pending API key approvals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(key => {
            const hasCritical = key.scopes.some(s => ['admin:write','events:delete','guests:delete'].includes(s))
            return (
              <div key={key.id} className={cn(
                'bg-card border rounded-xl p-5 space-y-4',
                hasCritical ? 'border-red-500/30' : 'border-yellow-500/30'
              )}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{key.name}</h3>
                      {hasCritical && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> High Sensitivity
                        </span>
                      )}
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full',
                        key.environment === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                      )}>
                        {key.environment}
                      </span>
                    </div>
                    {key.description && (
                      <p className="text-sm text-muted-foreground">{key.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    <Clock className="w-3 h-3 inline mr-1" />{formatDate(key.created_at)}
                  </span>
                </div>

                {/* Tenant */}
                <div className="flex items-center gap-3 bg-background rounded-lg p-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{key.tenant.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">@{key.tenant.slug}</span>
                  </div>
                </div>

                {/* Scopes */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Requested Scopes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {key.scopes.map(s => (
                      <span key={s} className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-mono border',
                        SENSITIVE.includes(s)
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {s}
                        {SENSITIVE.includes(s) && ' ⚠'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rate limits */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {key.rate_limit_rpm} RPM
                  </span>
                  <span>{key.rate_limit_daily.toLocaleString()} req/day</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setRejectionNote({ id: key.id, reason: '' })}
                    disabled={processing === key.id}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => approve(key.id)}
                    disabled={processing === key.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-600/90 transition-colors disabled:opacity-50">
                    {processing === key.id
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectionNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold flex items-center gap-2"><XCircle className="w-5 h-5 text-red-400" /> Reject API Key</h3>
            <p className="text-sm text-muted-foreground">Provide a reason for rejection (optional — will be communicated to the tenant).</p>
            <textarea
              value={rejectionNote.reason}
              onChange={e => setRejectionNote(prev => prev ? { ...prev, reason: e.target.value } : null)}
              placeholder="e.g. Scope admin:write not permitted on your current plan…"
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setRejectionNote(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
              <button onClick={reject} disabled={!!processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-600/90 disabled:opacity-50">
                {processing ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
