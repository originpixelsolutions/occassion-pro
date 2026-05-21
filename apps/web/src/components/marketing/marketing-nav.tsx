'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/10 bg-[#09090b]/90 backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
            <span className="text-sm font-black text-white">OP</span>
          </div>
          <span className="text-base font-bold tracking-tight text-white">OccasionPro</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pathname === href
                  ? 'text-white'
                  : 'text-white/60 hover:text-white',
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:shadow-violet-500/30"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="rounded-md p-2 text-white/60 hover:text-white md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-white/10 bg-[#09090b]/95 backdrop-blur-md md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-white/10 mt-3 flex flex-col gap-2">
              <Link
                href="/auth/login"
                className="block rounded-md px-3 py-2 text-sm font-medium text-white/60 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="block rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
