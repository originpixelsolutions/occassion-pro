import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/notifications/test
 * Sends a test notification to the authenticated user (dev/settings use only).
 */
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { channel = 'in_app' } = (await req.json().catch(() => ({}))) as { channel?: string }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { error } = await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'system',
    title: 'Test Notification',
    body: `This is a test ${channel} notification from OccasionPro. Your notification settings are working correctly.`,
    read: false,
    created_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, channel })
}
