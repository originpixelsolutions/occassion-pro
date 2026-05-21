import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile + tenant info.
 * Used by client-side hooks that need a single round-trip to bootstrap auth state.
 */
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(id, name, slug, plan, ai_enabled, trial_ends_at)')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  })
}
