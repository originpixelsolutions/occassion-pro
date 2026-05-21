import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'

/**
 * Root route `/`
 *
 * - Authenticated users → /dashboard
 * - Unauthenticated users → marketing home (rendered by (marketing)/page.tsx at the same URL)
 *
 * Next.js resolves route groups in filesystem order. This file takes
 * precedence for auth-based redirects; the (marketing) group page.tsx
 * handles the public landing page when no user is present.
 */
export default async function RootPage() {
  const user = await getUser()
  if (user) redirect('/dashboard')

  // Fall through to (marketing)/page.tsx content
  const { default: MarketingHome } = await import('./(marketing)/page')
  return <MarketingHome />
}
