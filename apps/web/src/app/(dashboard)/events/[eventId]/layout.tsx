'use client'

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEvent } from '@/hooks/use-events'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn, statusColors } from '@/lib/utils'
import {
  ArrowLeft, FileText, CheckSquare, Users, Mail, Star,
  Hotel, Ticket, UtensilsCrossed, Truck, Wallet, CreditCard,
  Clock, Package, Sparkles, MessageSquare, FolderOpen,
  Download, ShieldCheck, Camera, Palette, BadgeCheck,
  ClipboardCheck, HeartPulse, AlertOctagon, Gift, ScanLine,
  Settings, Archive, ChevronLeft, ChevronRight, CalendarDays,
  Menu, X, Receipt, Zap, Globe,
  Users2, UserCheck, Link2, MessageCircle, LayoutTemplate,
} from 'lucide-react'

// ── Tab definitions (mirrors page.tsx TABS array) ─────────────────────────────

type Tab = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const TABS: Tab[] = [
  { id: 'overview',      label: 'Overview',      icon: FileText       },
  { id: 'clients',       label: 'Clients',        icon: UserCheck      },
  { id: 'team',          label: 'Team',           icon: Users2         },
  { id: 'tasks',         label: 'Tasks',          icon: CheckSquare    },
  { id: 'guests',        label: 'Guests',         icon: Users          },
  { id: 'invitations',   label: 'Invitations',    icon: Mail           },
  { id: 'rsvp',          label: 'RSVP',           icon: Star           },
  { id: 'accommodation', label: 'Accommodation',  icon: Hotel          },
  { id: 'vouchers',      label: 'Vouchers',       icon: Ticket         },
  { id: 'fnb',           label: 'F&B',            icon: UtensilsCrossed },
  { id: 'vendors',       label: 'Vendors',        icon: Truck          },
  { id: 'budget',        label: 'Budget',         icon: Wallet         },
  { id: 'payments',      label: 'Payments',       icon: CreditCard     },
  { id: 'runsheet',      label: 'Runsheet',       icon: Clock          },
  { id: 'floor-plan',    label: 'Floor Plan',     icon: Package        },
  { id: 'conference',    label: 'Conference',     icon: Sparkles       },
  { id: 'messages',      label: 'Messages',       icon: MessageSquare  },
  { id: 'documents',     label: 'Documents',      icon: FolderOpen     },
  { id: 'exports',       label: 'Exports',        icon: Download       },
  { id: 'links',         label: 'Links',          icon: Link2          },
  { id: 'permits',       label: 'Permits',        icon: ShieldCheck    },
  { id: 'media',         label: 'Media',          icon: Camera         },
  { id: 'decor',         label: 'Decor',          icon: Palette        },
  { id: 'printing',      label: 'Badges',         icon: BadgeCheck     },
  { id: 'surveys',       label: 'Surveys',        icon: ClipboardCheck },
  { id: 'feedback',      label: 'Feedback',       icon: MessageCircle  },
  { id: 'safety',        label: 'Safety',         icon: HeartPulse     },
  { id: 'contingency',   label: 'Contingency',    icon: AlertOctagon   },
  { id: 'gifts',         label: 'Gifts',          icon: Gift           },
  { id: 'checkin',       label: 'Check-in',       icon: ScanLine       },
  { id: 'gst',           label: 'GST & Tax',      icon: Receipt        },
  { id: 'settings',      label: 'Settings',       icon: Settings       },
  { id: 'whatsapp',      label: 'WhatsApp',       icon: MessageSquare  },
  { id: 'automations',   label: 'Automations',    icon: Zap            },
  { id: 'microsite',     label: 'Microsite',      icon: Globe          },
  { id: 'website',       label: 'Website',        icon: LayoutTemplate },
  { id: 'ai',            label: 'AI',             icon: Sparkles       },
]

// ── Sidebar component ─────────────────────────────────────────────────────────

function EventSidebar({
  eventId,
  collapsed,
  onToggle,
}: {
  eventId: string
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const { data: event, isLoading } = useEvent(eventId)
  const { profile } = useAuth()

  // Show post-event tab once event has ended / is completed
  const showPostEvent = !!event && (
    event.status === 'completed' ||
    (event.end_date && new Date(event.end_date) < new Date())
  )
  const visibleTabs: Tab[] = showPostEvent
    ? [...TABS, { id: 'post-event', label: 'Post-Event', icon: Archive }]
    : TABS

  const resolveHref = (tab: Tab): string | null => {
    return tab.id === 'overview'
      ? `/events/${eventId}`
      : `/events/${eventId}/${tab.id}`
  }

  const isActive = (tab: Tab): boolean => {
    if (tab.id === 'overview') {
      return pathname === `/events/${eventId}`
    }
    return (
      pathname === `/events/${eventId}/${tab.id}` ||
      pathname.startsWith(`/events/${eventId}/${tab.id}/`)
    )
  }

  // Status color pill
  const statusClass = event?.status
    ? statusColors[event.status as keyof typeof statusColors] ?? 'bg-muted text-muted-foreground'
    : ''

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 border-r border-border bg-sidebar',
        'transition-all duration-200 ease-in-out',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* ── Top: back link + event name ── */}
      <div className="px-3 pt-4 pb-3 border-b border-border space-y-3">
        {/* Back to events */}
        <Link
          href="/events"
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground',
            'transition-colors duration-150',
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>All Events</span>}
        </Link>

        {/* Event name + status */}
        {!collapsed && (
          <div className="space-y-1.5">
            {isLoading ? (
              <div className="h-4 bg-border/60 rounded animate-pulse w-3/4" />
            ) : event ? (
              <>
                <p className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
                  {event.name}
                </p>
                <div className="flex items-center gap-2">
                  {event.status && (
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize', statusClass)}>
                      {event.status}
                    </span>
                  )}
                  {event.start_date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" strokeWidth={1.5} />
                      {new Date(event.start_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Tab navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2 scrollbar-thin scrollbar-thumb-border">
        {visibleTabs.map((tab) => {
          const href = resolveHref(tab)
          const active = isActive(tab)
          const Icon = tab.icon

          const linkContent = (
            <>
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  active
                    ? 'text-primary dark:text-violet-400'
                    : 'opacity-70 group-hover:opacity-100 transition-opacity',
                )}
                strokeWidth={active ? 2 : 1.5}
              />
              {!collapsed && (
                <span className="truncate text-sm">{tab.label}</span>
              )}
            </>
          )

          const baseClass = cn(
            'flex items-center gap-2.5 px-2 py-2 rounded-lg font-medium transition-all duration-150 group w-full',
            collapsed ? 'justify-center' : '',
            active
              ? 'bg-primary/10 text-primary dark:bg-violet-500/12 dark:text-violet-400 dark:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface dark:hover:bg-white/5',
          )

          if (!href) {
            return (
              <button
                key={tab.id}
                disabled
                title={tab.label}
                className={cn(baseClass, 'opacity-50 cursor-wait')}
              >
                {linkContent}
              </button>
            )
          }

          return (
            <Link
              key={tab.id}
              href={href}
              title={collapsed ? tab.label : undefined}
              className={baseClass}
            >
              {linkContent}
            </Link>
          )
        })}
      </nav>

      {/* ── Collapse toggle ── */}
      <div className="px-2 pb-3 pt-2 border-t border-border">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs text-muted-foreground',
            'hover:text-foreground hover:bg-surface dark:hover:bg-white/5 transition-colors',
            collapsed ? 'justify-center' : '',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            : <><ChevronLeft className="w-4 h-4" strokeWidth={1.5} /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ eventId: string }>()
  const eventId = params?.eventId ?? ''
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] relative">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="h-full w-64 bg-sidebar border-r border-border shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Event Navigation</span>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-3rem)]">
            <EventSidebar
              eventId={eventId}
              collapsed={false}
              onToggle={() => {}}
            />
          </div>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex">
        <EventSidebar
          eventId={eventId}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile menu toggle */}
        <div className="md:hidden px-4 pt-3 pb-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-4 h-4" />
            <span>Event Menu</span>
          </button>
        </div>

        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
