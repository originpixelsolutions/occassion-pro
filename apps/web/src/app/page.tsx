import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'

/**
 * Root route `/`
 *
 * - Authenticated users → /dashboard
 * - Unauthenticated users → /about (marketing landing)
 */
export default async function RootPage() {
  const user = await getUser()
  if (user) redirect('/dashboard')
  redirect('/about')
}
