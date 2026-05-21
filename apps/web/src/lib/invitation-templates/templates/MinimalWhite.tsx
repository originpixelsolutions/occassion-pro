'use client'
import { motion } from 'framer-motion'
import type { InvitationRenderProps } from '../index'
import { RsvpButtons, EventDetails, GuestGreeting } from '../shared/InvitationShell'

const DEFAULTS = {
  background:   '#ffffff',
  primaryColor: '#1a1a1a',
  accentColor:  '#6b7280',
  textColor:    '#374151',
  fontHeading:  'Inter, sans-serif',
  fontBody:     'Inter, sans-serif',
}

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.12 } } },
  item:      { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } },
}

export default function MinimalWhite({ config, event, guestLink, rsvpStatus, onRsvp, rsvpLoading }: InvitationRenderProps) {
  const c = { ...DEFAULTS, ...config }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: c.background, fontFamily: c.fontBody }}
    >
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="w-full max-w-md"
      >
        {/* Top accent line */}
        <motion.div
          variants={stagger.item}
          className="h-0.5 w-12 mb-8"
          style={{ background: c.primaryColor }}
        />

        {/* Workspace */}
        {event.workspace?.name && (
          <motion.p
            variants={stagger.item}
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: c.accentColor }}
          >
            {event.workspace.name}
          </motion.p>
        )}

        {/* Title */}
        <motion.h1
          variants={stagger.item}
          className="text-4xl sm:text-5xl font-light leading-tight mb-6"
          style={{ color: c.primaryColor, fontFamily: c.fontHeading }}
        >
          {event.title}
        </motion.h1>

        {/* Guest greeting */}
        <motion.div variants={stagger.item} className="mb-6 text-left">
          <GuestGreeting guestLink={guestLink} headingColor={c.primaryColor} subColor={c.accentColor} />
        </motion.div>

        {/* Thin divider */}
        <motion.div
          variants={stagger.item}
          className="h-px mb-6"
          style={{ background: `${c.primaryColor}15` }}
        />

        {/* Details */}
        <motion.div variants={stagger.item}>
          <EventDetails event={event} textColor={c.textColor} accentColor={c.primaryColor} />
        </motion.div>

        {/* Description */}
        {event.description && (
          <motion.p
            variants={stagger.item}
            className="text-sm leading-relaxed mt-6"
            style={{ color: c.accentColor }}
          >
            {event.description}
          </motion.p>
        )}

        {/* Thin divider */}
        <motion.div
          variants={stagger.item}
          className="h-px my-6"
          style={{ background: `${c.primaryColor}15` }}
        />

        {/* RSVP */}
        <motion.div variants={stagger.item}>
          <RsvpButtons
            rsvpStatus={rsvpStatus}
            loading={rsvpLoading}
            primaryColor={c.primaryColor}
            accentColor={c.accentColor}
            textColor={c.textColor}
            onRsvp={onRsvp}
          />
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={stagger.item}
          className="h-0.5 w-12 mt-8"
          style={{ background: c.primaryColor }}
        />
      </motion.div>
    </div>
  )
}
