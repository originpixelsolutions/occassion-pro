'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

let _cachedValue: boolean | null = null
let _fetchedAt = 0
const CACHE_MS = 30_000 // 30-second client cache
const _listeners = new Set<(val: boolean) => void>()

/** Notify all mounted hooks when the value changes (e.g. from realtime) */
export function broadcastAiEnabled(val: boolean) {
  _cachedValue = val
  _fetchedAt = Date.now()
  _listeners.forEach(fn => fn(val))
}

/**
 * useAIEnabled — reads the platform-level ai_enabled toggle.
 *
 * - Returns false by default until confirmed enabled (safe default)
 * - Caches the value for 30s in module scope to avoid hammering the API
 * - Subscribes to a Supabase realtime channel so the toggle change
 *   takes effect immediately without a page reload
 * - Every AI-powered UI element should check `aiEnabled` before rendering
 */
export function useAIEnabled(): { aiEnabled: boolean; loading: boolean } {
  const [aiEnabled, setAiEnabled] = useState<boolean>(_cachedValue ?? false)
  const [loading, setLoading] = useState<boolean>(_cachedValue === null)

  const refresh = useCallback(async () => {
    if (_cachedValue !== null && Date.now() - _fetchedAt < CACHE_MS) {
      setAiEnabled(_cachedValue)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/super-admin/platform-settings/public/ai-enabled`)
      if (res.ok) {
        const data: { ai_enabled: boolean } = await res.json()
        broadcastAiEnabled(data.ai_enabled)
        setAiEnabled(data.ai_enabled)
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
    // This relies on Supabase being available in the browser context
    let realtimeChannel: ReturnType<typeof import('@supabase/supabase-js').createClient>['channel'] | null = null

    const attachRealtime = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        realtimeChannel = supabase
          .channel('platform_settings_ai')
          .on(
            'postgres_changes' as Parameters<typeof realtimeChannel.on>[0],
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'platform_settings',
              filter: 'key=eq.ai_enabled',
            },
            (payload: { new: { value: boolean } }) => {
              const newVal = payload.new?.value === true
              broadcastAiEnabled(newVal)
              setAiEnabled(newVal)
            },
          )
          .subscribe()
      } catch {
        // Realtime unavailable — polling fallback via cache TTL is enough
      }
    }

    attachRealtime()

    // Register as a listener for programmatic broadcasts
    const listener = (val: boolean) => setAiEnabled(val)
    _listeners.add(listener)

    return () => {
      _listeners.delete(listener)
      if (realtimeChannel) {
        try { realtimeChannel.unsubscribe() } catch {}
      }
    }
  }, [refresh])

  return { aiEnabled, loading }
}
