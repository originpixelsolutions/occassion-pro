'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart, Send, MessageSquare, Mail, Smartphone, Check } from 'lucide-react'
import { useSendThankYou } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const TEMPLATES = [
  {
    id: 'personal',
    label: 'Personal',
    preview: 'Dear {guest_name}, thank you so much for celebrating {event_name} with us! Your presence made the day truly special.',
  },
  {
    id: 'formal',
    label: 'Formal',
    preview: 'Dear {guest_name}, on behalf of our team, we extend our sincere gratitude for your presence at {event_name}. It was an honour to host you.',
  },
  {
    id: 'casual',
    label: 'Casual',
    preview: 'Hey {guest_name}! 🎉 Thanks for being part of {event_name}! It wouldn\'t have been the same without you.',
  },
]

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { id: 'sms', label: 'SMS', icon: Smartphone, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
]

const FILTERS = [
  { id: 'all', label: 'All Guests' },
  { id: 'attended', label: 'Attended Only' },
  { id: 'vip', label: 'VIP Only' },
]

export default function ThankYouPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const send = useSendThankYou(tenant, eventId)

  const [channels, setChannels] = useState<string[]>(['whatsapp'])
  const [message, setMessage] = useState(TEMPLATES[0].preview)
  const [subject, setSubject] = useState('Thank you for being part of our event!')
  const [guestFilter, setGuestFilter] = useState<'all' | 'attended' | 'vip'>('attended')
  const [sent, setSent] = useState(false)

  function toggleChannel(id: string) {
    setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function applyTemplate(preview: string) {
    setMessage(preview)
  }

  function handleSend() {
    send.mutate(
      { channels, message, subject: channels.includes('email') ? subject : undefined, guest_filter: guestFilter },
      { onSuccess: () => setSent(true) },
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Thank-You Messages</h1>
          <p className="text-white/40 text-sm mt-0.5">Send personalised gratitude to your guests</p>
        </div>

        {/* Sent success */}
        {sent && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-emerald-300">Messages sent successfully!</div>
              <div className="text-xs text-emerald-400/60 mt-0.5">Your guests have been notified.</div>
            </div>
          </div>
        )}

        {/* Channel selector */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-medium text-white/60">Send Via</h3>
          <div className="flex gap-3">
            {CHANNELS.map(ch => {
              const Icon = ch.icon
              const active = channels.includes(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all',
                    active ? ch.color : 'text-white/30 border-white/[0.06] hover:border-white/[0.12]',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {ch.label}
                  {active && <Check className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Guest filter */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-medium text-white/60">Recipients</h3>
          <div className="flex gap-2">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setGuestFilter(f.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm border transition-all',
                  guestFilter === f.id
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    : 'text-white/40 border-white/[0.06] hover:border-white/[0.12]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-medium text-white/60">Quick Templates</h3>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.preview)}
                className={cn(
                  'p-3 rounded-xl text-left border transition-all',
                  message === t.preview
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]',
                )}
              >
                <div className="text-xs font-medium text-white/60 mb-1">{t.label}</div>
                <div className="text-xs text-white/30 line-clamp-3">{t.preview}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message composer */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <h3 className="text-sm font-medium text-white/60">Message</h3>

          {channels.includes('email') && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">
              Message body —{' '}
              <span className="text-indigo-400">use {'{guest_name}'} and {'{event_name}'} as variables</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              className="w-full px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Preview</div>
            <p className="text-sm text-white/60">
              {message
                .replace('{guest_name}', 'Priya Sharma')
                .replace('{event_name}', 'Rohan & Priya Wedding')}
            </p>
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={send.isPending || channels.length === 0 || !message.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:from-pink-400 hover:to-rose-400 disabled:opacity-50 transition-all"
        >
          {send.isPending ? (
            <>Sending…</>
          ) : (
            <><Heart className="w-4 h-4" /> <Send className="w-4 h-4" /> Send Thank-You Messages</>
          )}
        </button>

      </div>
    </div>
  )
}
