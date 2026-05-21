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
  free:    'border-border',
  starter: 'border-blue-500/40',
  growth:  'border-violet-500 shadow-violet-500/10 shadow-xl',
  agency:  'border-amber-500/40',
}

const PLAN_BADGE: Record<string, string | null> = {
  free:    null,
  starter: null,
  growth:  'Most Popular',
  agency:  null,
}

const FEATURE_ROWS: { key: string; label: string; plans: Record<string, boolean | string> }[] = [
  { key: 'events',       label: 'Events',           plans: { free: '3', starter: '20', growth: '100', agency: 'Unlimited' } },
  { key: 'guests',       label: 'Guests / event',   plans: { free: '50', starter: '300', growth: '2,000', agency: 'Unlimited' } },
  { key: 'team',         label: 'Team members',     plans: { free: '3', starter: '10', growth: '25', agency: 'Unlimited' } },
  { key: 'storage',      label: 'Storage',          plans: { free: '1 GB', starter: '10 GB', growth: '50 GB', agency: 'Unlimited' } },
  { key: 'ai_assistant', label: 'AI Assistant',     plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'ai_proposals', label: 'AI Proposals',     plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'ai_budget',    label: 'AI Budget Optimizer', plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'client_portal', label: 'Client Portal',  plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'vendor_portal', label: 'Vendor Portal',  plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'audit_trail',  label: 'Audit Trail',      plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'playbooks',    label: 'Playbooks & Templates', plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'document_generation', label: 'Document Generation', plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'animated_invitations', label: 'Animated Invitations', plans: { free: false, starter: true, growth: true, agency: true } },
  { key: 'advanced_analytics', label: 'Advanced Analytics', plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'custom_domain', label: 'Custom Domain',  plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'api_access',   label: 'API Access',       plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'offline_checkin', label: 'Offline Check-in', plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'realtime_collaboration', label: 'Real-time Collaboration', plans: { free: false, starter: false, growth: true, agency: true } },
  { key: 'white_label',  label: 'White Label',      plans: { free: false, starter: false, growth: false, agency: true } },
  { key: 'priority_support', label: 'Priority Support', plans: { free: false, starter: false, growth: false, agency: true } },
]

const FAQS = [
  {
    q: 'Can I change my plan at any time?',
    a: 'Yes — you can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Your data is always preserved. If you exceed the Free plan limits after downgrading, you will have read-only access to existing content until you upgrade or remove items.',
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

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Component ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router   = useRouter()
  const [billing, setBilling]     = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans]         = useState<Plan[]>([])
  const [openFaq, setOpenFaq]     = useState<number | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    fetch(`${API}/subscription/plans`)
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const fmt = (n: number) =>
    n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const getPrice = (plan: Plan) =>
    billing === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly

  const yearlySaving = (plan: Plan) => {
    if (!plan.price_monthly || !plan.price_yearly) return 0
    return Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="font-bold text-lg tracking-tight">
            OccasionPro
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => router.push('/auth/register')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              Start free trial
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-14">

        {/* ── Hero ── */}
        <section className="max-w-4xl mx-auto text-center px-4 pt-20 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium mb-6 border border-violet-500/20">
            <Zap className="w-3 h-3" />
            14-day Growth trial — no card required
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            From solo planners to large agencies — pick the plan that grows with you.
            Upgrade, downgrade, or cancel any time.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-all',
                billing === 'monthly'
                  ? 'bg-background shadow-sm text-foreground border border-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                billing === 'yearly'
                  ? 'bg-background shadow-sm text-foreground border border-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Yearly
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                Save 17%
              </span>
            </button>
          </div>
        </section>

        {/* ── Plan cards ── */}
        <section className="max-w-7xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(plans.length > 0
              ? plans
              : [
                  { id: '1', slug: 'free',    name: 'Free',    description: 'For individuals testing the platform',         price_monthly: 0,     price_yearly: 0,      currency: 'INR', trial_days: 0,  max_events: 3,   max_guests_per_event: 50,   max_team_members: 3,  max_storage_gb: 1,   max_ai_calls_monthly: null, max_short_links: 5,   features: {} },
                  { id: '2', slug: 'starter', name: 'Starter', description: 'For small event businesses',                   price_monthly: 2499,  price_yearly: 24990,  currency: 'INR', trial_days: 0,  max_events: 20,  max_guests_per_event: 300,  max_team_members: 10, max_storage_gb: 10,  max_ai_calls_monthly: 100,  max_short_links: 50,  features: { ai_assistant: true } },
                  { id: '3', slug: 'growth',  name: 'Growth',  description: 'For growing event companies',                  price_monthly: 5999,  price_yearly: 59990,  currency: 'INR', trial_days: 14, max_events: 100, max_guests_per_event: 2000, max_team_members: 25, max_storage_gb: 50,  max_ai_calls_monthly: 500,  max_short_links: 200, features: { ai_assistant: true, ai_proposals: true, advanced_analytics: true } },
                  { id: '4', slug: 'agency',  name: 'Agency',  description: 'For large event agencies',                    price_monthly: 12999, price_yearly: 129990, currency: 'INR', trial_days: 0,  max_events: null, max_guests_per_event: null, max_team_members: null, max_storage_gb: null, max_ai_calls_monthly: null, max_short_links: null, features: { ai_assistant: true, ai_proposals: true, white_label: true, priority_support: true } },
                ] as Plan[]
            ).map((plan) => {
              const Icon    = PLAN_ICONS[plan.slug] ?? Star
              const badge   = PLAN_BADGE[plan.slug]
              const price   = getPrice(plan)
              const saving  = yearlySaving(plan)
              const isGrowth = plan.slug === 'growth'

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative rounded-2xl border bg-card p-6 flex flex-col transition-all',
                    PLAN_ACCENT[plan.slug],
                    isGrowth && 'bg-gradient-to-b from-violet-950/30 to-card',
                  )}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap uppercase tracking-wider">
                      {badge}
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      isGrowth ? 'bg-violet-600' : 'bg-muted',
                    )}>
                      <Icon className={cn('w-5 h-5', isGrowth ? 'text-white' : 'text-muted-foreground')} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{plan.name}</p>
                      {plan.trial_days > 0 && (
                        <p className="text-[10px] text-violet-400 font-medium">{plan.trial_days}-day free trial</p>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    {price === 0 ? (
                      <p className="text-3xl font-bold">Free</p>
                    ) : (
                      <>
                        <p className="text-3xl font-bold">
                          ₹{Math.round(price).toLocaleString('en-IN')}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        {billing === 'yearly' && saving > 0 && (
                          <p className="text-xs text-green-400 mt-0.5">
                            ₹{plan.price_yearly.toLocaleString('en-IN')}/year · Save {saving}%
                          </p>
                        )}
                        {billing === 'monthly' && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ₹{plan.price_yearly.toLocaleString('en-IN')}/yr with annual billing
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-5 leading-relaxed">{plan.description}</p>

                  {/* Key limits */}
                  <div className="flex flex-col gap-2 mb-5">
                    {[
                      { icon: CalendarDays, label: plan.max_events == null ? 'Unlimited events' : `${plan.max_events} events` },
                      { icon: Users, label: plan.max_guests_per_event == null ? 'Unlimited guests' : `${plan.max_guests_per_event.toLocaleString()} guests/event` },
                      { icon: FolderOpen, label: plan.max_team_members == null ? 'Unlimited team' : `${plan.max_team_members} team members` },
                      { icon: BarChart3, label: plan.max_storage_gb == null ? 'Unlimited storage' : `${plan.max_storage_gb} GB storage` },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-2 text-xs text-foreground/70">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
                        'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5',
                        isGrowth
                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                          : 'bg-muted hover:bg-muted/80 text-foreground border border-border',
                      )}
                    >
                      {plan.slug === 'free'
                        ? 'Get started free'
                        : plan.trial_days > 0
                        ? `Start ${plan.trial_days}-day free trial`
                        : `Get ${plan.name}`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {plan.trial_days > 0 && (
                      <p className="text-[10px] text-center text-muted-foreground mt-2">
                        No credit card required
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Feature comparison toggle ── */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <button
            onClick={() => setShowComparison((v) => !v)}
            className="mx-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', showComparison && 'rotate-180')} />
            {showComparison ? 'Hide' : 'Show'} full feature comparison
          </button>

          {showComparison && (
            <div className="mt-6 border border-border rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-5 bg-muted/40 border-b border-border">
                <div className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature</div>
                {['Free', 'Starter', 'Growth', 'Agency'].map((n) => (
                  <div key={n} className={cn('p-4 text-xs font-bold text-center', n === 'Growth' && 'text-violet-400')}>
                    {n}
                  </div>
                ))}
              </div>

              {/* Feature rows */}
              {FEATURE_ROWS.map((row, i) => (
                <div
                  key={row.key}
                  className={cn('grid grid-cols-5 border-b border-border/40 last:border-0', i % 2 === 0 ? '' : 'bg-muted/10')}
                >
                  <div className="p-3 px-4 text-sm text-foreground/80">{row.label}</div>
                  {(['free', 'starter', 'growth', 'agency'] as const).map((slug) => {
                    const val = row.plans[slug]
                    return (
                      <div key={slug} className="p-3 flex items-center justify-center">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40" />
                          )
                        ) : (
                          <span className={cn('text-xs font-medium', slug === 'growth' && 'text-violet-300')}>
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

        {/* ── Trust strip ── */}
        <section className="border-y border-border/40 bg-muted/20 py-8">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 compliant, end-to-end encrypted' },
              { icon: Globe,  title: '99.9% Uptime',        desc: 'SLA-backed global infrastructure' },
              { icon: Brain,  title: 'AI-Native',           desc: 'Deep AI integration, not just a chatbot' },
              { icon: Headphones, title: 'Dedicated Support', desc: 'Live chat, email & phone support' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-border/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-left hover:bg-muted/30 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform ml-4', openFaq === i && 'rotate-180')} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA band ── */}
        <section className="bg-gradient-to-r from-violet-950/60 to-violet-900/40 border-t border-violet-500/20 py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-3">Ready to transform your event business?</h2>
            <p className="text-muted-foreground mb-8">
              Start your 14-day Growth trial today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/auth/register?trial=growth')}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-all text-sm"
              >
                <Zap className="w-4 h-4" />
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/auth/login')}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border hover:bg-muted/30 text-foreground/80 font-medium text-sm transition-colors"
              >
                Sign in to your account
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              All prices in INR · Taxes may apply · Cancel any time
            </p>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border/40 py-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} OccasionPro. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/legal/privacy"  className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/legal/terms"    className="hover:text-foreground transition-colors">Terms</a>
              <a href="mailto:support@occasionpro.com" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
