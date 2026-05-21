'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NotificationBell } from '@/components/notifications'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

interface EventCard {
  access_id: string; event_id: string; title: string
  date: string; end_date?: string; status: string
  venue_name?: string; access_level: string; last_viewed_at?: string
  tenant: { id: string; name: string; logo_url?: string }
}

const ACCESS_LABELS: Record<string, string> = {
  view_only: 'View Only', collaborator: 'Collaborator', full_access: 'Full Access'
}

function EventCard({ ev }: { ev: EventCard }) {
  const days = Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000)
  return (
    <Link href={`/client/events/${ev.event_id}`}
      className="block bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl p-5 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {ev.tenant.logo_url
            ? <img src={ev.tenant.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            : <div className="w-8 h-8 rounded-lg bg-violet-600/30 flex items-center justify-center text-violet-400 text-xs font-bold">{ev.tenant.name[0]}</div>}
          <div>
            <p className="text-white/40 text-xs">{ev.tenant.name}</p>
            <h3 className="text-white font-semibold text-sm group-hover:text-violet-300 transition-colors">{ev.title}</h3>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">
          {ACCESS_LABELS[ev.access_level]}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>📅 {new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {ev.venue_name && <span>📍 {ev.venue_name}</span>}
        {days > 0 && days < 30 && <span className="text-amber-400">⏳ {days}d away</span>}
        {days <= 0 && !ev.end_date && <span className="text-green-400">● Today</span>}
      </div>
    </Link>
  )
}

export default function ClientDashboard() {
  const router = useRouter()
  const [data, setData] = useState<{ upcoming: EventCard[]; active: EventCard[]; past: EventCard[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/client-portal/dashboard`, { credentials: 'include' })
      .then(async r => {
        if (r.status === 401) { router.push('/client/login'); return null }
        return r.json()
      })
      .then(d => { if (d) { setData(d); setLoading(false) } })
      .catch(() => router.push('/client/login'))
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const total = data.upcoming.length + data.active.length + data.past.length

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f0f1a]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-violet-800 rounded-lg flex items-center justify-center text-white text-xs font-bold">✦</div>
            <span className="text-white font-semibold text-sm">Client Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell variant="compact" />
            <button
              onClick={async () => { await fetch(`${API}/client-portal/auth/logout`, { method: 'POST', credentials: 'include' }); router.push('/client/login') }}
              className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My Events</h1>
          <p className="text-white/40 text-sm mt-1">{total} event{total !== 1 ? 's' : ''} you have access to</p>
        </div>

        {total === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-white/60 font-medium">No events yet</p>
            <p className="text-white/30 text-sm mt-1">You'll receive an invitation email when an event team adds you.</p>
          </div>
        )}

        {data.active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Active
            </h2>
            <div className="space-y-3">{data.active.map(ev => <EventCard key={ev.event_id} ev={ev} />)}</div>
          </section>
        )}

        {data.upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Upcoming</h2>
            <div className="space-y-3">{data.upcoming.map(ev => <EventCard key={ev.event_id} ev={ev} />)}</div>
          </section>
        )}

        {data.past.length > 0 && (
          <section>
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Past</h2>
            <div className="space-y-3 opacity-60">{data.past.map(ev => <EventCard key={ev.event_id} ev={ev} />)}</div>
          </section>
        )}
      </main>
    </div>
  )
}
