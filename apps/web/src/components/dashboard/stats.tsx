'use client'
import { useDashboardStats } from '@/hooks/use-events'
import { formatCurrency } from '@/lib/utils'
import { CalendarDays, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DashboardStats() {
  const { data: stats, isLoading } = useDashboardStats()

  const cards = [
    {
      label: 'Upcoming Events',
      value: isLoading ? '—' : stats?.upcoming_events ?? 0,
      icon: CalendarDays,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      change: '+2 this week',
    },
    {
      label: 'In Progress',
      value: isLoading ? '—' : stats?.in_progress_events ?? 0,
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      change: 'Active now',
    },
    {
      label: 'Completed (30d)',
      value: isLoading ? '—' : stats?.completed_this_month ?? 0,
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      change: 'This month',
    },
    {
      label: 'Revenue (30d)',
      value: isLoading ? '—' : formatCurrency(stats?.revenue_this_month ?? 0),
      icon: TrendingUp,
      color: 'text-violet-400',
      bg: 'bg-violet-400/10',
      change: 'This month',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg, change }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{change}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
