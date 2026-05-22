'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search, RefreshCw, ShieldOff, LogOut, ChevronDown, UserCog } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''
}

interface PlatformUser {
  id: string
  email: string
  full_name: string | null
  role: string
  tenant_id: string
  tenant_name: string | null
  status: string
  last_login: string | null
  created_at: string
}

const ROLE_COLOR: Record<string, string> = {
  owner:   'text-violet-400 bg-violet-400/10 border-violet-400/20',
  admin:   'text-blue-400 bg-blue-400/10 border-blue-400/20',
  manager: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  member:  'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
}

function fmtDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRelative(d: string | null) {
  if (!d) return 'Never'
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

export default function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<PlatformUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [roleChange, setRoleChange] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/users?limit=200`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : data.users ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const doAction = async (action: string, userId: string, body?: object) => {
    setActionLoading(`${action}-${userId}`)
    try {
      await fetch(`${API}/super-admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      await load()
      setSelected(null)
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (statusFilter !== 'all' && u.status !== statusFilter) return false
    if (search && ![u.email, u.full_name, u.tenant_name].some(v => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  const roles = ['all', ...Array.from(new Set(users.map(u => u.role)))]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">User Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">All users across all tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{users.length} total users</span>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, tenant..."
            className="pl-8 pr-3 py-1.5 text-xs bg-card/60 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-56"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="text-xs bg-card/60 border border-border/50 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 capitalize"
        >
          {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs bg-card/60 border border-border/50 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-background/30">
                {['User', 'Tenant', 'Role', 'Status', 'Last Login', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted/30 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length ? (
                filtered.map(u => (
                  <tr key={u.id} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">{u.full_name ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{u.tenant_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${ROLE_COLOR[u.role] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        u.status === 'active' ? 'text-emerald-400 bg-emerald-400/10' :
                        u.status === 'suspended' ? 'text-red-400 bg-red-400/10' :
                        'text-amber-400 bg-amber-400/10'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtRelative(u.last_login)}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(u); setRoleChange(u.role) }}
                        className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <UserCog className="w-3 h-3" /> Manage
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border/50 p-5 overflow-y-auto z-40 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold">Manage User</h3>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-foreground">✕</button>
          </div>

          <div className="space-y-2 mb-6">
            <div className="p-3 bg-background/60 rounded-xl">
              <p className="text-xs font-semibold text-foreground">{selected.full_name ?? 'No name'}</p>
              <p className="text-[11px] text-muted-foreground">{selected.email}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{selected.tenant_name}</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Role change */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 block">Change Role</label>
              <div className="flex gap-2">
                <select
                  value={roleChange}
                  onChange={e => setRoleChange(e.target.value)}
                  className="flex-1 text-xs bg-background border border-border/60 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {['owner','admin','manager','member'].map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
                <button
                  onClick={() => doAction('change-role', selected.id, { role: roleChange })}
                  disabled={actionLoading === `change-role-${selected.id}` || roleChange === selected.role}
                  className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="border-t border-border/30 pt-3 space-y-2">
              {/* Force logout */}
              <button
                onClick={() => doAction('force-logout', selected.id)}
                disabled={actionLoading === `force-logout-${selected.id}`}
                className="w-full flex items-center gap-2 text-xs text-amber-400 hover:bg-amber-400/10 px-3 py-2 rounded-lg border border-amber-400/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Force Logout All Sessions
              </button>

              {/* Suspend / Reactivate */}
              {selected.status === 'active' ? (
                <button
                  onClick={() => doAction('suspend', selected.id)}
                  disabled={actionLoading === `suspend-${selected.id}`}
                  className="w-full flex items-center gap-2 text-xs text-red-400 hover:bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20 transition-colors"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  Suspend User
                </button>
              ) : (
                <button
                  onClick={() => doAction('reactivate', selected.id)}
                  disabled={actionLoading === `reactivate-${selected.id}`}
                  className="w-full flex items-center gap-2 text-xs text-emerald-400 hover:bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20 transition-colors"
                >
                  Reactivate User
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
