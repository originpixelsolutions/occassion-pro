'use client'
/**
 * use-tenant
 * Returns the current user's tenant (workspace) details from the auth store.
 * Includes subscription plan, trial status, and feature flags.
 */
import { useAuthStore } from '@/store/auth.store'
import { useMemo } from 'react'

export function useTenant() {
  const { profile } = useAuthStore()

  const tenant = useMemo(() => {
    if (!profile) return null
    // profile.tenants is populated via the joined query in use-auth
    return (profile as any).tenants ?? null
  }, [profile])

  const isTrialing = useMemo(() => {
    if (!tenant?.trial_ends_at) return false
    return new Date(tenant.trial_ends_at) > new Date()
  }, [tenant])

  const daysLeftInTrial = useMemo(() => {
    if (!tenant?.trial_ends_at) return 0
    const diff = new Date(tenant.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [tenant])

  return {
    tenant,
    tenantId: tenant?.id ?? null,
    plan: tenant?.plan ?? 'starter',
    isTrialing,
    daysLeftInTrial,
    aiEnabled: tenant?.ai_enabled !== false,
  }
}
