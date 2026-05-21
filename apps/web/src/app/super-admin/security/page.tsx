'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, Shield, Ban, AlertTriangle,
  Users, Lock, Unlock, Trash2, Plus, X, CheckCircle2,
  Monitor, Globe, Clock,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  if (typeof window === 'undefined') return ''
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('supabase') && k.includes('auth')) {
        const p = JSON.parse(localStorage.getItem(k) ?? '{}')
        return p?.access_token ?? p?.access_token ?? ''
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ActiveSession {
  id: string
  user_id: string
  user_email: string
  tenant_name: string | null
  role: string
  ip_address: string
  user_agent: string
  created_at: string
  last_active: string
  is_current: boolean
}

interface BlockedIP {
  id: string
  ip_address: string
  reason: string
  blocked_type: 'manual' | 'auto'
  blocked_at: string
  expires_at: string | null
  failed_attempts?: number
}

interface RateLimit {
  id: string
  identifier: string
  identifier_type: 'ip' | 'tenant' | 'user'
  endpoint: string
  requests_per_min: number
  created_at: string
}

interface FailedLogin {
  hour: number
  count: number
}

interface DPDPStatus {
  consent_records: number
  data_requests_pending: number
  data_requests_completed: number
  last_audit: string | null
  retention_policy_days: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

function StatCard({ label, value, icon: Icon, color = 'text-zinc-300' }: {
  label: string; value: string | number; icon: React.ElementType; color?: string
}) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-zinc-600" />
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([])
  const [failedLogins, setFailedLogins] = useState<FailedLogin[]>([])
  const [dpdp, setDpdp] = useState<DPDPStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const [revokingSession, setRevokingSession] = useState<string | null>(null)
  const [removingIP, setRemovingIP] = useState<string | null>(null)

  const [showBlockIP, setShowBlockIP] = useState(false)
  const [blockForm, setBlockForm] = useState({ ip: '', reason: '', expires_in_hours: '24' })
  const [blockingIP, setBlockingIP] = useState(false)

  const [showAddLimit, setShowAddLimit] = useState(false)
  const [limitForm, setLimitForm] = useState({ identifier: '', identifier_type: 'ip', endpoint: '', requests_per_min: '60' })
  const [savingLimit, setSavingLimit] = useState(false)

  const [activeTab, setActiveTab] = useState<'sessions' | 'blocked' | 'rate-limits' | 'dpdp'>('sessions')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sess, ips, limits, logins, dpdpData] = await Promise.allSettled([
        apiFetch('/super-admin/security/sessions'),
        apiFetch('/super-admin/security/blocked-ips'),
        apiFetch('/super-admin/security/rate-limits'),
        apiFetch('/super-admin/security/failed-logins'),
        apiFetch('/super-admin/security/dpdp'),
      ])
      if (sess.status === 'fulfilled') setSessions(sess.value ?? [])
      if (ips.status === 'fulfilled') setBlockedIPs(ips.value ?? [])
      if (limits.status === 'fulfilled') setRateLimits(limits.value ?? [])
      if (logins.status === 'fulfilled') setFailedLogins(logins.value ?? [])
      if (dpdpData.status === 'fulfilled') setDpdp(dpdpData.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const revokeSession = async (session: ActiveSession) => {
    setRevokingSession(session.id)
    try {
      await apiFetch(`/super-admin/security/sessions/${session.id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== session.id))
    } finally {
      setRevokingSession(null)
    }
  }

  const unblockIP = async (ip: BlockedIP) => {
    setRemovingIP(ip.id)
    try {
      await apiFetch(`/super-admin/security/blocked-ips/${ip.id}`, { method: 'DELETE' })
      setBlockedIPs(prev => prev.filter(b => b.id !== ip.id))
    } finally {
      setRemovingIP(null)
    }
  }

  const blockIP = async () => {
    setBlockingIP(true)
    try {
      const data = await apiFetch('/super-admin/security/blocked-ips', {
        method: 'POST',
        body: JSON.stringify({
          ip_address: blockForm.ip,
          reason: blockForm.reason,
          expires_in_hours: blockForm.expires_in_hours ? Number(blockForm.expires_in_hours) : null,
        }),
      })
      setBlockedIPs(prev => [data, ...prev])
      setShowBlockIP(false)
      setBlockForm({ ip: '', reason: '', expires_in_hours: '24' })
    } finally {
      setBlockingIP(false)
    }
  }

  const deleteRateLimit = async (id: string) => {
    await apiFetch(`/super-admin/security/rate-limits/${id}`, { method: 'DELETE' })
    setRateLimits(prev => prev.filter(r => r.id !== id))
  }

  const addRateLimit = async () => {
    setSavingLimit(true)
    try {
      const data = await apiFetch('/super-admin/security/rate-limits', {
        method: 'POST',
        body: JSON.stringify({
          identifier: limitForm.identifier,
          identifier_type: limitForm.identifier_type,
          endpoint: limitForm.endpoint,
          requests_per_min: Number(limitForm.requests_per_min),
        }),
      })
      setRateLimits(prev => [data, ...prev])
      setShowAddLimit(false)
      setLimitForm({ identifier: '', identifier_type: 'ip', endpoint: '', requests_per_min: '60' })
    } finally {
      setSavingLimit(false)
    }
  }

  const maxFailed = Math.max(...failedLogins.map(f => f.count), 1)
  const heatmapData = Array.from({ length: 24 }, (_, i) => {
    const entry = failedLogins.find(f => f.hour === i)
    return { hour: i, count: entry?.count ?? 0 }
  })

  const tabs = [
    { id: 'sessions',    label: 'Active Sessions',  count: sessions.length },
    { id: 'blocked',     label: 'Blocked IPs',       count: blockedIPs.length },
    { id: 'rate-limits', label: 'Rate Limit Rules',  count: rateLimits.length },
    { id: 'dpdp',        label: 'DPDP Compliance',   count: null },
  ] as const

  return (
    <div className="p-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white">Security</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Sessions, access control, threat monitoring, and compliance</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Active Sessions" value={sessions.length} icon={Users} color="text-blue-400" />
        <StatCard label="Blocked IPs" value={blockedIPs.length} icon={Ban} color={blockedIPs.length > 0 ? 'text-red-400' : 'text-zinc-300'} />
        <StatCard label="Rate Limit Rules" value={rateLimits.length} icon={Shield} color="text-violet-400" />
        <StatCard
          label="Failed Logins (24h)"
          value={heatmapData.reduce((a, b) => a + b.count, 0)}
          icon={AlertTriangle}
          color={heatmapData.reduce((a, b) => a + b.count, 0) > 50 ? 'text-red-400' : 'text-amber-400'}
        />
      </div>

      {/* Failed login heatmap */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Failed Login Attempts — Last 24 Hours</p>
          <p className="text-[10px] text-zinc-600">{heatmapData.reduce((a, b) => a + b.count, 0)} total</p>
        </div>
        <div className="flex items-end gap-1 h-16">
          {heatmapData.map(({ hour, count }) => {
            const pct = (count / maxFailed) * 100
            const color = count === 0
              ? 'bg-white/[0.04]'
              : count < maxFailed * 0.3
                ? 'bg-amber-500/30'
                : count < maxFailed * 0.7
                  ? 'bg-amber-500/60'
                  : 'bg-red-500/80'
            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1" title={`${hour}:00 — ${count} attempts`}>
                <div className="w-full flex items-end justify-center" style={{ height: '44px' }}>
                  <div
                    className={`w-full rounded-sm transition-all ${color}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                {hour % 4 === 0 && (
                  <span className="text-[8px] text-zinc-700">{hour}h</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-[#111118] border border-white/[0.06] rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-violet-500/20 text-violet-300' : 'bg-white/[0.06] text-zinc-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Active Sessions</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32"><p className="text-xs text-zinc-600">No active sessions</p></div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {sessions.map(session => (
                <div key={session.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                    <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-zinc-300 truncate">{session.user_email}</p>
                      {session.is_current && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 shrink-0">You</span>
                      )}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-500 shrink-0 capitalize">
                        {session.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 truncate">
                      {session.tenant_name ?? 'Super Admin'} · {session.ip_address}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-zinc-500">Started {fmtRelative(session.created_at)}</p>
                    <p className="text-[10px] text-zinc-600">Active {fmtRelative(session.last_active)}</p>
                  </div>
                  <button
                    onClick={() => revokeSession(session)}
                    disabled={revokingSession === session.id || session.is_current}
                    title={session.is_current ? "Can't revoke your own session" : 'Revoke session'}
                    className="shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {revokingSession === session.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <X className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocked IPs tab */}
      {activeTab === 'blocked' && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Blocked IP Addresses</p>
            <button
              onClick={() => setShowBlockIP(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-semibold border border-red-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Block IP
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : blockedIPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500/40" />
              <p className="text-xs text-zinc-600">No blocked IP addresses</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {blockedIPs.map(ip => (
                <div key={ip.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono font-medium text-red-300">{ip.ip_address}</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        ip.blocked_type === 'auto'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {ip.blocked_type}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{ip.reason}</p>
                    {ip.failed_attempts && (
                      <p className="text-[10px] text-zinc-600">{ip.failed_attempts} failed attempts</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-zinc-500">Blocked {fmtRelative(ip.blocked_at)}</p>
                    <p className="text-[10px] text-zinc-600">
                      {ip.expires_at ? `Expires ${fmtDate(ip.expires_at)}` : 'Permanent'}
                    </p>
                  </div>
                  <button
                    onClick={() => unblockIP(ip)}
                    disabled={removingIP === ip.id}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 text-[10px] border border-white/[0.08] transition-colors"
                  >
                    {removingIP === ip.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rate Limits tab */}
      {activeTab === 'rate-limits' && (
        <div className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Rate Limit Exceptions</p>
            <button
              onClick={() => setShowAddLimit(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-[10px] font-semibold border border-violet-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Rule
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : rateLimits.length === 0 ? (
            <div className="flex items-center justify-center h-32"><p className="text-xs text-zinc-600">No custom rate limit rules</p></div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {rateLimits.map(rule => (
                <div key={rule.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono font-medium text-zinc-300">{rule.identifier}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                        {rule.identifier_type}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{rule.endpoint || '*'}</p>
                  </div>
                  <p className="text-xs font-bold text-violet-300 shrink-0">{rule.requests_per_min} req/min</p>
                  <p className="text-[10px] text-zinc-600 shrink-0">Added {fmtRelative(rule.created_at)}</p>
                  <button
                    onClick={() => deleteRateLimit(rule.id)}
                    className="shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DPDP tab */}
      {activeTab === 'dpdp' && (
        <div className="space-y-4">
          {dpdp ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] text-zinc-500 mb-1">Consent Records</p>
                  <p className="text-xl font-bold text-blue-400">{dpdp.consent_records.toLocaleString()}</p>
                </div>
                <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] text-zinc-500 mb-1">Data Requests Pending</p>
                  <p className={`text-xl font-bold ${dpdp.data_requests_pending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {dpdp.data_requests_pending}
                  </p>
                </div>
                <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] text-zinc-500 mb-1">Requests Completed</p>
                  <p className="text-xl font-bold text-emerald-400">{dpdp.data_requests_completed}</p>
                </div>
              </div>
              <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Policy Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Data Retention Policy</p>
                    <p className="text-sm font-semibold text-zinc-300">{dpdp.retention_policy_days} days</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Last Compliance Audit</p>
                    <p className="text-sm font-semibold text-zinc-300">
                      {dpdp.last_audit ? fmtDate(dpdp.last_audit) : 'Not yet performed'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-300 mb-0.5">DPDP Act 2023 (India)</p>
                    <p className="text-[10px] text-amber-500/80">
                      OccasionPro processes personal data of Indian residents. Ensure Data Fiduciary obligations are met —
                      purpose limitation, storage limitation, and Data Principal rights (access, correction, erasure, grievance redressal)
                      are implemented as per the Digital Personal Data Protection Act, 2023.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : (
            <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-8 flex items-center justify-center">
              <p className="text-xs text-zinc-600">DPDP compliance data unavailable</p>
            </div>
          )}
        </div>
      )}

      {/* Block IP Modal */}
      {showBlockIP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Block IP Address</h3>
              <button onClick={() => setShowBlockIP(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">IP Address</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.1"
                  value={blockForm.ip}
                  onChange={e => setBlockForm(f => ({ ...f, ip: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="Brute force, spam, abuse…"
                  value={blockForm.reason}
                  onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Expires in hours (blank = permanent)</label>
                <input
                  type="number"
                  placeholder="24"
                  value={blockForm.expires_in_hours}
                  onChange={e => setBlockForm(f => ({ ...f, expires_in_hours: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={blockIP}
                disabled={blockingIP || !blockForm.ip || !blockForm.reason}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {blockingIP ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Block IP
              </button>
              <button onClick={() => setShowBlockIP(false)} className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rate Limit Modal */}
      {showAddLimit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Add Rate Limit Rule</h3>
              <button onClick={() => setShowAddLimit(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Identifier Type</label>
                <select
                  value={limitForm.identifier_type}
                  onChange={e => setLimitForm(f => ({ ...f, identifier_type: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                >
                  <option value="ip">IP Address</option>
                  <option value="tenant">Tenant</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Identifier</label>
                <input
                  type="text"
                  placeholder="IP, tenant ID, or user ID"
                  value={limitForm.identifier}
                  onChange={e => setLimitForm(f => ({ ...f, identifier: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Endpoint (blank = all)</label>
                <input
                  type="text"
                  placeholder="/v1/events or *"
                  value={limitForm.endpoint}
                  onChange={e => setLimitForm(f => ({ ...f, endpoint: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Requests per Minute</label>
                <input
                  type="number"
                  value={limitForm.requests_per_min}
                  onChange={e => setLimitForm(f => ({ ...f, requests_per_min: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addRateLimit}
                disabled={savingLimit || !limitForm.identifier}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {savingLimit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Rule
              </button>
              <button onClick={() => setShowAddLimit(false)} className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
