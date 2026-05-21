'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:     '#1a1206',
  primaryColor:   '#d4af37',
  accentColor:    '#f5d76e',
  textColor:      '#f5e9c3',
  fontHeading:    'Cormorant Garamond, Georgia, serif',
  fontBody:       'Lato, sans-serif',
}

function GoldParticle({ delay, x, y }: { delay: number; x: string; y: string }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
      style={{ left: x, top: y, background: '#d4af37', opacity: 0.6 }}
      animate={{ y: [0, -30, 0], opacity: [0.6, 1, 0.3, 0.6], scale: [1, 1.4, 1] }}
      transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}

export default function RoyalGold({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }
  const particles = Array.from({ length: 12 }, (_, i) => ({
    delay: i * 0.3,
    x: `${8 + (i * 7.5) % 84}%`,
    y: `${5 + (i * 11) % 80}%`,
  }))

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Decorative particles */}
      {particles.map((p, i) => <GoldParticle key={i} {...p} />)}

      {/* Ornate border frame */}
      <div
        className="absolute inset-4 border pointer-events-none"
        style={{ borderColor: `${c.primaryColor}40` }}
      />
      <div
        className="absolute inset-6 border pointer-events-none"
        style={{ borderColor: `${c.primaryColor}20` }}
      />

      {/* Corner ornaments */}
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} text-2xl pointer-events-none opacity-40`}
          style={{ color: c.primaryColor }}>❧</div>
      ))}

      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Crown icon */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-4xl mb-4"
        >
          👑
        </motion.div>

        {/* Host name / workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs tracking-[0.3em] uppercase mb-3"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="h-px mx-auto mb-6 w-32"
          style={{ background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
        />

        {/* Invitation label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs tracking-[0.4em] uppercase mb-6"
          style={{ color: c.textColor, opacity: 0.7 }}
        >
          You are cordially invited to
        </motion.p>

        {/* Event title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="text-center text-4xl sm:text-5xl font-bold mb-6 leading-tight"
          style={{ fontFamily: c.fontHeading, color: c.primaryColor }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />

        {/* Gold divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="my-6 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
        />

        {/* Event details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="px-4"
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.accentColor} />
        </motion.div>

        {/* Description */}
        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm mt-4 px-4 leading-relaxed opacity-80"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Gold divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="my-6 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
        />

        {/* RSVP */}
        <RsvpButtons
          rsvpStatus={rsvpStatus}
          loading={rsvpLoading}
          primaryColor={c.primaryColor}
          accentColor={c.accentColor}
          textColor={c.textColor}
          onRsvp={onRsvp}
        />

        {/* Footer flourish */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
          className="text-center text-xs tracking-widest mt-2"
          style={{ color: c.accentColor }}
        >
          ✦ ✦ ✦
        </motion.p>
      </motion.div>
    </div>
  )
}
