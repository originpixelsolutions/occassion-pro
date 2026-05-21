'use client'
import { useState, useEffect } from 'react'
import {
  CreditCard, Zap, Check, ArrowRight, AlertTriangle,
  BarChart3, Users, FolderOpen, Brain, Link2,
  Crown, Star, Rocket, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string; slug: string; name: string; description: string
  price_monthly: number; price_yearly: number; trial_days: number
  max_events: number | null; max_guests_per_event: number | null
  max_team_members: number | null; max_storage_gb: number | null
  max_ai_calls_monthly: number | null; max_short_links: number | null
  features: Record<string, boolean>
}

interface CurrentPlan {
  plan_slug: string; plan_name: string; sub_status: string
  trial_end: string | null; trial_days_remaining: number
  current_period_end: string; cancel_at_period_end: boolean
  is_trialing: boolean; price_monthly: number
  limit_events: number | null; limit_team: number | null
  limit_storage_gb: number | null; limit_ai_calls: number | null
  limit_short_links: number | null; limit_guests_per_event: number | null
  usage_events: number; usage_team_members: number
  usage_storage_gb: number; usage_ai_calls: number; usage_short_links: number
  features: Record<string, boolean>
}

// ─── Plan Icons ───────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, any> = {
  free: Star, starter: Rocket, growth: Crown, agency: Building2,
}

const PLAN_COLORS: Record<string, string> = {
  free:    'border-border bg-card',
  starter: 'border-blue-500/30 bg-blue-500/5',
  growth:  'border-violet-500/30 bg-violet-500/5',
  agency:  'border-amber-500/30 bg-amber-500/5',
}

const PLAN_BADGE: Record<string, string> = {
  growth: 'Most Popular',
  agency: 'Best Value',
}

// ─── Features display list ────────────────────────────────────────────────────

const FEATURE_LABELS: [string, string][] = [
  ['ai_assistant',          'AI Assistant'],
  ['ai_proposals',          'AI Proposal Generator'],
  ['ai_budget_optimizer',   'AI Budget Optimizer'],
  ['multi_currency',        'Multi-Currency'],
  ['client_portal',         'Client Portal'],
  ['vendor_portal',         'Vendor Portal'],
  ['audit_trail',           'Audit Trail'],
  ['playbooks',             'Event Playbooks'],
  ['document_generation',   'Document Generation'],
  ['animated_invitations',  'Animated Invitations'],
  ['api_access',            'API Access'],
  ['white_label',           'White Label'],
  ['custom_domain',         'Custom Domain'],
  ['offline_checkin',       'Offline Check-in'],
  ['advanced_analytics',    'Advanced Analytics'],
  ['priority_support',      'Priority Support'],
]

// ─── Usage Meter ─────────────────────────────────────────────────────────────

function UsageMeter({
  label, used, limit, icon: Icon, color,
}: { label: string; used: number; limit: number | null; icon: any; color: string }) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0
  const isUnlimited = limit === null
  const isWarning = !isUnlimited && pct >= 80
  const isCritical = !isUnlimited && pct >= 95

  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-3.5 h-3.5', color)} />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className={cn('text-xs font-bold',
          isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-muted-foreground'
        )}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500',
              isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-1.5 bg-primary/20 rounded-full">
          <div className="h-full bg-primary/40 rounded-full w-full" />
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const api = useApi()
  const [plans, setPlans] = useState<Plan[]>([])
  const [current, setCurrent] = useState<CurrentPlan | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(true)
  const [trialLoading, setTrialLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/subscription/plans'),
      api.get('/subscription/current'),
    ]).then(([p, c]) => {
      setPlans(p ?? [])
      setCurrent(c)
    }).finally(() => setLoading(false))
  }, [])

  const handleStartTrial = async () => {
    setTrialLoading(true)
    try {
      await api.post('/subscription/trial', { plan: 'growth' })
      const c = await api.get('/subscription/current')
      setCurrent(c)
    } finally {
      setTrialLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You\'ll retain access until the period ends.')) return
    setCancelLoading(true)
    try {
      await api.post('/subscription/cancel', {})
      const c = await api.get('/subscription/current')
      setCurrent(c)
    } finally {
      setCancelLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-violet-400" /> Billing & Plans
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and view usage</p>
      </div>

      {/* Current plan status */}
      {current && (
        <div className={cn(
          'rounded-xl border p-5',
          current.sub_status === 'trialing'
            ? 'bg-violet-500/5 border-violet-500/30'
            : current.cancel_at_period_end
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-card border-border'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.plan_name} Plan</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize border',
                  current.sub_status === 'active'    ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  current.sub_status === 'trialing'  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                  current.sub_status === 'past_due'  ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                )}>
                  {current.sub_status.replace(/_/g, ' ')}
                </span>
              </div>
              {current.is_trialing && (
                <p className="text-sm text-violet-400 mt-1">
                  🎉 Trial ends in <strong>{current.trial_days_remaining} day{current.trial_days_remaining !== 1 ? 's' : ''}</strong> — no credit card required
                </p>
              )}
              {current.cancel_at_period_end && (
                <p className="text-sm text-amber-400 mt-1">
                  ⚠️ Subscription cancelled — access ends {new Date(current.current_period_end).toLocaleDateString()}
                </p>
              )}
              {!current.is_trialing && !current.cancel_at_period_end && current.plan_slug !== 'free' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Next billing: {new Date(current.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {current.plan_slug !== 'free' && !current.cancel_at_period_end && (
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                {cancelLoading ? 'Cancelling…' : 'Cancel Plan'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trial CTA for free plan */}
      {current?.plan_slug === 'free' && !current.is_trialing && (
        <div className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" /> Start your free 14-day Growth trial
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                AI proposals, advanced analytics, API access, unlimited events — no credit card required
              </p>
            </div>
            <button
              onClick={handleStartTrial}
              disabled={trialLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors shrink-0 disabled:opacity-60"
            >
              {trialLoading ? 'Starting…' : 'Start Free Trial'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Usage meters */}
      {current && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Current Usage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <UsageMeter label="Events" used={current.usage_events} limit={current.limit_events} icon={FolderOpen} color="text-blue-400" />
            <UsageMeter label="Team Members" used={current.usage_team_members} limit={current.limit_team} icon={Users} color="text-green-400" />
            <UsageMeter label="AI Calls" used={current.usage_ai_calls} limit={current.limit_ai_calls} icon={Brain} color="text-violet-400" />
            <UsageMeter label="Short Links" used={current.usage_short_links} limit={current.limit_short_links} icon={Link2} color="text-amber-400" />
            <UsageMeter label="Storage (GB)" used={current.usage_storage_gb} limit={current.limit_storage_gb} icon={BarChart3} color="text-pink-400" />
          </div>
        </div>
      )}

      {/* Plan comparison */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Available Plans</h2>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {(['monthly','yearly'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={cn('px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                  billing === b ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {b}
                {b === 'yearly' && <span className="ml-1 text-green-400">-17%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => {
            const Icon = PLAN_ICONS[plan.slug] ?? Star
            const isCurrentPlan = current?.plan_slug === plan.slug
            const badge = PLAN_BADGE[plan.slug]
            const price = billing === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly

            return (
              <div key={plan.id} className={cn(
                'relative rounded-xl border p-5 flex flex-col',
                PLAN_COLORS[plan.slug],
                isCurrentPlan && 'ring-2 ring-primary',
              )}>
                {badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                    {badge}
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-2.5 right-3 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                    Current
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{plan.name}</p>
                    {plan.trial_days > 0 && (
                      <p className="text-[10px] text-violet-400">{plan.trial_days}-day free trial</p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  {price === 0 ? (
                    <p className="text-2xl font-bold">Free</p>
                  ) : (
                    <p className="text-2xl font-bold">
                      ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  )}
                  {billing === 'yearly' && price > 0 && (
                    <p className="text-xs text-green-400">Billed ₹{plan.price_yearly.toLocaleString('en-IN')}/year</p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-1.5 mb-4 text-xs">
                  {[
                    { label: 'Events', val: plan.max_events },
                    { label: 'Guests/event', val: plan.max_guests_per_event },
                    { label: 'Team members', val: plan.max_team_members },
                    { label: 'AI calls/mo', val: plan.max_ai_calls_monthly },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{val === null ? '∞ Unlimited' : val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Feature flags */}
                <div className="space-y-1 mb-5 flex-1">
                  {FEATURE_LABELS.slice(0, 8).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {plan.features[key]
                        ? <Check className="w-3 h-3 text-green-400 shrink-0" />
                        : <div className="w-3 h-3 rounded-full bg-border shrink-0" />
                      }
                      <span className={plan.features[key] ? 'text-foreground' : 'text-muted-foreground/50 line-through'}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  disabled={isCurrentPlan}
                  onClick={() => {
                    if (plan.slug === 'growth' && current?.plan_slug === 'free') handleStartTrial()
                  }}
                  className={cn(
                    'w-full py-2 rounded-lg text-xs font-semibold transition-colors',
                    isCurrentPlan
                      ? 'bg-primary/20 text-primary cursor-default'
                      : plan.slug === 'growth'
                      ? 'bg-violet-500 text-white hover:bg-violet-600'
                      : plan.slug === 'agency'
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-card border border-border hover:bg-accent'
                  )}
                >
                  {isCurrentPlan ? 'Current Plan' :
                   plan.trial_days > 0 ? `Start ${plan.trial_days}-Day Trial` :
                   plan.slug === 'free' ? 'Downgrade to Free' :
                   `Upgrade to ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* All features comparison footnote */}
      <div className="text-center text-xs text-muted-foreground">
        All plans include SSL, 99.9% uptime SLA, and data export. Prices in INR. Taxes may apply.
      </div>

    </div>
  )
}
