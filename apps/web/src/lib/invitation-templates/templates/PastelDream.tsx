'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#fdf4ff',
  primaryColor: '#9b59b6',
  accentColor:  '#c39bd3',
  textColor:    '#4a235a',
  fontHeading:  'Nunito, sans-serif',
  fontBody:     'Nunito, sans-serif',
}

const SHAPES = [
  { shape: '●', top: '8%',  left: '5%',  color: '#f9c6ff', size: 80 },
  { shape: '●', top: '15%', left: '88%', color: '#c3e0ff', size: 60 },
  { shape: '●', top: '70%', left: '3%',  color: '#ffd6e7', size: 100 },
  { shape: '●', top: '80%', left: '85%', color: '#d4f5d4', size: 70 },
]

export default function PastelDream({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Floating blobs */}
      {SHAPES.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, background: s.color, filter: 'blur(20px)', opacity: 0.6 }}
          animate={{ scale: [1, 1.15, 1], x: [0, 10, 0], y: [0, -8, 0] }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 w-full max-w-md bg-white/70 backdrop-blur-md rounded-3xl shadow-xl p-8"
      >
        {/* Rainbow dot row */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-1.5 mb-6"
        >
          {['#ff9f9f', '#ffcf9f', '#fff09f', '#9fefbb', '#9fd0ff', '#cf9fff'].map((col, i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: col }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </motion.div>

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight"
          style={{ color: c.primaryColor }}
        >
          {event.title}
        </motion.h1>

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.primaryColor} />
        </motion.div>

        {/* Dashed divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="my-4"
          style={{ borderTop: `2px dashed ${c.accentColor}60` }}
        />

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.55 }}
            className="text-sm leading-relaxed mt-4"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Dashed divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="my-4"
          style={{ borderTop: `2px dashed ${c.accentColor}60` }}
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
