'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRegisterStore } from '@/store/register.store'
import { toast } from 'sonner'
import {
  Loader2, Zap, CheckCircle2, ArrowRight, Sparkles, Crown,
  Building2, Rocket,
} from 'lucide-react'
import Link from 'next/link'

// ── Step indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: 'Account' }, { n: 2, label: 'Workspace' }, { n: 3, label: 'Plan' }]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              s.n < current ? 'bg-primary text-primary-foreground' :
              s.n === current ? 'bg-primary/20 border-2 border-primary text-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {s.n < current ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[10px] font-medium ${s.n === current ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-px mb-5 mx-1 transition-all ${s.n < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Plan config ──────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: Rocket,
    monthlyPrice: 0,
    annualPrice: 0,
    color: 'text-muted-foreground',
    badge: null,
    description: 'For individuals just getting started.',
    features: [
      '3 events / month',
      '50 guests per event',
      'Basic event management',
      'Email support',
      '1 team member',
    ],
    cta: 'Start for free',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    monthlyPrice: 2499,
    annualPrice: 1999,
    color: 'text-blue-400',
    badge: null,
    description: 'For growing event planners.',
    features: [
      '20 events / month',
      '500 guests per event',
      'CRM & lead tracking',
      'Client portal',
      'Email + WhatsApp notifications',
      '3 team members',
      'Basic AI suggestions',
    ],
    cta: 'Start 14-day trial',
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    icon: Sparkles,
    monthlyPrice: 5999,
    annualPrice: 4999,
    color: 'text-primary',
    badge: 'Most Popular',
    description: 'For professional event companies.',
    features: [
      'Unlimited events',
      'Unlimited guests',
      'Full AI command center',
      'Multi-portal access',
      'Advanced analytics',
      'Vendor management',
      'Floor plan editor',
      'Real-time runsheets',
      '10 team members',
      'Priority support',
    ],
    cta: 'Start 14-day trial',
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    icon: Crown,
    monthlyPrice: 12999,
    annualPrice: 10999,
    color: 'text-amber-400',
    badge: 'Enterprise',
    description: 'For large agencies & enterprises.',
    features: [
      'Everything in Growth',
      'Multi-company management',
      'White-label branding',
      'Custom domain',
      'Dedicated account manager',
      'SLA guarantee',
      'Unlimited team members',
      'API access',
      'Custom integrations',
      'SSO / SAML',
    ],
    cta: 'Start 14-day trial',
    highlight: false,
  },
]

export default function PlanPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { tenantId, selectedPlan: savedPlan, billingCycle: savedCycle, setPlanData, reset } = useRegisterStore()

  const [selected, setSelected] = useState(savedPlan || 'growth')
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(savedCycle || 'monthly')
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error('Please complete account setup first')
        router.push('/register')
      } else {
        setAuthChecked(true)
      }
    })
  }, [])

  async function handleContinue() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      setPlanData(selected, cycle)

      // Notify the API of the plan choice (best-effort — don't block if API unavailable)
      if (tenantId) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
        await fetch(`${apiBase}/api/v1/tenants/${tenantId}/plan`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan: selected, billing_cycle: cycle, start_trial: selected !== 'free' }),
        }).catch(() => {
          // Non-fatal — plan can be updated later
        })
      }

      // Clear registration wizard state
      reset()

      // Refresh to pick up new session/profile data, then go to dashboard
      router.refresh()
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const annualSavings = Math.round(((5999 - 4999) / 5999) * 100)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-12 px-4 overflow-y-auto">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">OccasionPro</span>
          </Link>
          <StepIndicator current={3} />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Choose your plan</h1>
          <p className="text-muted-foreground text-sm">
            All paid plans include a 14-day free trial — no credit card required.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${cycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <button
            onClick={() => setCycle((c) => (c === 'monthly' ? 'annual' : 'monthly'))}
            className={`relative w-11 h-6 rounded-full transition-all ${
              cycle === 'annual' ? 'bg-primary' : 'bg-border'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
              cycle === 'annual' ? 'left-6' : 'left-1'
            }`} />
          </button>
          <span className={`text-sm font-medium flex items-center gap-1.5 ${cycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual
            <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
              Save {annualSavings}%
            </span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon
            const price = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice
            const isSelected = selected === plan.id

            return (
              <motion.button
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => setSelected(plan.id)}
                className={`relative text-left rounded-2xl border p-5 transition-all space-y-4 ${
                  plan.highlight
                    ? isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/40 shadow-xl shadow-primary/10'
                      : 'border-primary/30 bg-primary/[0.03] hover:border-primary/60 hover:bg-primary/5'
                    : isSelected
                    ? 'border-border bg-card ring-2 ring-primary/40 shadow-lg'
                    : 'border-border bg-card hover:border-border/80 hover:bg-accent/5'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                    plan.id === 'growth'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                )}

                {/* Icon + Name */}
                <div className="space-y-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    plan.highlight ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Icon className={`w-4 h-4 ${plan.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div>
                  {price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">₹0</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">₹{price.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                  )}
                  {cycle === 'annual' && price > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      billed annually (₹{(price * 12).toLocaleString('en-IN')}/yr)
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.button>
            )
          })}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pb-8">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleContinue}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-primary/20 min-w-52"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {loading
              ? 'Setting up your workspace…'
              : PLANS.find((p) => p.id === selected)?.cta ?? 'Continue'}
          </motion.button>

          {selected !== 'free' && (
            <p className="text-xs text-muted-foreground text-center">
              14-day trial. Cancel anytime. No credit card needed.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            You can upgrade or change plans at any time from{' '}
            <span className="text-foreground font-medium">Settings → Billing</span>.
          </p>
        </div>

        {/* Enterprise callout */}
        <div className="border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold">Need something custom?</p>
            </div>
            <p className="text-xs text-muted-foreground">
              We offer custom pricing for large enterprises, government bodies, and multi-location agencies.
            </p>
          </div>
          <a
            href="mailto:enterprise@occasionpro.in"
            className="flex-shrink-0 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors whitespace-nowrap"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  )
}
