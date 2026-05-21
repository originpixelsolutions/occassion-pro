/**
 * OccasionPro — Plan Selection
 * Route: /register/plan
 * Step 3: Choose subscription plan → start trial
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Sparkles, ArrowRight, Zap } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  trial_days: number
  features: string[]
  max_events: number | null
  max_users: number | null
  max_storage_gb: number | null
  is_popular: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export default function PlanSelectionPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/v1/plans/public`)
      .then(r => r.json())
      .then(data => {
        setPlans(data.plans ?? FALLBACK_PLANS)
        if (data.plans?.length) setSelectedPlan(data.plans.find((p: Plan) => p.is_popular)?.id ?? data.plans[0].id)
      })
      .catch(() => {
        setPlans(FALLBACK_PLANS)
        setSelectedPlan(FALLBACK_PLANS.find(p => p.is_popular)?.id ?? FALLBACK_PLANS[0].id)
      })
      .finally(() => setPlansLoading(false))
  }, [])

  async function handleStart() {
    if (!selectedPlan) return
    setError(null)
    setLoading(true)
    try {
      const token = localStorage.getItem('op_reg_token')
      if (!token) { router.push('/register'); return }

      const res = await fetch(`${API}/v1/auth/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: selectedPlan, billing_cycle: billing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Could not start trial')

      // Clean up the registration token — it's now served its purpose
      localStorage.removeItem('op_reg_token')

      // The backend auto-confirmed the email in Step 1. Establish a real Supabase
      // session now so the middleware cookie check passes on /dashboard.
      const email = sessionStorage.getItem('op_reg_email')
      const password = sessionStorage.getItem('op_reg_pw')

      if (email && password) {
        const supabase = getSupabaseBrowserClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw new Error('Account created but sign-in failed: ' + signInError.message)
      }

      // Clear temp credentials regardless
      sessionStorage.removeItem('op_reg_email')
      sessionStorage.removeItem('op_reg_pw')

      router.push('/dashboard?onboarding=true')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const yearlyDiscount = 20

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-6 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg">OccasionPro</span>
      </div>

      <div className="w-full max-w-4xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {['Account', 'Workspace', 'Plan'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                i < 2
                  ? 'bg-violet-600/40 border-violet-600/40 text-violet-300'
                  : 'bg-violet-600 border-violet-600 text-white'
              }`}>
                {i < 2 ? <CheckCircle2 className="w-3.5 h-3.5" /> : 3}
              </div>
              <span className={`text-sm ${i === 2 ? 'text-white font-medium' : 'text-zinc-500'}`}>{step}</span>
              {i < 2 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Choose your plan</h1>
          <p className="text-zinc-400 text-sm">
            Every plan includes a free trial. No credit card required to start.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-white/10">
            {(['monthly', 'yearly'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  billing === b
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {b === 'monthly' ? 'Monthly' : (
                  <>
                    Yearly
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                      -{yearlyDiscount}%
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {plansLoading ? (
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-80 rounded-2xl border border-white/8 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {plans.map(plan => {
              const price = billing === 'monthly'
                ? plan.price_monthly
                : Math.round(plan.price_monthly * (1 - yearlyDiscount / 100))
              const isSelected = selectedPlan === plan.id

              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`text-left rounded-2xl p-6 border transition-all flex flex-col ${
                    isSelected
                      ? plan.is_popular
                        ? 'border-violet-500/70 bg-violet-500/10 shadow-[0_0_30px_rgba(124,58,237,0.2)]'
                        : 'border-violet-500/50 bg-violet-500/8'
                      : plan.is_popular
                      ? 'border-violet-500/30 bg-white/[0.03] hover:border-violet-500/50'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  {plan.is_popular && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300 mb-3">
                      <Zap className="w-3 h-3" />
                      MOST POPULAR
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-white font-bold text-lg">{plan.name}</div>
                      <div className="flex items-baseline gap-1 mt-1">
                        {price === 0 ? (
                          <span className="text-2xl font-bold text-white">Free</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-white">₹{fmt(price)}</span>
                            <span className="text-zinc-400 text-sm">/mo</span>
                          </>
                        )}
                      </div>
                      {billing === 'yearly' && price > 0 && (
                        <div className="text-xs text-emerald-400 mt-0.5">
                          Billed ₹{fmt(price * 12)}/year
                        </div>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      isSelected ? 'border-violet-500 bg-violet-500' : 'border-white/20'
                    }`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 mb-4 space-y-0.5">
                    <div>{plan.max_events === null ? 'Unlimited events' : `Up to ${plan.max_events} events/month`}</div>
                    <div>{plan.max_users === null ? 'Unlimited team members' : `${plan.max_users} team members`}</div>
                    <div>{plan.max_storage_gb === null ? 'Unlimited storage' : `${plan.max_storage_gb} GB storage`}</div>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {plan.features.slice(0, 5).map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {plan.trial_days > 0 && (
                    <div className="mt-4 text-xs text-zinc-500 text-center">
                      {plan.trial_days}-day free trial
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleStart}
            disabled={!selectedPlan || loading}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] text-base"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-xs text-zinc-600">
            No credit card · Cancel anytime · Full access during trial
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── FALLBACK PLANS (shown if API is unavailable) ─────────────────────────────
const FALLBACK_PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price_monthly: 4999,
    price_yearly: 3999,
    trial_days: 14,
    max_events: 10,
    max_users: 5,
    max_storage_gb: 5,
    is_popular: false,
    features: ['Core event modules', 'Guest management', 'Budget tracker', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 14999,
    price_yearly: 11999,
    trial_days: 14,
    max_events: 50,
    max_users: 25,
    max_storage_gb: 50,
    is_popular: true,
    features: ['All modules', 'AI features', 'Conference module', 'Animated invitations', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 0,
    price_yearly: 0,
    trial_days: 30,
    max_events: null,
    max_users: null,
    max_storage_gb: null,
    is_popular: false,
    features: ['Unlimited everything', 'Custom integrations', 'Dedicated success manager', 'SLA guarantee'],
  },
]
