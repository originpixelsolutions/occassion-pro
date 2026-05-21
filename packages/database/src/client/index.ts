import { createClient as _createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.generated'

// ── TYPED SUPABASE CLIENT ─────────────────────────────────────

export type TypedSupabaseClient = SupabaseClient<Database>

// ── BROWSER CLIENT (singleton) ────────────────────────────────

let browserClient: TypedSupabaseClient | null = null

export function createBrowserClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): TypedSupabaseClient {
  if (browserClient) return browserClient

  browserClient = _createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-app-name': 'occasionpro-web',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })

  return browserClient
}

// ── SERVER CLIENT (per-request, with service role for admin ops) ──

export function createServerClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): TypedSupabaseClient {
  return _createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createServiceClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): TypedSupabaseClient {
  return _createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-app-name': 'occasionpro-service',
      },
    },
  })
}

// ── ENVIRONMENT HELPER ────────────────────────────────────────

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL env variable')
  if (!anonKey) throw new Error('Missing SUPABASE_ANON_KEY env variable')

  return { url, anonKey, serviceRoleKey }
}
