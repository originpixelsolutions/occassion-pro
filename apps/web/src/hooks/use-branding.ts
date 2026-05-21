'use client'

import { useEffect, useState, useCallback } from 'react'
import { BrandingTokenSet, DEFAULT_BRANDING, applyBrandingToDOM, fetchBranding } from '@/lib/branding'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface UseBrandingResult {
  branding: BrandingTokenSet
  loading: boolean
  reload: () => Promise<void>
}

/**
 * useBranding — fetches tenant branding and injects CSS variables into :root.
 * Use once per app in BrandingProvider. 
 */
export function useBranding(): UseBrandingResult {
  const [branding, setBranding] = useState<BrandingTokenSet>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Get current tenant from Supabase session
      const supabase = getSupabaseBrowserClient()
      let tenantId: string | null = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('tenant_members')
            .select('tenant_id')
            .eq('user_id', user.id)
            .limit(1)
            .single()
          tenantId = data?.tenant_id ?? null
        }
      } catch {}

      const tokens = await fetchBranding(tenantId, API)
      setBranding(tokens)
      applyBrandingToDOM(tokens)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { branding, loading, reload: load }
}

/**
 * usePreviewBranding — applies a token preview directly to DOM without saving.
 * Used in the live preview panel of the branding editor.
 */
export function usePreviewBranding() {
  const preview = useCallback((tokens: Partial<BrandingTokenSet>) => {
    applyBrandingToDOM({ ...DEFAULT_BRANDING, ...tokens })
  }, [])

  const reset = useCallback((saved: BrandingTokenSet) => {
    applyBrandingToDOM(saved)
  }, [])

  return { preview, reset }
}
