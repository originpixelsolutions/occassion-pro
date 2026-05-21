'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Assignment {
  id: string
  event_id: string
  event_name: string
  event_date: string
  service_description: string
  agreed_amount: number
  currency_code: string
  status: string
  tenant_name: string
  unread_messages: number
}

interface Stats {
  total: number
  active: number
  pending_invite: number
  completed: number
  total_earned: number
}

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  declined: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function fmtCurrency(amount: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function VendorDashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending_invite: 0, completed: 0, total_earned: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return

    fetch('/api/v1/vendor-portal/events', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: Assignment[]) => {
        setAssignments(data)
        setStats({
          total: data.length,
          active: data.filter(a => ['confirmed', 'in_progress'].includes(a.status)).length,
          pending_invite: data.filter(a => a.status === 'invited').length,
          completed: data.filter(a => a.status === 'completed').length,
          total_earned: data.filter(a => a.status === 'completed').reduce((s, a) => s + (a.agreed_amount || 0), 0),
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const upcoming = assignments.filter(a => ['invited', 'confirmed', 'in_progress'].includes(a.status))
  const hasInvites = assignments.some(a => a.status === 'invited')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Your vendor activity at a glance</p>
      </div>

      {/* Pending invites banner */}
      {hasInvites && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-amber-300 text-sm font-medium">You have pending invitations</p>
            <p className="text-amber-400/70 text-xs">Review and respond to event invitations from organisers.</p>
          </div>
          <Link href="/vendor/assignments?filter=invited" className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-medium transition-colors">
            View invites
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total assignments" value={stats.total} />
        <StatCard label="Active" value={stats.active} sub="confirmed or in-progress" />
        <StatCard label="Pending invites" value={stats.pending_invite} />
        <StatCard label="Total earned" value={fmtCurrency(stats.total_earned)} sub={`from ${stats.completed} completed events`} />
      </div>

      {/* Upcoming events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-200">Upcoming & Active</h2>
          <Link href="/vendor/assignments" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-10 text-center">
            <p className="text-zinc-500 text-sm">No active assignments</p>
            <p className="text-zinc-600 text-xs mt-1">Event organisers will send you invitations here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(a => (
              <Link
                key={a.id}
                href={`/vendor/assignments/${a.id}`}
                className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors group"
              >
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  a.status === 'invited' ? 'bg-amber-400' :
                  a.status === 'confirmed' ? 'bg-blue-400' : 'bg-violet-400'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">{a.event_name}</p>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded border capitalize ${STATUS_STYLES[a.status] ?? ''}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                    {a.unread_messages > 0 && (
                      <span className="px-1.5 py-0.5 bg-violet-500 rounded-full text-[10px] text-white font-medium">
                        {a.unread_messages}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">{a.tenant_name} · {fmtDate(a.event_date)}</p>
                  {a.service_description && (
                    <p className="text-zinc-400 text-xs mt-0.5 truncate">{a.service_description}</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  {a.agreed_amount ? (
                    <p className="text-white text-sm font-medium">{fmtCurrency(a.agreed_amount, a.currency_code)}</p>
                  ) : (
                    <p className="text-zinc-600 text-xs">Amount TBD</p>
                  )}
                  <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 ml-auto mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
