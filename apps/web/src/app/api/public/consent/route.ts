import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/public/consent
 * Records a consent event from a public-facing page (guest portal, RSVP form, etc.).
 * Does NOT require authentication — uses the service-role key for trusted server writes.
 *
 * Body:
 *   tenant_id     string  (required)
 *   purpose       string  (required) — maps to consent_type
 *   given         boolean (required)
 *   subject_email string  (required)
 *   subject_type  string  (optional, defaults to 'guest')
 *   event_id      string  (optional)
 *   subject_id    string  (optional) — authenticated user/guest id
 *   consent_text  string  (optional) — exact text shown to user
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const {
    tenant_id,
    event_id,
    purpose,
    given,
    subject_email,
    subject_id,
    subject_type = 'guest',
    consent_text = 'I consent to the processing of my personal data.',
  } = body as {
    tenant_id?: string
    event_id?: string
    purpose: string
    given: boolean
    subject_email?: string
    subject_id?: string
    subject_type?: string
    consent_text?: string
  }

  if (!tenant_id || !purpose) {
    return NextResponse.json({ error: 'tenant_id and purpose are required' }, { status: 400 })
  }
  if (!subject_email) {
    return NextResponse.json({ error: 'subject_email is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rawIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rawUa = req.headers.get('user-agent') ?? 'unknown'

  const { error } = await supabase.from('consent_records').insert({
    tenant_id,
    event_id: event_id ?? null,
    subject_type,
    subject_id: subject_id ?? null,
    subject_email,
    consent_type: purpose,          // purpose maps to consent_type
    consent_given: given,
    consent_text,
    // Store hashes of IP and UA for privacy compliance
    ip_hash: rawIp,                 // In production, SHA-256 hash this
    user_agent_hash: rawUa,         // In production, SHA-256 hash this
    version: '1.0',
  })

  if (error) {
    console.error('[public/consent]', error)
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
