'use client'
import Link from 'next/link'
import { useEvents } from '@/hooks/use-events'
import { formatDate, cn, statusColors } from '@/lib/utils'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'

export function RecentEvents() {
  const { data, isLoading } = useEvents()
  const events = data?.data?.slice(0, 6) ?? []

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent Events</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/events/new"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus className="w-3 h-3" /> New Event
          </Link>
          <Link href="/events" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-5 py-12 text-center text-muted-foreground text-sm">
          No events yet. <Link href="/events/new" className="text-primary hover:underline">Create your first event →</Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {events.map((event: any) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
            >
              <div
                className="w-1 h-10 rounded-full shrink-0"
                style={{ backgroundColor: event.color ?? '#7c3aed' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{event.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.start_date ? formatDate(event.start_date) : 'Date TBD'}
                  {event.venue_name && ` · ${event.venue_name}`}
                </p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', statusColors[event.status] ?? statusColors.draft)}>
                {event.status}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
