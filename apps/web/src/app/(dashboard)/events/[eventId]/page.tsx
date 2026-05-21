'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEvent } from '@/hooks/use-events'
import { formatDate, formatCurrency, cn, statusColors } from '@/lib/utils'
import SmartReadinessWidget from '@/components/events/SmartReadinessWidget'
import EventTypeBadge from '@/components/events/EventTypeBadge'
import { EventHealthScore } from '@/components/intelligence/EventHealthScore'
import { AlertsList } from '@/components/intelligence/AlertsList'
import {
  ArrowLeft, CalendarDays, MapPin, Users, Wallet, FileText,
  Sparkles, Settings, CheckSquare, Truck, Package, Clock,
  Mail, Star, Hotel, Ticket, UtensilsCrossed, ShieldCheck,
  MessageSquare, FolderOpen, Camera, Palette, Printer,
  ClipboardCheck, HeartPulse, AlertOctagon, Gift, Archive,
  CreditCard, Download, BadgeCheck, ScanLine,
} from 'lucide-react'

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Override the computed href. For dynamic hrefs resolved at render time, leave
   *  undefined and handle in resolveTabHref(). */
  href?: string
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'overview',       label: 'Overview',       icon: FileText },
  { id: 'tasks',          label: 'Tasks',           icon: CheckSquare },
  { id: 'guests',         label: 'Guests',          icon: Users },
  { id: 'invitation',     label: 'Invitations',     icon: Mail },
  { id: 'rsvp',           label: 'RSVP',            icon: Star },
  { id: 'accommodation',  label: 'Accommodation',   icon: Hotel },
  { id: 'vouchers',       label: 'Vouchers',        icon: Ticket },
  { id: 'fnb',            label: 'F&B',             icon: UtensilsCrossed },
  { id: 'vendors',        label: 'Vendors',         icon: Truck },
  { id: 'budget',         label: 'Budget',          icon: Wallet },
  { id: 'payments',       label: 'Payments',        icon: CreditCard },
  { id: 'runsheet',       label: 'Runsheet',        icon: Clock },
  { id: 'floor-plan',     label: 'Floor Plan',      icon: Package },
  { id: 'conference',     label: 'Conference',      icon: Sparkles },
  { id: 'messages',       label: 'Messages',        icon: MessageSquare },
  { id: 'documents',      label: 'Documents',       icon: FolderOpen },
  { id: 'exports',        label: 'Exports',         icon: Download },
  { id: 'permits',        label: 'Permits',         icon: ShieldCheck },
  { id: 'media',          label: 'Media',           icon: Camera },
  { id: 'decor',          label: 'Décor',           icon: Palette },
  { id: 'printing',       label: 'Badges',          icon: BadgeCheck },
  { id: 'surveys',        label: 'Surveys',         icon: ClipboardCheck },
  { id: 'safety',         label: 'Safety',          icon: HeartPulse },
  { id: 'contingency',    label: 'Contingency',     icon: AlertOctagon },
  { id: 'gifts',          label: 'Gifts',           icon: Gift },
  { id: 'checkin',        label: 'Check-in',        icon: ScanLine },
  { id: 'settings',       label: 'Settings',        icon: Settings },
  { id: 'ai',             label: 'AI',              icon: Sparkles },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const { data: event, isLoading } = useEvent(eventId)

  const handleNavigateToModule = (path: string) => {
    router.push(`/events/${eventId}/${path}`)
  }

  const resolveTabHref = (tab: Tab): string => {
    if (tab.href) return tab.href
    return tab.id === 'overview' ? `/events/${eventId}` : `/events/${eventId}/${tab.id}`
  }

  // Post-Event tab is only visible once the event has ended or is completed
  const showPostEvent = !!event && (
    event.status === 'completed' ||
    (event.end_date && new Date(event.end_date) < new Date())
  )
  const visibleTabs: Tab[] = showPostEvent
    ? [...TABS, { id: 'post-event', label: 'Post-Event', icon: Archive }]
    : TABS

  // ── Loading / not-found states ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-card border border-border rounded-xl w-1/2" />
        <div className="h-32 bg-card border border-border rounded-xl" />
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground">Event not found</p>
        <Link href="/events" className="text-primary hover:underline text-sm">← Back to events</Link>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/events" className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Events
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{event.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: (event.event_type_data?.color ?? event.color ?? '#7c3aed') + '20' }}
          >
            {event.event_type_data?.icon ?? '🎪'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold">{event.name}</h1>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold capitalize', statusColors[event.status] ?? statusColors.draft)}>
                {event.status}
              </span>
              {event.event_type_data && (
                <EventTypeBadge eventType={event.event_type_data} size="sm" showIcon={false} />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {event.event_type_data?.name ?? event.event_type?.replace(/_/g, ' ')}
              {event.event_category && ` · ${event.event_category.replace(/_/g, ' ')}`}
              {event.timezone && ` · ${event.timezone}`}
              {event.currency_code && event.currency_code !== 'INR' && ` · ${event.currency_code}`}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              {event.start_date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDate(event.start_date)}
                  {event.end_date && ` – ${formatDate(event.end_date)}`}
                </span>
              )}
              {event.venue_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.venue_name}{event.city && `, ${event.city}`}
                </span>
              )}
              {event.expected_guests && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {event.expected_guests.toLocaleString()} guests
                </span>
              )}
              {event.total_budget && (
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  {formatCurrency(event.total_budget)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/events/${eventId}/settings`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </Link>
            <Link
              href={`/ai?event=${eventId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs hover:bg-violet-500/20 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Tools
            </Link>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tasks Complete',  value: `${event.completed_tasks ?? 0}/${event.total_tasks ?? 0}`, color: 'text-blue-400' },
          { label: 'Guests Confirmed', value: event.confirmed_guests ?? 0,                              color: 'text-green-400' },
          { label: 'Vendors Assigned', value: event.total_vendors ?? 0,                                 color: 'text-yellow-400' },
          { label: 'Budget Used',      value: event.budget_used_percent ? `${event.budget_used_percent}%` : '—', color: 'text-violet-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs navigation — links to sub-pages */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-border">
          {visibleTabs.map((tab) => {
            const { id, label, icon: Icon } = tab
            const href = resolveTabHref(tab)
            // Hide check-in tab while tenant slug is still loading
            if (!href) return null
            return (
              <Link
                key={id}
                href={href}
                className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-primary/50 transition-all whitespace-nowrap"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Overview content */}
        <div className="p-6 space-y-6">

          {/* Event Health + Alerts — two-column layout on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Health score ring (1/3 width) */}
            <EventHealthScore eventId={eventId} />

            {/* Active alerts (2/3 width) */}
            <div className="md:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <span className="text-sm font-medium text-white/70">Active Alerts</span>
              </div>
              <div className="p-4">
                <AlertsList eventId={eventId} maxVisible={6} />
              </div>
            </div>
          </div>

          {/* Smart Readiness Widget */}
          <SmartReadinessWidget
            eventId={eventId}
            refreshInterval={30000}
            onNavigateToModule={handleNavigateToModule}
          />

          {/* Description + Notes */}
          <div className="space-y-4">
            {event.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description added yet.</p>
            )}

            {event.notes && (
              <div className="p-4 bg-background rounded-xl border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                <p className="text-sm leading-relaxed">{event.notes}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
