'use client'

import { useEffect, useState, useRef, FormEvent } from 'react'
import { useParams } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PortalSettings {
  portal_title?: string
  hero_image_url?: string
  brand_color?: string
  welcome_message?: string
  footer_text?: string
  section_rsvp?: boolean
  section_event_details?: boolean
  section_accommodation?: boolean
  section_schedule?: boolean
  section_meal?: boolean
  section_gallery?: boolean
  section_gift_registry?: boolean
  section_survey?: boolean
  section_contact?: boolean
  section_qr_code?: boolean
  section_seating?: boolean
}

interface EventInfo {
  id: string
  name: string
  event_date: string
  event_end_date?: string
  event_location?: string
  description?: string
  cover_image_url?: string
  timezone?: string
}

interface GuestInfo {
  id: string
  full_name: string
  mobile?: string
  email?: string
  rsvp_status: 'pending' | 'confirmed' | 'declined' | 'maybe'
  meal_preference?: string
  dietary_requirements?: string
  table_number?: string
  check_in_at?: string
  qr_code_url?: string
}

interface PortalData {
  settings: PortalSettings
  event: EventInfo
  guest: GuestInfo
  accommodation?: {
    hotel_name?: string
    room_number?: string
    check_in?: string
    check_out?: string
    address?: string
    transport_info?: string
  }
  itinerary?: { time: string; title: string; location?: string; description?: string }[]
  announcements?: { id: string; title: string; body: string; emoji?: string; is_pinned: boolean; created_at: string }[]
  food_menu?: { course: string; items: { name: string; dietary_tags?: string[] }[] }[]
  faqs?: { question: string; answer: string }[]
  contacts?: { name: string; role: string; phone?: string; email?: string }[]
  gallery?: { url: string; caption?: string }[]
  gifts?: { title: string; description?: string; link?: string; is_fulfilled: boolean }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

const RSVP_STYLES = {
  pending:   { label: 'RSVP Pending',  bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  confirmed: { label: 'Attending ✓',   bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-400' },
  declined:  { label: 'Not Attending', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400' },
  maybe:     { label: 'Maybe',         bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
}

// ─── OTP Login Component ───────────────────────────────────────────────────────

function OtpLogin({ eventId, brandColor, onSuccess }: {
  eventId: string
  brandColor: string
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])

  async function requestOtp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/guest-portal/${eventId}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to send OTP')
      setStep('otp')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault()
    const code = otpDigits.join('')
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/guest-portal/${eventId}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mobile, otp: code }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Invalid OTP')
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOtpDigit(index: number, value: string) {
    if (!/^[0-9]?$/.test(value)) return
    const newDigits = [...otpDigits]
    newDigits[index] = value
    setOtpDigits(newDigits)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
    if (!value && index > 0) otpRefs.current[index - 1]?.focus()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: brandColor || '#7c3aed' }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your registered mobile number to access your event portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {step === 'mobile' ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile number</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 text-base"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-base disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: brandColor || '#7c3aed' }}
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-3">
                  OTP sent to <span className="font-medium text-slate-700">{mobile}</span>
                </p>
                <div className="flex gap-2 justify-between">
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleOtpDigit(i, e.target.value)}
                      onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && otpRefs.current[i - 1]?.focus()}
                      className="w-11 h-12 text-center text-xl font-bold border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
                    />
                  ))}
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || otpDigits.some(d => !d)}
                className="w-full py-3 rounded-xl text-white font-semibold text-base disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: brandColor || '#7c3aed' }}
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('mobile'); setOtpDigits(['','','','','','']); setError('') }}
                className="w-full text-sm text-slate-500 hover:text-slate-700"
              >
                ← Change number
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Powered by <span className="font-semibold">OccasionPro</span>
        </p>
      </div>
    </div>
  )
}

// ─── Section Components ────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function RsvpSection({ eventId, guest, brandColor, onUpdate }: {
  eventId: string; guest: GuestInfo; brandColor: string; onUpdate: () => void
}) {
  const [status, setStatus] = useState(guest.rsvp_status)
  const [meal, setMeal] = useState(guest.meal_preference || '')
  const [dietary, setDietary] = useState(guest.dietary_requirements || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch(`/api/v1/guest-portal/${eventId}/sections/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      await fetch(`/api/v1/guest-portal/${eventId}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meal_preference: meal, dietary_requirements: dietary }),
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); onUpdate() }, 2000)
    } catch {} finally {
      setSaving(false)
    }
  }

  const current = RSVP_STYLES[status] ?? RSVP_STYLES.pending

  return (
    <SectionCard title="RSVP" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}>
      <div className="space-y-4">
        {/* Current status */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${current.bg} ${current.text}`}>
          <div className={`w-2 h-2 rounded-full ${current.dot}`} />
          {current.label}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Attendance */}
          <div className="grid grid-cols-3 gap-2">
            {(['confirmed', 'maybe', 'declined'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`py-2.5 rounded-xl text-sm font-medium capitalize border transition-all ${
                  status === s
                    ? 'border-2 bg-opacity-10'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                style={status === s ? {
                  borderColor: brandColor || '#7c3aed',
                  color: brandColor || '#7c3aed',
                  backgroundColor: `${brandColor}15` || '#7c3aed15',
                } : {}}
              >
                {s === 'confirmed' ? '✓ Attending' : s === 'maybe' ? '? Maybe' : '✗ Decline'}
              </button>
            ))}
          </div>

          {status !== 'declined' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meal preference</label>
                <select
                  value={meal}
                  onChange={e => setMeal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-violet-400"
                >
                  <option value="">No preference</option>
                  <option value="veg">Vegetarian</option>
                  <option value="non_veg">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="jain">Jain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dietary requirements / allergies</label>
                <input
                  type="text"
                  value={dietary}
                  onChange={e => setDietary(e.target.value)}
                  placeholder="e.g. Gluten-free, nut allergy"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-violet-400"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
            style={{ backgroundColor: brandColor || '#7c3aed' }}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Update RSVP'}
          </button>
        </form>
      </div>
    </SectionCard>
  )
}

function ContactSection({ eventId, contacts, brandColor }: {
  eventId: string
  contacts?: { name: string; role: string; phone?: string; email?: string }[]
  brandColor: string
}) {
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    if (!msg.trim()) return
    setSending(true)
    try {
      await fetch(`/api/v1/guest-portal/${eventId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg }),
      })
      setSent(true)
      setMsg('')
      setTimeout(() => setSent(false), 3000)
    } catch {} finally {
      setSending(false)
    }
  }

  return (
    <SectionCard title="Contact Organiser" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}>
      <div className="space-y-4">
        {contacts && contacts.length > 0 && (
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.role}</p>
                </div>
                <div className="flex gap-2">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="space-y-2">
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Send a message to the organiser…"
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
          />
          {sent && <p className="text-green-600 text-sm">Message sent!</p>}
          <button
            type="submit"
            disabled={sending || !msg.trim()}
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: brandColor || '#7c3aed' }}
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </SectionCard>
  )
}

// ─── Main Portal Page ──────────────────────────────────────────────────────────

export default function GuestPortalPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('home')

  async function loadPortal() {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/guest-portal/${eventId}/portal`, {
        credentials: 'include',
      })
      if (res.status === 401) {
        setAuthed(false)
      } else if (res.ok) {
        const json = await res.json()
        setData(json)
        setAuthed(true)
      } else {
        setAuthed(false)
      }
    } catch {
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPortal() }, [eventId])

  const brandColor = data?.settings?.brand_color || '#7c3aed'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading your portal…</p>
        </div>
      </div>
    )
  }

  if (authed === false) {
    return <OtpLogin eventId={eventId} brandColor={brandColor} onSuccess={loadPortal} />
  }

  if (!data) return null

  const { settings, event, guest, accommodation, itinerary, announcements, food_menu, faqs, contacts, gallery, gifts } = data
  const countdown = daysUntil(event.event_date)
  const rsvpStyle = RSVP_STYLES[guest.rsvp_status] ?? RSVP_STYLES.pending

  // Build nav items based on enabled sections
  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    settings?.section_rsvp !== false ? { id: 'rsvp', label: 'RSVP', icon: '✉️' } : null,
    settings?.section_schedule && itinerary?.length ? { id: 'schedule', label: 'Schedule', icon: '📅' } : null,
    settings?.section_accommodation && accommodation ? { id: 'stay', label: 'Stay', icon: '🏨' } : null,
    settings?.section_meal && food_menu?.length ? { id: 'food', label: 'Menu', icon: '🍽️' } : null,
    settings?.section_gallery && gallery?.length ? { id: 'gallery', label: 'Gallery', icon: '📸' } : null,
    settings?.section_gift_registry && gifts?.length ? { id: 'gifts', label: 'Gifts', icon: '🎁' } : null,
    settings?.section_contact !== false ? { id: 'contact', label: 'Contact', icon: '💬' } : null,
  ].filter(Boolean) as { id: string; label: string; icon: string }[]

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* Hero */}
      <div
        className="relative"
        style={{
          background: event.cover_image_url
            ? `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%), url('${event.cover_image_url}') center/cover`
            : `linear-gradient(135deg, ${brandColor}dd, ${brandColor}88)`,
        }}
      >
        <div className="px-5 pt-10 pb-8 text-white">
          {countdown && (
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium mb-4">
              <span>🎉</span>
              <span>{countdown === 'Today' ? 'Today is the day!' : countdown === 'Tomorrow' ? 'Tomorrow!' : `${countdown} away`}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold leading-tight">{settings.portal_title || event.name}</h1>
          <p className="text-white/80 text-sm mt-1">{fmtDate(event.event_date)}</p>
          {event.event_location && (
            <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {event.event_location}
            </p>
          )}

          {/* Guest tag */}
          <div className="mt-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {guest.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{guest.full_name}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${rsvpStyle.bg} ${rsvpStyle.text}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${rsvpStyle.dot}`} />
                {rsvpStyle.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Announcements */}
      {announcements && announcements.filter(a => a.is_pinned).length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          {announcements.filter(a => a.is_pinned).map(a => (
            <div key={a.id} className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <span className="text-lg flex-shrink-0 mt-0.5">{a.emoji || '📢'}</span>
              <div>
                <p className="text-amber-800 text-sm font-semibold">{a.title}</p>
                <p className="text-amber-700 text-xs mt-0.5">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="px-4 mt-4 space-y-4">

        {/* RSVP Section */}
        {settings?.section_rsvp !== false && (
          <RsvpSection eventId={eventId} guest={guest} brandColor={brandColor} onUpdate={loadPortal} />
        )}

        {/* Schedule / Itinerary */}
        {settings?.section_schedule && itinerary && itinerary.length > 0 && (
          <SectionCard title="Schedule" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}>
            <div className="space-y-3">
              {itinerary.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: brandColor }} />
                    {i < itinerary.length - 1 && <div className="w-0.5 flex-1 mt-1 bg-slate-100" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="text-xs text-slate-400 font-medium">{item.time}</p>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    {item.location && <p className="text-xs text-slate-500 mt-0.5">📍 {item.location}</p>}
                    {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Accommodation */}
        {settings?.section_accommodation && accommodation && (
          <SectionCard title="Your Stay" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}>
            <div className="space-y-2">
              {accommodation.hotel_name && (
                <div>
                  <p className="text-xs text-slate-500">Hotel</p>
                  <p className="text-sm font-semibold text-slate-800">{accommodation.hotel_name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {accommodation.room_number && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Room</p>
                    <p className="text-base font-bold text-slate-800">{accommodation.room_number}</p>
                  </div>
                )}
                {accommodation.check_in && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Check-in</p>
                    <p className="text-sm font-semibold text-slate-800">{fmtDate(accommodation.check_in)}</p>
                  </div>
                )}
              </div>
              {accommodation.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(accommodation.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                  style={{ color: brandColor }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  {accommodation.address}
                </a>
              )}
              {accommodation.transport_info && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{accommodation.transport_info}</p>
              )}
            </div>
          </SectionCard>
        )}

        {/* Food Menu */}
        {settings?.section_meal && food_menu && food_menu.length > 0 && (
          <SectionCard title="Menu" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}>
            <div className="space-y-4">
              {food_menu.map((course, ci) => (
                <div key={ci}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{course.course}</p>
                  <div className="space-y-1.5">
                    {course.items.map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between">
                        <p className="text-sm text-slate-700">{item.name}</p>
                        <div className="flex gap-1">
                          {item.dietary_tags?.map((tag, ti) => (
                            <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* FAQs */}
        {faqs && faqs.length > 0 && (
          <SectionCard title="FAQs" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-slate-800 py-1">
                  {faq.question}
                  <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed pb-2 border-b border-slate-50">{faq.answer}</p>
              </details>
            ))}
          </div>
          </SectionCard>
        )}

        {/* Gallery */}
        {settings?.section_gallery && gallery && gallery.length > 0 && (
          <SectionCard title="Gallery" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                  <img src={img.url} alt={img.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Gifts */}
        {settings?.section_gift_registry && gifts && gifts.length > 0 && (
          <SectionCard title="Gift Registry" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}>
            <div className="space-y-3">
              {gifts.map((gift, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${gift.is_fulfilled ? 'bg-slate-50 opacity-60' : 'bg-slate-50'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{gift.title}</p>
                      {gift.is_fulfilled && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">Gifted ✓</span>}
                    </div>
                    {gift.description && <p className="text-xs text-slate-500 mt-0.5">{gift.description}</p>}
                  </div>
                  {gift.link && !gift.is_fulfilled && (
                    <a href={gift.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium px-2.5 py-1 rounded-lg text-white flex-shrink-0"
                      style={{ backgroundColor: brandColor }}>
                      Gift
                    </a>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Announcements (non-pinned) */}
        {announcements && announcements.filter(a => !a.is_pinned).length > 0 && (
          <SectionCard title="Announcements" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}>
            <div className="space-y-3">
              {announcements.filter(a => !a.is_pinned).map(a => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <span className="text-xl">{a.emoji || '📢'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Contact */}
        {settings?.section_contact !== false && (
          <ContactSection eventId={eventId} contacts={contacts} brandColor={brandColor} />
        )}

        {/* Welcome message */}
        {settings?.welcome_message && (
          <p className="text-center text-slate-500 text-sm italic px-2">{settings.welcome_message}</p>
        )}

        {/* Footer */}
        <div className="text-center py-2">
          {settings?.footer_text && <p className="text-slate-400 text-xs mb-1">{settings.footer_text}</p>}
          {!settings?.hide_powered_by && (
            <p className="text-slate-300 text-[10px]">Powered by OccasionPro</p>
          )}
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      {navItems.length > 2 && (
        <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-100 px-2 py-2 safe-area-inset-bottom z-50">
          <div className="flex justify-around max-w-md mx-auto">
            {navItems.slice(0, 5).map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex flex-col items-center gap-0.5 px-2 py-1"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] text-slate-500">{item.label}</span>
              </a>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
