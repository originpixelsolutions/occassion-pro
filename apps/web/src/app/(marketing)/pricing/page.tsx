'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, X, Zap, ArrowRight, Crown, Star, Rocket, Building2,
  CalendarDays, Users, Brain, Link2, FolderOpen, BarChart3,
  Shield, Globe, Headphones, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  slug: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  currency: string
  trial_days: number
  max_events: number | null
  max_guests_per_event: number | null
  max_team_members: number | null
  max_storage_gb: number | null
  max_ai_calls_monthly: number | null
  max_short_links: number | null
  features: Record<string, boolean>
}

// ─── Static config ───────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, any> = {
  free:    Building2,
  starter: Rocket,
  growth:  Star,
  agency:  Crown,
}

const PLAN_ACCENT: Record<string, string> = {
  free:    'border-white/10',
  starter: 'border-blue-500/30',
  growth:  'border-violet-500/60 shadow-2xl shadow-violet-500/10',
  agency:  'border-amber-500/30',
}

const PLAN_BADGE: Record<string, string | null> = {
  free:    null,
  starter: null,
  growth:  'Most Popular',
  agency:  null,
}

const FEATURE_ROWS: { key: string; label: string; plans: Record<string, boolean | string> }[] = [
  { key: 'events',               label: 'Events',                    plans: { free: '3', starter: '20', growth: '100', agency: 'Unlimited' } },
  { key: 'guests',               label: 'Guests / event',            plans: { free: '50', starter: '300', growth: '2,000', agency: 'Unlimited' } },
  { key: 'team',                 label: 'Team members',              plans: { free: '3', starter: '10', growth: '25', agency: 'Unlimited' } },
  { key: 'storage',              label: 'Storage',                   plans: { free: '1 GB', starter: '10 GB', growth: '50 GB', agency: 'Unlimited' } },
  { key: 'ai_assistant',         label: 'AI Assistant',              plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'ai_proposals',         label: 'AI Proposals',              plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'ai_budget',            label: 'AI Budget Optimizer',       plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'client_portal',        label: 'Client Portal',             plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'vendor_portal',        label: 'Vendor Portal',             plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'audit_trail',          label: 'Audit Trail',               plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'playbooks',            label: 'Playbooks & Templates',     plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'document_generation',  label: 'Document Generation',       plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'animated_invitations', label: 'Animated Invitations',      plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'advanced_analytics',   label: 'Advanced Analytics',        plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'custom_domain',        label: 'Custom Domain',             plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'api_access',           label: 'API Access',                plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'offline_checkin',      label: 'Offline Check-in',          plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'realtime_collab',      label: 'Real-time Collaboration',   plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'white_label',          label: 'White Label',               plans: { free: false, starter: false, growth: false, agency: true } },
  { key: 'priority_support',     label: 'Priority Support',          plans: { free: false, starter: false, growth: false, agency: true } },
]

const FAQS = [
  {
    q: 'Can I change my plan at any time?',
    a: 'Yes — you can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Your data is always preserved. If you exceed Free plan limits after downgrading, you get read-only access to existing content until you upgrade or remove items.',
  },
  {
    q: 'Is the 14-day trial really free?',
    a: 'Absolutely. No credit card required to start the Growth trial. You get full Growth plan features for 14 days. After the trial you can upgrade or continue on the Free plan.',
  },
  {
    q: 'Do you offer annual billing discounts?',
    a: 'Yes — all paid plans are ~17% cheaper when billed yearly. Switch to annual billing any time from your billing settings.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit/debit cards, UPI, net banking, and wallets via Razorpay. All payments are processed securely.',
  },
  {
    q: 'Do you offer custom enterprise pricing?',
    a: 'Yes. For large organisations needing custom limits, dedicated support, or on-premise deployment, contact our sales team for a tailored quote.',
  },
]

const FALLBACK_PLANS: Plan[] = [
  {
    id: '1', slug: 'free',    name: 'Free',    description: 'For individuals exploring the platform',
    price_monthly: 0,     price_yearly: 0,      currency: 'INR', trial_days: 0,
    max_events: 3,   max_guests_per_event: 50,   max_team_members: 3,  max_storage_gb: 1,
    max_ai_calls_monthly: null, max_short_links: 5,   features: {},
  },
  {
    id: '2', slug: 'starter', name: 'Starter', description: 'For small event businesses getting started',
    price_monthly: 2499,  price_yearly: 24990,  currency: 'INR', trial_days: 0,
    max_events: 20,  max_guests_per_event: 300,  max_team_members: 10, max_storage_gb: 10,
    max_ai_calls_monthly: 100, max_short_links: 50, features: { ai_assistant: true },
  },
  {
    id: '3', slug: 'growth',  name: 'Growth',  description: 'For growing event companies scaling fast',
    price_monthly: 5999,  price_yearly: 59990,  currency: 'INR', trial_days: 14,
    max_events: 100, max_guests_per_event: 2000, max_team_members: 25, max_storage_gb: 50,
    max_ai_calls_monthly: 500, max_short_links: 200,
    features: { ai_assistant: true, ai_proposals: true, advanced_analytics: true },
  },
  {
    id: '4', slug: 'agency',  name: 'Agency',  description: 'For large agencies running enterprise events',
    price_monthly: 12999, price_yearly: 129990, currency: 'INR', trial_days: 0,
    max_events: null, max_guests_per_event: null, max_team_members: null, max_storage_gb: null,
    max_ai_calls_monthly: null, max_short_links: null,
    features: { ai_assistant: true, ai_proposals: true, white_label: true, priority_support: true },
  },
]

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarketingPricingPage() {
  const router  = useRouter()
  const [billing, setBilling]           = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans]               = useState<Plan[]>([])
  const [openFaq, setOpenFaq]           = useState<number | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    fetch(`${API}/subscription/plans`)
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const activePlans = plans.length > 0 ? plans : FALLBACK_PLANS

  const getPrice = (plan: Plan) =>
    billing === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly

  const yearlySaving = (plan: Plan) => {
    if (!plan.price_monthly || !plan.price_yearly) return 0
    return Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)
  }

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            <Zap className="h-3 w-3" />
            14-day Growth trial — no credit card required
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mb-10 text-lg leading-relaxed text-white/50">
            From solo planners to large agencies — pick the plan that grows with you.
            Upgrade, downgrade, or cancel any time.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all',
                billing === 'monthly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all',
                billing === 'yearly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
              )}
            >
              Yearly
              <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {activePlans.map((plan) => {
            const Icon     = PLAN_ICONS[plan.slug] ?? Star
            const badge    = PLAN_BADGE[plan.slug]
            const price    = getPrice(plan)
            const saving   = yearlySaving(plan)
            const isGrowth = plan.slug === 'growth'

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-white/[0.03] p-6 transition-all',
                  PLAN_ACCENT[plan.slug],
                  isGrowth && 'bg-gradient-to-b from-violet-500/10 to-transparent',
                )}
              >
                {badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    {badge}
                  </div>
                )}

                {/* Icon + name */}
                <div className="mb-5 flex items-center gap-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    isGrowth ? 'bg-violet-600' : 'bg-white/10',
                  )}>
                    <Icon className={cn('h-5 w-5', isGrowth ? 'text-white' : 'text-white/50')} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{plan.name}</p>
                    {plan.trial_days > 0 && (
                      <p className="text-[10px] font-medium text-violet-400">{plan.trial_days}-day free trial</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {price === 0 ? (
                    <p className="text-3xl font-bold text-white">Free</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-white">
                        ₹{Math.round(price).toLocaleString('en-IN')}
                        <span className="text-sm font-normal text-white/40">/mo</span>
                      </p>
                      {billing === 'yearly' && saving > 0 && (
                        <p className="mt-0.5 text-xs text-green-400">
                          ₹{plan.price_yearly.toLocaleString('en-IN')}/year · Save {saving}%
                        </p>
                      )}
                      {billing === 'monthly' && plan.price_yearly > 0 && (
                        <p className="mt-0.5 text-xs text-white/30">
                          ₹{plan.price_yearly.toLocaleString('en-IN')}/yr with annual billing
                        </p>
                      )}
                    </>
                  )}
                </div>

                <p className="mb-5 text-xs leading-relaxed text-white/40">{plan.description}</p>

                {/* Key limits */}
                <div className="mb-5 flex flex-col gap-2">
                  {[
                    { icon: CalendarDays, label: plan.max_events == null ? 'Unlimited events' : `${plan.max_events} events` },
                    { icon: Users,        label: plan.max_guests_per_event == null ? 'Unlimited guests' : `${plan.max_guests_per_event.toLocaleString()} guests/event` },
                    { icon: FolderOpen,   label: plan.max_team_members == null ? 'Unlimited team' : `${plan.max_team_members} team members` },
                    { icon: BarChart3,    label: plan.max_storage_gb == null ? 'Unlimited storage' : `${plan.max_storage_gb} GB storage` },
                  ].map(({ icon: LimitIcon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-xs text-white/50">
                      <LimitIcon className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-auto">
                  <button
                    onClick={() => {
                      if (plan.slug === 'free') {
                        router.push('/auth/register')
                      } else if (plan.trial_days > 0) {
                        router.push('/auth/register?trial=growth')
                      } else {
                        router.push(`/auth/register?plan=${plan.slug}&billing=${billing}`)
                      }
                    }}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all',
                      isGrowth
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:opacity-90'
                        : 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {plan.slug === 'free'
                      ? 'Get started free'
                      : plan.trial_days > 0
                      ? `Start ${plan.trial_days}-day free trial`
                      : `Get ${plan.name}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {plan.trial_days > 0 && (
                    <p className="mt-2 text-center text-[10px] text-white/30">No credit card required</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Feature comparison ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <button
          onClick={() => setShowComparison((v) => !v)}
          className="mx-auto flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', showComparison && 'rotate-180')} />
          {showComparison ? 'Hide' : 'Show'} full feature comparison
        </button>

        {showComparison && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            {/* Header */}
            <div className="grid grid-cols-5 border-b border-white/10 bg-white/[0.03]">
              <div className="p-4 text-xs font-semibold uppercase tracking-wider text-white/30">Feature</div>
              {(['Free', 'Starter', 'Growth', 'Agency'] as const).map((n) => (
                <div key={n} className={cn('p-4 text-center text-xs font-bold', n === 'Growth' ? 'text-violet-400' : 'text-white/60')}>
                  {n}
                </div>
              ))}
            </div>

            {/* Rows */}
            {FEATURE_ROWS.map((row, i) => (
              <div
                key={row.key}
                className={cn(
                  'grid grid-cols-5 border-b border-white/5 last:border-0',
                  i % 2 !== 0 && 'bg-white/[0.015]',
                )}
              >
                <div className="p-3 px-4 text-sm text-white/60">{row.label}</div>
                {(['free', 'starter', 'growth', 'agency'] as const).map((slug) => {
                  const val = row.plans[slug]
                  return (
                    <div key={slug} className="flex items-center justify-center p-3">
                      {typeof val === 'boolean' ? (
                        val ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <X className="h-4 w-4 text-white/15" />
                        )
                      ) : (
                        <span className={cn('text-xs font-medium', slug === 'growth' ? 'text-violet-300' : 'text-white/50')}>
                          {val}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: Shield,     title: 'Enterprise Security', desc: 'SOC 2 compliant, end-to-end encrypted' },
              { icon: Globe,      title: '99.9% Uptime',        desc: 'SLA-backed global infrastructure' },
              { icon: Brain,      title: 'AI-Native',           desc: 'Deep AI integration, not a chatbot' },
              { icon: Headphones, title: 'Dedicated Support',   desc: 'Live chat, email & phone support' },
            ].map(({ icon: TIcon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <TIcon className="h-4 w-4 text-white/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/80">{title}</p>
                  <p className="mt-0.5 text-xs text-white/30">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-10 text-center text-2xl font-bold text-white">Frequently asked questions</h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
              >
                {faq.q}
                <ChevronDown className={cn('ml-4 h-4 w-4 shrink-0 text-white/30 transition-transform', openFaq === i && 'rotate-180')} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm leading-relaxed text-white/40">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-violet-500/20 py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white">
            Ready to transform your event business?
          </h2>
          <p className="mb-10 text-white/50">
            Start your 14-day Growth trial today. No credit card required.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => router.push('/auth/register?trial=growth')}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90"
            >
              <Zap className="h-4 w-4" />
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/contact')}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Talk to sales
            </button>
          </div>
          <p className="mt-5 text-xs text-white/25">
            All prices in INR · Taxes may apply · Cancel any time
          </p>
        </div>
      </section>
    </>
  )
}
