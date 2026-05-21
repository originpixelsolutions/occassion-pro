'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#fff5f7',
  primaryColor: '#d63384',
  accentColor:  '#f7a8c4',
  textColor:    '#4a2535',
  fontHeading:  'Playfair Display, Georgia, serif',
  fontBody:     'Lato, sans-serif',
}

const petals = ['🌸', '🌺', '🌷', '💐', '🌼']

function FloatingPetal({ emoji, delay, x }: { emoji: string; delay: number; x: string }) {
  return (
    <motion.div
      className="absolute text-2xl pointer-events-none select-none"
      style={{ left: x, top: '-5%' }}
      animate={{ y: ['0vh', '110vh'], rotate: [0, 360], opacity: [0, 0.7, 0.7, 0] }}
      transition={{ duration: 8 + Math.random() * 4, repeat: Infinity, delay, ease: 'linear' }}
    >
      {emoji}
    </motion.div>
  )
}

export default function FloralPink({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }
  const floatingPetals = Array.from({ length: 8 }, (_, i) => ({
    emoji: petals[i % petals.length],
    delay: i * 1.1,
    x: `${10 + i * 11}%`,
  }))

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Floating petals */}
      {floatingPetals.map((p, i) => <FloatingPetal key={i} {...p} />)}

      {/* Soft radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 30%, ${c.accentColor}30 0%, transparent 70%)` }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Floral header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="text-center text-5xl mb-4"
        >
          🌸
        </motion.div>

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-center text-xs tracking-widest uppercase mb-4"
            style={{ color: c.primaryColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Decorative vine line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm mb-4 opacity-50"
          style={{ color: c.accentColor }}
        >
          ❧ ❧ ❧
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="text-center text-4xl sm:text-5xl font-bold mb-6 leading-tight"
          style={{ fontFamily: c.fontHeading, color: c.primaryColor }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-4"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.primaryColor} />
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="my-5 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${c.accentColor}, transparent)` }}
        />

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/60 rounded-2xl p-4 backdrop-blur-sm"
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm mt-4 leading-relaxed"
            style={{ color: c.textColor, opacity: 0.8 }}
          >
            {event.description}
          </motion.p>
        )}

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="my-5 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${c.accentColor}, transparent)` }}
        />

        <RsvpButtons
          rsvpStatus={rsvpStatus}
          loading={rsvpLoading}
          primaryColor={c.primaryColor}
          accentColor={c.accentColor}
          textColor={c.textColor}
          onRsvp={onRsvp}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
          className="text-center text-sm mt-2"
        >
          🌸 🌸 🌸
        </motion.p>
      </motion.div>
    </div>
  )
}
