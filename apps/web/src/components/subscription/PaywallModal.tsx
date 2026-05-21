'use client'

import { useRouter } from 'next/navigation'
import { Lock, Zap, AlertTriangle, Calendar, ArrowRight } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'

/**
 * PaywallModal
 * Full-screen, non-dismissable overlay shown when a workspace's
 * subscription has expired (access_state === 'locked').
 * Rendered at the layout level; no props needed.
 */
export function PaywallModal() {
  const { plan, isLocked, loading } = useSubscription()
  const router = useRouter()

  if (loading || !isLocked || !plan) return null

  const isCancelled  = plan.sub_status === 'cancelled'
  const isSuspended  = plan.sub_status === 'suspended'
  const isExpired    = plan.sub_status === 'expired'

  const headline = isSuspended
    ? 'Workspace Suspended'
    : isCancelled
    ? 'Subscription Cancelled'
    : 'Trial Expired'

  const subtext = isSuspended
    ? 'Your workspace has been suspended due to a billing issue. Please contact support or update your payment method.'
    : isCancelled
    ? 'Your subscription has ended. Reactivate now to restore full access to your workspace and events.'
    : 'Your 14-day Growth trial has ended. Upgrade to a paid plan to continue using OccasionPro.'

  return (
    // Fixed full-screen overlay — z-[9999] ensures it sits above everything
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header band */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-6 py-5 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3">
            {isSuspended ? (
              <AlertTriangle className="w-7 h-7 text-amber-300" />
            ) : (
              <Lock className="w-7 h-7 text-white" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{headline}</h2>
          <p className="text-sm text-violet-200 mt-1">
            {plan.plan_name} · {plan.sub_status}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {subtext}
          </p>

          {/* What you'll get back */}
          {!isSuspended && (
            <div className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1">
                What you get on a paid plan
              </p>
              {[
                'All your events, guests & vendors preserved',
                'Full AI assistant & smart features',
                'Unlimited team invitations',
                'Client & vendor portals',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => router.push('/settings/billing')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors text-sm"
            >
              <Zap className="w-4 h-4" />
              {isCancelled ? 'Reactivate Subscription' : isSuspended ? 'Update Payment Method' : 'Choose a Plan'}
              <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </button>

            <button
              onClick={() => router.push('/pricing')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border hover:bg-muted/50 text-foreground/70 text-sm transition-colors"
            >
              <Calendar className="w-4 h-4" />
              View all plans
            </button>
          </div>

          {/* Support link */}
          <p className="text-xs text-muted-foreground text-center">
            Need help?{' '}
            <a href="mailto:support@occasionpro.com" className="text-violet-500 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
