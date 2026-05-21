'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

function cpFetch(path: string, opts?: RequestInit) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-Client-Session': session } : {}),
      ...(opts?.headers || {}),
    },
  })
}

export default function ClientMessagesPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cp_client') : null
    if (stored) { try { setClientId(JSON.parse(stored).id) } catch {} }
    loadMessages()
  }, [eventId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }
    try {
      const r = await cpFetch(`/client-portal/events/${eventId}/messages`)
      if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return }
      const d = await r.json()
      setMessages(d.messages || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const r = await cpFetch(`/client-portal/events/${eventId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: text.trim() }),
      })
      const msg = await r.json()
      setMessages(prev => [...prev, msg])
      setText('')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  let lastDate = ''

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-zinc-500 text-sm">
              No messages yet. Start the conversation!
            </div>
          )}

          {messages.map((msg, i) => {
            const dateStr = formatDate(msg.created_at)
            const showDate = dateStr !== lastDate
            lastDate = dateStr
            const isClient = msg.sender_type === 'client'
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/6" />
                    <span className="text-xs text-zinc-600">{dateStr}</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                )}
                <div className={cn('flex', isClient ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                      isClient
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-[#13131a] border border-white/8 text-zinc-200 rounded-bl-sm',
                    )}
                  >
                    {!isClient && (
                      <p className="text-xs font-semibold text-indigo-400 mb-0.5">Event Team</p>
                    )}
                    <p className="leading-relaxed">{msg.message}</p>
                    <p className={cn('text-xs mt-1', isClient ? 'text-indigo-200/70' : 'text-zinc-600')}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-end gap-2 pt-3 border-t border-white/6">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any) } }}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 bg-[#13131a] border border-white/8 rounded-xl px-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
