'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

// ─── Session context ──────────────────────────────────────────────────────────
interface VendorSession {
  id: string
  name: string
  business_name?: string
  email: string
  category: string
  avatar_url?: string
}

const VendorCtx = createContext<VendorSession | null>(null)
export function useVendor() { return useContext(VendorCtx) }

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { href: '/vendor/assignments', label: 'My Assignments', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )},
  { href: '/vendor/messages', label: 'Messages', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )},
  { href: '/vendor/payments', label: 'Payments', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )},
  { href: '/vendor/performance', label: 'Performance', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )},
  { href: '/vendor/profile', label: 'Profile', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
]

export default function VendorPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [vendor, setVendor] = useState<VendorSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Don't protect auth pages
  const isAuthPage = pathname.startsWith('/vendor/auth')

  useEffect(() => {
    if (isAuthPage) { setLoading(false); return }
    const token = localStorage.getItem('vendor_session_token')
    if (!token) { router.push('/vendor/auth/login'); return }

    fetch('/api/v1/vendor-portal/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setVendor(data))
      .catch(() => { localStorage.removeItem('vendor_session_token'); router.push('/vendor/auth/login') })
      .finally(() => setLoading(false))
  }, [pathname])

  function handleLogout() {
    const token = localStorage.getItem('vendor_session_token')
    if (token) {
      fetch('/api/v1/vendor-portal/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.removeItem('vendor_session_token')
    localStorage.removeItem('vendor_id')
    router.push('/vendor/auth/login')
  }

  if (isAuthPage) return <>{children}</>

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <VendorCtx.Provider value={vendor}>
      <div className="min-h-screen bg-[#0a0a0f] flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-zinc-950 border-r border-zinc-800/60 flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          {/* Brand */}
          <div className="h-14 flex items-center gap-2.5 px-4 border-b border-zinc-800/60">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">VP</span>
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-none">Vendor Portal</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">OccasionPro</p>
            </div>
          </div>

          {/* Vendor info */}
          {vendor && (
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  {vendor.avatar_url ? (
                    <img src={vendor.avatar_url} alt={vendor.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="text-violet-300 font-semibold text-xs">{vendor.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{vendor.name}</p>
                  <p className="text-zinc-500 text-[10px] truncate">{vendor.category}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {NAV.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-zinc-800/60">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
          {/* Top bar (mobile) */}
          <header className="lg:hidden h-14 bg-zinc-950 border-b border-zinc-800/60 flex items-center px-4 gap-3">
            <button onClick={() => setMobileOpen(true)} className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-white font-medium text-sm">Vendor Portal</span>
          </header>

          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </VendorCtx.Provider>
  )
}
