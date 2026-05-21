'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Calendar, Clock, CheckCircle2, AlertTriangle, Star,
  Plus, Search, Filter, ChevronRight, MoreHorizontal,
  UserCheck, UserX, Phone, Mail, Briefcase, TrendingUp,
  DollarSign, ArrowUpRight, Shield, Zap, Activity,
  ChevronDown, X, MapPin, Loader2, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'roster' | 'schedule' | 'live' | 'payroll'
type StaffStatus = 'active' | 'inactive' | 'on_leave'

interface StaffRole {
  id: string
  name: string
  code: string
  color: string
  department: string
}

interface StaffMember {
  id: string
  full_name: string
  email: string
  phone: string
  employee_code: string
  role: StaffRole
  department: string
  employment_type: string
  status: StaffStatus
  skills: string[]
  total_events: number
  rating: number
  base_hourly_rate: number
  photo_url?: string | null
}

interface TenantStats {
  total_staff: number
  active_staff: number
  on_leave: number
  total_roles: number
  avg_rating: number
  by_department: Record<string, number>
  by_employment_type: Record<string, number>
  top_performers: {
    id: string
    full_name: string
    photo_url: string | null
    total_events: number
    rating: number
    role: { name: string }
  }[]
}

// ── Dept colours ───────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  Operations:    '#6366f1',
  Security:      '#dc2626',
  Technical:     '#0ea5e9',
  Entertainment: '#f59e0b',
  Hospitality:   '#8b5cf6',
  Logistics:     '#10b981',
  Decor:         '#ec4899',
  General:       '#64748b',
}

// ── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:     { label: 'Active',     bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
    inactive:   { label: 'Inactive',   bg: 'rgba(100,116,139,0.12)', color: 'hsl(var(--muted-foreground))' },
    on_leave:   { label: 'On Leave',   bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    terminated: { label: 'Terminated', bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  }
  const s = map[status] ?? map.inactive
  return (
    <span style={{ background: s.bg, color: s.color }}
      className="px-2 py-0.5 rounded-full text-xs font-medium">
      {s.label}
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star size={12} className="fill-amber-400 text-amber-400" />
      <span className="text-xs text-amber-400 font-medium">{(rating ?? 0).toFixed(1)}</span>
    </div>
  )
}

// ── Empty state for event-scoped tabs ──────────────────────────────────────

function EventScopedEmpty({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <Calendar size={28} style={{ color: 'hsl(var(--primary))' }} />
      </div>
      <h3 className="text-base font-semibold text-white/80 mb-1">{tabLabel} is event-scoped</h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">
        Select a specific event to view its {tabLabel.toLowerCase()} data — shifts, live check-ins, and payroll
        are managed at the event level.
      </p>
      <Link
        href="/events"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
        style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}
      >
        Browse Events <ChevronRight size={14} />
      </Link>
    </div>
  )
}

// ── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
  const [stats, setStats]     = useState<TenantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}/workforce/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => setError('Failed to load workforce stats.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="animate-spin text-white/30" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <AlertCircle size={16} className="text-red-400 shrink-0" />
        <span className="text-sm text-red-400">{error || 'No data'}</span>
      </div>
    )
  }

  const deptData = Object.entries(stats.by_department).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Staff', value: stats.total_staff,
            sub: `${stats.active_staff} active`, icon: Users,
            color: '#6366f1', bg: 'rgba(99,102,241,0.1)',
          },
          {
            label: 'On Leave', value: stats.on_leave,
            sub: `${stats.total_staff - stats.active_staff - stats.on_leave} inactive`,
            icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',
          },
          {
            label: 'Avg Rating', value: stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : '—',
            sub: 'across active staff', icon: Star,
            color: '#10b981', bg: 'rgba(16,185,129,0.1)',
          },
          {
            label: 'Staff Roles', value: stats.total_roles,
            sub: 'active roles defined', icon: Briefcase,
            color: '#ec4899', bg: 'rgba(236,72,153,0.1)',
          },
        ].map(kpi => (
          <div key={kpi.label}
            className="rounded-xl p-5 border"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg" style={{ background: kpi.bg }}>
                <kpi.icon size={18} style={{ color: kpi.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{kpi.value}</div>
            <div className="text-xs text-white/40">{kpi.sub}</div>
            <div className="text-xs text-white/60 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dept breakdown bar */}
        <div className="lg:col-span-2 rounded-xl p-5 border"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
          <h3 className="text-sm font-semibold text-white/80 mb-4">Staff by Department</h3>
          {deptData.length === 0 ? (
            <p className="text-sm text-white/30 py-8 text-center">No staff data yet</p>
          ) : (
            <div className="space-y-3">
              {deptData.map(([dept, count]) => {
                const max = Math.max(...deptData.map(d => d[1]))
                const pct = max > 0 ? Math.round((count / max) * 100) : 0
                const color = DEPT_COLORS[dept] || '#64748b'
                return (
                  <div key={dept} className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/80 truncate">{dept}</span>
                        <span className="text-xs text-white/40 ml-2 flex-shrink-0">{count} staff</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'hsl(var(--muted))' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Employment type breakdown */}
          {Object.keys(stats.by_employment_type).length > 0 && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
              <h4 className="text-xs text-white/40 mb-3">By Employment Type</h4>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.by_employment_type).map(([type, count]) => (
                  <div key={type} className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                    <span className="text-white font-medium">{count}</span>
                    {' '}
                    <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="rounded-xl p-5 border"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
          <h3 className="text-sm font-semibold text-white/80 mb-4">Top Performers</h3>
          {stats.top_performers.length === 0 ? (
            <p className="text-sm text-white/30 py-8 text-center">No performers yet</p>
          ) : (
            <div className="space-y-3">
              {stats.top_performers.map((staff, i) => (
                <div key={staff.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: i === 0 ? 'rgba(245,158,11,0.2)' : 'hsl(var(--muted))',
                      color: i === 0 ? '#f59e0b' : '#64748b',
                    }}>
                    {i + 1}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: 'rgba(99,102,241,0.25)' }}>
                    {staff.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/80 font-medium truncate">{staff.full_name}</div>
                    <div className="text-xs text-white/40">{staff.role?.name}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <TrendingUp size={10} className="text-emerald-400" />
                    <span className="text-xs text-white/60">{staff.total_events}</span>
                  </div>
                  <StarRating rating={staff.rating} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Staff Modal ────────────────────────────────────────────────────────

function AddStaffModal({
  token,
  roles,
  onSaved,
  onClose,
}: {
  token: string
  roles: StaffRole[]
  onSaved: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', employee_code: '',
    department: '', employment_type: 'full_time', role_id: '',
    skills: '', base_hourly_rate: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/workforce/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name:        form.full_name.trim(),
          email:            form.email.trim(),
          phone:            form.phone.trim() || undefined,
          employee_code:    form.employee_code.trim() || undefined,
          department:       form.department.trim() || undefined,
          employment_type:  form.employment_type,
          role_id:          form.role_id || undefined,
          skills:           form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          base_hourly_rate: form.base_hourly_rate ? Number(form.base_hourly_rate) : undefined,
          status:           'active',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to save staff member.')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Network error.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border shadow-2xl"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.5)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
            <h2 className="text-base font-semibold text-white">Add Staff Member</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Full Name *</label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Email *</label>
                <input value={form.email} onChange={e => set('email', e.target.value)}
                  type="email" placeholder="priya@example.com"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Employee Code</label>
                <input value={form.employee_code} onChange={e => set('employee_code', e.target.value)}
                  placeholder="EMP001"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Role</label>
                <select value={form.role_id} onChange={e => set('role_id', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
                  <option value="">No role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Employment Type</label>
                <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)}
                  placeholder="Operations"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Base Hourly Rate (₹)</label>
                <input value={form.base_hourly_rate} onChange={e => set('base_hourly_rate', e.target.value)}
                  type="number" placeholder="850"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Skills (comma-separated)</label>
              <input value={form.skills} onChange={e => set('skills', e.target.value)}
                placeholder="Coordination, Guest Relations, Hindi"
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
            </div>

            {error && (
              <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white border transition-colors"
                style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'hsl(var(--primary) / 0.25)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save Staff Member
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Roster Tab ─────────────────────────────────────────────────────────────

function RosterTab({ token }: { token: string }) {
  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [roles, setRoles]           = useState<StaffRole[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [showAddModal, setShowAddModal]   = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterDept !== 'all') params.set('department', filterDept)
      if (search) params.set('search', search)

      const [staffRes, rolesRes] = await Promise.all([
        fetch(`${API}/workforce/staff?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/workforce/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (!staffRes.ok) throw new Error('Failed to load staff')
      const staffData = await staffRes.json()
      setStaff(staffData)
      if (rolesRes.ok) setRoles(await rolesRes.json())
    } catch {
      setError('Failed to load staff data.')
    } finally { setLoading(false) }
  }, [token, filterStatus, filterDept, search])

  useEffect(() => { load() }, [load])

  const depts = ['all', ...Array.from(new Set(staff.map(s => s.department).filter(Boolean)))]

  // Client-side search (API also supports it, but we do both for instant feel)
  const filtered = staff.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    if (filterDept !== 'all' && s.department !== filterDept) return false
    if (search && !s.full_name.toLowerCase().includes(search.toLowerCase()) &&
      !s.employee_code?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="flex gap-5 h-full">
        {/* Main table */}
        <div className="flex-1 min-w-0">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search staff…"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white/80 outline-none"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
            </div>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="py-2 px-3 rounded-lg text-sm text-white/70 outline-none"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>

            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="py-2 px-3 rounded-lg text-sm text-white/70 outline-none"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
              {depts.map(d => <option key={d} value={d}>{d === 'all' ? 'All Depts' : d}</option>)}
            </select>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
              <Plus size={14} /> Add Staff
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={22} className="animate-spin text-white/30" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users size={36} className="text-white/10 mb-3" />
              <p className="text-sm text-white/40">
                {staff.length === 0
                  ? 'No staff members yet. Click "Add Staff" to get started.'
                  : 'No staff match your filters.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                    {['Staff Member', 'Role', 'Department', 'Type', 'Status', 'Events', 'Rating', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr key={s.id}
                      onClick={() => setSelectedStaff(s)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: (s.role?.color ?? '#6366f1') + '33' }}>
                            {s.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm text-white/90 font-medium">{s.full_name}</div>
                            <div className="text-xs text-white/40">{s.employee_code ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-white/70">
                          <span className="w-2 h-2 rounded-full"
                            style={{ background: s.role?.color ?? '#64748b' }} />
                          {s.role?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60">{s.department ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-white/50 capitalize">
                          {(s.employment_type ?? '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-xs text-white/70">{s.total_events ?? 0}</td>
                      <td className="px-4 py-3"><StarRating rating={s.rating ?? 0} /></td>
                      <td className="px-4 py-3">
                        <button className="p-1 rounded hover:bg-white/5">
                          <MoreHorizontal size={14} className="text-white/30" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedStaff && (
          <div className="w-72 flex-shrink-0 rounded-xl p-5 border"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                  style={{ background: (selectedStaff.role?.color ?? '#6366f1') + '33' }}>
                  {selectedStaff.full_name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{selectedStaff.full_name}</div>
                  <div className="text-xs text-white/40">{selectedStaff.employee_code ?? '—'}</div>
                </div>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="p-1 hover:bg-white/5 rounded">
                <X size={14} className="text-white/30" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Briefcase size={12} className="text-white/30" />
                <span style={{ color: selectedStaff.role?.color ?? 'hsl(var(--muted-foreground))' }}>
                  {selectedStaff.role?.name ?? '—'}
                </span>
              </div>
              {selectedStaff.phone && (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Phone size={12} className="text-white/30" /> {selectedStaff.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Mail size={12} className="text-white/30" /> {selectedStaff.email}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Events',  value: selectedStaff.total_events ?? 0 },
                { label: 'Rating',  value: (selectedStaff.rating ?? 0).toFixed(1) },
                { label: '₹/hr',   value: selectedStaff.base_hourly_rate ?? '—' },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-2 text-center"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <div className="text-sm font-bold text-white">{s.value}</div>
                  <div className="text-xs text-white/40">{s.label}</div>
                </div>
              ))}
            </div>

            {selectedStaff.skills?.length > 0 && (
              <div className="mb-5">
                <div className="text-xs text-white/40 mb-2">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStaff.skills.map(skill => (
                    <span key={skill} className="px-2 py-0.5 rounded text-xs text-white/60"
                      style={{ background: 'hsl(var(--muted))' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <StatusBadge status={selectedStaff.status} />

            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 rounded-lg text-xs font-medium text-white"
                style={{ background: 'hsl(var(--primary) / 0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                Assign to Event
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-white/60"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddStaffModal
          token={token}
          roles={roles}
          onSaved={load}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function WorkforcePage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard',      icon: Activity    },
    { id: 'roster',    label: 'Staff Roster',   icon: Users       },
    { id: 'schedule',  label: 'Schedule',       icon: Calendar    },
    { id: 'live',      label: 'Live Operations',icon: Zap         },
    { id: 'payroll',   label: 'Payroll',        icon: DollarSign  },
  ]

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: 'hsl(var(--background))' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workforce Management</h1>
          <p className="text-sm text-white/40 mt-1">
            Staff scheduling, attendance tracking &amp; payroll for all events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/events"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)' }}>
            <Calendar size={14} /> Select Event
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { background: 'hsl(var(--primary) / 0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
              : { color: 'hsl(var(--muted-foreground))', border: '1px solid transparent' }}>
            <tab.icon size={14} />
            {tab.label}
            {tab.id === 'live' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && <DashboardTab token={token} />}
        {activeTab === 'roster'    && <RosterTab token={token} />}
        {activeTab === 'schedule'  && <EventScopedEmpty tabLabel="Schedule" />}
        {activeTab === 'live'      && <EventScopedEmpty tabLabel="Live Operations" />}
        {activeTab === 'payroll'   && <EventScopedEmpty tabLabel="Payroll" />}
      </div>
    </div>
  )
}
