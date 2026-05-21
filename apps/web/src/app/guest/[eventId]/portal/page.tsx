'use client'

/**
 * Guest Portal — Main Portal Page
 * Route: /guest/[eventId]/portal
 * 
 * Sections (toggled per event):
 *   invitation, rsvp, event_details, accommodation, transport,
 *   meal, qr_code, seating, schedule, gallery, contact, survey,
 *   gift_registry, sessions
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/notifications'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalData {
  event: {
    id: string; title: string; date: string; end_date?: string
    venue_name?: string; venue_address?: string; description?: string
  }
  guest: {
    id: string; name: string; mobile: string; category?: string
    table_number?: string; seat_number?: string; dietary_preference?: string
    rsvp_status?: string; accommodation_hotel?: string; accommodation_room?: string
    transport_type?: string; transport_pickup_location?: string
    meal_type?: string; meal_time?: string; special_meal_note?: string
  } | null
  settings: {
    portal_title?: string; brand_color: string; welcome_message?: string
    hero_image_url?: string; footer_text?: string; hide_powered_by?: boolean
  }
  sections: {
    invitation: boolean; rsvp: boolean; event_details: boolean
    accommodation: boolean; transport: boolean; meal: boolean; qr_code: boolean
    seating: boolean; schedule: boolean; gallery: boolean; contact: boolean
    survey: boolean; gift_registry: boolean; sessions: boolean
  }
  meta: {
    is_event_day: boolean; is_post_event: boolean
    days_until_event: number; event_status: string
  }
  qr_data?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const RSVP_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed ✓', color: '#10b981' },
  declined: { label: 'Declined', color: '#ef4444' },
  maybe: { label: 'Tentative', color: '#f59e0b' },
  pending: { label: 'RSVP Pending', color: '#6b7280' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuestPortalPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const [messageText, setMessageText] = useState('')
  const [messageSent, setMessageSent] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    fetch(`${API}/guest-portal/${eventId}/portal`, {
      credentials: 'include',
    })
      .then(async r => {
        if (r.status === 401) { router.push(`/guest/${eventId}/login`); return null }
        if (!r.ok) throw new Error('Failed to load portal')
        return r.json()
      })
      .then(d => { if (d) { setData(d); setLoading(false) } })
      .catch(() => { router.push(`/guest/${eventId}/login`) })
  }, [eventId, router])

  const brand = data?.settings?.brand_color || '#7c3aed'

  async function sendMessage() {
    if (!messageText.trim() || sendingMessage) return
    setSendingMessage(true)
    try {
      await fetch(`${API}/guest-portal/${eventId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageText }),
      })
      setMessageSent(true)
      setMessageText('')
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleLogout() {
    await fetch(`${API}/guest-portal/${eventId}/logout`, { method: 'POST', credentials: 'include' })
    router.push(`/guest/${eventId}/login`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f1a' }}>
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!data) return null

  const { event, guest, sections, meta } = data

  // Build nav tabs based on enabled sections
  const tabs = [
    { id: 'overview', label: '🏠 Overview', show: true },
    { id: 'rsvp', label: '✉️ RSVP', show: sections.rsvp },
    { id: 'event_details', label: '📅 Event', show: sections.event_details },
    { id: 'accommodation', label: '🏨 Stay', show: sections.accommodation && !!guest?.accommodation_hotel },
    { id: 'transport', label: '🚗 Travel', show: sections.transport },
    { id: 'meal', label: '🍽️ Meal', show: sections.meal },
    { id: 'qr_code', label: '📱 My QR', show: sections.qr_code },
    { id: 'seating', label: '💺 Seating', show: sections.seating && !!guest?.table_number },
    { id: 'schedule', label: '📋 Schedule', show: sections.schedule },
    { id: 'contact', label: '💬 Contact', show: sections.contact },
    { id: 'survey', label: '⭐ Feedback', show: sections.survey && meta.is_post_event },
  ].filter(t => t.show)

  const rsvpInfo = guest?.rsvp_status ? RSVP_LABELS[guest.rsvp_status] || RSVP_LABELS.pending : RSVP_LABELS.pending
  const welcomeMessage = (data.settings.welcome_message || 'Welcome, {{guest_name}}!')
    .replace('{{guest_name}}', guest?.name?.split(' ')[0] || 'Guest')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #111827 100%)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl"
        style={{ background: `linear-gradient(90deg, ${brand}22, transparent)` }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: brand }}
            >✦</div>
            <span className="text-white font-semibold text-sm">{data.settings.portal_title || event.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {meta.is_event_day && (
              <span className="text-xs font-medium px-2 py-1 rounded-full animate-pulse" style={{ background: `${brand}33`, color: brand }}>
                Today is the day!
              </span>
            )}
            {!meta.is_event_day && !meta.is_post_event && meta.days_until_event > 0 && (
              <span className="text-xs text-white/40">
                {meta.days_until_event}d away
              </span>
            )}
            {/* Toast-style notifications for guests — compact bell only */}
            <NotificationBell variant="compact" />
            <button onClick={handleLogout} className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Welcome banner */}
      {data.settings.hero_image_url && (
        <div className="relative h-32 overflow-hidden">
          <img src={data.settings.hero_image_url} alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-white text-xl font-semibold text-center px-4">{welcomeMessage}</h2>
          </div>
        </div>
      )}

      {/* Nav tabs — horizontal scroll */}
      <nav className="border-b border-white/10 overflow-x-auto scrollbar-none">
        <div className="flex px-4 gap-1 max-w-2xl mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className="flex-none px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: activeSection === tab.id ? brand : 'transparent',
                color: activeSection === tab.id ? brand : 'rgba(255,255,255,0.4)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* ─── OVERVIEW ─────────────────────────────────────────────── */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {!data.settings.hero_image_url && (
                <Card>
                  <p className="text-white text-lg font-medium">{welcomeMessage}</p>
                  {guest && <p className="text-white/40 text-sm mt-1">{guest.category || 'Guest'}</p>}
                </Card>
              )}

              {/* RSVP status */}
              {sections.rsvp && guest && (
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Your RSVP</p>
                      <p className="font-semibold" style={{ color: rsvpInfo.color }}>{rsvpInfo.label}</p>
                    </div>
                    {guest.rsvp_status === 'pending' && (
                      <button
                        onClick={() => setActiveSection('rsvp')}
                        className="text-sm px-3 py-1.5 rounded-lg text-white font-medium"
                        style={{ background: brand }}
                      >
                        RSVP Now
                      </button>
                    )}
                  </div>
                </Card>
              )}

              {/* Event snapshot */}
              <Card>
                <p className="text-white/50 text-xs uppercase tracking-wider mb-3">{event.title}</p>
                <div className="space-y-2">
                  <Row icon="📅" label={formatDate(event.date)} />
                  <Row icon="⏰" label={formatTime(event.date)} />
                  {event.venue_name && <Row icon="📍" label={event.venue_name} />}
                </div>
              </Card>

              {/* QR code prominent on event day */}
              {meta.is_event_day && sections.qr_code && data.qr_data && (
                <Card>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Check-In QR</p>
                  <div className="flex justify-center">
                    <img src={data.qr_data} alt="QR Code" className="w-48 h-48 rounded-xl" />
                  </div>
                  <p className="text-white/40 text-xs text-center mt-2">Show this at the entrance</p>
                </Card>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-3 gap-3">
                {sections.qr_code && <QuickLink icon="📱" label="My QR" onClick={() => setActiveSection('qr_code')} color={brand} />}
                {sections.meal && guest?.meal_type && <QuickLink icon="🍽️" label="My Meal" onClick={() => setActiveSection('meal')} color={brand} />}
                {sections.contact && <QuickLink icon="💬" label="Contact" onClick={() => setActiveSection('contact')} color={brand} />}
              </div>
            </div>
          )}

          {/* ─── RSVP ─────────────────────────────────────────────────── */}
          {activeSection === 'rsvp' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-4">RSVP Status</p>
              {guest?.rsvp_status && guest.rsvp_status !== 'pending' ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">
                    {guest.rsvp_status === 'confirmed' ? '✅' : guest.rsvp_status === 'declined' ? '❌' : '🤔'}
                  </div>
                  <p className="text-white font-semibold" style={{ color: rsvpInfo.color }}>{rsvpInfo.label}</p>
                  <p className="text-white/40 text-sm mt-2">
                    {guest.rsvp_status === 'confirmed'
                      ? 'We look forward to seeing you!'
                      : 'We\'ll miss you at the event.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm">Will you be attending?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <RsvpButton label="✅ Attending" color="#10b981" onClick={() => {}} />
                    <RsvpButton label="❌ Decline" color="#ef4444" onClick={() => {}} />
                  </div>
                  <RsvpButton label="🤔 Maybe" color="#f59e0b" onClick={() => {}} />
                </div>
              )}
            </Card>
          )}

          {/* ─── EVENT DETAILS ────────────────────────────────────────── */}
          {activeSection === 'event_details' && (
            <div className="space-y-4">
              <Card>
                <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Event Details</p>
                <h2 className="text-white text-xl font-semibold mb-4">{event.title}</h2>
                <div className="space-y-3">
                  <Row icon="📅" label="Date" value={formatDate(event.date)} />
                  <Row icon="⏰" label="Time" value={formatTime(event.date)} />
                  {event.end_date && <Row icon="🏁" label="Ends" value={formatTime(event.end_date)} />}
                  {event.venue_name && <Row icon="📍" label="Venue" value={event.venue_name} />}
                  {event.venue_address && <Row icon="🗺️" label="Address" value={event.venue_address} />}
                </div>
                {event.venue_address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-4 flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
                    style={{ background: brand }}
                  >
                    🗺️ Get Directions
                  </a>
                )}
              </Card>
              {event.description && (
                <Card>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">About</p>
                  <p className="text-white/70 text-sm leading-relaxed">{event.description}</p>
                </Card>
              )}
            </div>
          )}

          {/* ─── QR CODE ──────────────────────────────────────────────── */}
          {activeSection === 'qr_code' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Your Check-In QR</p>
              {data.qr_data ? (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-white rounded-2xl">
                      <img src={data.qr_data} alt="QR Code" className="w-52 h-52" />
                    </div>
                  </div>
                  <p className="text-white font-medium text-center">{guest?.name}</p>
                  {guest?.table_number && (
                    <p className="text-white/50 text-sm text-center mt-1">Table {guest.table_number}</p>
                  )}
                  <p className="text-white/30 text-xs text-center mt-3">Show this QR code at the entrance</p>
                </>
              ) : (
                <p className="text-white/40 text-sm text-center py-8">QR code will be available closer to the event.</p>
              )}
            </Card>
          )}

          {/* ─── ACCOMMODATION ────────────────────────────────────────── */}
          {activeSection === 'accommodation' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Stay</p>
              {guest?.accommodation_hotel ? (
                <div className="space-y-3">
                  <Row icon="🏨" label="Hotel" value={guest.accommodation_hotel} />
                  {guest.accommodation_room && <Row icon="🔑" label="Room" value={guest.accommodation_room} />}
                </div>
              ) : (
                <p className="text-white/40 text-sm py-4">Accommodation details not yet assigned.</p>
              )}
            </Card>
          )}

          {/* ─── TRANSPORT ────────────────────────────────────────────── */}
          {activeSection === 'transport' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Travel</p>
              {guest?.transport_type ? (
                <div className="space-y-3">
                  <Row icon="🚗" label="Transport" value={guest.transport_type} />
                  {guest.transport_pickup_location && <Row icon="📍" label="Pickup" value={guest.transport_pickup_location} />}
                </div>
              ) : (
                <p className="text-white/40 text-sm py-4">Transport details not yet assigned.</p>
              )}
            </Card>
          )}

          {/* ─── MEAL ─────────────────────────────────────────────────── */}
          {activeSection === 'meal' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Meal</p>
              {guest?.meal_type ? (
                <div className="space-y-3">
                  <Row icon="🍽️" label="Type" value={guest.meal_type} />
                  {guest.meal_time && <Row icon="⏰" label="Time" value={guest.meal_time} />}
                  {guest.dietary_preference && <Row icon="🥗" label="Dietary" value={guest.dietary_preference} />}
                  {guest.special_meal_note && <Row icon="📝" label="Note" value={guest.special_meal_note} />}
                </div>
              ) : (
                <p className="text-white/40 text-sm py-4">Meal details not yet assigned.</p>
              )}
            </Card>
          )}

          {/* ─── SEATING ──────────────────────────────────────────────── */}
          {activeSection === 'seating' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Seat</p>
              {guest?.table_number ? (
                <div className="space-y-3">
                  <div className="flex justify-center py-4">
                    <div
                      className="w-28 h-28 rounded-2xl flex flex-col items-center justify-center text-white font-bold border-2"
                      style={{ borderColor: brand, background: `${brand}22` }}
                    >
                      <span className="text-3xl font-black">{guest.table_number}</span>
                      <span className="text-xs opacity-60 mt-1">Table</span>
                    </div>
                  </div>
                  {guest.seat_number && <Row icon="💺" label="Seat" value={guest.seat_number} />}
                </div>
              ) : (
                <p className="text-white/40 text-sm py-4 text-center">Seating details will be released closer to the event.</p>
              )}
            </Card>
          )}

          {/* ─── SCHEDULE ─────────────────────────────────────────────── */}
          {activeSection === 'schedule' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Schedule</p>
              <p className="text-white/40 text-sm py-4 text-center">Detailed schedule coming soon.</p>
            </Card>
          )}

          {/* ─── CONTACT ──────────────────────────────────────────────── */}
          {activeSection === 'contact' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Contact Organiser</p>
              {messageSent ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-white font-medium">Message Sent!</p>
                  <p className="text-white/40 text-sm mt-1">The team will get back to you shortly.</p>
                  <button
                    onClick={() => setMessageSent(false)}
                    className="mt-4 text-sm text-violet-400 hover:text-violet-300"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    placeholder="Type your message to the event team…"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    maxLength={1000}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 resize-none text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-xs">{messageText.length}/1000</span>
                    <button
                      onClick={sendMessage}
                      disabled={!messageText.trim() || sendingMessage}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ background: brand }}
                    >
                      {sendingMessage ? 'Sending…' : 'Send Message'}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ─── SURVEY ───────────────────────────────────────────────── */}
          {activeSection === 'survey' && (
            <Card>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Share Your Feedback</p>
              <p className="text-white/40 text-sm py-4 text-center">Feedback form will appear after the event concludes.</p>
            </Card>
          )}

        </div>
      </main>

      {/* Footer */}
      {!data.settings.hide_powered_by && (
        <footer className="text-center py-4 text-white/20 text-xs border-t border-white/5">
          {data.settings.footer_text || `Powered by OccasionPro`}
        </footer>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      {children}
    </div>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (value === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-white/70 text-sm">{label}</span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-white/40 text-xs">{label}</p>
        <p className="text-white text-sm">{value}</p>
      </div>
    </div>
  )
}

function QuickLink({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-white/50">{label}</span>
    </button>
  )
}

function RsvpButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
      style={{ background: `${color}33`, border: `1px solid ${color}66`, color }}
    >
      {label}
    </button>
  )
}
