'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

export interface TenantPlan {
  tenant_id: string
  subscription_id: string
  sub_status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'suspended' | 'expired'
  plan_slug: 'free' | 'starter' | 'growth' | 'agency'
  plan_name: string
  is_trialing: boolean
  trial_days_remaining: number
  trial_ends_at: string | null
  access_state: 'active' | 'grace' | 'locked'
  currency: string
  price_monthly: number
  limit_events: number | null
  limit_team: number | null
  limit_guests_per_event: number | null
  limit_storage_gb: number | null
  usage_events: number
  usage_team_members: number
  features: Record<string, boolean>
}

interface UseSubscriptionReturn {
  plan: TenantPlan | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  hasFeature: (key: string) => boolean
  isLocked: boolean
  isGrace: boolean
  isTrialing: boolean
  trialDaysLeft: number
}

export function useSubscription(): UseSubscriptionReturn {
  const { token } = useAuth()
  const [plan, setPlan]     = useState<TenantPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch(`${API}/subscription/current`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load subscription')
      const data = await res.json()
      setPlan(data)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasFeature = useCallback(
    (key: string): boolean => {
      if (!plan) return false
      if (plan.access_state === 'locked') return false
      return plan.features?.[key] === true
    },
    [plan],
  )

  return {
    plan,
    loading,
    error,
    refresh,
    hasFeature,
    isLocked:   plan?.access_state === 'locked',
    isGrace:    plan?.access_state === 'grace',
    isTrialing: plan?.is_trialing ?? false,
    trialDaysLeft: plan?.trial_days_remaining ?? 0,
  }
}
