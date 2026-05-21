'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#f0f4f8',
  primaryColor: '#1e40af',
  accentColor:  '#3b82f6',
  textColor:    '#1e293b',
  fontHeading:  'Inter, sans-serif',
  fontBody:     'Inter, sans-serif',
}

export default function CorporateBlue({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-lg"
      >
        {/* Header banner */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-2 origin-left"
          style={{ background: `linear-gradient(to right, ${c.primaryColor}, ${c.accentColor})` }}
        />

        <div className="p-8">
          {/* Logo row */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-8"
          >
            {event.workspace?.logo_url ? (
              <img
                src={event.workspace.logo_url}
                alt={event.workspace.name}
                className="h-10 w-10 rounded object-contain"
              />
            ) : (
              <div
                className="w-10 h-10 rounded flex items-center justify-center font-bold text-white text-lg"
                style={{ background: c.primaryColor }}
              >
                {(event.workspace?.name ?? event.title)?.[0]?.toUpperCase()}
              </div>
            )}
            {event.workspace?.name && (
              <span className="font-semibold text-sm" style={{ color: c.textColor }}>
                {event.workspace.name}
              </span>
            )}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-2xl sm:text-3xl font-bold leading-tight mb-2"
            style={{ color: c.primaryColor }}
          >
            {event.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.35 }}
            className="text-sm mb-6"
            style={{ color: c.textColor }}
          >
            You have been invited to attend
          </motion.p>

          {/* Guest greeting */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-6 p-4 rounded-lg text-left"
            style={{ background: `${c.accentColor}10`, borderLeft: `3px solid ${c.accentColor}` }}
          >
            <GuestGreeting guestLink={guestLink} headingColor={c.textColor} subColor={c.accentColor} />
          </motion.div>

          {/* Detail rows */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-6"
          >
            <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
          </motion.div>

          {event.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.5 }}
              className="text-sm leading-relaxed mb-6"
              style={{ color: c.textColor }}
            >
              {event.description}
            </motion.p>
          )}

          {/* Divider */}
          <div className="h-px mb-4" style={{ background: `${c.primaryColor}15` }} />

          <RsvpButtons
            rsvpStatus={rsvpStatus}
            loading={rsvpLoading}
            primaryColor={c.primaryColor}
            accentColor={c.accentColor}
            textColor={c.textColor}
            onRsvp={onRsvp}
          />
        </div>

        {/* Footer bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="px-8 py-4 text-xs"
          style={{ background: `${c.primaryColor}08`, color: c.textColor, opacity: 0.5 }}
        >
          Powered by OccasionPro · Secure RSVP
        </motion.div>
      </motion.div>
    </div>
  )
}
