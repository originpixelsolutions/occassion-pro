'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Users, Trash2, Plus, Check, X, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

type Permission = {
  id?: string
  key: string
  label?: string
  name?: string
  description?: string
  module?: string
}

type Role = {
  id: string
  name: string
  label?: string
  description?: string
  color?: string
  is_system?: boolean
  isSystem?: boolean
  member_count?: number
  memberCount?: number
  permissions?: { permission?: Permission; key?: string; name?: string }[]
}

// ── Fallback permission labels ────────────────────────────────────────────────

function permLabel(p: { permission?: Permission; key?: string; name?: string }): string {
  if (p.permission?.label) return p.permission.label
  if (p.permission?.name)  return p.permission.name
  const k = p.key ?? p.permission?.key ?? ''
  return k
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function roleColor(role: Role): string {
  if (role.color) return role.color
  const name = (role.name ?? role.label ?? '').toLowerCase()
  if (name.includes('owner'))   return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
  if (name.includes('admin'))   return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
  if (name.includes('manager')) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  if (name.includes('lead'))    return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
  if (name.includes('finance')) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  return 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
}

// ── Role Row ──────────────────────────────────────────────────────────────────

function RoleRow({
  role,
  onDelete,
  deleting,
}: {
  role: Role
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const perms = role.permissions ?? []
  const isSystem = role.is_system ?? role.isSystem ?? false
  const memberCount = role.member_count ?? role.memberCount ?? 0
  const displayLabel = role.label ?? role.name ?? 'Unknown'

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('text-xs font-semibold px-2 py-1 rounded-full', roleColor(role))}>
            {displayLabel}
          </div>
          {role.description && (
            <p className="text-xs text-muted-foreground hidden sm:block">{role.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{memberCount}</span>
          </div>
          {perms.length > 0 && (
            <div className="text-xs text-muted-foreground">{perms.length} perms</div>
          )}
          {!isSystem && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(role.id)
              }}
              disabled={deleting}
              className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Permission grid */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface/30">
          {isSystem && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              System roles cannot be modified
            </p>
          )}
          {perms.length === 0 ? (
            <p className="text-xs text-muted-foreground">No permissions assigned.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {perms.map((p, i) => (
                <div
                  key={p.key ?? p.permission?.key ?? i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-green-500/8 text-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="font-medium">{permLabel(p)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create Role Modal ─────────────────────────────────────────────────────────

function CreateRoleModal({
  onClose,
  onCreated,
  token,
}: {
  onClose: () => void
  onCreated: () => void
  token: string
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/rbac/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.message ?? 'Failed to create role')
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-base font-semibold">Create Custom Role</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Role Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finance Lead"
              className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role can do"
              className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Role
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { token } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetch(`${API}/rbac/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : []))
      setRoles(Array.isArray(data) ? data : (data.data ?? data.roles ?? []))
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleDelete = async (roleId: string) => {
    if (!token) return
    setDeletingId(roleId)
    try {
      await fetch(`${API}/rbac/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setRoles((prev) => prev.filter((r) => r.id !== roleId))
    } catch {
      /* silent */
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {showCreate && token && (
        <CreateRoleModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define what each role can access and do in your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Custom Role</span>
          </button>
        </div>
      </div>

      {/* Role hierarchy info */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Role Hierarchy</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            OccasionPro uses a role-based access system where higher roles have broader permissions.
            System roles cannot be modified. Custom roles can be created with any combination of permissions.
            Event-level overrides can further restrict or extend individual access on a per-event basis.
          </p>
        </div>
      </div>

      {/* Role cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border rounded-xl px-4 py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 rounded-full bg-muted/60" />
                <div className="h-4 w-48 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No roles found. Create a custom role to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              onDelete={handleDelete}
              deleting={deletingId === role.id}
            />
          ))}
        </div>
      )}

      {/* Event-level overrides note */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Event-Level Module Overrides</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Beyond workspace roles, Owners and Event Managers can grant or restrict access to specific modules
          (CRM, Finance, Guests, Vendors, etc.) for individual team members on a per-event basis.
          Overrides are managed from each event&apos;s <strong>Team</strong> settings.
        </p>
      </div>
    </div>
  )
}
