'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Users, UserPlus, Search, Mail, Shield, Crown,
  ChevronRight, X, Edit2, Trash2, CheckCircle2, Clock,
  Lock, Eye, Pencil, Zap, ChevronDown, ArrowRightLeft,
  Star, AlertTriangle, MoreVertical, Send, RotateCcw,
  RefreshCw, Loader2, Copy, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ── Role hierarchy ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  label: string
  badge: string
  icon: React.ElementType
  description: string
  rank: number
}> = {
  owner: {
    label: 'Owner',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    icon: Crown,
    description: 'Full workspace control. Cannot be restricted.',
    rank: 4,
  },
  event_manager: {
    label: 'Manager',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Shield,
    description: 'Manages events, team, and most operations.',
    rank: 3,
  },
  team_lead: {
    label: 'Lead',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    icon: Star,
    description: 'Leads sub-teams and assigned tasks.',
    rank: 2,
  },
  team_member: {
    label: 'Member',
    badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    icon: Users,
    description: 'Standard access based on module permissions.',
    rank: 1,
  },
}

const ASSIGNABLE_ROLES = ['event_manager', 'team_lead', 'team_member']

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-zinc-500/10   text-zinc-400   border-zinc-500/20',
  on_leave: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  pending:  'bg-blue-500/10   text-blue-400   border-blue-500/20',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  department?: string
  status: string
  avatar_url?: string
  joined_at?: string
  is_workspace_owner?: boolean
}

interface Invitation {
  id: string
  email: string
  name: string | null
  role: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  accepted_at: string | null
  created_at: string
  users?: { id: string; full_name: string; email: string } | null
}

const INV_STATUS_BADGE: Record<string, string> = {
  pending:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  expired:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  revoked:  'bg-red-500/10 text-red-400 border-red-500/20',
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useApi<T>(path: string, token: string, skip = false) {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token || skip) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [path, token, skip])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

// ── Role Badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role, isOwner }: { role: string; isOwner?: boolean }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.team_member
  const Icon = cfg.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      cfg.badge
    )}>
      <Icon className="w-3 h-3" />
      {cfg.label}
      {isOwner && role === 'owner' && <Crown className="w-3 h-3 text-yellow-400" />}
    </span>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 'md' }: { name: string; url?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size]
  if (url) return <img src={url} alt={name} className={cn(cls, 'rounded-full object-cover')} />
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={cn(cls, 'rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center font-semibold text-white shrink-0')}>
      {initials}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { token, user } = useAuth()
  const { data: raw, loading, refetch } = useApi<{ members?: Member[] }>('/team', token)
  const members: Member[] = raw?.members ?? []

  const [search, setSearch]               = useState('')
  const [roleFilter, setRoleFilter]       = useState<string>('all')
  const [selected, setSelected]           = useState<Member | null>(null)
  const [showInvite, setShowInvite]       = useState(false)
  const [showTransfer, setShowTransfer]   = useState(false)
  const [activeTab, setActiveTab]         = useState<'members' | 'invitations'>('members')

  // Invitations
  const [invitations, setInvitations]   = useState<Invitation[]>([])
  const [invLoading, setInvLoading]     = useState(false)
  const fetchInvitations = useCallback(() => {
    if (!token) return
    setInvLoading(true)
    fetch(`${API}/team/invitations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setInvitations(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setInvLoading(false))
  }, [token])
  useEffect(() => { if (activeTab === 'invitations') fetchInvitations() }, [activeTab, fetchInvitations])

  const pendingCount = invitations.filter(i => i.status === 'pending').length

  // Determine current user's role
  const myMember  = members.find(m => m.email === user?.email)
  const isOwner   = myMember?.role === 'owner'
  const myRank    = ROLE_CONFIG[myMember?.role ?? 'team_member']?.rank ?? 0

  const filtered = members.filter(m => {
    const matchSearch = !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const stats = {
    total:    members.length,
    active:   members.filter(m => m.status === 'active').length,
    managers: members.filter(m => m.role === 'event_manager').length,
    leads:    members.filter(m => m.role === 'team_lead').length,
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage workspace members and their roles
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <button
              onClick={() => setShowTransfer(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Ownership
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => { setShowInvite(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Role hierarchy banner */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role Hierarchy</p>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(ROLE_CONFIG).map(([key, cfg], i, arr) => {
            const Icon = cfg.icon
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border', cfg.badge)}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block">{cfg.description}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: stats.total,    color: 'text-foreground' },
          { label: 'Active',        value: stats.active,   color: 'text-emerald-400' },
          { label: 'Managers',      value: stats.managers, color: 'text-amber-400' },
          { label: 'Team Leads',    value: stats.leads,    color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/40 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/40">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'members'
              ? 'border-violet-500 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Members
          <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-full">{stats.total}</span>
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'invitations'
              ? 'border-violet-500 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Invitations
          {pendingCount > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'members' && <>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border/50 p-1 bg-muted/20">
          {[{ value: 'all', label: 'All' }, ...Object.entries(ROLE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map(r => (
            <button
              key={r.value}
              onClick={() => setRoleFilter(r.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                roleFilter === r.value
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.email === user?.email}
              canManage={isOwner && m.role !== 'owner'}
              onClick={() => setSelected(m)}
              onRoleChange={async (newRole) => {
                await fetch(`${API}/team/${m.user_id}/role`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ role: newRole }),
                })
                refetch()
              }}
              onRemove={async () => {
                if (!confirm(`Remove ${m.full_name} from the workspace?`)) return
                await fetch(`${API}/team/${m.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                })
                refetch()
              }}
            />
          ))}
          {!filtered.length && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No members found</p>
            </div>
          )}
        </div>
      )}

      </>}

      {activeTab === 'invitations' && (
        <InvitationsPanel
          invitations={invitations}
          loading={invLoading}
          token={token}
          onRefresh={fetchInvitations}
        />
      )}

      {/* Modals */}
      {showInvite && (
        <InviteModal
          token={token}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false)
            setActiveTab('invitations')
            fetchInvitations()
          }}
        />
      )}

      {showTransfer && (
        <TransferOwnershipModal
          token={token}
          members={members.filter(m => m.role !== 'owner')}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => { setShowTransfer(false); refetch() }}
        />
      )}

      {selected && (
        <MemberDrawer
          member={selected}
          isMe={selected.email === user?.email}
          canManage={isOwner && selected.role !== 'owner'}
          token={token}
          onClose={() => setSelected(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}

// ── Member Row ─────────────────────────────────────────────────────────────────

function MemberRow({ member: m, isMe, canManage, onClick, onRoleChange, onRemove }: {
  member: Member
  isMe: boolean
  canManage: boolean
  onClick: () => void
  onRoleChange: (role: string) => void
  onRemove: () => void
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/60 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative">
        <Avatar name={m.full_name ?? m.email} url={m.avatar_url} size="md" />
        {m.role === 'owner' && (
          <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 drop-shadow" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{m.full_name ?? m.email}</span>
          {isMe && <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">you</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
      </div>

      {m.department && (
        <span className="hidden sm:block text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
          {m.department}
        </span>
      )}

      <RoleBadge role={m.role} />

      <span className={cn('hidden sm:block text-xs px-2 py-0.5 rounded-full border font-medium capitalize', STATUS_BADGE[m.status] ?? STATUS_BADGE.inactive)}>
        {m.status?.replace('_', ' ')}
      </span>

      {/* Actions — owner-only */}
      {canManage && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {/* Role picker */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted/50 border border-border/40 transition-colors"
            >
              Change Role <ChevronDown className="w-3 h-3" />
            </button>
            {showRoleMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                {ASSIGNABLE_ROLES.map(role => {
                  const cfg = ROLE_CONFIG[role]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={role}
                      onClick={() => { onRoleChange(role); setShowRoleMenu(false) }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors',
                        m.role === role && 'text-violet-400'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                      {m.role === role && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={onRemove}
            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </div>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail]       = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('team_member')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch(`${API}/team/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, name: name.trim() || undefined, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Failed to send invite')
      setDone(data.invite_url ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (done !== null) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Invitation Sent</h2>
            <p className="text-sm text-muted-foreground mt-1">
              An invite link has been sent to <span className="text-foreground font-medium">{email}</span>
            </p>
          </div>
          {done && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Or share this link directly:</p>
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/50 rounded-lg">
                <code className="flex-1 text-xs text-muted-foreground truncate">{done}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(done)}
                  className="shrink-0 p-1 hover:bg-muted/50 rounded transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <button
            onClick={onSuccess}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="text-lg font-semibold">Invite Team Member</h2>
            <p className="text-xs text-muted-foreground mt-0.5">They'll receive an email with an invite link</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="colleague@example.com"
              className="mt-1 w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Full Name <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Pre-fill their name"
              className="mt-1 w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</label>
            <div className="mt-2 space-y-2">
              {ASSIGNABLE_ROLES.map(r => {
                const cfg = ROLE_CONFIG[r]
                const Icon = cfg.icon
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left',
                      role === r
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-border/40 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    <div className={cn('mt-0.5 p-1.5 rounded-md', role === r ? 'bg-violet-500/20' : 'bg-muted/50')}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                    {role === r && <CheckCircle2 className="w-4 h-4 text-violet-400 ml-auto mt-0.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !email}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {sending ? 'Sending Invite…' : 'Send Invitation'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Transfer Ownership Modal ───────────────────────────────────────────────────

function TransferOwnershipModal({ token, members, onClose, onSuccess }: {
  token: string
  members: Member[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit() {
    if (!selected) return
    const member = members.find(m => m.id === selected)
    if (!confirm(`Transfer workspace ownership to ${member?.full_name ?? member?.email}? You will become an Event Manager.`)) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/team/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_owner_user_id: member?.user_id }),
      })
      if (!res.ok) throw new Error((await res.json()).message ?? 'Transfer failed')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              Transfer Ownership
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone without the new owner's approval</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              The selected member will become the new Workspace Owner with full, unconditional access. You will be downgraded to Event Manager.
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                  selected === m.id
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-border/40 hover:border-border hover:bg-muted/30'
                )}
              >
                <Avatar name={m.full_name ?? m.email} url={m.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <RoleBadge role={m.role} />
                {selected === m.id && <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !selected}
            className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Transferring…' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Invitations Panel ─────────────────────────────────────────────────────────

function InvitationsPanel({ invitations, loading, token, onRefresh }: {
  invitations: Invitation[]
  loading: boolean
  token: string
  onRefresh: () => void
}) {
  const [actionId, setActionId] = useState<string | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

  async function revoke(id: string) {
    if (!confirm('Revoke this invitation? The link will stop working immediately.')) return
    setActionId(id)
    try {
      await fetch(`${API_URL}/team/invitations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      onRefresh()
    } finally {
      setActionId(null)
    }
  }

  async function resend(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`${API_URL}/team/invitations/${id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.invite_url) {
        await navigator.clipboard.writeText(data.invite_url)
        alert('New link copied to clipboard!')
      }
      onRefresh()
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!invitations.length) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Send className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No invitations yet</p>
        <p className="text-sm mt-1">Click "Invite Member" to send your first invitation</p>
      </div>
    )
  }

  const grouped: Record<string, Invitation[]> = {
    pending:  invitations.filter(i => i.status === 'pending'),
    accepted: invitations.filter(i => i.status === 'accepted'),
    expired:  invitations.filter(i => i.status === 'expired'),
    revoked:  invitations.filter(i => i.status === 'revoked'),
  }

  return (
    <div className="space-y-6">
      {(['pending', 'accepted', 'expired', 'revoked'] as const).map(status => {
        const group = grouped[status]
        if (!group.length) return null
        return (
          <div key={status}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className={cn('inline-block w-2 h-2 rounded-full', {
                pending:  'bg-blue-400',
                accepted: 'bg-emerald-400',
                expired:  'bg-zinc-500',
                revoked:  'bg-red-400',
              }[status])} />
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="text-muted-foreground/50">({group.length})</span>
            </p>
            <div className="space-y-2">
              {group.map(inv => (
                <InvitationRow
                  key={inv.id}
                  inv={inv}
                  busy={actionId === inv.id}
                  onRevoke={() => revoke(inv.id)}
                  onResend={() => resend(inv.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InvitationRow({ inv, busy, onRevoke, onResend }: {
  inv: Invitation
  busy: boolean
  onRevoke: () => void
  onResend: () => void
}) {
  const roleLabel = {
    event_manager: 'Manager',
    team_lead: 'Lead',
    team_member: 'Member',
  }[inv.role] ?? inv.role

  const daysLeft = inv.status === 'pending'
    ? Math.max(0, Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-slate-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{inv.email}</span>
          {inv.name && (
            <span className="text-xs text-muted-foreground">({inv.name})</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground capitalize">{roleLabel}</span>
          {daysLeft !== null && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className={cn('text-xs', daysLeft <= 1 ? 'text-red-400' : 'text-muted-foreground')}>
                {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
              </span>
            </>
          )}
          {inv.accepted_at && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Accepted {new Date(inv.accepted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </>
          )}
          {inv.status === 'expired' && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Expired {new Date(inv.expires_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className={cn(
        'text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0',
        INV_STATUS_BADGE[inv.status]
      )}>
        {inv.status}
      </span>

      {/* Actions */}
      {(inv.status === 'pending' || inv.status === 'expired') && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onResend}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            title="Resend invitation"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Resend
          </button>
          {inv.status === 'pending' && (
            <button
              onClick={onRevoke}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Revoke invitation"
            >
              <X className="w-3 h-3" />
              Revoke
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Member Drawer ──────────────────────────────────────────────────────────────

function MemberDrawer({ member: m, isMe, canManage, token, onClose, onRefresh }: {
  member: Member
  isMe: boolean
  canManage: boolean
  token: string
  onClose: () => void
  onRefresh: () => void
}) {
  const cfg = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.team_member
  const Icon = cfg.icon

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold">Member Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar name={m.full_name ?? m.email} url={m.avatar_url} size="lg" />
              {m.role === 'owner' && (
                <Crown className="absolute -top-1.5 -right-1.5 w-5 h-5 text-yellow-400 drop-shadow" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">{m.full_name ?? 'Unknown'}</h3>
                {isMe && <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">you</span>}
              </div>
              <p className="text-sm text-muted-foreground">{m.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <RoleBadge role={m.role} />
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', STATUS_BADGE[m.status] ?? STATUS_BADGE.inactive)}>
                  {m.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Role description */}
          <div className={cn('flex items-start gap-3 p-3 rounded-lg border', cfg.badge)}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{cfg.label}</p>
              <p className="text-xs opacity-80 mt-0.5">{cfg.description}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {m.department && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm font-medium mt-0.5">{m.department}</p>
              </div>
            )}
            {m.joined_at && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="text-sm font-medium mt-0.5">
                  {new Date(m.joined_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Owner notice */}
          {m.role === 'owner' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Crown className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
              <p className="text-xs text-violet-300">
                This member is the Workspace Owner. Their access cannot be restricted or modified by anyone else. Ownership can only be transferred by the owner themselves.
              </p>
            </div>
          )}
        </div>

        {canManage && (
          <div className="p-6 border-t border-border/50 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Change Role</p>
            <div className="grid grid-cols-3 gap-2">
              {ASSIGNABLE_ROLES.map(role => {
                const rc = ROLE_CONFIG[role]
                return (
                  <button
                    key={role}
                    onClick={async () => {
                      await fetch(`${API}/team/${m.user_id}/role`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ role }),
                      })
                      onRefresh()
                      onClose()
                    }}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium border transition-colors',
                      m.role === role
                        ? rc.badge
                        : 'border-border/40 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    {rc.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
