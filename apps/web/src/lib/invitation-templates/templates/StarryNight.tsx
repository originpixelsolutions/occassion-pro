'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#0a0e27',
  primaryColor: '#818cf8',
  accentColor:  '#c7d2fe',
  textColor:    '#e0e7ff',
  fontHeading:  'Comfortaa, cursive',
  fontBody:     'Quicksand, sans-serif',
}

function Star({ x, y, delay, size }: { x: string; y: string; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: '#fff' }}
      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
      transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}

export default function StarryNight({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }
  const stars = Array.from({ length: 50 }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 100}%`,
    delay: Math.random() * 3,
    size: Math.random() > 0.8 ? 3 : Math.random() > 0.5 ? 2 : 1,
  }))

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Stars */}
      {stars.map((s, i) => <Star key={i} {...s} />)}

      {/* Nebula */}
      <div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          top: '10%', left: '20%',
          background: `radial-gradient(circle, ${c.primaryColor}15, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute w-72 h-72 rounded-full pointer-events-none"
        style={{
          bottom: '10%', right: '15%',
          background: `radial-gradient(circle, #ec4899 15, transparent 70%)`,
          filter: 'blur(50px)',
          opacity: 0.15,
        }}
      />

      {/* Shooting star animation */}
      <motion.div
        className="absolute w-0.5 h-16 pointer-events-none"
        style={{
          top: '15%', left: '70%',
          background: `linear-gradient(to bottom, transparent, ${c.accentColor})`,
          rotate: 45,
        }}
        animate={{ x: [0, -200], y: [0, 200], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 8, ease: 'easeIn' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Moon emoji */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="text-center text-5xl mb-6"
        >
          🌙
        </motion.div>

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs tracking-widest uppercase mb-4"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Star divider */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.35 }}
          className="text-center mb-4"
          style={{ color: c.primaryColor }}
        >
          ✦ · ✦ · ✦
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="text-center text-4xl sm:text-5xl font-bold mb-6 leading-tight"
          style={{
            fontFamily: c.fontHeading,
            color: c.accentColor,
            textShadow: `0 0 40px ${c.primaryColor}80`,
          }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />
        </motion.div>

        {/* Constellation divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="mb-6"
          style={{ height: 1, background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
        />

        {/* Detail card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-5 mb-6"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${c.primaryColor}40`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.65 }}
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mb-2"
          style={{ height: 1, background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
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
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1 }}
          className="text-center text-sm mt-2"
          style={{ color: c.accentColor }}
        >
          ✦ ✦ ✦
        </motion.p>
      </motion.div>
    </div>
  )
}
