'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin, Clock, MessageSquare, CheckSquare, Loader2, Globe, DollarSign } from 'lucide-react'

function cpFetch(path: string) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { ...(session ? { 'X-Client-Session': session } : {}) },
  })
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#13131a] border border-white/8 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  )
}

export default function ClientEventOverviewPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }

    cpFetch(`/client-portal/events/${eventId}`)
      .then(r => {
        if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [eventId, tenant])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!data) return <p className="text-zinc-500 text-sm">Event not found.</p>

  const { event, access_level, unread_messages, pending_approvals, total_approvals } = data
  const startDate = event?.start_date ? new Date(event.start_date) : null
  const endDate = event?.end_date ? new Date(event.end_date) : null

  const accessMap: Record<string, string> = {
    view_only: 'View Only',
    collaborator: 'Collaborator',
    full_access: 'Full Access',
  }

  return (
    <div className="space-y-6">
      {/* Event Hero */}
      <div className="bg-gradient-to-br from-indigo-500/10 via-[#13131a] to-[#13131a] border border-white/8 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-snug">{event?.name}</h1>
            <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {accessMap[access_level] || access_level}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {startDate && (
            <div className="flex items-center gap-2 text-zinc-400">
              <Calendar className="w-4 h-4 text-zinc-600" />
              {startDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          {endDate && startDate?.toDateString() !== endDate.toDateString() && (
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4 text-zinc-600" />
              Until {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          {event?.venue_name && (
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="w-4 h-4 text-zinc-600" />
              {event.venue_name}{event.city ? `, ${event.city}` : ''}
            </div>
          )}
          {event?.timezone && (
            <div className="flex items-center gap-2 text-zinc-400">
              <Globe className="w-4 h-4 text-zinc-600" />
              {event.timezone}
            </div>
          )}
        </div>

        {event?.description && (
          <p className="text-sm text-zinc-400 leading-relaxed border-t border-white/6 pt-4">
            {event.description}
          </p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon={MessageSquare}
          label="Unread messages"
          value={unread_messages}
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={CheckSquare}
          label="Pending approvals"
          value={pending_approvals}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={CheckSquare}
          label="Total approvals"
          value={total_approvals}
          color="bg-emerald-500/10 text-emerald-400"
        />
        {(access_level === 'full_access' || access_level === 'collaborator') && event?.total_budget && (
          <StatCard
            icon={DollarSign}
            label="Total budget"
            value={`${event.currency_code} ${Number(event.total_budget).toLocaleString()}`}
            color="bg-violet-500/10 text-violet-400"
          />
        )}
      </div>

      {unread_messages > 0 && (
        <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            You have <strong>{unread_messages}</strong> unread message{unread_messages !== 1 ? 's' : ''} from your event team.
          </p>
        </div>
      )}
    </div>
  )
}
