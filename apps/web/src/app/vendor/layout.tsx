'use client'

/**
 * Vendor Portal Layout
 * Auth pages (login, register, forgot-password, reset-password) render fullscreen.
 * All other pages are wrapped in the sidebar nav layout.
 */

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, User, TrendingUp, CreditCard,
  LogOut, Menu, X, Building2, ChevronRight,
} from 'lucide-react'

const AUTH_PATHS = ['/vendor/login', '/vendor/register', '/vendor/forgot-password', '/vendor/reset-password']

const NAV = [
  { href: '/vendor/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/vendor/events',       label: 'My Events',    icon: CalendarDays },
  { href: '/vendor/profile',      label: 'Profile',      icon: User },
  { href: '/vendor/performance',  label: 'Performance',  icon: TrendingUp },
  { href: '/vendor/payments',     label: 'Payments',     icon: CreditCard },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [mobile, setMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isAuth = AUTH_PATHS.some(p => pathname?.startsWith(p))

  // Redirect to login if no session and not on auth page
  useEffect(() => {
    if (isAuth) return
    const session = typeof window !== 'undefined' ? localStorage.getItem('vp_session') : null
    if (!session) router.replace('/vendor/login')
  }, [isAuth, router])

  // Auth pages — render fullscreen without layout
  if (isAuth) return <>{children}</>

  async function handleLogout() {
    const session = localStorage.getItem('vp_session')
    if (session) {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
        await fetch(`${API}/vendor-portal/auth/logout`, {
          method: 'POST',
          headers: { 'X-Vendor-Session': session },
        })
      } catch {}
    }
    localStorage.removeItem('vp_session')
    localStorage.removeItem('vp_vendor')
    router.replace('/vendor/login')
  }

  return (
    <div className="flex h-screen bg-zinc-950 font-sans overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`
        flex flex-col w-60 bg-zinc-900 border-r border-zinc-800 shrink-0
        ${mobile ? (menuOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden') : ''}
      `}>
        {/* Logo */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">OccasionPro</p>
              <p className="text-[10px] text-cyan-400 font-medium leading-tight">Vendor Portal</p>
            </div>
          </div>
          {mobile && (
            <button onClick={() => setMenuOpen(false)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => { router.push(href); setMenuOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobile && menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setMenuOpen(true)} className="text-zinc-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm font-medium text-white">Vendor Portal</p>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
