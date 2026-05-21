'use client'
/**
 * Shared RSVP footer + date/venue blocks used by all templates.
 */

import { motion } from 'framer-motion'
import { Calendar, MapPin, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { InvitationEvent, InvitationGuestLink, RsvpStatus } from '../index'

// ── Date formatter ────────────────────────────────────────────────────────────

export function formatEventDate(start: string, end?: string, tz?: string): string {
  try {
    const s = parseISO(start)
    const base = format(s, 'EEEE, MMMM d, yyyy')
    const time = format(s, 'h:mm a')
    if (!end) return `${base} · ${time}`
    const e = parseISO(end)
    return `${base} · ${time} – ${format(e, 'h:mm a')}${tz ? ` (${tz})` : ''}`
  } catch {
    return start
  }
}

// ── RSVP Button ───────────────────────────────────────────────────────────────

interface RsvpButtonsProps {
  rsvpStatus: RsvpStatus
  loading: boolean
  primaryColor: string
  accentColor: string
  textColor: string
  onRsvp: (r: 'attending' | 'not_attending') => Promise<void>
}

export function RsvpButtons({
  rsvpStatus, loading, primaryColor, accentColor, textColor, onRsvp,
}: RsvpButtonsProps) {
  if (rsvpStatus) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-2 py-6"
      >
        <div
          className="text-xl font-semibold"
          style={{ color: rsvpStatus === 'attending' ? primaryColor : '#9ca3af' }}
        >
          {rsvpStatus === 'attending' ? '🎉 See you there!' : '❌ We\'ll miss you'}
        </div>
        <button
          onClick={() => onRsvp(rsvpStatus === 'attending' ? 'not_attending' : 'attending')}
          disabled={loading}
          className="text-sm underline opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          Change response
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="flex flex-col sm:flex-row gap-3 justify-center py-6"
    >
      <button
        onClick={() => onRsvp('attending')}
        disabled={loading}
        className="px-8 py-3 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
        style={{ background: primaryColor, color: '#fff' }}
      >
        {loading ? 'Saving…' : '✓  Yes, I\'ll attend'}
      </button>
      <button
        onClick={() => onRsvp('not_attending')}
        disabled={loading}
        className="px-8 py-3 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
        style={{ background: 'transparent', color: textColor, border: `2px solid ${accentColor}` }}
      >
        {loading ? 'Saving…' : '✗  Can\'t make it'}
      </button>
    </motion.div>
  )
}

// ── Event Details Block ───────────────────────────────────────────────────────

interface EventDetailsProps {
  event: InvitationEvent
  textColor: string
  accentColor: string
}

export function EventDetails({ event, textColor, accentColor }: EventDetailsProps) {
  return (
    <div className="flex flex-col gap-3 text-sm" style={{ color: textColor }}>
      <div className="flex items-start gap-3">
        <Calendar size={16} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
        <span>{formatEventDate(event.start_date, event.end_date, event.timezone)}</span>
      </div>
      {event.venue_name && (
        <div className="flex items-start gap-3">
          <MapPin size={16} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
          <span>
            {event.venue_name}
            {event.venue_address && (
              <span className="block opacity-70 text-xs mt-0.5">{event.venue_address}</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Personalized greeting ─────────────────────────────────────────────────────

export function GuestGreeting({
  guestLink,
  headingColor,
  subColor,
}: {
  guestLink: InvitationGuestLink
  headingColor: string
  subColor: string
}) {
  const name = guestLink.guest?.full_name ?? 'Valued Guest'
  const msg  = guestLink.personalized_message

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="text-center"
    >
      <p className="text-base font-medium mb-1" style={{ color: headingColor }}>
        Dear {name},
      </p>
      {msg && (
        <p className="text-sm italic opacity-80" style={{ color: subColor }}>
          &ldquo;{msg}&rdquo;
        </p>
      )}
    </motion.div>
  )
}
