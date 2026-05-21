'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#050505',
  primaryColor: '#39ff14',
  accentColor:  '#ff073a',
  textColor:    '#ffffff',
  fontHeading:  'Black Han Sans, Impact, sans-serif',
  fontBody:     'Exo 2, sans-serif',
}

function NeonFlicker({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <motion.span
      style={{ color, textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 40px ${color}` }}
      animate={{ opacity: [1, 0.9, 1, 0.8, 1] }}
      transition={{ duration: 0.15, times: [0, 0.1, 0.2, 0.5, 1], repeat: Infinity, repeatDelay: 3 + Math.random() * 3 }}
    >
      {children}
    </motion.span>
  )
}

export default function NeonParty({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)`,
        }}
      />

      {/* Neon glow spots */}
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: `${c.primaryColor}15`, filter: 'blur(80px)' }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: `${c.accentColor}15`, filter: 'blur(80px)' }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Party emoji */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="text-center text-6xl mb-4"
        >
          🪩
        </motion.div>

        {/* Neon border box title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-6 p-4 rounded-lg"
          style={{
            border: `2px solid ${c.primaryColor}`,
            boxShadow: `0 0 15px ${c.primaryColor}60, inset 0 0 15px ${c.primaryColor}10`,
          }}
        >
          <div className="text-xs tracking-[0.4em] uppercase mb-2" style={{ color: c.accentColor }}>
            You&apos;re invited to
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black uppercase leading-tight"
            style={{ fontFamily: c.fontHeading }}
          >
            <NeonFlicker color={c.primaryColor}>{event.title}</NeonFlicker>
          </h1>
          {event.workspace?.name && (
            <div className="text-xs mt-2 tracking-widest uppercase opacity-60" style={{ color: c.textColor }}>
              by {event.workspace.name}
            </div>
          )}
        </motion.div>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mb-5 text-center"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.primaryColor} />
        </motion.div>

        {/* Neon rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-5"
          style={{
            height: 1,
            background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)`,
            boxShadow: `0 0 8px ${c.primaryColor}`,
          }}
        />

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-lg p-4 mb-5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${c.accentColor}40`,
          }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.accentColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm leading-relaxed mb-5"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Neon rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mb-2"
          style={{
            height: 1,
            background: `linear-gradient(to right, transparent, ${c.accentColor}, transparent)`,
            boxShadow: `0 0 8px ${c.accentColor}`,
          }}
        />

        <RsvpButtons
          rsvpStatus={rsvpStatus}
          loading={rsvpLoading}
          primaryColor={c.primaryColor}
          accentColor={c.accentColor}
          textColor={c.textColor}
          onRsvp={onRsvp}
        />
      </motion.div>
    </div>
  )
}
