import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/v1/tenants/me/intelligence/alerts?limit=10
 *
 * Proxies to the NestJS backend intelligence alerts endpoint when available,
 * or falls back to a direct Supabase query for the current tenant.
 */
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10')

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) {
    return NextResponse.json({ alerts: [] })
  }

  // Try to proxy to NestJS backend first
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (apiUrl) {
    try {
      // Get session token to forward auth
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        const upstream = await fetch(
          `${apiUrl}/intelligence/alerts?limit=${limit}&tenantId=${profile.tenant_id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            next: { revalidate: 60 }, // cache for 60s
          },
        )
        if (upstream.ok) {
          const data = await upstream.json()
          return NextResponse.json(data)
        }
      }
    } catch {
      // fall through to direct query
    }
  }

  // Direct Supabase fallback
  const { data: alerts } = await supabase
    .from('smart_alerts')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ alerts: alerts ?? [] })
}
