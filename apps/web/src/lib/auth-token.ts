/**
 * auth-token.ts
 *
 * Utility for getting the current user's JWT access token.
 *
 * Supabase v2 stores auth state under `sb-<projectRef>-auth-token` in
 * localStorage — NOT the v1 `supabase.auth.token` key. Rather than hard-code
 * that key, we use the official Supabase client which handles the key
 * automatically across v1/v2 and any future changes.
 *
 * Usage (in a useEffect or async function inside a Client Component):
 *   import { getAuthToken } from '@/lib/auth-token'
 *   const token = await getAuthToken()
 */

import { getSupabaseBrowserClient } from './supabase/client'

/**
 * Returns the current user's JWT access token, or empty string if not signed in.
 * Works correctly with Supabase v2 (project ref: lndcqdnsllfcnkidhtem).
 */
export async function getAuthToken(): Promise<string> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  } catch {
    return ''
  }
}

/**
 * Synchronous fallback — reads directly from the Supabase v2 localStorage key.
 * Use only when you cannot use async (e.g., inside a non-async callback).
 * Prefer getAuthToken() wherever possible.
 */
export function getAuthTokenSync(): string {
  try {
    const PROJECT_REF = 'lndcqdnsllfcnkidhtem'
    const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.access_token ?? ''
    }
  } catch {}
  return ''
}
