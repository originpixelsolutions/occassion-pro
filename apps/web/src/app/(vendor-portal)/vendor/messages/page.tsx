'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ThreadSummary {
  assignment_id: string
  event_name: string
  tenant_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  invited: 'text-amber-400',
  confirmed: 'text-blue-400',
  in_progress: 'text-violet-400',
  completed: 'text-green-400',
  cancelled: 'text-red-400',
  declined: 'text-zinc-500',
}

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return
    fetch('/api/v1/vendor-portal/messages', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setThreads)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-white">Messages</h1>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 bg-violet-500 rounded-full text-xs text-white font-medium">{totalUnread}</span>
          )}
        </div>
        <p className="text-zinc-400 text-sm mt-0.5">Conversations with event organisers</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <svg className="w-8 h-8 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-zinc-500 text-sm">No messages yet</p>
          <p className="text-zinc-600 text-xs mt-1">Organisers will contact you here for event-specific discussions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(t => (
            <Link
              key={t.assignment_id}
              href={`/vendor/assignments/${t.assignment_id}?tab=messages`}
              className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors group"
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                t.unread_count > 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {t.tenant_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium truncate ${t.unread_count > 0 ? 'text-white' : 'text-zinc-200'}`}>
                    {t.event_name}
                  </p>
                  <span className={`text-[10px] capitalize ${STATUS_STYLES[t.status] ?? 'text-zinc-500'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs">{t.tenant_name}</p>
                {t.last_message && (
                  <p className={`text-xs mt-0.5 truncate ${t.unread_count > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {t.last_message}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                {t.last_message_at && (
                  <p className="text-[10px] text-zinc-600">{timeAgo(t.last_message_at)}</p>
                )}
                {t.unread_count > 0 && (
                  <span className="w-5 h-5 bg-violet-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                    {t.unread_count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
