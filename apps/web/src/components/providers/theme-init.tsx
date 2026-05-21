'use client'
import { useThemePersistence } from '@/hooks/use-theme-persistence'

/** Mounts inside ThemeProvider — syncs theme to/from Supabase silently */
export function ThemeInit() {
  useThemePersistence()
  return null
}
