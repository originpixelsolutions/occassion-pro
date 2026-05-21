'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, Plus, Trash2, Edit2, Users, Key, Lock,
  ChevronRight, Search, Check, X, AlertTriangle, Clock,
  Settings, BookOpen, Eye, RefreshCw, Shield,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// ── Helpers ────────────────────────────────────────────────────────────────

function api(token: string) {
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  return {
    get: (path: string) => fetch(`${API}/v1/rbac${path}`, { headers: h }).then(r => r.json()),
    post: (path: string, body?: any) => fetch(`${API}/v1/rbac${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(r => r.json()),
    put: (path: string, body?: any) => fetch(`${API}/v1/rbac${path}`, { method: 'PUT', headers: h, body: JSON.stringify(body) }).then(r => r.json()),
    patch: (path: string, body?: any) => fetch(`${API}/v1/rbac${path}`, { method: 'PATCH', headers: h, body: JSON.stringify(body) }).then(r => r.json()),
    del: (path: string) => fetch(`${API}/v1/rbac${path}`, { method: 'DELETE', headers: h }).then(r => r.json()),
  }
}

const ROLE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

const CATEGORY_ICONS: Record<string, any> = {
  events: Shield,
  crm: Users,
  finance: BookOpen,
  vendors: Settings,
  team: Users,
  settings: Settings,
  rbac: Lock,
  analytics: Eye,
  documents: BookOpen,
  playbooks: BookOpen,
  integrations: Settings,
  command_center: ShieldCheck,
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Permission {
  id: string
  code: string
  resource: string
  action: string
  category: string
  description?: string
}

interface Role {
  id: string
  name: string
  description?: string
  color: string
  priority: number
  is_system: boolean
  permission_count: number
  member_count: number
  permissions?: Permission[]
  members?: any[]
  created_at: string
}

interface AuditEntry {
  id: string
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, any>
  created_at: string
  profiles?: { full_name?: string; email: string }
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted/40', className)} />
}

// ── Permission Checkbox Row ────────────────────────────────────────────────

function PermissionRow({
  permission,
  checked,
  disabled,
  onToggle,
}: {
  permission: Permission
  checked: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent',
    )}>
      <div
        onClick={() => !disabled && onToggle(permission.id)}
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
          checked
            ? 'bg-primary border-primary'
            : 'border-border bg-background',
          disabled && 'pointer-events-none',
        )}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-mono text-foreground">{permission.code}</span>
        {permission.description && (
          <p className="text-[11px] text-muted-foreground truncate">{permission.description}</p>
        )}
      </div>
      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
        permission.action === 'write' ? 'bg-orange-500/10 text-orange-400' :
        permission.action === 'delete' ? 'bg-red-500/10 text-red-400' :
        permission.action === 'admin' ? 'bg-purple-500/10 text-purple-400' :
        'bg-blue-500/10 text-blue-400',
      )}>
        {permission.action}
      </span>
    </label>
  )
}

// ── Create/Edit Role Modal ─────────────────────────────────────────────────

function RoleModal({
  role,
  onClose,
  onSave,
}: {
  role?: Role | null
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [color, setColor] = useState(role?.color ?? ROLE_COLORS[0])
  const [priority, setPriority] = useState(role?.priority ?? 0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), description, color, priority })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{role ? 'Edit Role' : 'Create Role'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Event Coordinator"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="What can members with this role do?"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all',
                      color === c && 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="w-28">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                min={0}
                max={100}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : role ? 'Update Role' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  // State
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({})
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set())
  const [members, setMembers] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [allMembers, setAllMembers] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingPerms, setSavingPerms] = useState(false)
  const [pendingPermIds, setPendingPermIds] = useState<Set<string> | null>(null)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'permissions' | 'members' | 'audit'>('permissions')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null)

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [rolesRes, permsRes, membersRes] = await Promise.all([
        api(token).get('/roles'),
        api(token).get('/permissions'),
        api(token).get('/members'),
      ])
      setRoles(rolesRes.roles ?? [])
      // Group permissions by category
      const grouped: Record<string, Permission[]> = permsRes.grouped ?? {}
      setPermissions(grouped)
      setAllMembers(membersRes.members ?? [])
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadRoleDetail = useCallback(async (role: Role) => {
    if (!token) return
    setDetailLoading(true)
    try {
      const [detail, auditRes] = await Promise.all([
        api(token).get(`/roles/${role.id}`),
        api(token).get(`/audit-log?limit=50`),
      ])
      const permIds = new Set<string>((detail.permissions ?? []).map((p: Permission) => p.id))
      setRolePermIds(permIds)
      setPendingPermIds(new Set(permIds))
      setMembers(detail.members ?? [])
      setAuditLog((auditRes.entries ?? []).filter((e: AuditEntry) => e.target_id === role.id))
    } finally {
      setDetailLoading(false)
    }
  }, [token])

  useEffect(() => { loadRoles() }, [loadRoles])

  useEffect(() => {
    if (selectedRole) loadRoleDetail(selectedRole)
  }, [selectedRole, loadRoleDetail])

  // ── Derived ──────────────────────────────────────────────────────────────

  const filteredRoles = roles.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()),
  )

  const categories = Object.keys(permissions).sort()

  const filteredPermissions = categoryFilter === 'all'
    ? permissions
    : { [categoryFilter]: permissions[categoryFilter] ?? [] }

  const hasChanges = pendingPermIds !== null &&
    (pendingPermIds.size !== rolePermIds.size ||
     [...pendingPermIds].some(id => !rolePermIds.has(id)))

  // ── Actions ──────────────────────────────────────────────────────────────

  async function savePermissions() {
    if (!selectedRole || !pendingPermIds) return
    setSavingPerms(true)
    try {
      await api(token).put(`/roles/${selectedRole.id}/permissions`, {
        permission_ids: [...pendingPermIds],
      })
      setRolePermIds(new Set(pendingPermIds))
      // Update count in roles list
      setRoles(prev => prev.map(r =>
        r.id === selectedRole.id ? { ...r, permission_count: pendingPermIds.size } : r,
      ))
    } finally {
      setSavingPerms(false)
    }
  }

  function togglePerm(permId: string) {
    if (!pendingPermIds) return
    const next = new Set(pendingPermIds)
    if (next.has(permId)) next.delete(permId)
    else next.add(permId)
    setPendingPermIds(next)
  }

  async function handleCreateRole(data: any) {
    await api(token).post('/roles', data)
    setShowCreateModal(false)
    loadRoles()
  }

  async function handleUpdateRole(data: any) {
    if (!editRole) return
    await api(token).patch(`/roles/${editRole.id}`, data)
    setEditRole(null)
    loadRoles()
    if (selectedRole?.id === editRole.id) {
      setSelectedRole(prev => prev ? { ...prev, ...data } : null)
    }
  }

  async function handleDeleteRole() {
    if (!confirmDelete) return
    await api(token).del(`/roles/${confirmDelete.id}`)
    setConfirmDelete(null)
    if (selectedRole?.id === confirmDelete.id) setSelectedRole(null)
    loadRoles()
  }

  async function removeRoleFromMember(profileId: string) {
    if (!selectedRole) return
    await api(token).del(`/profiles/${profileId}/roles/${selectedRole.id}`)
    setMembers(prev => prev.filter(m => m.id !== profileId))
    setRoles(prev => prev.map(r =>
      r.id === selectedRole.id ? { ...r, member_count: Math.max(0, r.member_count - 1) } : r,
    ))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Role List */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h1 className="font-semibold text-sm">Roles & Permissions</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
              title="Create role"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search roles…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Role list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))
          ) : filteredRoles.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">No roles found</div>
          ) : (
            filteredRoles.map(role => {
              const active = selectedRole?.id === role.id
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group',
                    active ? 'bg-primary/10' : 'hover:bg-accent',
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: role.color }}
                  >
                    {role.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm font-medium truncate', active && 'text-primary')}>
                        {role.name}
                      </span>
                      {role.is_system && (
                        <Lock className="w-3 h-3 text-muted-foreground shrink-0" title="System role" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {role.permission_count} perms
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {role.member_count} members
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                    active && 'opacity-100',
                  )}>
                    {!role.is_system && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setEditRole(role) }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete(role) }}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer stat */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            {roles.filter(r => r.is_system).length} system · {roles.filter(r => !r.is_system).length} custom roles
          </p>
        </div>
      </aside>

      {/* Right: Detail Panel */}
      {!selectedRole ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">Select a Role</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a role to manage its permissions and members
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedRole.color }}
              >
                {selectedRole.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{selectedRole.name}</h2>
                  {selectedRole.is_system && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> System
                    </span>
                  )}
                </div>
                {selectedRole.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedRole.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadRoleDetail(selectedRole)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {!selectedRole.is_system && (
                <button
                  onClick={() => setEditRole(selectedRole)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3 h-3" /> Edit Role
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="px-6 py-3 flex items-center gap-6 border-b border-border shrink-0">
            <div className="flex items-center gap-1.5 text-sm">
              <Key className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">{(pendingPermIds ?? rolePermIds).size}</span>
              <span className="text-muted-foreground">permissions</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold">{members.length}</span>
              <span className="text-muted-foreground">members</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Priority {selectedRole.priority}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b border-border flex items-center gap-0 shrink-0">
            {[
              { id: 'permissions', label: 'Permissions', icon: Key },
              { id: 'members', label: `Members (${members.length})`, icon: Users },
              { id: 'audit', label: 'Audit Log', icon: Clock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors',
                  tab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : tab === 'permissions' ? (
              <div className="flex flex-col h-full">
                {/* Category filter */}
                <div className="px-6 pt-4 pb-2 flex items-center gap-2 flex-wrap shrink-0">
                  {['all', ...categories].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-full font-medium transition-colors capitalize',
                        categoryFilter === cat
                          ? 'bg-primary text-white'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Permissions matrix */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {Object.entries(filteredPermissions).map(([category, perms]) => {
                    const CatIcon = CATEGORY_ICONS[category] ?? Shield
                    return (
                      <div key={category} className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                            {category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({perms.filter(p => pendingPermIds?.has(p.id) ?? rolePermIds.has(p.id)).length}/{perms.length})
                          </span>
                          {!selectedRole.is_system && (
                            <button
                              onClick={() => {
                                const allSelected = perms.every(p => pendingPermIds?.has(p.id))
                                const next = new Set(pendingPermIds ?? rolePermIds)
                                if (allSelected) perms.forEach(p => next.delete(p.id))
                                else perms.forEach(p => next.add(p.id))
                                setPendingPermIds(next)
                              }}
                              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {perms.every(p => pendingPermIds?.has(p.id)) ? 'Deselect all' : 'Select all'}
                            </button>
                          )}
                        </div>
                        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/50">
                          {perms.map(perm => (
                            <PermissionRow
                              key={perm.id}
                              permission={perm}
                              checked={pendingPermIds ? pendingPermIds.has(perm.id) : rolePermIds.has(perm.id)}
                              disabled={selectedRole.is_system}
                              onToggle={togglePerm}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Save bar */}
                {hasChanges && !selectedRole.is_system && (
                  <div className="px-6 py-3 border-t border-border bg-card/80 backdrop-blur flex items-center justify-between shrink-0">
                    <span className="text-xs text-muted-foreground">You have unsaved permission changes</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPendingPermIds(new Set(rolePermIds))}
                        className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        onClick={savePermissions}
                        disabled={savingPerms}
                        className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {savingPerms ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : tab === 'members' ? (
              <div className="p-6">
                {members.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No members assigned to this role</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-accent/40 transition-colors group">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {m.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.full_name ?? 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        {m.expires_at && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Clock className="w-3 h-3" />
                            Expires {new Date(m.expires_at).toLocaleDateString()}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          since {new Date(m.assigned_at).toLocaleDateString()}
                        </div>
                        {!selectedRole.is_system && (
                          <button
                            onClick={() => removeRoleFromMember(m.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                            title="Remove from role"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Audit Log */
              <div className="p-6">
                {auditLog.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No audit events for this role</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          entry.action.includes('created') ? 'bg-green-500/10 text-green-400' :
                          entry.action.includes('deleted') ? 'bg-red-500/10 text-red-400' :
                          entry.action.includes('granted') ? 'bg-blue-500/10 text-blue-400' :
                          entry.action.includes('revoked') ? 'bg-orange-500/10 text-orange-400' :
                          'bg-muted text-muted-foreground',
                        )}>
                          <Shield className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium capitalize">
                            {entry.action.replace(/_/g, ' ')}
                          </p>
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {JSON.stringify(entry.metadata)}
                            </p>
                          )}
                          {entry.profiles && (
                            <p className="text-xs text-muted-foreground">
                              by {entry.profiles.full_name ?? entry.profiles.email}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showCreateModal && (
        <RoleModal onClose={() => setShowCreateModal(false)} onSave={handleCreateRole} />
      )}
      {editRole && (
        <RoleModal role={editRole} onClose={() => setEditRole(null)} onSave={handleUpdateRole} />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Role</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <strong className="text-foreground">{confirmDelete.name}</strong>?
              {confirmDelete.member_count > 0 && (
                <> This role has <strong className="text-amber-400">{confirmDelete.member_count} members</strong> who will lose associated permissions.</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRole}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
