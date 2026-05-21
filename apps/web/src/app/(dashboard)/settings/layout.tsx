'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Settings, CreditCard, Users, Bell, Palette,
  Globe, Webhook, Key, Shield, ShieldCheck, Lock, CalendarDays,
} from 'lucide-react'

// ── Nav items ─────────────────────────────────────────────────────────────────

const SETTINGS_NAV = [
  { label: 'General',        href: '/settings',                    icon: Settings     },
  { label: 'Billing',        href: '/settings/billing',            icon: CreditCard   },
  { label: 'Team',           href: '/settings/team',               icon: Users        },
  { label: 'Roles',          href: '/settings/roles',              icon: Shield       },
  { label: 'Event Types',    href: '/settings/event-types',        icon: CalendarDays },
  { label: 'Notifications',  href: '/settings/notifications',      icon: Bell         },
  { label: 'Branding',       href: '/settings/branding',           icon: Palette      },
  { label: 'Gateways',       href: '/settings/gateways',           icon: Webhook      },
  { label: 'Custom Domain',  href: '/settings/custom-domain',      icon: Globe        },
  { label: 'API Keys',       href: '/settings/api',                icon: Key          },
  { label: 'Security',       href: '/settings/security',           icon: Lock         },
  { label: 'Data & Privacy', href: '/settings/dpdp',               icon: ShieldCheck  },
]

// ── Layout ────────────────────────────────────────────────────────────────────

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/settings'
      ? pathname === '/settings'
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex gap-8 min-h-[calc(100vh-4rem)]">
      {/* ── Left nav ── */}
      <aside className="w-52 shrink-0 pt-1">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
          Settings
        </p>
        <nav className="space-y-0.5">
          {SETTINGS_NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                  active
                    ? 'bg-primary/10 text-primary dark:bg-violet-500/12 dark:text-violet-400 dark:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface dark:hover:bg-white/5',
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    active
                      ? 'text-primary dark:text-violet-400'
                      : 'opacity-70 group-hover:opacity-100 transition-opacity',
                  )}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Page content ── */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
