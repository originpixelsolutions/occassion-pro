'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#0d0d0d',
  primaryColor: '#c9a84c',
  accentColor:  '#e8d5a3',
  textColor:    '#e5e5e5',
  fontHeading:  'Cinzel, Georgia, serif',
  fontBody:     'Raleway, sans-serif',
}

export default function DarkLuxury({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-6"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Background texture gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 20% 50%, ${c.primaryColor}12 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 50%, ${c.accentColor}08 0%, transparent 60%)`,
        }}
      />

      {/* Animated shimmer bars */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px w-full pointer-events-none"
          style={{
            top: `${20 + i * 20}%`,
            background: `linear-gradient(to right, transparent, ${c.primaryColor}20, transparent)`,
          }}
          animate={{ opacity: [0.3, 0.8, 0.3], x: ['-100%', '100%'] }}
          transition={{ duration: 6, repeat: Infinity, delay: i * 1.5, ease: 'linear' }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Monogram / logo area */}
        <motion.div
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-center mb-6"
        >
          {event.workspace?.logo_url ? (
            <img
              src={event.workspace.logo_url}
              alt={event.workspace.name}
              className="h-12 w-12 mx-auto rounded-full object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 mx-auto rounded-full border flex items-center justify-center text-lg font-bold"
              style={{ borderColor: c.primaryColor, color: c.primaryColor }}
            >
              {(event.workspace?.name ?? event.title)?.[0]?.toUpperCase()}
            </div>
          )}
        </motion.div>

        {/* Top rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="mb-6"
          style={{ height: 1, background: `linear-gradient(to right, transparent, ${c.primaryColor}, transparent)` }}
        />

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-xs tracking-[0.5em] uppercase mb-4"
            style={{ color: c.primaryColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* The event */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.45 }}
          className="text-center text-xs tracking-[0.3em] uppercase mb-4"
          style={{ color: c.accentColor }}
        >
          presents
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, letterSpacing: '0.3em' }}
          animate={{ opacity: 1, letterSpacing: '0.05em' }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center text-3xl sm:text-4xl font-bold mb-8 leading-tight"
          style={{ fontFamily: c.fontHeading, color: c.accentColor }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />
        </motion.div>

        {/* Detail card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="rounded-xl p-5 mb-6"
          style={{
            background: `${c.primaryColor}0d`,
            border: `1px solid ${c.primaryColor}30`,
          }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Bottom rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.75, duration: 0.7 }}
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
      </motion.div>
    </div>
  )
}
