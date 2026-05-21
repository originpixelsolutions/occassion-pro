import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
}

/**
 * GET /api/notifications/preferences
 * GET /api/notifications/preferences/global  (same handler, different semantics handled by client)
 * Returns the user's notification preferences.
 */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return defaults if no preferences set yet
  const defaults = {
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
    whatsapp_enabled: false,
    event_updates: true,
    task_reminders: true,
    guest_activity: true,
    payment_alerts: true,
    team_mentions: true,
    system_alerts: true,
  }

  return NextResponse.json({ preferences: data ?? defaults })
}

/**
 * PATCH /api/notifications/preferences
 * Updates the user's notification preferences.
 */
export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...body, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ preferences: data })
}
