'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Users, Mail, Layout, UtensilsCrossed, ClipboardList,
  CreditCard, ArrowRight, Play, Star, CheckCircle2,
  Zap, Shield, Globe, ChevronRight, Sparkles,
  Calendar, QrCode, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Feature cards data ───────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Users,
    title: 'Smart Guest Management',
    description:
      'RSVP tracking, seating assignments, dietary requirements, and self-registration portals — all connected in real time.',
    color: 'from-blue-500/20 to-cyan-500/10',
    iconColor: 'text-blue-400',
    tags: ['RSVP', 'Seating', 'Dietary', 'QR Check-in'],
  },
  {
    icon: Mail,
    title: 'Animated Invitations',
    description:
      'Send stunning animated invitations over WhatsApp, email, and SMS with personalised short links and live RSVP tracking.',
    color: 'from-violet-500/20 to-purple-500/10',
    iconColor: 'text-violet-400',
    tags: ['WhatsApp', 'Email', 'SMS', 'Short Links'],
  },
  {
    icon: Layout,
    title: 'Live Floor Plan Editor',
    description:
      'Drag-and-drop venue floor plans with real-time collaborative editing, zone management, and instant guest assignment.',
    color: 'from-emerald-500/20 to-green-500/10',
    iconColor: 'text-emerald-400',
    tags: ['Drag & Drop', 'Realtime', 'Zones', 'Tables'],
  },
  {
    icon: UtensilsCrossed,
    title: 'F&B Token System',
    description:
      'Issue digital food and beverage tokens, scan QR codes at stations, and track real-time consumption across your event.',
    color: 'from-orange-500/20 to-amber-500/10',
    iconColor: 'text-orange-400',
    tags: ['Tokens', 'QR Scan', 'Live Tracking', 'Reports'],
  },
  {
    icon: ClipboardList,
    title: 'Live Runsheet',
    description:
      'Collaborative day-of schedule with presence indicators, live updates, and instant team sync — your digital command center.',
    color: 'from-pink-500/20 to-rose-500/10',
    iconColor: 'text-pink-400',
    tags: ['Realtime', 'Collaboration', 'Timeline', 'Alerts'],
  },
  {
    icon: CreditCard,
    title: 'Payments & Ticketing',
    description:
      'Accept payments via Razorpay, Stripe, or Cashfree. Sell tickets, apply discount codes, issue refunds — zero spreadsheets.',
    color: 'from-indigo-500/20 to-blue-500/10',
    iconColor: 'text-indigo-400',
    tags: ['Razorpay', 'Stripe', 'Cashfree', 'Invoicing'],
  },
]

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    slug: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for trying OccasionPro',
    badge: null,
    highlight: false,
    cta: 'Get Started Free',
    ctaHref: '/register',
    features: [
      '3 events / month',
      '50 guests per event',
      '3 team members',
      '1 GB storage',
      'Basic guest management',
      'Email invitations',
    ],
  },
  {
    slug: 'starter',
    name: 'Starter',
    price: 2499,
    period: 'month',
    description: 'For growing event companies',
    badge: null,
    highlight: false,
    cta: 'Start Free Trial',
    ctaHref: '/register?plan=starter',
    features: [
      '20 events / month',
      '300 guests per event',
      '10 team members',
      '10 GB storage',
      'AI assistant',
      'WhatsApp invitations',
      'Floor plan editor',
      'Basic analytics',
    ],
  },
  {
    slug: 'growth',
    name: 'Growth',
    price: 5999,
    period: 'month',
    description: 'For professional event businesses',
    badge: 'Most Popular',
    highlight: true,
    cta: 'Start Free Trial',
    ctaHref: '/register?plan=growth',
    trialNote: '14-day free trial — no credit card required',
    features: [
      '100 events / month',
      '2,000 guests per event',
      '25 team members',
      '50 GB storage',
      'F&B token system',
      'Live runsheet',
      'Payment collection',
      'Client portal',
      'Vendor portal',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: 12999,
    period: 'month',
    description: 'For large agencies and enterprises',
    badge: null,
    highlight: false,
    cta: 'Contact Sales',
    ctaHref: '/contact?plan=agency',
    features: [
      'Unlimited events',
      'Unlimited guests',
      'Unlimited team members',
      'Unlimited storage',
      'White-label portals',
      'Custom domain',
      'Multi-event orchestration',
      'Conference module',
      'API access',
      'Dedicated support',
      'Custom onboarding',
    ],
  },
]

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: 'Priya Mehta',
    role: 'Director',
    company: 'Bliss Events, Mumbai',
    avatar: 'PM',
    rating: 5,
    quote:
      'OccasionPro completely transformed how we manage weddings. The WhatsApp invitation builder alone saves us 8 hours per event. Our clients love the live RSVP portal.',
  },
  {
    name: 'Rajesh Kumar',
    role: 'CEO',
    company: 'Prestige Conferences, Bangalore',
    avatar: 'RK',
    rating: 5,
    quote:
      'We run 50+ corporate conferences a year. The runsheet collaboration feature is a game-changer — our entire team stays in sync without a single phone call on the day.',
  },
  {
    name: 'Ananya Singh',
    role: 'Head of Operations',
    company: 'Grand Affairs, Delhi',
    avatar: 'AS',
    rating: 5,
    quote:
      'The F&B token system at our last gaala event was flawless. Zero queues, instant QR redemption, and the consumption reports helped us plan better for next time.',
  },
]

// ─── Floating event card component ───────────────────────────────────────────

function FloatingCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute left-1/4 top-32 h-[300px] w-[300px] rounded-full bg-indigo-600/15 blur-[80px]" />
        <div className="absolute right-1/4 top-24 h-[200px] w-[200px] rounded-full bg-purple-600/15 blur-[60px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Trust badge */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Trusted by 500+ event companies across India
          </div>
        </div>

        {/* Headline */}
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            The Complete Event{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              Management Platform
            </span>{' '}
            for India
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
            Run weddings, conferences, corporate events, and more — from guest invitations to badge
            printing, payments to runsheets — all in one AI-powered platform.
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-violet-500/25 transition-all hover:scale-105 hover:shadow-violet-500/40"
          >
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
          >
            <Play className="h-4 w-4 fill-white" />
            Watch Demo
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-white/30">
          14-day free trial &middot; No credit card required &middot; Cancel anytime
        </p>

        {/* Floating illustration area */}
        <div className="relative mx-auto mt-20 h-80 max-w-3xl select-none">
          {/* Central dashboard mockup */}
          <div className="absolute inset-x-8 top-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/3 backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              <div className="ml-2 h-5 w-48 rounded bg-white/5" />
            </div>
            <div className="grid grid-cols-4 gap-3 p-5">
              {['Events', 'Guests', 'Revenue', 'Tasks'].map((label, i) => (
                <div key={label} className="rounded-lg bg-white/5 p-3">
                  <div className="mb-1 text-[10px] font-medium text-white/40">{label}</div>
                  <div
                    className={cn(
                      'h-6 w-16 rounded bg-gradient-to-r',
                      i === 0 && 'from-violet-500/40 to-violet-500/20',
                      i === 1 && 'from-blue-500/40 to-blue-500/20',
                      i === 2 && 'from-emerald-500/40 to-emerald-500/20',
                      i === 3 && 'from-orange-500/40 to-orange-500/20',
                    )}
                  />
                </div>
              ))}
              <div className="col-span-2 rounded-lg bg-white/5 p-3">
                <div className="mb-2 text-[10px] font-medium text-white/40">Guest RSVPs</div>
                <div className="flex items-end gap-1 h-8">
                  {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 rounded-sm bg-violet-500/40"
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-2 rounded-lg bg-white/5 p-3">
                <div className="mb-2 text-[10px] font-medium text-white/40">Today's Events</div>
                {['Sharma Wedding', 'TechCorp Summit'].map((e) => (
                  <div key={e} className="mb-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    <div className="text-[10px] text-white/50">{e}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating badge cards */}
          <FloatingCard className="animate-float-slow -left-4 top-12 hidden lg:block">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white">247 RSVPs</div>
                <div className="text-[9px] text-white/40">Sharma Wedding</div>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="animate-float -right-4 top-8 hidden lg:block">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20">
                <QrCode className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white">142 Check-ins</div>
                <div className="text-[9px] text-white/40">Live today</div>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="animate-float-slow bottom-4 -left-2 hidden lg:block">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20">
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white">₹4.2L Revenue</div>
                <div className="text-[9px] text-white/40">This month</div>
              </div>
            </div>
          </FloatingCard>
        </div>
      </div>

      {/* Stat strip */}
      <div className="relative mx-auto mt-16 max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/3 py-8 backdrop-blur-sm">
          {[
            { value: '10,000+', label: 'Events Managed' },
            { value: '5,00,000+', label: 'Guests Served' },
            { value: '500+', label: 'Companies' },
          ].map(({ value, label }) => (
            <div key={label} className="px-6 text-center md:px-10">
              <div className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent md:text-3xl">
                {value}
              </div>
              <div className="mt-1 text-sm text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features section ─────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            <Zap className="h-3 w-3 text-violet-400" />
            Everything you need
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One platform. Every event.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/50">
            From intimate weddings to stadium-scale concerts — OccasionPro handles the full
            lifecycle with enterprise-grade tools and AI intelligence.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-white/8 bg-white/3 p-6 transition-all duration-300 hover:border-white/15 hover:bg-white/5"
              >
                {/* Gradient glow on hover */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    feature.color,
                  )}
                />
                <div className="relative">
                  <div
                    className={cn(
                      'mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/8',
                      feature.iconColor,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{feature.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {feature.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing section ─────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section id="pricing" className="bg-white/[0.02] py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            <CreditCard className="h-3 w-3 text-violet-400" />
            Transparent pricing
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Plans for every scale
          </h2>
          <p className="mt-4 text-base text-white/50">
            Start free. Scale as you grow. All plans include a 14-day trial.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-all',
                plan.highlight
                  ? 'border-violet-500/60 bg-gradient-to-b from-violet-500/10 to-transparent shadow-2xl shadow-violet-500/10'
                  : 'border-white/8 bg-white/3 hover:border-white/15',
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-0.5 text-xs font-semibold text-white shadow-lg">
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-white/40">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.price === 0 ? (
                  <div className="text-3xl font-extrabold text-white">Free</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-white/40">₹</span>
                    <span className="text-3xl font-extrabold text-white">
                      {plan.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm text-white/40">/{plan.period}</span>
                  </div>
                )}
                {plan.trialNote && (
                  <p className="mt-1.5 text-[11px] text-emerald-400">{plan.trialNote}</p>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={cn(
                  'block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all',
                  plan.highlight
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:opacity-90'
                    : 'border border-white/15 bg-white/5 text-white hover:bg-white/10',
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-white/30">
          All prices exclusive of GST &middot; INR billing &middot;{' '}
          <Link href="/pricing" className="text-violet-400 hover:text-violet-300">
            Compare all features →
          </Link>
        </p>
      </div>
    </section>
  )
}

// ─── Social proof section ─────────────────────────────────────────────────────

function TestimonialsSection() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            Loved by event professionals
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What our customers say
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-white/8 bg-white/3 p-6 transition-all hover:border-white/12 hover:bg-white/5"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <blockquote className="mb-6 text-sm leading-relaxed text-white/60">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/40 text-sm font-bold text-white">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/40">
                    {t.role}, {t.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Event types strip ────────────────────────────────────────────────────────

function EventTypesStrip() {
  const types = [
    'Weddings', 'Conferences', 'Corporate Events', 'Concerts',
    'Product Launches', 'Trade Fairs', 'Award Shows', 'Sports Events',
    'Temple Festivals', 'College Fests', 'Government Summits', 'Virtual Events',
  ]
  return (
    <section className="overflow-hidden border-y border-white/8 bg-white/[0.015] py-6">
      <div className="flex animate-marquee gap-8 whitespace-nowrap">
        {[...types, ...types].map((t, i) => (
          <span key={i} className="flex items-center gap-2 text-sm font-medium text-white/30">
            <span className="h-1 w-1 rounded-full bg-violet-500/50" />
            {t}
          </span>
        ))}
      </div>
    </section>
  )
}

// ─── AI feature callout ───────────────────────────────────────────────────────

function AiSection() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 via-indigo-950/30 to-transparent p-10 lg:p-16">
          {/* Glow */}
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-violet-600/20 blur-[80px]" />

          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                <Sparkles className="h-3 w-3" />
                AI-Powered Intelligence
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your AI event COO, always on.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/50">
                OccasionPro's AI engine monitors every event in real time — alerting you to
                risks, suggesting optimizations, generating proposals, and automating repetitive
                ops work so you focus on what matters.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'AI proposal generation from event brief',
                  'Budget optimization and overspend alerts',
                  'Risk prediction and mitigation suggestions',
                  'Auto-scheduling and staffing recommendations',
                  'Post-event debrief and insight reports',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-white/60">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500"
              >
                Try AI Features Free
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* AI panel mockup */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs font-semibold text-violet-300">AI Insights — Live</span>
              </div>
              {[
                { type: 'warning', msg: 'Guest RSVP rate 42% — below target. Consider sending WhatsApp reminder.', time: '2m ago' },
                { type: 'info', msg: 'Catering quantity optimised: Save ₹18,500 by adjusting Day 2 dinner count.', time: '15m ago' },
                { type: 'critical', msg: 'Backup generator vendor has not confirmed. Escalation recommended.', time: '1h ago' },
              ].map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    'mb-3 rounded-xl border p-3 text-xs',
                    alert.type === 'critical' && 'border-red-500/30 bg-red-500/10 text-red-300',
                    alert.type === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                    alert.type === 'info' && 'border-blue-500/30 bg-blue-500/10 text-blue-300',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wide opacity-70">
                      {alert.type}
                    </span>
                    <span className="opacity-50">{alert.time}</span>
                  </div>
                  {alert.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="bg-white/[0.02] py-28">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-violet-600/15 blur-[80px]" />
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to transform your events?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/50">
            Join 500+ event companies using OccasionPro to run better events, save hours of
            manual work, and delight their clients.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-violet-500/30 transition-all hover:scale-105"
            >
              Start your 14-day free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10"
            >
              Talk to sales
            </Link>
          </div>
          <p className="mt-5 text-xs text-white/30">
            No credit card required &middot; Setup in under 5 minutes &middot; Cancel anytime
          </p>

          {/* Trust logos (placeholder) */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-30 grayscale">
            {['Razorpay', 'Stripe', 'Supabase', 'Cloudflare', 'Resend'].map((name) => (
              <div key={name} className="text-sm font-bold text-white/60 tracking-tight">
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <EventTypesStrip />
      <FeaturesSection />
      <AiSection />
      <PricingSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  )
}
