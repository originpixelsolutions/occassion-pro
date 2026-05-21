'use client'

import { useState } from 'react'
import {
  CheckCircle2, Calendar, Clock, Users, Zap, Star,
  ArrowRight, Building2, Globe, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Data ──────────────────────────────────────────────────────────────────────

const DEMO_BENEFITS = [
  'Live walkthrough of the full platform by an event industry specialist',
  'Customised demo tailored to your event type (weddings, corporate, MICE)',
  'Pricing and ROI analysis for your team size and event volume',
  'Q&A with our product and engineering team',
  'Free 14-day trial setup included',
]

const DEMO_SLOTS = [
  { day: 'Monday, 26 May', slots: ['10:00 AM', '2:00 PM', '4:00 PM'] },
  { day: 'Tuesday, 27 May', slots: ['11:00 AM', '3:00 PM'] },
  { day: 'Wednesday, 28 May', slots: ['10:00 AM', '12:00 PM', '4:00 PM'] },
  { day: 'Thursday, 29 May', slots: ['10:00 AM', '2:00 PM'] },
]

const TESTIMONIALS = [
  {
    quote: 'The demo was genuinely eye-opening. Within 30 minutes I saw how we could eliminate 3 different tools we were using.',
    author: 'Divya Nair',
    role: 'Director, Precious Moments Events',
    stars: 5,
  },
  {
    quote: 'Unlike other demos that just show slides, the OccasionPro team actually walked through our own event type. Huge difference.',
    author: 'Vikram Bajaj',
    role: 'CEO, Grand Occasions',
    stars: 5,
  },
]

type FormState = {
  name: string
  email: string
  company: string
  phone: string
  company_size: string
  event_type: string
  selected_slot: string
  selected_day: string
  message: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', company: '', phone: '',
    company_size: '', event_type: '', selected_slot: '', selected_day: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="bg-[#09090b] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-12 lg:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-violet-600/20 to-transparent blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl grid gap-12 lg:grid-cols-2 items-center">
          {/* Left: pitch */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 mb-6">
              <Play className="w-3.5 h-3.5 text-violet-400" />
              45-minute live demo
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-5xl leading-tight mb-6">
              See OccasionPro{' '}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                in action
              </span>
            </h1>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              Get a personalised 45-minute walkthrough with one of our event industry specialists.
              We'll show you exactly how OccasionPro works for <em>your</em> type of events.
            </p>

            <ul className="space-y-3 mb-8">
              {DEMO_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-white/70">
                  <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>

            {/* Testimonials */}
            <div className="space-y-4">
              {TESTIMONIALS.map(({ quote, author, role, stars }) => (
                <div key={author} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-white/65 italic mb-3">"{quote}"</p>
                  <div>
                    <p className="text-sm font-semibold text-white">{author}</p>
                    <p className="text-xs text-white/40">{role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: booking form */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Demo booked!</h3>
                <p className="text-white/60 mb-2">
                  We've sent a confirmation to <strong>{form.email}</strong>.
                </p>
                <p className="text-sm text-white/40">
                  {form.selected_day && form.selected_slot
                    ? `Your slot: ${form.selected_day} at ${form.selected_slot} IST`
                    : 'Our team will reach out within 2 hours to confirm your slot.'}
                </p>
                <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/50 mb-2">In the meantime, explore the platform:</p>
                  <a
                    href="/signup"
                    className="text-sm font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 justify-center"
                  >
                    Start your free trial <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-5">Book your demo</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Full Name *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Work Email *</label>
                    <input
                      required type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
                      placeholder="you@eventco.in"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Company *</label>
                    <input
                      required
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
                      placeholder="Company name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Team Size</label>
                    <select
                      value={form.company_size}
                      onChange={(e) => setForm((f) => ({ ...f, company_size: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-3.5 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none"
                    >
                      <option value="">Select…</option>
                      <option value="1-5">1–5 people</option>
                      <option value="6-20">6–20 people</option>
                      <option value="21-50">21–50 people</option>
                      <option value="51+">51+ people</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Primary Event Type</label>
                    <select
                      value={form.event_type}
                      onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-3.5 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none"
                    >
                      <option value="">Select…</option>
                      <option value="weddings">Weddings</option>
                      <option value="corporate">Corporate Events</option>
                      <option value="mice">MICE & Conferences</option>
                      <option value="entertainment">Entertainment & Live</option>
                      <option value="government">Government & Public</option>
                      <option value="mixed">Mixed / All Types</option>
                    </select>
                  </div>
                </div>

                {/* Slot picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50">Preferred Slot (IST)</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {DEMO_SLOTS.map(({ day, slots }) => (
                      <div key={day}>
                        <p className="text-xs text-white/35 mb-1.5">{day}</p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => {
                            const selected = form.selected_day === day && form.selected_slot === slot
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, selected_day: day, selected_slot: slot }))}
                                className={cn(
                                  'text-xs px-3 py-1.5 rounded-lg border transition-all',
                                  selected
                                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                                    : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70',
                                )}
                              >
                                {slot}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/50">Anything specific you'd like to see?</label>
                  <textarea
                    rows={2}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none resize-none"
                    placeholder="e.g. show me the floor plan editor and guest check-in flow…"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.name || !form.email || !form.company}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {loading
                    ? 'Booking…'
                    : <><span>Book Demo</span><ArrowRight className="w-4 h-4" /></>
                  }
                </button>

                <p className="text-center text-xs text-white/30">
                  No credit card required · Cancel anytime · Free 14-day trial included
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Trust logos */}
      <section className="px-6 py-16 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-8">
            Trusted by leading event companies
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {['Celebration Masters', 'EventEdge', 'Grand Occasions', 'Moments & Memories', 'StarEvents Pro', 'Royal Gatherings'].map((name) => (
              <div key={name} className="text-sm font-semibold text-white/25">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
