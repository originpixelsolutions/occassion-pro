'use client'

import { use, useState, useEffect } from 'react'
import { Users, UserPlus, Mail, Shield, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Grant Access Modal ────────────────────────────────────────────────────

function GrantClientAccessModal({
  eventId,
  onClose,
  onGranted,
}: {
  eventId: string
  onClose: () => void
  onGranted: (result: any) => void
}) {
  const [form, setForm] = useState({ email: '', access_level: 'view_only' as const })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ invite_token: string; email: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('op_tenant') : null
  const token = typeof window !== 'undefined' ? localStorage.getItem('op_token') : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        body: JSON.stringify({ email: form.email, event_id: eventId, access_level: form.access_level }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to invite client')
      setResult({ invite_token: data.invite_token, email: form.email })
      onGranted(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Build the verify URL (tenant slug is in tenantId for now — in production, use tenant slug)
  const verifyUrl = result
    ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/${tenantId}/client/auth/verify?token=${result.invite_token}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Invite Client</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Grant portal access to a client</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-500/10">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Invitation created</p>
                <p className="text-xs text-muted-foreground mt-1">Share this link with {result.email}</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Magic link (expires 24h)</p>
                <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">{verifyUrl}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-xl text-xs hover:bg-accent transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <a
                  href={`mailto:${result.email}?subject=Your event portal access&body=You've been invited to view your event. Access it here: ${encodeURIComponent(verifyUrl)}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs hover:bg-primary/90 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" /> Send email
                </a>
              </div>
              <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Client email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="client@example.com"
                  required
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Access level</label>
                <div className="relative">
                  <select
                    value={form.access_level}
                    onChange={e => setForm(f => ({ ...f, access_level: e.target.value as any }))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                  >
                    <option value="view_only">View Only — can see event details</option>
                    <option value="collaborator">Collaborator — can review & approve</option>
                    <option value="full_access">Full Access — can see full budget & invoices</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border rounded-xl text-sm hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Inviting…</> : <><UserPlus className="w-3.5 h-3.5" /> Invite Client</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Access Level Badge ────────────────────────────────────────────────────

const ACCESS_CONFIG = {
  view_only:    { label: 'View Only',    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  collaborator: { label: 'Collaborator', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  full_access:  { label: 'Full Access',  color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function EventClientsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('op_token') : null
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('op_tenant') : null

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
  }

  useEffect(() => { loadClients() }, [eventId])

  const loadClients = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/client-portal/events/${eventId}/clients`,
        { headers },
      )
      const data = await res.json()
      setClients(data.clients || [])
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (clientAccountId: string) => {
    setRevoking(clientAccountId)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/client-portal/${eventId}/access/${clientAccountId}`,
        { method: 'DELETE', headers },
      )
      setClients(prev => prev.map(c =>
        c.client_accounts?.id === clientAccountId
          ? { ...c, revoked_at: new Date().toISOString() }
          : c,
      ))
    } finally {
      setRevoking(null)
    }
  }

  const active = clients.filter(c => !c.revoked_at)
  const revoked = clients.filter(c => c.revoked_at)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" /> Client Access
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage which clients can view this event's portal
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Invite Client
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active clients */}
          <div className="space-y-3">
            {active.length === 0 ? (
              <div className="text-center py-16 space-y-3 border border-dashed border-border rounded-2xl">
                <Users className="w-9 h-9 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No clients invited yet</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Invite your first client
                </button>
              </div>
            ) : (
              active.map(c => {
                const client = c.client_accounts
                const accessCfg = ACCESS_CONFIG[c.access_level as keyof typeof ACCESS_CONFIG] || ACCESS_CONFIG.view_only
                return (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 text-sm font-semibold text-indigo-400">
                      {client?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{client?.full_name || client?.email}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', accessCfg.color)}>
                          {accessCfg.label}
                        </span>
                        {!client?.profile_complete && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Not set up
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{client?.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {c.invited_at && (
                          <span className="text-xs text-muted-foreground/60">
                            Invited {new Date(c.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {c.last_viewed_at && (
                          <span className="text-xs text-muted-foreground/60">
                            Last viewed {new Date(c.last_viewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {client?.last_login_at && (
                          <span className="flex items-center gap-1 text-xs text-emerald-500/70">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`mailto:${client?.email}`}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Send email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleRevoke(client?.id)}
                        disabled={revoking === client?.id}
                        className="flex items-center gap-1 px-2.5 py-1 border border-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      >
                        {revoking === client?.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Revoke
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Revoked clients */}
          {revoked.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revoked Access</h3>
              {revoked.map(c => {
                const client = c.client_accounts
                return (
                  <div key={c.id} className="bg-card/50 border border-border rounded-xl p-4 flex items-center gap-4 opacity-50">
                    <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center shrink-0 text-sm font-semibold text-zinc-500">
                      {client?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate line-through">{client?.full_name || client?.email}</p>
                      <p className="text-xs text-muted-foreground">{client?.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Revoked {new Date(c.revoked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {showModal && (
        <GrantClientAccessModal
          eventId={eventId}
          onClose={() => setShowModal(false)}
          onGranted={() => { setShowModal(false); loadClients() }}
        />
      )}
    </div>
  )
}
