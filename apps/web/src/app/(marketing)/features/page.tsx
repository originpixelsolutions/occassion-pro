'use client'

import Link from 'next/link'
import {
  Users, Mail, Layout, UtensilsCrossed, ClipboardList, CreditCard,
  Truck, Wallet, MapPin, MessageSquare, FolderOpen, ShieldCheck,
  Camera, Sparkles, QrCode, BarChart3, Globe, Zap, ArrowRight,
  CheckCircle2, Star, Clock, Building2, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURE_GROUPS = [
  {
    group: 'Guest & Hospitality',
    color: 'from-blue-600 to-cyan-500',
    textColor: 'text-blue-400',
    features: [
      {
        icon: Users,
        title: 'Smart Guest Management',
        description: 'RSVP tracking, seating assignments, dietary requirements, check-in QR codes, and self-registration portals — all in real time.',
        bullets: ['Smart RSVP flow', 'Dietary & accessibility flags', 'Seat assignments', 'QR check-in'],
      },
      {
        icon: Mail,
        title: 'Animated Invitations',
        description: 'Stunning animated invitations delivered via WhatsApp, Email, and SMS with personalised short links and live RSVP dashboards.',
        bullets: ['WhatsApp + Email + SMS', 'Personalised short links', 'Live RSVP dashboard', 'Plus-one management'],
      },
      {
        icon: UtensilsCrossed,
        title: 'F&B Token System',
        description: 'Issue digital food and beverage tokens, scan QR codes at catering stations, and track real-time consumption.',
        bullets: ['Digital QR tokens', 'Station scanning', 'Live consumption data', 'Dietary filtering'],
      },
    ],
  },
  {
    group: 'Operations & Logistics',
    color: 'from-violet-600 to-purple-500',
    textColor: 'text-violet-400',
    features: [
      {
        icon: Layout,
        title: 'Live Floor Plan Editor',
        description: 'Drag-and-drop venue floor plans with real-time collaborative editing, multi-zone management, and instant guest assignment.',
        bullets: ['Drag & drop editor', 'Real-time collaboration', 'Zone management', 'Guest-to-seat linking'],
      },
      {
        icon: ClipboardList,
        title: 'Live Runsheet',
        description: 'Day-of schedule with presence indicators, real-time updates, and instant team sync. Your digital command center.',
        bullets: ['Timeline view', 'Presence indicators', 'Live updates', 'Team chat'],
      },
      {
        icon: Truck,
        title: 'Vendor Management',
        description: 'Full vendor lifecycle from prospecting to contract signing, performance tracking, and automated payment scheduling.',
        bullets: ['Vendor directory', 'Contract management', 'Performance ratings', 'Payment scheduling'],
      },
    ],
  },
  {
    group: 'Finance & Intelligence',
    color: 'from-emerald-600 to-green-500',
    textColor: 'text-emerald-400',
    features: [
      {
        icon: Wallet,
        title: 'Budget & Finance',
        description: 'Multi-event budget tracking with category breakdown, variance analysis, and real-time profitability forecasting.',
        bullets: ['Budget vs actual', 'Category tracking', 'Profitability reports', 'Invoice management'],
      },
      {
        icon: CreditCard,
        title: 'Payments & Ticketing',
        description: 'Accept payments via Razorpay, Stripe, or Cashfree. Sell tickets, apply discounts, issue refunds — zero spreadsheets.',
        bullets: ['Razorpay / Stripe', 'Discount codes', 'Automated invoices', 'Refund management'],
      },
      {
        icon: Sparkles,
        title: 'AI Command Center',
        description: 'AI-powered insights including risk prediction, budget recommendations, vendor scoring, and operational intelligence.',
        bullets: ['Risk prediction', 'Budget AI', 'Smart scheduling', 'Auto proposals'],
      },
    ],
  },
  {
    group: 'Communication & Collaboration',
    color: 'from-pink-600 to-rose-500',
    textColor: 'text-pink-400',
    features: [
      {
        icon: MessageSquare,
        title: 'Messaging & Notifications',
        description: 'Centralised communications hub with WhatsApp, Email, and in-app messaging for team, vendors, and guests.',
        bullets: ['Multi-channel messaging', 'Broadcast to guests', 'Vendor communication', 'Internal team chat'],
      },
      {
        icon: FolderOpen,
        title: 'Document Management',
        description: 'Store contracts, permits, creative briefs, and event assets in a searchable, permission-controlled document library.',
        bullets: ['Version control', 'Access permissions', 'Smart search', 'Digital signatures'],
      },
      {
        icon: Globe,
        title: 'Client Portal',
        description: 'A branded portal for clients to review proposals, approve designs, monitor event progress, and provide feedback.',
        bullets: ['White-label portal', 'Proposal approvals', 'Live event tracking', 'Feedback collection'],
      },
    ],
  },
]

const INTEGRATIONS = [
  'Razorpay', 'Stripe', 'Cashfree', 'Zoom', 'Google Meet',
  'WhatsApp Business', 'Mailchimp', 'Canva', 'Quickbooks', 'Tally',
  'Salesforce', 'HubSpot', 'Google Calendar', 'Outlook', 'Slack',
]

// ── Components ────────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
  bullets,
  textColor,
}: {
  icon: React.ElementType
  title: string
  description: string
  bullets: string[]
  textColor: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-white/20 hover:bg-white/8 transition-all duration-200">
      <div className="mb-4 w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
        <Icon className={cn('w-5 h-5', textColor)} strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed mb-4">{description}</p>
      <ul className="space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2 text-xs text-white/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  return (
    <div className="bg-[#09090b] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-16 text-center lg:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-violet-600/20 to-transparent blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 mb-6">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          Everything you need to run exceptional events
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Built for the full{' '}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            event lifecycle
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          From first client conversation to post-event reports, OccasionPro handles every operational
          detail — so you can focus on creating extraordinary experiences.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            Book a Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4 mx-auto max-w-3xl">
          {[
            { value: '500+', label: 'Event companies' },
            { value: '50K+', label: 'Events managed' },
            { value: '5M+', label: 'Guests handled' },
            { value: '99.9%', label: 'Uptime SLA' },
          ].map(({ value, label }) => (
            <div key={label} className="space-y-1">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-sm text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature groups */}
      {FEATURE_GROUPS.map((group) => (
        <section key={group.group} className="px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-center gap-3">
              <div className={cn('h-px flex-1 bg-gradient-to-r opacity-30', group.color)} />
              <h2 className={cn('text-sm font-semibold uppercase tracking-widest', group.textColor)}>
                {group.group}
              </h2>
              <div className={cn('h-px flex-1 bg-gradient-to-l opacity-30', group.color)} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  bullets={feature.bullets}
                  textColor={group.textColor}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Integrations */}
      <section className="px-6 py-16 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Integrates with your stack</h2>
          <p className="text-white/50 mb-10">
            Connect with the tools you already use. 30+ native integrations with more on the way.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:border-white/20 hover:text-white/80 transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to modernise your event operations?
          </h2>
          <p className="text-white/60 mb-8">
            Join 500+ event companies who have moved from spreadsheets to OccasionPro.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Book a Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
