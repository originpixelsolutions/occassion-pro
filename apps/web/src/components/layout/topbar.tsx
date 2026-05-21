'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationBell } from '@/components/notifications'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':       { title: 'Dashboard',          sub: 'Overview & quick actions' },
  '/events':          { title: 'Events',             sub: 'Manage all events' },
  '/crm':             { title: 'CRM & Sales',        sub: 'Pipeline & leads' },
  '/finance':         { title: 'Finance',            sub: 'Invoices, expenses & P&L' },
  '/venues':          { title: 'Venues',             sub: 'Venue management' },
  '/vendors':         { title: 'Vendors',            sub: 'Vendor network' },
  '/inventory':       { title: 'Inventory',          sub: 'Warehouse & equipment' },
  '/guests':          { title: 'Guests',             sub: 'RSVP & check-in' },
  '/team':            { title: 'Team',               sub: 'Workforce management' },
  '/microsites':      { title: 'Microsites',         sub: 'Event landing pages' },
  '/analytics':       { title: 'Analytics',          sub: 'Business intelligence' },
  '/ai':              { title: 'AI Assistant',       sub: 'Powered by OccasionPro AI' },
  '/command-center':  { title: 'Command Center',     sub: 'Live operations' },
  '/orchestration':   { title: 'Orchestration',      sub: 'Multi-event management' },
  '/production':      { title: 'Production',         sub: 'Production & logistics' },
  '/hospitality':     { title: 'Hospitality',        sub: 'Accommodation & services' },
  '/artists':         { title: 'Artists',            sub: 'Talent management' },
  '/workforce':       { title: 'Workforce',          sub: 'Staff scheduling' },
  '/marketing':       { title: 'Marketing',          sub: 'Campaigns & leads' },
  '/support':         { title: 'Support',            sub: 'Help & ticketing' },
  '/integrations':    { title: 'Integrations',       sub: 'API & webhooks' },
  '/playbooks':       { title: 'Playbooks',          sub: 'Templates & runbooks' },
  '/documents':       { title: 'Documents',          sub: 'Proposals & contracts' },
  '/roles':           { title: 'Roles & Permissions', sub: 'Access control' },
  '/settings':        { title: 'Settings',           sub: 'Account & preferences' },
  '/notifications':   { title: 'Notifications',      sub: 'Inbox & alerts' },
  '/client-portal':   { title: 'Client Portal',      sub: 'Client collaboration' },
}

export function TopBar() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const baseKey = '/' + segments[0]
  const page = PAGE_TITLES[baseKey] ?? { title: segments[0] ?? 'OccasionPro', sub: '' }

  return (
    <header className="h-14 flex items-center gap-3 px-6 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold leading-tight truncate">{page.title}</h1>
        {page.sub && <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{page.sub}</p>}
      </div>

      {/* Global search */}
      <button className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all min-w-[180px] group">
        <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
        <span>Search…</span>
        <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono border border-border">⌘K</kbd>
      </button>

      {/* Notifications — real-time bell with drawer */}
      <NotificationBell />

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  )
}
