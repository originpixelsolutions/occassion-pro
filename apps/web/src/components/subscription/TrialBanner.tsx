'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Zap, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/hooks/use-subscription'

export function TrialBanner() {
  const { plan, isTrialing, trialDaysLeft, loading } = useSubscription()
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  // Only show during trialing, hide if dismissed or loading
  if (loading || !isTrialing || dismissed || !plan) return null

  const urgent   = trialDaysLeft <= 3
  const warning  = trialDaysLeft <= 7 && !urgent
  const daysText = trialDaysLeft <= 0
    ? 'expires today'
    : trialDaysLeft === 1
    ? '1 day left'
    : `${trialDaysLeft} days left`

  return (
    <div
      className={cn(
        'relative w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors z-50',
        urgent  && 'bg-red-500/90 text-white',
        warning && 'bg-amber-500/90 text-white',
        !urgent && !warning && 'bg-violet-600/90 text-white',
      )}
    >
      {/* Left: icon + message */}
      <div className="flex items-center gap-2.5">
        {urgent ? (
          <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
        ) : (
          <Clock className="w-4 h-4 shrink-0" />
        )}
        <span>
          <span className="font-semibold">Growth Trial — </span>
          {urgent
            ? `Your trial ${daysText}. Upgrade now to keep your data and features.`
            : `Your 14-day Growth trial has ${daysText}.`}
        </span>
      </div>

      {/* Right: CTA + dismiss */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <button
          onClick={() => router.push('/settings/billing')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all',
            urgent  && 'bg-white text-red-600 hover:bg-red-50',
            warning && 'bg-white text-amber-700 hover:bg-amber-50',
            !urgent && !warning && 'bg-white/20 hover:bg-white/30 text-white',
          )}
        >
          <Zap className="w-3 h-3" />
          Upgrade Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
