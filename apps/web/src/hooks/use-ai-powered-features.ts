'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

let _cachedValue: boolean | null = null
let _fetchedAt = 0
const CACHE_MS = 30_000 // 30-second client cache
const _listeners = new Set<(val: boolean) => void>()

/**
 * Notify all mounted hooks when the value changes (e.g. from realtime or super-admin toggle).
 * Exported so the super-admin page can broadcast immediately without waiting for realtime.
 */
export function broadcastAiPoweredFeatures(val: boolean) {
  _cachedValue = val
  _fetchedAt = Date.now()
  _listeners.forEach(fn => fn(val))
}

/** @deprecated use broadcastAiPoweredFeatures */
export const broadcastAiEnabled = broadcastAiPoweredFeatures

/**
 * useAIPoweredFeatures — reads the platform-level `ai_api_enabled` toggle.
 *
 * IMPORTANT: This hook gates ONLY paid AI API features (OpenAI / Anthropic / LiteLLM calls).
 * Rule-based smart features (health scores, budget alerts, duplicate detection,
 * smart seating, F&B suggestions, vendor conflict detection) are NEVER gated —
 * they always run regardless of this flag.
 *
 * - Returns false by default until confirmed enabled (safe default)
 * - Caches the value for 30s in module scope to avoid hammering the API
 * - Subscribes to Supabase realtime so the toggle change takes effect immediately
 *   without a page reload
 */
export function useAIPoweredFeatures(): { aiPoweredEnabled: boolean; loading: boolean } {
  const [aiPoweredEnabled, setAiPoweredEnabled] = useState<boolean>(_cachedValue ?? false)
  const [loading, setLoading] = useState<boolean>(_cachedValue === null)

  const refresh = useCallback(async () => {
    if (_cachedValue !== null && Date.now() - _fetchedAt < CACHE_MS) {
      setAiPoweredEnabled(_cachedValue)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/super-admin/platform-settings/public/ai-enabled`)
      if (res.ok) {
        const data: { ai_api_enabled: boolean } = await res.json()
        broadcastAiPoweredFeatures(data.ai_api_enabled)
        setAiPoweredEnabled(data.ai_api_enabled)
      }
    } catch {
      // On error, keep whatever state we have (defaults to false → safe)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Subscribe to realtime updates from Supabase
    let realtimeChannel: ReturnType<typeof import('@supabase/supabase-js').createClient>['channel'] | null = null

    const attachRealtime = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        realtimeChannel = supabase
          .channel('platform_settings_ai_api')
          .on(
            'postgres_changes' as Parameters<typeof realtimeChannel.on>[0],
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'platform_settings',
              filter: 'key=eq.ai_api_enabled',
            },
            (payload: { new: { value: boolean } }) => {
              const newVal = payload.new?.value === true
              broadcastAiPoweredFeatures(newVal)
              setAiPoweredEnabled(newVal)
            },
          )
          .subscribe()
      } catch {
        // Realtime unavailable — polling fallback via cache TTL is sufficient
      }
    }

    attachRealtime()

    // Register as a listener for programmatic broadcasts
    const listener = (val: boolean) => setAiPoweredEnabled(val)
    _listeners.add(listener)

    return () => {
      _listeners.delete(listener)
      if (realtimeChannel) {
        try { realtimeChannel.unsubscribe() } catch {}
      }
    }
  }, [refresh])

  return { aiPoweredEnabled, loading }
}

/** @deprecated use useAIPoweredFeatures */
export function useAIEnabled() {
  const { aiPoweredEnabled, loading } = useAIPoweredFeatures()
  return { aiEnabled: aiPoweredEnabled, loading }
}
