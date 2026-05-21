import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/public/data-requests
 * Submits a DPDP data subject request (access, correction, erasure, portability, grievance).
 * Public endpoint — no auth required, accepts guest email + request type.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { email, request_type, description, tenant_id } = body as {
    email: string
    request_type: string
    description?: string
    tenant_id?: string
  }

  if (!email || !request_type) {
    return NextResponse.json({ error: 'email and request_type are required' }, { status: 400 })
  }

  const VALID_TYPES = ['access', 'correction', 'erasure', 'portability', 'grievance', 'nomination']
  if (!VALID_TYPES.includes(request_type)) {
    return NextResponse.json({ error: 'Invalid request_type' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('data_requests')
    .insert({
      email,
      request_type,
      description,
      tenant_id,
      status: 'pending',
      ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[public/data-requests]', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  return NextResponse.json({ success: true, request_id: data.id })
}
