import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getUser, getSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { ThemeInit } from '@/components/providers/theme-init'
import { TrialBanner, PaywallModal } from '@/components/subscription'
import { SupportWidget } from '@/components/support'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  // ── Onboarding redirect ──────────────────────────────────────────────────
  // The middleware injects x-pathname so we can detect the current route.
  // We skip the onboarding check when already on /onboarding to avoid
  // an infinite redirect loop.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isOnboardingPage = pathname === '/onboarding' || pathname.startsWith('/onboarding')

  if (!isOnboardingPage) {
    try {
      const supabase = await getSupabaseServerClient()

      // Resolve tenant_id from the user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      if (profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('onboarding_completed_at')
          .eq('id', profile.tenant_id)
          .single()

        // NULL = not yet onboarded → redirect to wizard
        if (tenant && tenant.onboarding_completed_at === null) {
          redirect('/onboarding')
        }
      }
    } catch {
      // Column may not exist in dev yet (migration not run) — allow access
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Silently syncs theme preference from DB on first render */}
      <ThemeInit />

      {/* Primary navigation sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* Trial / subscription warning banner */}
        <TrialBanner />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global modals rendered at root level */}
      <PaywallModal />

      {/* Support chat widget */}
      <SupportWidget />
    </div>
  )
}
