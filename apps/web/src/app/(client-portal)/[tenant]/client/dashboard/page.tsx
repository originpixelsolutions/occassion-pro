'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin, ChevronRight, Loader2, LogOut, Sparkles, Clock, CheckCircle2 } from 'lucide-react'

function cpFetch(path: string) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: {
      ...(session ? { 'X-Client-Session': session } : {}),
    },
  })
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || map.draft}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function EventCard({ event, tenant }: { event: any; tenant: string }) {
  const router = useRouter()
  const startDate = event.start_date ? new Date(event.start_date) : null
  return (
    <button
      onClick={() => router.push(`/${tenant}/client/events/${event.event_id}`)}
      className="w-full text-left bg-[#13131a] border border-white/8 rounded-2xl p-5 hover:border-indigo-500/30 hover:bg-white/2 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusPill status={event.status} />
            <span className="text-xs text-zinc-500">{event.access_level?.replace('_', ' ')}</span>
          </div>
          <h3 className="font-semibold text-base leading-snug truncate">{event.name}</h3>
          {startDate && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
              <Calendar className="w-3.5 h-3.5" />
              {startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
          {event.venue_name && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
              <MapPin className="w-3.5 h-3.5" />
              {event.venue_name}{event.city ? `, ${event.city}` : ''}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
      </div>
    </button>
  )
}

export default function ClientDashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params)
  const router = useRouter()
  const [data, setData] = useState<{ upcoming: any[]; active: any[]; past: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cp_client') : null
    if (stored) { try { setClient(JSON.parse(stored)) } catch {} }

    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }

    cpFetch('/client-portal/dashboard')
      .then(r => {
        if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [tenant])

  const handleLogout = async () => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (session) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/auth/logout`, {
        method: 'POST',
        headers: { 'X-Client-Session': session },
      })
    }
    localStorage.removeItem('cp_session')
    localStorage.removeItem('cp_tenant')
    localStorage.removeItem('cp_client')
    router.push(`/${tenant}/client/auth`)
  }

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur border-b border-white/6">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-sm font-semibold">Client Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}{client?.full_name ? `, ${client.full_name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Here are your events</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
          </div>
        ) : !data || (!data.upcoming.length && !data.active.length && !data.past.length) ? (
          <div className="text-center py-20 space-y-3">
            <Calendar className="w-10 h-10 text-zinc-700 mx-auto" />
            <p className="text-zinc-400 text-sm">No events yet</p>
            <p className="text-zinc-600 text-xs">You'll see events here once you're invited to one.</p>
          </div>
        ) : (
          <>
            {data.active.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Now</h2>
                </div>
                {data.active.map(e => <EventCard key={e.event_id} event={e} tenant={tenant} />)}
              </section>
            )}

            {data.upcoming.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Upcoming</h2>
                </div>
                {data.upcoming.map(e => <EventCard key={e.event_id} event={e} tenant={tenant} />)}
              </section>
            )}

            {data.past.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Past Events</h2>
                </div>
                {data.past.map(e => <EventCard key={e.event_id} event={e} tenant={tenant} />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
