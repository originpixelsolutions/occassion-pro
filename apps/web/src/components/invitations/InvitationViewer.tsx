'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import {
  MapPin, Clock, Calendar, ChevronDown, Share2, Check, X,
  CalendarPlus,
} from 'lucide-react'

// ── Theme configuration ────────────────────────────────────────────────────

interface ThemeConfig {
  background: { type: 'gradient' | 'image' | 'pattern' | 'solid'; value: string }
  primaryColor: string
  accentColor: string
  textColor: string
  fontHeading: string
  fontBody: string
  animationStyle: 'elegant' | 'playful' | 'minimal' | 'vibrant'
  animationSpeed: 'slow' | 'medium' | 'fast'
  decorativeElements: string[]
  musicEnabled: boolean
  musicUrl?: string
}

interface CustomConfig {
  coverImageUrl?: string
  eventTitleOverride?: string
  hostNames?: string
  rsvpDeadline?: string
  customMessageTemplate?: string
  primaryColor?: string
  accentColor?: string
  backgroundImageUrl?: string
  selectedFont?: string
  animationSpeed?: 'slow' | 'medium' | 'fast'
  animationStyle?: 'elegant' | 'playful' | 'minimal' | 'vibrant'
  musicEnabled?: boolean
  musicUrl?: string
}

interface InvitationData {
  event: {
    id: string
    title: string
    description?: string
    start_date: string
    end_date?: string
    timezone?: string
    venue_name?: string
    venue_address?: string
    cover_image_url?: string
    workspace?: { name: string; logo_url?: string }
  }
  guestLink: {
    personalized_message?: string
    guest?: { full_name: string; id?: string }
    short_link?: { code: string }
  }
  invitation: {
    template?: { theme_slug: string; config: ThemeConfig }
    custom_config?: CustomConfig
    is_published?: boolean
  }
}

interface InvitationViewerProps {
  data: InvitationData
  shortCode?: string
  previewMode?: boolean
}

// ── Animation speed maps ───────────────────────────────────────────────────
const SPEED_MAP = { slow: 1.4, medium: 1.0, fast: 0.6 }
const STAGGER_MAP = { slow: 0.25, medium: 0.18, fast: 0.1 }

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ days: d, hours: h, minutes: m, seconds: s })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return timeLeft
}

// ── Confetti ───────────────────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  const pieces = Array.from({ length: 60 }, (_, i) => i)
  if (!active) return null
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {pieces.map(i => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            backgroundColor: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6fc8', '#a29bfe'][i % 6],
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: Math.random() * 720 - 360, opacity: 0 }}
          transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

// ── Decorative Elements ────────────────────────────────────────────────────
function DecorativeLayer({ elements, primaryColor, accentColor }: {
  elements: string[]
  primaryColor: string
  accentColor: string
}) {
  if (!elements?.length) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]" aria-hidden>
      {elements.includes('animated-stars') && (
        <>
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: accentColor,
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
            />
          ))}
        </>
      )}
      {elements.includes('gold-particles') && (
        <>
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full opacity-30"
              style={{
                width: Math.random() * 4 + 2,
                height: Math.random() * 4 + 2,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: primaryColor,
              }}
              animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4 }}
            />
          ))}
        </>
      )}
      {elements.includes('neon-glow') && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(ellipse at 30% 40%, ${primaryColor}40 0%, transparent 60%),
                         radial-gradient(ellipse at 70% 60%, ${accentColor}30 0%, transparent 50%)`,
          }}
        />
      )}
      {elements.includes('geometric-border') && (
        <div className="absolute inset-4 border opacity-20 rounded-lg" style={{ borderColor: primaryColor }} />
      )}
    </div>
  )
}

// ── Add to Calendar ────────────────────────────────────────────────────────
function buildCalendarLinks(event: InvitationData['event'], url: string) {
  const title = encodeURIComponent(event.title)
  const start = new Date(event.start_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = event.end_date
    ? new Date(event.end_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : start
  const loc = encodeURIComponent(event.venue_name ?? '')
  const desc = encodeURIComponent(`View your invitation: ${url}`)

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&location=${loc}&details=${desc}`
  const ics = `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${title}%0ADTSTART:${start}%0ADTEND:${end}%0ALOCATION:${loc}%0ADESCRIPTION:${desc}%0AEND:VEVENT%0AEND:VCALENDAR`

  return { google, ics }
}

// ── Main InvitationViewer Component ────────────────────────────────────────
export default function InvitationViewer({ data, shortCode, previewMode = false }: InvitationViewerProps) {
  const { event, guestLink, invitation } = data

  // Merge template config with custom overrides
  const baseConfig: ThemeConfig = invitation.template?.config ?? {
    background: { type: 'gradient', value: 'linear-gradient(135deg,#1a0a00 0%,#2d1400 100%)' },
    primaryColor: '#c9a84c',
    accentColor: '#f5d88a',
    textColor: '#f5e6c8',
    fontHeading: 'Cormorant Garamond',
    fontBody: 'Lato',
    animationStyle: 'elegant',
    animationSpeed: 'slow',
    decorativeElements: [],
    musicEnabled: false,
  }

  const custom = invitation.custom_config ?? {}
  const primaryColor = custom.primaryColor ?? baseConfig.primaryColor
  const accentColor = custom.accentColor ?? baseConfig.accentColor
  const textColor = baseConfig.textColor
  const animSpeed = custom.animationSpeed ?? baseConfig.animationSpeed
  const animStyle = custom.animationStyle ?? baseConfig.animationStyle
  const speedFactor = SPEED_MAP[animSpeed]
  const stagger = STAGGER_MAP[animSpeed]

  const bg = custom.backgroundImageUrl
    ? { type: 'image' as const, value: custom.backgroundImageUrl }
    : baseConfig.background

  const guestName = guestLink.guest?.full_name ?? 'Valued Guest'
  const eventTitle = custom.eventTitleOverride ?? event.title
  const hostNames = custom.hostNames ?? event.workspace?.name ?? ''
  const coverImage = custom.coverImageUrl ?? event.cover_image_url
  const personalMsg = custom.customMessageTemplate ?? guestLink.personalized_message
  const rsvpDeadline = custom.rsvpDeadline

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.occasionpro.com'
  const invitationUrl = shortCode ? `${appUrl}/i/${shortCode}` : appUrl
  const calLinks = buildCalendarLinks(event, invitationUrl)

  const [rsvpState, setRsvpState] = useState<'idle' | 'attending' | 'not_attending' | 'submitting'>('idle')
  const [showConfetti, setShowConfetti] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const countdown = useCountdown(event.start_date)
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollY } = useScroll({ container: containerRef })
  const coverY = useTransform(scrollY, [0, 400], [0, 80])

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: animStyle === 'playful' ? 40 : 24 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: {
        duration: speedFactor * (animStyle === 'minimal' ? 0.5 : 0.8),
        delay: i * stagger,
        ease: animStyle === 'vibrant' ? 'backOut' : [0.25, 0.46, 0.45, 0.94],
      },
    }),
  }

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1, scale: 1,
      transition: {
        duration: speedFactor * 0.6,
        delay: i * stagger,
        ease: 'backOut',
      },
    }),
  }

  async function handleRsvp(response: 'attending' | 'not_attending') {
    if (previewMode) { setRsvpState(response); return }
    setRsvpState('submitting')
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
      await fetch(`${API}/invitations/public/${shortCode}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      setRsvpState(response)
      if (response === 'attending') {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 4000)
      }
    } catch {
      setRsvpState('idle')
    }
  }

  // Format event date
  const eventDate = new Date(event.start_date)
  const formattedDate = eventDate.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const formattedTime = eventDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  // Build background style
  const backgroundStyle: React.CSSProperties = bg.type === 'image'
    ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : bg.type === 'gradient'
    ? { background: bg.value }
    : { backgroundColor: bg.value }

  const themeSlug = invitation.template?.theme_slug ?? 'royal-gold'

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-y-auto overflow-x-hidden"
      style={{ ...backgroundStyle, color: textColor, fontFamily: `'${baseConfig.fontBody}', sans-serif` }}
    >
      {/* Background overlay for readability */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none z-0" />

      {/* Decorative elements */}
      <DecorativeLayer
        elements={baseConfig.decorativeElements}
        primaryColor={primaryColor}
        accentColor={accentColor}
      />

      {/* Confetti */}
      <Confetti active={showConfetti} />

      {/* Content */}
      <div className="relative z-10 max-w-lg mx-auto px-5 pb-20">

        {/* ── 1. Opening: Monogram / Logo ── */}
        <motion.div
          className="flex flex-col items-center justify-center pt-16 pb-8"
          initial="hidden"
          animate="visible"
          variants={scaleIn}
          custom={0}
        >
          {event.workspace?.logo_url ? (
            <motion.img
              src={event.workspace.logo_url}
              alt="logo"
              className="w-20 h-20 rounded-full object-cover shadow-2xl mb-4"
              style={{ boxShadow: `0 0 40px ${primaryColor}40` }}
            />
          ) : (
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-2xl"
              style={{
                backgroundColor: `${primaryColor}20`,
                border: `2px solid ${primaryColor}`,
                color: primaryColor,
                fontFamily: `'${baseConfig.fontHeading}', serif`,
                boxShadow: `0 0 40px ${primaryColor}30`,
              }}
            >
              {eventTitle.charAt(0)}
            </motion.div>
          )}

          <motion.div
            className="text-center"
            style={{ color: `${primaryColor}` }}
          >
            <div className="text-xs tracking-[0.35em] uppercase opacity-70 mb-1">
              {event.workspace?.name}
            </div>
            <div
              className="text-xs tracking-[0.2em] uppercase"
              style={{ color: accentColor }}
            >
              — cordially invites you —
            </div>
          </motion.div>
        </motion.div>

        {/* ── 2. Cover Image ── */}
        {coverImage && (
          <motion.div
            className="relative w-full rounded-2xl overflow-hidden mb-8 shadow-2xl"
            style={{ height: '220px' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: speedFactor * 0.9, delay: stagger * 2 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ y: coverY }}
            >
              <img
                src={coverImage}
                alt={eventTitle}
                className="w-full h-[130%] object-cover"
              />
            </motion.div>
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${bg.type === 'gradient' ? bg.value.split(',')[0].replace('linear-gradient(135deg,', '').trim() : '#000'} 0%, transparent 60%)` }}
            />
          </motion.div>
        )}

        {/* ── 3. Event Name ── */}
        <motion.div
          className="text-center mb-6"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-2"
            style={{
              fontFamily: `'${custom.selectedFont ?? baseConfig.fontHeading}', serif`,
              color: primaryColor,
              textShadow: `0 2px 20px ${primaryColor}40`,
            }}
          >
            {eventTitle}
          </h1>
          <div
            className="w-16 h-0.5 mx-auto mt-3 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </motion.div>

        {/* ── 4. Host Names ── */}
        {hostNames && (
          <motion.p
            className="text-center text-sm leading-relaxed opacity-80 mb-6 italic px-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            style={{ fontFamily: `'${baseConfig.fontBody}', sans-serif` }}
          >
            Together with their families,{' '}
            <span style={{ color: accentColor, fontWeight: 600 }}>{hostNames}</span>{' '}
            request the pleasure of your company
          </motion.p>
        )}

        {/* ── 5. Guest Name ── */}
        <motion.div
          className="text-center mb-8"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          custom={5}
        >
          <p
            className="text-xs tracking-[0.3em] uppercase opacity-60 mb-2"
          >
            Dear
          </p>
          <p
            className="text-2xl md:text-3xl font-semibold"
            style={{
              fontFamily: `'${baseConfig.fontHeading}', serif`,
              color: accentColor,
              textShadow: `0 1px 10px ${accentColor}30`,
            }}
          >
            {guestName}
          </p>
          <div className="flex items-center gap-2 justify-center mt-2 opacity-50">
            <div className="w-8 h-px" style={{ backgroundColor: primaryColor }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            <div className="w-8 h-px" style={{ backgroundColor: primaryColor }} />
          </div>
        </motion.div>

        {/* ── 6 & 7. Date, Time & Venue ── */}
        <motion.div
          className="rounded-2xl p-5 mb-6 backdrop-blur-sm"
          style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}20` }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={6}
        >
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Calendar className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <div>
              <p className="text-xs opacity-60 mb-0.5 uppercase tracking-wider">Date & Time</p>
              <p className="font-semibold text-sm" style={{ fontFamily: `'${baseConfig.fontHeading}', serif` }}>
                {formattedDate}
              </p>
              <p className="text-sm opacity-80">{formattedTime}</p>
            </div>
          </div>

          {(event.venue_name || event.venue_address) && (
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-xs opacity-60 mb-0.5 uppercase tracking-wider">Venue</p>
                {event.venue_name && (
                  <p className="font-semibold text-sm" style={{ fontFamily: `'${baseConfig.fontHeading}', serif` }}>
                    {event.venue_name}
                  </p>
                )}
                {event.venue_address && (
                  <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{event.venue_address}</p>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── 8. Countdown ── */}
        <motion.div
          className="mb-8"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={7}
        >
          <p className="text-center text-xs uppercase tracking-widest opacity-50 mb-3">
            Event begins in
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: countdown.days, label: 'Days' },
              { value: countdown.hours, label: 'Hours' },
              { value: countdown.minutes, label: 'Min' },
              { value: countdown.seconds, label: 'Sec' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-xl py-3 backdrop-blur-sm"
                style={{ backgroundColor: `${primaryColor}15`, border: `1px solid ${primaryColor}20` }}
              >
                <motion.span
                  key={value}
                  className="text-2xl font-bold"
                  style={{ color: primaryColor, fontFamily: `'${baseConfig.fontHeading}', serif` }}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {String(value).padStart(2, '0')}
                </motion.span>
                <span className="text-[10px] uppercase tracking-wider opacity-50 mt-1">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 9. Personalized Message ── */}
        {personalMsg && (
          <motion.div
            className="text-center mb-8 px-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={8}
          >
            <p
              className="text-base italic leading-relaxed opacity-85"
              style={{ fontFamily: `'${baseConfig.fontHeading}', serif`, color: accentColor }}
            >
              "{personalMsg}"
            </p>
          </motion.div>
        )}

        {/* ── 10. RSVP Section ── */}
        <motion.div
          className="mb-6"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={9}
        >
          <div
            className="rounded-2xl p-6 text-center backdrop-blur-sm"
            style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}20` }}
          >
            <p
              className="text-lg font-semibold mb-1"
              style={{ fontFamily: `'${baseConfig.fontHeading}', serif`, color: primaryColor }}
            >
              Will you join us?
            </p>
            {rsvpDeadline && (
              <p className="text-xs opacity-60 mb-4">
                Please RSVP by{' '}
                {new Date(rsvpDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            <AnimatePresence mode="wait">
              {rsvpState === 'idle' || rsvpState === 'submitting' ? (
                <motion.div
                  key="buttons"
                  className="flex gap-3 mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.button
                    onClick={() => handleRsvp('attending')}
                    disabled={rsvpState === 'submitting'}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: primaryColor, color: '#fff' }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check className="w-4 h-4" /> Attending
                  </motion.button>
                  <motion.button
                    onClick={() => handleRsvp('not_attending')}
                    disabled={rsvpState === 'submitting'}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      border: `1px solid ${primaryColor}30`,
                      color: textColor,
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <X className="w-4 h-4" /> Decline
                  </motion.button>
                </motion.div>
              ) : rsvpState === 'attending' ? (
                <motion.div
                  key="attending"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="flex flex-col items-center gap-2 mt-3"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Check className="w-7 h-7" style={{ color: primaryColor }} />
                  </div>
                  <p className="font-semibold" style={{ color: primaryColor }}>
                    Wonderful! See you there!
                  </p>
                  <p className="text-xs opacity-60">We can't wait to celebrate with you</p>
                </motion.div>
              ) : (
                <motion.div
                  key="declined"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 mt-3"
                >
                  <p className="font-medium opacity-70">We're sorry you can't make it.</p>
                  <p className="text-xs opacity-50">Thank you for letting us know.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── 11. Add to Calendar ── */}
        <motion.div
          className="mb-6"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={10}
        >
          <button
            onClick={() => setShowCalendar(v => !v)}
            className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor: `${primaryColor}10`,
              border: `1px solid ${primaryColor}20`,
              color: textColor,
            }}
          >
            <CalendarPlus className="w-4 h-4" style={{ color: primaryColor }} />
            Add to Calendar
            <ChevronDown
              className="w-4 h-4 transition-transform"
              style={{ color: primaryColor, transform: showCalendar ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          <AnimatePresence>
            {showCalendar && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mt-2">
                  <a
                    href={calLinks.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center transition-all"
                    style={{ backgroundColor: `${primaryColor}15`, border: `1px solid ${primaryColor}20`, color: textColor }}
                  >
                    Google Calendar
                  </a>
                  <a
                    href={calLinks.ics}
                    download={`${eventTitle}.ics`}
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center transition-all"
                    style={{ backgroundColor: `${primaryColor}15`, border: `1px solid ${primaryColor}20`, color: textColor }}
                  >
                    Apple / .ics
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── 12. Share ── */}
        <motion.div
          className="text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={11}
        >
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`I've been invited to ${eventTitle}! Join me: ${invitationUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
            style={{ backgroundColor: '#25D366', color: '#fff' }}
          >
            <Share2 className="w-4 h-4" />
            Share on WhatsApp
          </a>
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-10" />
      </div>

      {/* Theme-specific font loading via CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Cinzel:wght@400;700&family=Dancing+Script:wght@600;700&family=Playfair+Display:wght@400;700&family=Pacifico&family=Righteous&family=Montserrat:wght@400;600;700&family=Abril+Fatface&family=Merriweather:wght@400;700&family=Orbitron:wght@700&family=Exo+2:wght@400;600&family=Nunito:wght@400;600&family=Lato:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
      `}</style>
    </div>
  )
}
