'use client'
/**
 * useThemePersistence
 *
 * Bridges next-themes (localStorage) with Supabase user_preferences.
 * On mount: loads saved theme from Supabase and applies it.
 * On change: debounces writes to Supabase so rapid toggles don't spam the DB.
 */
import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

const DEBOUNCE_MS = 1500

export function useThemePersistence() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const supabase = createClient()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialised = useRef(false)

  // ── On mount: load persisted preference from Supabase ──────────────────
  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('user_preferences')
          .select('theme')
          .eq('user_id', user.id)
          .single()

        if (data?.theme && ['light', 'dark', 'system'].includes(data.theme)) {
          // Only apply if it differs from what localStorage already has
          const stored = localStorage.getItem('occasion-theme')
          if (stored !== data.theme) {
            setTheme(data.theme)
          }
        }
      } catch {
        // Supabase unavailable or table doesn't exist yet — silently ignore
      } finally {
        initialised.current = true
      }
    }

    loadSavedTheme()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── On theme change: debounce-write to Supabase ────────────────────────
  useEffect(() => {
    if (!initialised.current) return
    if (!theme) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
          .from('user_preferences')
          .upsert(
            { user_id: user.id, theme },
            { onConflict: 'user_id' },
          )
      } catch {
        // Silently ignore — localStorage remains source of truth
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return { theme, resolvedTheme, setTheme }
}
