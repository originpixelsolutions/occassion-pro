'use client'

/**
 * OccasionPro — Event Team Access Page
 *
 * Displays all workspace members with their event-level access status.
 * Owners and Event Managers can:
 *   - Remove a member from this event (workspace account stays intact)
 *   - Set per-module access overrides for a member
 *   - Re-add a removed member
 *
 * Access priority displayed visually:
 *   Active with no overrides → uses workspace role defaults
 *   Active with overrides    → custom per-module access
 *   Removed                  → blocked from this event
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Shield,
  Crown,
  Star,
  UserX,
  UserCheck,
  Settings2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Edit3,
  Lock,
  Unlock,
  RotateCcw,
  Search,
  Filter,
  Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

type WorkspaceRole = 'owner' | 'event_manager' | 'team_lead' | 'team_member'
type ModuleAccess = 'none' | 'view' | 'edit' | 'full'

interface ModuleOverrides {
  [key: string]: ModuleAccess
}

interface EventTeamMember {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  workspace_role: WorkspaceRole
  is_active: boolean
  module_overrides: ModuleOverrides | null
  added_by: string | null
  added_at: string | null
  removed_by: string | null
  removed_at: string | null
}

interface MyAccess {
  role: WorkspaceRole
  can_manage: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; color: string; icon: typeof Crown }> = {
  owner:         { label: 'Workspace Owner', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', icon: Crown },
  event_manager: { label: 'Event Manager',   color: 'text-amber-400  bg-amber-500/10  border-amber-500/20',  icon: Shield },
  team_lead:     { label: 'Team Lead',        color: 'text-blue-400   bg-blue-500/10   border-blue-500/20',   icon: Star },
  team_member:   { label: 'Team Member',      color: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',   icon: Users },
}

const ALL_MODULES = [
  { key: 'crm',         label: 'CRM & Sales' },
  { key: 'finance',     label: 'Finance' },
  { key: 'guests',      label: 'Guest Management' },
  { key: 'vendors',     label: 'Vendor Management' },
  { key: 'operations',  label: 'Operations' },
  { key: 'production',  label: 'Production' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'artists',     label: 'Artist Management' },
  { key: 'venues',      label: 'Venue Management' },
  { key: 'inventory',   label: 'Inventory' },
  { key: 'marketing',   label: 'Marketing' },
  { key: 'support',     label: 'Support' },
]

const ACCESS_CONFIG: Record<ModuleAccess, { label: string; color: string; icon: typeof Eye }> = {
  none: { label: 'No Access', color: 'text-red-400',   icon: Lock },
  view: { label: 'View Only', color: 'text-blue-400',  icon: Eye },
  edit: { label: 'Edit',      color: 'text-amber-400', icon: Edit3 },
  full: { label: 'Full',      color: 'text-emerald-400', icon: Unlock },
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────

function AccessBadge({ isActive, overrides }: { isActive: boolean; overrides: ModuleOverrides | null }) {
  if (!isActive) {
    return (
      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        Removed from event
      </span>
    )
  }
  if (overrides && Object.keys(overrides).length > 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
        <Settings2 className="w-3 h-3" />
        Custom access ({Object.keys(overrides).length} override{Object.keys(overrides).length > 1 ? 's' : ''})
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
      <CheckCircle2 className="w-3 h-3" />
      Role defaults
    </span>
  )
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  const cfg = ROLE_CONFIG[role]
  const Icon = cfg.icon
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Module Override Editor ────────────────────────────────────────────────

function ModuleOverrideEditor({
  member,
  onSave,
  onClear,
  onClose,
}: {
  member: EventTeamMember
  onSave: (overrides: ModuleOverrides) => Promise<void>
  onClear: () => Promise<void>
  onClose: () => void
}) {
  const [overrides, setOverrides] = useState<ModuleOverrides>(member.module_overrides ?? {})
  const [saving, setSaving] = useState(false)

  const setAccess = (moduleKey: string, value: ModuleAccess | '') => {
    setOverrides(prev => {
      const next = { ...prev }
      if (value === '') {
        delete next[moduleKey]
      } else {
        next[moduleKey] = value
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(overrides)
    setSaving(false)
    onClose()
  }

  const handleClear = async () => {
    setSaving(true)
    await onClear()
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Module Access Overrides</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Customise <span className="text-white">{member.name}</span>'s access for this event.
                Overrides take precedence over their workspace role.
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <RoleBadge role={member.workspace_role} />
            <span className="text-zinc-600 text-xs">•</span>
            <span className="text-xs text-zinc-400">Workspace role sets the baseline</span>
          </div>
        </div>

        {/* Module list */}
        <div className="px-5 py-3 max-h-80 overflow-y-auto space-y-1">
          {ALL_MODULES.map(mod => {
            const current = overrides[mod.key] ?? ''
            return (
              <div key={mod.key} className="flex items-center justify-between py-2">
                <span className="text-sm text-zinc-300">{mod.label}</span>
                <select
                  value={current}
                  onChange={e => setAccess(mod.key, e.target.value as ModuleAccess | '')}
                  className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-zinc-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="">— Use role default</option>
                  <option value="none">No Access</option>
                  <option value="view">View Only</option>
                  <option value="edit">Edit</option>
                  <option value="full">Full Access</option>
                </select>
              </div>
            )
          })}
        </div>

        {/* Info */}
        <div className="px-5 py-2 bg-blue-500/5 border-t border-blue-500/10">
          <p className="text-xs text-blue-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Leave a module at "Use role default" to inherit permissions from their workspace role.
            Selecting "No Access" explicitly blocks that module on this event only.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            onClick={handleClear}
            disabled={saving || !member.module_overrides || Object.keys(member.module_overrides).length === 0}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset all overrides
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white border border-zinc-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save overrides'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Member Row ────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  onRemove,
  onReAdd,
  onEditOverrides,
}: {
  member: EventTeamMember
  canManage: boolean
  onRemove: (member: EventTeamMember) => void
  onReAdd: (member: EventTeamMember) => void
  onEditOverrides: (member: EventTeamMember) => void
}) {
  const isOwner = member.workspace_role === 'owner'

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
      member.is_active
        ? 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
        : 'bg-red-500/5 border-red-500/10 opacity-60'
    }`}>

      {/* Avatar */}
      <div className="relative shrink-0">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
            {getInitials(member.name)}
          </div>
        )}
        {isOwner && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
            <Crown className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white truncate">{member.name}</span>
          <RoleBadge role={member.workspace_role} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-zinc-500 truncate">{member.email}</span>
          {!member.is_active && member.removed_at && (
            <span className="text-xs text-zinc-600">
              Removed {formatDate(member.removed_at)}
            </span>
          )}
        </div>
      </div>

      {/* Access status */}
      <div className="shrink-0">
        {isOwner ? (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Crown className="w-3 h-3" />
            Cannot be restricted
          </span>
        ) : (
          <AccessBadge isActive={member.is_active} overrides={member.module_overrides} />
        )}
      </div>

      {/* Actions */}
      {canManage && !isOwner && (
        <div className="shrink-0 flex items-center gap-1">
          {member.is_active ? (
            <>
              <button
                onClick={() => onEditOverrides(member)}
                title="Edit module access overrides"
                className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRemove(member)}
                title="Remove from this event"
                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onReAdd(member)}
              title="Re-add to this event"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
            >
              <UserCheck className="w-3 h-3" />
              Re-add
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Remove Confirm Modal ─────────────────────────────────────────────────

function RemoveConfirmModal({
  member,
  onConfirm,
  onClose,
}: {
  member: EventTeamMember
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(reason)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Remove from event</h3>
            <p className="text-xs text-zinc-400">
              {member.name} will lose access to this event only.
            </p>
          </div>
        </div>

        <div className="p-3 mb-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <p className="text-xs text-amber-300">
            This only affects their access to this event. Their workspace account and access to other events remain unchanged.
          </p>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1.5">
            Reason (optional)
          </label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. No longer assigned to this event"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white border border-zinc-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Removing…' : 'Remove from event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function EventTeamPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params

  const [members, setMembers] = useState<EventTeamMember[]>([])
  const [myAccess, setMyAccess] = useState<MyAccess>({ role: 'team_member', can_manage: false })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'removed' | 'overrides'>('all')
  const [removingMember, setRemovingMember] = useState<EventTeamMember | null>(null)
  const [editingOverrides, setEditingOverrides] = useState<EventTeamMember | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Fetch team
  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/team`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMembers(data.members ?? [])
    } catch {
      showToast('Failed to load event team', 'error')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  // Fetch my role
  const fetchMyRole = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const role = data.tenant_role as WorkspaceRole
      setMyAccess({
        role,
        can_manage: role === 'owner' || role === 'event_manager',
      })
    } catch {}
  }, [])

  useEffect(() => {
    fetchTeam()
    fetchMyRole()
  }, [fetchTeam, fetchMyRole])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleRemove = async (member: EventTeamMember, reason: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/team/${member.user_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed')
      showToast(`${member.name} removed from this event`)
      fetchTeam()
    } catch (e: any) {
      showToast(e.message ?? 'Failed to remove member', 'error')
    }
  }

  const handleReAdd = async (member: EventTeamMember) => {
    try {
      const res = await fetch(`/api/events/${eventId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: member.user_id }),
      })
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed')
      showToast(`${member.name} re-added to this event`)
      fetchTeam()
    } catch (e: any) {
      showToast(e.message ?? 'Failed to re-add member', 'error')
    }
  }

  const handleSaveOverrides = async (member: EventTeamMember, overrides: ModuleOverrides) => {
    const res = await fetch(`/api/events/${eventId}/team/${member.user_id}/access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ overrides }),
    })
    if (!res.ok) throw new Error((await res.json()).message ?? 'Failed')
    showToast(`Access overrides saved for ${member.name}`)
    fetchTeam()
  }

  const handleClearOverrides = async (member: EventTeamMember) => {
    const res = await fetch(`/api/events/${eventId}/team/${member.user_id}/access`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error((await res.json()).message ?? 'Failed')
    showToast(`Access overrides cleared for ${member.name}`)
    fetchTeam()
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = {
    total:    members.length,
    active:   members.filter(m => m.is_active).length,
    removed:  members.filter(m => !m.is_active).length,
    overrides: members.filter(m => m.is_active && m.module_overrides && Object.keys(m.module_overrides).length > 0).length,
    managers: members.filter(m => m.workspace_role === 'event_manager').length,
    leads:    members.filter(m => m.workspace_role === 'team_lead').length,
  }

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = members.filter(m => {
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())

    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? m.is_active :
      filter === 'removed' ? !m.is_active :
      filter === 'overrides' ? (m.module_overrides != null && Object.keys(m.module_overrides).length > 0) :
      true

    return matchSearch && matchFilter
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-zinc-950">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Event Team Access</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Manage who can access this event and customise per-module permissions.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          {[
            { label: 'Total assigned', value: stats.total, color: 'text-white' },
            { label: 'Active',         value: stats.active, color: 'text-emerald-400' },
            { label: 'Removed',        value: stats.removed, color: 'text-red-400' },
            { label: 'Custom access',  value: stats.overrides, color: 'text-amber-400' },
            { label: 'Managers',       value: stats.managers, color: 'text-amber-400' },
            { label: 'Team Leads',     value: stats.leads, color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-800">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1">
          {(['all', 'active', 'removed', 'overrides'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                filter === f
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'overrides' ? 'Custom' : f}
              {f === 'removed' && stats.removed > 0 && (
                <span className="ml-1 px-1 bg-red-500/30 text-red-400 rounded text-[10px]">
                  {stats.removed}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Role hierarchy info bar */}
      <div className="px-6 py-2 flex items-center gap-2 bg-zinc-900/30 border-b border-zinc-800">
        <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <p className="text-xs text-zinc-500">
          Event-level removal and overrides apply to this event only.
          Workspace role and access to other events are unaffected.
          The <span className="text-violet-400">Workspace Owner</span> always has full access and cannot be restricted.
        </p>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Users className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">
              {search ? 'No members match your search' : 'No members found for this filter'}
            </p>
          </div>
        ) : (
          filtered.map(member => (
            <MemberRow
              key={member.user_id}
              member={member}
              canManage={myAccess.can_manage}
              onRemove={setRemovingMember}
              onReAdd={handleReAdd}
              onEditOverrides={setEditingOverrides}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {removingMember && (
        <RemoveConfirmModal
          member={removingMember}
          onConfirm={reason => handleRemove(removingMember, reason)}
          onClose={() => setRemovingMember(null)}
        />
      )}

      {editingOverrides && (
        <ModuleOverrideEditor
          member={editingOverrides}
          onSave={overrides => handleSaveOverrides(editingOverrides, overrides)}
          onClear={() => handleClearOverrides(editingOverrides)}
          onClose={() => setEditingOverrides(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-zinc-900 border-zinc-700 text-white'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <XCircle className="w-4 h-4" />
          }
          {toast.message}
        </div>
      )}
    </div>
  )
}
