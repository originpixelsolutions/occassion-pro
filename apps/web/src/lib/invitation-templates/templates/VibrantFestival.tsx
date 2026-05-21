'use client'
import { motion, useAnimation } from 'framer-motion'
import { useEffect } from 'react'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#0f0f0f',
  primaryColor: '#ff6b35',
  accentColor:  '#ffd23f',
  textColor:    '#ffffff',
  fontHeading:  'Oswald, Impact, sans-serif',
  fontBody:     'Source Sans Pro, sans-serif',
}

const CONFETTI_COLORS = ['#ff6b35', '#ffd23f', '#06ffa5', '#ff71ce', '#01cdfe']

function Confetti({ delay, x }: { delay: number; x: string }) {
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
  return (
    <motion.div
      className="absolute w-2 h-2 pointer-events-none"
      style={{ left: x, top: '-5%', background: color, borderRadius: Math.random() > 0.5 ? '50%' : '0' }}
      animate={{
        y: ['0vh', '110vh'],
        rotate: [0, 720],
        x: [0, (Math.random() - 0.5) * 100],
        opacity: [1, 1, 0],
      }}
      transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay, ease: 'linear' }}
    />
  )
}

export default function VibrantFestival({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }
  const confetti = Array.from({ length: 20 }, (_, i) => ({ delay: i * 0.5, x: `${i * 5}%` }))

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Confetti rain */}
      {confetti.map((p, i) => <Confetti key={i} {...p} />)}

      {/* Neon grid lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `linear-gradient(${c.primaryColor} 1px, transparent 1px),
                            linear-gradient(90deg, ${c.primaryColor} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: `${c.primaryColor}20`, filter: 'blur(60px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: `${c.accentColor}20`, filter: 'blur(60px)' }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Big emoji */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="text-center text-6xl mb-4"
        >
          🎉
        </motion.div>

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center text-xs tracking-widest uppercase mb-4"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Title — staggered letters effect via word-by-word */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, type: 'spring' }}
          className="text-center text-4xl sm:text-6xl font-black uppercase mb-6 leading-none"
          style={{
            fontFamily: c.fontHeading,
            color: c.primaryColor,
            textShadow: `0 0 30px ${c.primaryColor}80`,
          }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4 text-center"
        >
          <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />
        </motion.div>

        {/* Detail card with neon border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl p-5 mb-6"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${c.primaryColor}50`,
            boxShadow: `0 0 20px ${c.primaryColor}20`,
          }}
        >
          <EventDetails event={event} textColor={c.textColor} accentColor={c.accentColor} />
        </motion.div>

        {event.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.55 }}
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: c.textColor }}
          >
            {event.description}
          </motion.p>
        )}

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
