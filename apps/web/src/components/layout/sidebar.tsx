'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutDashboard, CalendarDays, Users, Wallet, Building2,
  Truck, Package, UserSquare2, Sparkles, Settings, ChevronRight,
  Globe, Bell, LogOut, BarChart3, Terminal, Music2,
  Utensils, Link2, HardHat, TrendingUp, LifeBuoy, Crosshair, Webhook, BookMarked, FileText,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { getInitials } from '@/lib/utils'

// ── Role-based visibility ──────────────────────────────────────────────────────
// Lists hrefs that are hidden for each role. Unlisted roles (workspace_owner,
// super_admin) see everything. Roles not present in this map see everything too.
const HIDDEN_FOR_ROLE: Record<string, string[]> = {
  team_member:   ['/finance', '/analytics', '/ai', '/integrations', '/roles', '/settings'],
  event_manager: ['/integrations', '/roles'],
  team_lead:     ['/roles'],
}

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { label: 'Dashboard',     href: '/dashboard',      icon: LayoutDashboard },
      { label: 'Events',        href: '/events',         icon: CalendarDays },
      { label: 'CRM',           href: '/crm',            icon: Users },
      { label: 'Finance',       href: '/finance',        icon: Wallet },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Venues',        href: '/venues',         icon: Building2 },
      { label: 'Vendors',       href: '/vendors',        icon: Truck },
      { label: 'Inventory',     href: '/inventory',      icon: Package },
      { label: 'Guests',        href: '/guests',         icon: Users },
      { label: 'Team',          href: '/team',           icon: UserSquare2 },
      { label: 'Production',    href: '/production',     icon: Package },
      { label: 'Hospitality',   href: '/hospitality',    icon: Utensils },
      { label: 'Artists',       href: '/artists',        icon: Music2 },
      { label: 'Workforce',     href: '/workforce',      icon: HardHat },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics',     href: '/analytics',      icon: BarChart3 },
      { label: 'Command Center',href: '/command-center', icon: Terminal },
      { label: 'Orchestration', href: '/orchestration',  icon: Crosshair },
      { label: 'AI Assistant',  href: '/ai',             icon: Sparkles, highlight: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Microsites',    href: '/microsites',     icon: Globe },
      { label: 'Marketing',     href: '/marketing',      icon: TrendingUp },
      { label: 'Client Portal', href: '/client-portal',  icon: Link2 },
      { label: 'Support',       href: '/support',        icon: LifeBuoy },
      { label: 'Integrations',  href: '/integrations',   icon: Webhook },
      { label: 'Playbooks',     href: '/playbooks',      icon: BookMarked },
      { label: 'Documents',     href: '/documents',      icon: FileText },
      { label: 'Roles & Perms', href: '/roles',          icon: ShieldCheck },
    ],
  },
]

const BOTTOM_NAV = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Settings',      href: '/settings',      icon: Settings },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')

  // Compute which hrefs this role should not see
  const hiddenHrefs = new Set<string>(
    profile?.role ? (HIDDEN_FOR_ROLE[profile.role] ?? []) : []
  )

  return (
    <aside className={cn(
      'w-[220px] shrink-0 flex flex-col h-full',
      'bg-card dark:bg-[#0c0c12] border-r border-border',
      'transition-colors duration-200',
    )}>
      {/* ── Logo ── */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center gradient-logo shrink-0">
          <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-sm tracking-tight text-gradient-primary">OccasionPro</span>
      </div>

      {/* ── Scrollable nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(({ href }) => !hiddenHrefs.has(href))
          if (!visibleItems.length) return null
          return (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {visibleItems.map(({ label, href, icon: Icon, highlight }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium',
                      'transition-all duration-150 group relative',
                      active
                        ? 'bg-primary/10 text-primary dark:bg-violet-500/12 dark:text-violet-400 dark:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)]'
                        : highlight
                          ? 'text-amber-500 dark:text-amber-400 hover:bg-amber-500/8 dark:hover:bg-amber-400/8'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface dark:hover:bg-white/5',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0',
                        active
                          ? 'text-primary dark:text-violet-400'
                          : highlight
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'opacity-70 group-hover:opacity-100 transition-opacity',
                      )}
                      strokeWidth={active ? 2 : 1.5}
                    />
                    <span className="truncate">{label}</span>
                    {active && (
                      <ChevronRight className="w-3 h-3 ml-auto opacity-60 shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      {/* ── Bottom nav ── */}
      <div className="px-2 py-2 space-y-0.5 border-t border-border">
        {BOTTOM_NAV.filter(({ href }) => !hiddenHrefs.has(href)).map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium',
                'transition-all duration-150',
                active
                  ? 'bg-primary/10 text-primary dark:bg-violet-500/12 dark:text-violet-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface dark:hover:bg-white/5',
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0 opacity-80" strokeWidth={1.5} />
              {label}
            </Link>
          )
        })}
      </div>

      {/* ── User profile ── */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
            {profile?.full_name ? getInitials(profile.full_name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{profile?.full_name ?? 'Loading…'}</p>
            <p className="text-[10px] text-muted-foreground truncate capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-danger transition-colors p-1 rounded-md hover:bg-danger/10"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
