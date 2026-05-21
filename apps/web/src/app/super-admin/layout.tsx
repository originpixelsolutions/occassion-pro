'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity, BarChart3, Brain, Building2, CalendarDays, CreditCard,
  FileSearch, Globe, Key, LayoutDashboard, MessageSquare,
  Package, Settings2, Shield, ShieldAlert, HeadphonesIcon, Server, ShieldCheck,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

// ─── Nav definition ───────────────────────────────────────────────────────────

const NAV = [
  {
    group: 'OVERVIEW',
    items: [
      { href: '/super-admin',                label: 'Dashboard',           icon: LayoutDashboard },
      { href: '/super-admin/tenants',        label: 'Tenants',             icon: Building2 },
      { href: '/super-admin/subscriptions',  label: 'Subscriptions',       icon: CreditCard },
      { href: '/super-admin/events',         label: 'Events',              icon: CalendarDays },
    ],
  },
  {
    group: 'SUPPORT',
    items: [
      { href: '/super-admin/support',        label: 'Support Tickets',     icon: HeadphonesIcon },
      { href: '/super-admin/dpdp',           label: 'DPDP Requests',       icon: ShieldCheck },
      { href: '/super-admin/api-approvals',  label: 'API Approvals',       icon: Key },
    ],
  },
  {
    group: 'CONFIGURATION',
    items: [
      { href: '/super-admin/intelligence',   label: 'AI / Intelligence',   icon: Brain },
      { href: '/super-admin/communications', label: 'Communications',      icon: MessageSquare },
      { href: '/super-admin/payments',       label: 'Payment Settings',    icon: Globe },
      { href: '/super-admin/settings',         label: 'Platform Settings',   icon: Settings2 },
      { href: '/super-admin/settings/api-keys', label: 'API Keys',          icon: Key },
      { href: '/super-admin/plans',          label: 'Plan Features',       icon: Package },
    ],
  },
  {
    group: 'SECURITY',
    items: [
      { href: '/super-admin/audit',          label: 'Audit Log',           icon: FileSearch },
      { href: '/super-admin/security',       label: 'Security',            icon: ShieldAlert },
    ],
  },
  {
    group: 'INFRASTRUCTURE',
    items: [
      { href: '/super-admin/system',         label: 'System Health',       icon: Server },
    ],
  },
]

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Role guard — redirect non-super-admin users
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getUser().then(({ data }) => {
      const role = (data.user?.user_metadata?.role ?? data.user?.app_metadata?.role) as string | undefined
      if (!data.user || role !== 'super_admin') {
        router.replace('/login')
      }
    })
  }, [router])

  const isActive = (href: string) =>
    href === '/super-admin' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex h-screen bg-[#060608] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-[#0a0a10] border-r border-white/[0.06] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/[0.06] shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white leading-tight tracking-wide">OccasionPro</p>
            <p className="text-[9px] text-violet-400 leading-tight font-semibold uppercase tracking-widest">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {NAV.map((group) => (
            <div key={group.group} className="mb-5">
              <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest px-2 mb-1.5">
                {group.group}
              </p>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium mb-0.5 transition-all duration-150 ${
                      active
                        ? 'bg-violet-600/20 text-violet-300 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-violet-400' : ''}`} />
                    {label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <BarChart3 className="w-3 h-3" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
