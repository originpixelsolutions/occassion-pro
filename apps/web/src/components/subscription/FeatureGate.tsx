'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/hooks/use-subscription'

interface FeatureGateProps {
  /** Feature key to check (must match PlanFeatureKey on backend) */
  feature: string
  /** Content to show when feature IS available */
  children: ReactNode
  /** Label shown on the upgrade prompt (default: feature key formatted) */
  featureLabel?: string
  /** Visual style of the gate: 'blur' overlays children, 'replace' hides them entirely */
  mode?: 'blur' | 'replace'
  /** Custom upgrade CTA label */
  upgradeCta?: string
  /** Minimum plan name to show in the upgrade message */
  requiredPlan?: string
  /** Extra className on the wrapper */
  className?: string
}

/**
 * FeatureGate
 * Wraps any content behind a plan feature flag.
 * - mode="blur"    → renders children with a blur + lock overlay
 * - mode="replace" → replaces children with an upgrade prompt card
 *
 * Usage:
 *   <FeatureGate feature="ai_proposals" featureLabel="AI Proposals" requiredPlan="Growth">
 *     <ProposalGenerator />
 *   </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  featureLabel,
  mode = 'blur',
  upgradeCta = 'Upgrade to unlock',
  requiredPlan = 'Growth',
  className,
}: FeatureGateProps) {
  const { hasFeature, loading, isLocked } = useSubscription()
  const router = useRouter()

  // While loading, render children (avoid flash of locked state)
  if (loading) return <>{children}</>

  // Feature available → render normally
  if (hasFeature(feature) && !isLocked) return <>{children}</>

  const label = featureLabel ?? feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  if (mode === 'replace') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {label} is available on the <span className="font-medium text-foreground">{requiredPlan}</span> plan and above.
        </p>
        <button
          onClick={() => router.push('/settings/billing')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          {upgradeCta}
        </button>
      </div>
    )
  }

  // mode === 'blur' — render children behind an overlay
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Children rendered but blurred */}
      <div className="select-none pointer-events-none blur-sm opacity-50" aria-hidden>
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] z-10">
        <div className="bg-card border border-border rounded-xl shadow-lg px-5 py-4 flex flex-col items-center text-center max-w-xs">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-0.5">{label}</p>
          <p className="text-xs text-muted-foreground mb-3">
            Requires the <span className="font-medium text-foreground">{requiredPlan}</span> plan
          </p>
          <button
            onClick={() => router.push('/settings/billing')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
          >
            <Zap className="w-3 h-3" />
            {upgradeCta}
          </button>
        </div>
      </div>
    </div>
  )
}
