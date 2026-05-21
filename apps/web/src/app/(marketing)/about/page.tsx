'use client'

import Link from 'next/link'
import {
  ArrowRight, Star, Globe, Users, Zap, Heart, Target, Shield,
} from 'lucide-react'

const TEAM = [
  { name: 'Aarav Mehta',     role: 'Co-Founder & CEO',      bio: 'Former Google engineer. 10 years in event tech.' },
  { name: 'Priya Chandran',  role: 'Co-Founder & CTO',      bio: 'Built real-time systems at Razorpay and Swiggy.' },
  { name: 'Rohan Sharma',    role: 'Head of Product',        bio: 'Product leader with 8 years in B2B SaaS.' },
  { name: 'Sneha Iyer',      role: 'Head of Customer Success', bio: 'Ex-event director with 200+ large events managed.' },
  { name: 'Karan Joshi',     role: 'VP Engineering',         bio: 'Scaled distributed systems at Amazon India.' },
  { name: 'Meera Pillai',    role: 'Head of Design',         bio: 'Previously design lead at Notion and Linear.' },
]

const VALUES = [
  {
    icon: Target,
    title: 'Operational Excellence',
    description: 'We believe every event deserves military-precision coordination. We build tools that make complex operations feel simple.',
    color: 'text-violet-400',
  },
  {
    icon: Heart,
    title: 'Event Industry First',
    description: 'We don\'t build generic project management tools. Every feature is purpose-built for the unique demands of event professionals.',
    color: 'text-pink-400',
  },
  {
    icon: Globe,
    title: 'Built for India',
    description: 'OccasionPro is designed for India\'s event ecosystem — WhatsApp-first communication, Razorpay payments, and DPDP compliance.',
    color: 'text-cyan-400',
  },
  {
    icon: Zap,
    title: 'AI-Native',
    description: 'We embed intelligence everywhere — not as an afterthought. AI should feel like a strategic advisor, not a chatbot.',
    color: 'text-amber-400',
  },
]

const MILESTONES = [
  { year: '2021', title: 'Founded in Mumbai', desc: 'Started after struggling to manage a 500-person wedding with spreadsheets.' },
  { year: '2022', title: 'First 50 customers', desc: 'Launched beta with wedding and corporate event companies across Mumbai and Delhi.' },
  { year: '2023', title: 'Series A — ₹30 Cr', desc: 'Raised from Sequoia India and existing angels to expand platform and team.' },
  { year: '2024', title: '500+ companies', desc: 'Expanded to enterprise — luxury weddings, stadium events, government summits.' },
  { year: '2025', title: 'AI Command Center', desc: 'Launched AI-powered operations intelligence, risk prediction, and auto-workflows.' },
  { year: '2026', title: 'Global expansion', desc: 'Operations in India, UAE, Singapore. 50K events managed annually.' },
]

export default function AboutPage() {
  return (
    <div className="bg-[#09090b] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 lg:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-b from-violet-600/15 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 mb-6">
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            Made in Mumbai, India 🇮🇳
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            We're building the{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              future of events
            </span>
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            OccasionPro was born from frustration. After struggling to coordinate a 500-person wedding
            across 12 WhatsApp groups and 8 spreadsheets, we knew the event industry deserved better infrastructure.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/30 to-indigo-900/20 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              "To give every event professional the infrastructure of a Fortune 500 operations team —
              regardless of company size, event type, or geography."
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white text-center mb-12">What we believe</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, description, color }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Icon className={`w-6 h-6 mb-4 ${color}`} strokeWidth={1.5} />
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-6 py-16 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white text-center mb-12">Our journey</h2>
          <div className="space-y-0">
            {MILESTONES.map((m, i) => (
              <div key={m.year} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full border-2 border-violet-500 bg-violet-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-400">{m.year.slice(2)}</span>
                  </div>
                  {i < MILESTONES.length - 1 && <div className="w-px flex-1 bg-white/10 my-1" />}
                </div>
                <div className="pb-8">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-semibold text-violet-400">{m.year}</span>
                    <h3 className="font-semibold text-white">{m.title}</h3>
                  </div>
                  <p className="text-sm text-white/55">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="px-6 py-16 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white text-center mb-3">The team</h2>
          <p className="text-white/50 text-center mb-12">Event professionals, engineers, and designers who've seen the chaos firsthand.</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map(({ name, role, bio }) => {
              const initials = name.split(' ').map((n) => n[0]).join('')
              return (
                <div key={name} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-violet-300">{initials}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{name}</p>
                    <p className="text-xs text-violet-400 mb-1">{role}</p>
                    <p className="text-xs text-white/50">{bio}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Join us on the mission</h2>
          <p className="text-white/60 mb-8">
            Whether you're an event company looking for better tools, or an engineer wanting to
            build the future of events — we'd love to connect.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Book a Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
