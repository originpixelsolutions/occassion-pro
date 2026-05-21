import { redirect } from 'next/navigation'

/**
 * (dashboard) group root — redirect to /dashboard.
 * The layout already handles auth; this just ensures a clean redirect.
 */
export default function DashboardGroupRoot() {
  redirect('/dashboard')
}
