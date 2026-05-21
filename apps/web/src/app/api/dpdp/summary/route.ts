import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/dpdp/summary
 * Returns DPDP (India's Digital Personal Data Protection Act) compliance summary
 * for the authenticated user's tenant.
 */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
  }

  const tenantId = profile.tenant_id

  // Fetch counts in parallel
  const [consentResult, requestsResult, retentionResult] = await Promise.all([
    supabase
      .from('consent_records')
      .select('id, consent_type, consent_given, given_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('given_at', { ascending: false })
      .limit(5),
    supabase
      .from('data_requests')
      .select('id, request_type, status, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('data_retention_policies')
      .select('*')
      .eq('tenant_id', tenantId),
  ])

  const pendingRequests = (requestsResult.data ?? []).filter(r => r.status === 'pending').length
  const totalConsents = consentResult.count ?? 0
  const activeConsents = (consentResult.data ?? []).filter(c => c.consent_given).length

  return NextResponse.json({
    summary: {
      totalConsents,
      activeConsents,
      totalDataRequests: requestsResult.count ?? 0,
      pendingRequests,
      retentionPolicies: retentionResult.data?.length ?? 0,
      complianceScore: pendingRequests === 0 ? 100 : Math.max(0, 100 - pendingRequests * 10),
    },
    recentRequests: requestsResult.data ?? [],
    recentConsents: consentResult.data ?? [],
  })
}
