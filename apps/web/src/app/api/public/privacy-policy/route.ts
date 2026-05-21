import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/public/privacy-policy?tenant_id=<uuid>
 * Returns the privacy policy / data processing summary for a tenant.
 * Used on the public data rights page and consent flows.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, privacy_policy_url, dpo_email, dpo_name')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Return static policy info + contact details
  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    privacy_policy_url: tenant.privacy_policy_url ?? null,
    dpo_contact: {
      name: tenant.dpo_name ?? 'Data Protection Officer',
      email: tenant.dpo_email ?? `privacy@${tenant.slug}.occasionpro.in`,
    },
    data_categories: [
      'Name and contact details',
      'Event attendance and RSVP information',
      'Dietary and accessibility preferences',
      'Accommodation bookings',
      'Transaction and payment records',
    ],
    purposes: [
      'Event management and coordination',
      'Guest communication and invitations',
      'Safety and emergency contact requirements',
      'Legal and regulatory compliance',
    ],
    retention_period: '3 years after event completion, or as required by law',
    rights: ['Access', 'Correction', 'Erasure', 'Portability', 'Grievance'],
  })
}
