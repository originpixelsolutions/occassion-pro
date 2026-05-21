/**
 * OccasionPro — Public Marketing Landing Page
 * Route: /
 * Unauthenticated. SEO-optimised. Dark premium design.
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Zap, Shield, Globe, BarChart3, Users, Calendar,
  CheckCircle2, ArrowRight, Star, ChevronDown, Menu, X,
  Sparkles, Building2, Music, Trophy, BookOpen, MapPin,
} from 'lucide-react'

// ─── NAV ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">OccasionPro</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#events" className="hover:text-white transition-colors">Event Types</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors font-medium"
          >
            Start free trial
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-zinc-400" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-black/90 px-6 py-4 flex flex-col gap-4 text-sm">
          <a href="#features" className="text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>Features</a>
          <a href="#events" className="text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>Event Types</a>
          <a href="#pricing" className="text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>Pricing</a>
          <Link href="/login" className="text-zinc-400 hover:text-white">Sign in</Link>
          <Link href="/register" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-center font-medium">
            Start free trial
          </Link>
        </div>
      )}
    </nav>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Enterprise Event Operating System
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-none mb-6">
          Run every event.<br />
          <span className="text-violet-400">From one command center.</span>
        </h1>

        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          OccasionPro is the enterprise platform for event companies — a full ERP, CRM, operations
          hub, and AI assistant in one system. Weddings to world summits.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] text-base"
          >
            Start free — 14 days trial
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-zinc-300 hover:text-white hover:border-white/30 transition-colors text-base"
          >
            See what's inside
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>

        <p className="mt-5 text-sm text-zinc-500">No credit card required · Cancel anytime · 1-minute setup</p>
      </div>

      {/* Dashboard mockup strip */}
      <div className="max-w-5xl mx-auto mt-20 relative">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur p-4 shadow-2xl">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Active Events', value: '24', change: '+3 this week' },
              { label: 'Guests Managed', value: '12,480', change: 'Across all events' },
              { label: 'Revenue Tracked', value: '₹2.4Cr', change: 'This quarter' },
              { label: 'Health Score', value: '94', change: '↑ 6 pts this week' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
                <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
                <div className="text-xl font-bold text-white">{kpi.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{kpi.change}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['Guests', 'Budget', 'Runsheet', 'Vendors', 'F&B', 'Floor Plan'].map(m => (
              <div key={m} className="h-8 bg-zinc-800/40 rounded-lg flex items-center px-3 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
                <span className="text-xs text-zinc-400">{m}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-violet-600/20 blur-2xl rounded-full" />
      </div>
    </section>
  )
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function Stats() {
  const stats = [
    { value: '500+', label: 'Simultaneous events supported' },
    { value: '30+', label: 'Modules built-in' },
    { value: '<500ms', label: 'Real-time data sync' },
    { value: '7', label: 'Payment gateways' },
  ]
  return (
    <section className="border-y border-white/8 bg-white/[0.02] py-12">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
            <div className="text-sm text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    title: 'AI Command Center',
    desc: 'AI-generated proposals, budget optimisation, vendor recommendations, risk predictions, and smart scheduling — built directly into the workflow.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Operations',
    desc: 'Live dashboards for every event. Guest check-ins auto-update F&B tokens, budget actuals, and floor plans instantly — sub-500ms sync.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
  {
    icon: Users,
    title: 'Full Guest Management',
    desc: 'Invitations, RSVP, dietary tracking, accommodation, floor plan seating, QR check-in, and communication — in one guest profile.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    desc: 'Row-level security on every table, immutable audit logs, Supabase Vault for all secrets, MFA, and full GDPR/DPDP compliance.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: Globe,
    title: 'Multi-Tenant SaaS',
    desc: 'Each event company gets an isolated workspace. Complete data separation, custom branding, per-plan module control.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: Calendar,
    title: 'Conference & Post-Event',
    desc: 'Full conference module (ticketing, speakers, agenda, CPD credits). Plus 11-module post-event workflow with branded PDF reports.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
]

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Everything an event company needs</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Not a simple event planner. An enterprise operating system — ERP + CRM + AI + Realtime — built for the most complex events on the planet.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-white/15 hover:bg-white/[0.05] transition-all">
              <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── EVENT TYPES ──────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { icon: Star, label: 'Weddings & Celebrations', examples: 'Weddings · Anniversaries · Engagements · Baby Showers' },
  { icon: Building2, label: 'Corporate Events', examples: 'Conferences · Product Launches · Award Shows · Retreats' },
  { icon: Music, label: 'Entertainment', examples: 'Concerts · Festivals · Celebrity Events · Fan Shows' },
  { icon: Trophy, label: 'Sports & Large Scale', examples: 'Tournaments · Marathons · Esports · Fan Zones' },
  { icon: Globe, label: 'Government & Public', examples: 'Summits · Rallies · National Celebrations · Expos' },
  { icon: BookOpen, label: 'Education & Community', examples: 'Graduations · Workshops · Temple Festivals · Galas' },
]

function EventTypes() {
  return (
    <section id="events" className="py-24 px-6 bg-white/[0.02] border-y border-white/8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Every type of event. One platform.</h2>
          <p className="text-zinc-400 text-lg">From intimate 20-person weddings to 500,000-person stadium events.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EVENT_TYPES.map(e => (
            <div key={e.label} className="flex items-start gap-4 rounded-xl border border-white/8 bg-zinc-900/40 p-5">
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <e.icon className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <div className="text-white font-medium text-sm mb-1">{e.label}</div>
                <div className="text-zinc-500 text-xs leading-relaxed">{e.examples}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PRICING ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Starter',
    price: '₹4,999',
    period: '/month',
    desc: 'Perfect for small agencies and freelancers',
    features: ['Up to 10 events/month', '5 team members', '5 GB storage', 'Core modules', 'Email support'],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '₹14,999',
    period: '/month',
    desc: 'For growing agencies handling multiple events',
    features: ['Up to 50 events/month', '25 team members', '50 GB storage', 'All modules', 'Conference module', 'Priority support', 'AI features'],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For large agencies and event groups',
    features: ['Unlimited events', 'Unlimited team members', 'Custom storage', 'All modules', 'Custom integrations', 'Dedicated success manager', 'SLA guarantee'],
    cta: 'Contact sales',
    highlight: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400 text-lg">14-day free trial on all plans. No credit card required.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(p => (
            <div
              key={p.name}
              className={`rounded-2xl p-6 border flex flex-col ${
                p.highlight
                  ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_40px_rgba(124,58,237,0.15)]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              {p.highlight && (
                <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">Most Popular</div>
              )}
              <div className="text-white font-bold text-xl mb-1">{p.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-white">{p.price}</span>
                <span className="text-zinc-400 text-sm">{p.period}</span>
              </div>
              <p className="text-zinc-500 text-sm mb-6">{p.desc}</p>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.name === 'Enterprise' ? '/contact' : '/register'}
                className={`w-full text-center py-3 rounded-xl font-medium text-sm transition-all ${
                  p.highlight
                    ? 'bg-violet-600 text-white hover:bg-violet-500'
                    : 'border border-white/15 text-zinc-300 hover:text-white hover:border-white/30'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24 px-6 border-t border-white/8">
      <div className="max-w-3xl mx-auto text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-96 h-32 bg-violet-600/30 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to run events like a command center?
            </h2>
            <p className="text-zinc-400 text-lg mb-10">
              Join event companies that have upgraded from scattered spreadsheets to a single AI-powered platform.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 text-white font-semibold text-base hover:bg-violet-500 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.4)]"
            >
              Get started free — 14 days
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-sm text-zinc-600">No credit card · 1-minute setup · Cancel anytime</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/8 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold">OccasionPro</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
        </div>
        <p className="text-sm text-zinc-600">© 2026 OccasionPro. All rights reserved.</p>
      </div>
    </footer>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <EventTypes />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
