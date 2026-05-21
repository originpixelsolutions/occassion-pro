'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Plus, Mail, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  last_active?: string
  avatar_url?: string
}

// ── Role reference (UI only) ──────────────────────────────────────────────────

const ROLES = [
  { id: 'owner',        label: 'Owner',       description: 'Full access to everything including billing',            color: 'text-violet-400' },
  { id: 'admin',        label: 'Admin',        description: 'Full access to all modules within the tenant',           color: 'text-orange-400' },
  { id: 'manager',      label: 'Manager',      description: 'Manage events, team, vendors and clients',              color: 'text-yellow-400' },
  { id: 'coordinator',  label: 'Coordinator',  description: 'Execute events, update tasks and coordinate teams',     color: 'text-blue-400' },
  { id: 'staff',        label: 'Staff',        description: 'View assigned tasks and events only',                   color: 'text-muted-foreground' },
  { id: 'finance',      label: 'Finance',      description: 'Access to financial modules only',                      color: 'text-emerald-400' },
  { id: 'support',      label: 'Support',      description: 'Access to support and ticketing only',                  color: 'text-violet-400' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamSettingsPage() {
  const { token } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('coordinator')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetch(`${API}/team`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : []))
      setMembers(Array.isArray(data) ? data : (data.data ?? data.members ?? []))
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleInvite = async () => {
    if (!token || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch(`${API}/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setInviteError(err.message ?? 'Failed to send invite')
        return
      }
      setInviteEmail('')
      setShowInvite(false)
      load()
    } catch {
      setInviteError('Network error')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!token) return
    setUpdatingId(userId)
    try {
      await fetch(`${API}/team/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      })
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId || m.id === userId ? { ...m, role: newRole } : m)),
      )
    } catch {
      /* silent */
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!token) return
    setRemovingId(memberId)
    try {
      await fetch(`${API}/team/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setMembers((prev) => prev.filter((m) => m.id !== memberId && m.user_id !== memberId))
    } catch {
      /* silent */
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage team members and their access roles.</p>
      </div>

      {/* Invite row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {loading ? '…' : `${members.length} team member${members.length !== 1 ? 's' : ''}`}
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Invite Member
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold">Invite Team Member</h4>
          <div className="flex gap-3">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="Email address"
              type="email"
              className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <select
              value={inviteRo