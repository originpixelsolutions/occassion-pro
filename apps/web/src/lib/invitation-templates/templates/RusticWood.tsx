'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#3e2723',
  primaryColor: '#d7a86e',
  accentColor:  '#ffcc80',
  textColor:    '#fdf0e0',
  fontHeading:  'Abril Fatface, Georgia, serif',
  fontBody:     'Merriweather, serif',
}

export default function RusticWood({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Wood grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            92deg,
            transparent,
            transparent 2px,
            ${c.primaryColor}20 2px,
            ${c.primaryColor}20 4px
          )`,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Banner rope decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-3xl mb-4"
        >
          🎋
        </motion.div>

        {/* Rope-style divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mb-6 text-center"
          style={{
            height: 3,
            background: `repeating-linear-gradient(90deg, ${c.primaryColor} 0px, ${c.primaryColor} 6px, transparent 6px, transparent 10px)`,
          }}
        />

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs tracking-widest uppercase mb-3"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="text-center text-4xl sm:text-5xl font-bold mb-4 leading-tight"
          style={{ fontFamily: c.fontHeading, color: c.accentColor }}
        >
          {event.title}
        </motion.h1>

        {/* Invitation text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.45 }}
          className="text-center text-sm italic mb-6"
          style={{ color: c.textColor }}
        >
          ~ A heartfelt invitation ~
        </motion.p>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />
        </motion.div>

        {/* Wood panel detail card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="rounded-lg p-5 mb-6"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `2px solid ${c.primaryColor}40`,
          }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.75 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Rope divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mb-2"
          style={{
            height: 3,
            background: `repeating-linear-gradient(90deg, ${c.primaryColor} 0px, ${c.primaryColor} 6px, transparent 6px, transparent 10px)`,
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1 }}
          className="text-center text-sm mt-2"
        >
          🌿 🍂 🌿
        </motion.p>
      </motion.div>
    </div>
  )
}
