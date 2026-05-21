'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Megaphone, Pin, Loader2 } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string
  is_pinned?: boolean
  emoji?: string
  created_at: string
}

export default function AnnouncementsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<Announcement[]>(`/guest-portal/${eventId}/sections/announcements`, eventId)
      .then(data => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false))
  }, [eventId])

  const relativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const pinned = announcements.filter(a => a.is_pinned)
  const regular = announcements.filter(a => !a.is_pinned)

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Megaphone size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Updates</h1>
        </div>
        {announcements.length > 0 && (
          <span style={{ marginLeft: 'auto', background: 'var(--portal-brand)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
            {announcements.length}
          </span>
        )}
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Megaphone size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No updates yet</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pin size={11} /> Pinned
                </div>
                {pinned.map(a => (
                  <AnnouncementCard key={a.id} a={a} relativeTime={relativeTime} pinned />
                ))}
              </>
            )}

            {regular.length > 0 && (
              <>
                {pinned.length > 0 && (
                  <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 }}>
                    Latest
                  </div>
                )}
                {regular.map(a => (
                  <AnnouncementCard key={a.id} a={a} relativeTime={relativeTime} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AnnouncementCard({
  a,
  relativeTime,
  pinned = false,
}: {
  a: { id: string; title: string; body: string; emoji?: string; created_at: string }
  relativeTime: (d: string) => string
  pinned?: boolean
}) {
  return (
    <div className="portal-card" style={{
      borderColor: pinned ? 'var(--portal-brand-20)' : '#262626',
      background: pinned ? 'var(--portal-brand-10)' : '#1a1a1a',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {a.emoji && (
          <div style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{a.emoji}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5' }}>{a.title}</div>
            <span style={{ fontSize: 11, color: '#555', flexShrink: 0, paddingTop: 2 }}>{relativeTime(a.created_at)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.7 }}>{a.body}</p>
        </div>
      </div>
    </div>
  )
}
