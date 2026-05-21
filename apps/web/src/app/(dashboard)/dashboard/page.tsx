'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CalendarDays, TrendingUp, IndianRupee, AlertTriangle,
  ChevronRight, Plus, Sparkles, MapPin, Wallet,
  BarChart3, UserSquare2, Package, FileText, Truck,
  ShieldCheck, Bell, Zap, Activity, Users, CheckCircle2,
  ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { getGreeting, getGreetingEmoji } from '@/lib/greeting'
import { TenantAlertsPanel } from '@/components/intelligence/TenantAlertsPanel'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function useApiData<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!token) return
    fetch(`${API}/v1${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [token, path])
  return { data, loading }
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted/40', className)} />
}

function formatINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`
  return `₹${n}`
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Math.floor((d.getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return `In ${diff} days`
  if (diff === -1) return 'Yesterday'
  if (diff < 0 && diff > -7) return `${Math.abs(diff)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-500/15 text-gray-400',
  active:    'bg-green-500/15 text-green-400',
  completed: 'bg-blue-500/15 text-blue-400',
  cancelled: 'bg-red-500/15 text-red-400',
  on_hold:   'bg-amber-500/15 text-amber-400',
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  wedding:    'bg-pink-500/20 text-pink-300',
  corporate:  'bg-blue-500/20 text-blue-300',
  concert:    'bg-purple-500/20 text-purple-300',
  conference: 'bg-indigo-500/20 text-indigo-300',
  birthday:   'bg-yellow-500/20 text-yellow-300',
  exhibition: 'bg-cyan-500/20 text-cyan-300',
}

export default function DashboardPage() {
  const { session, profile } = useAuth()
  const token = session?.access_token ?? ''

  const { data: eventsData, loading: eventsLoading } = useApiData<any>('/events?limit=8&sort=start_date', token)
  const { data: crmData, loading: crmLoading } = useApiData<any>('/crm/leads/stats/pipeline', token)
  const { data: finData, loading: finLoading } = useApiData<any>('/finance/summary?days=30', token)
  const { data: notifData } = useApiData<any>('/notifications?limit=5&unread=true', token)
  const { data: tasksData } = useApiData<any>('/tasks?due_today=true&limit=100', token)

  const events: any[] = eventsData?.data ?? []
  const upcoming = events.filter(e => e.status === 'active' || e.status === 'draft').slice(0, 5)
  const notifications: any[] = notifData?.notifications ?? []

  const greeting = getGreeting()
  const greetingEmoji = getGreetingEmoji()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  // Context line computations
  const tasksDueToday = tasksData?.count ?? tasksData?.data?.length ?? 0
  const now = new Date()
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7)
  const eventsThisWeek = events.filter(e => {
    if (!e.start_date) return false
    const d = new Date(e.start_date)
    return d >= now && d <= weekEnd
  }).length

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {tasksDueToday > 0 ? (
              <>You have <span className="font-medium text-foreground">{tasksDueToday} task{tasksDueToday !== 1 ? 's' : ''} due today</span> · </>
            ) : null}
            <span className="font-medium text-foreground">{eventsThisWeek} event{eventsThisWeek !== 1 ? 's' : ''}</span> this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ai" className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 rounded-xl text-sm font-medium transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> AI Assistant
          </Link>
          <Link href="/events/new" className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Event
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {eventsLoading || finLoading || crmLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            {[
              { label: 'Upcoming Events', value: eventsData?.count ?? 0, sub: `${upcoming.length} active`, icon: CalendarDays, gradient: 'from-violet-500 to-purple-600', href: '/events' },
              { label: 'Pipeline Value', value: formatINR(crmData?.total_value ?? 0), sub: `${crmData?.total_leads ?? 0} open leads`, icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600', href: '/crm' },
              { label: 'Revenue (30d)', value: formatINR(finData?.total_revenue ?? 0), sub: `${finData?.paid_invoices ?? 0} paid invoices`, icon: IndianRupee, gradient: 'from-amber-500 to-orange-500', href: '/finance' },
              { label: 'Overdue', value: formatINR(finData?.overdue_amount ?? 0), sub: `${finData?.overdue_count ?? 0} invoices`, icon: AlertTriangle, gradient: (finData?.overdue_count ?? 0) > 0 ? 'from-red-500 to-rose-600' : 'from-slate-500 to-slate-600', href: '/finance' },
            ].map(({ label, value, sub, icon: Icon, gradient, href }) => (
              <Link key={href} href={href} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm', gradient)}>
                    <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Alerts requiring attention */}
      <TenantAlertsPanel />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Upcoming Events list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Upcoming Events</h2>
              </div>
              <Link href="/events" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {eventsLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex gap-3"><Sk className="w-12 h-12 rounded-xl" /><div className="flex-1 space-y-2"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/2" /></div></div>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
                <Link href="/events/new" className="text-xs text-primary hover:underline">Create your first event →</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map(event => (
                  <Link key={event.id} href={`/events/${event.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors group">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-center"
                      style={{ backgroundColor: (event.color ?? '#6366f1') + '20', borderLeft: `3px solid ${event.color ?? '#6366f1'}` }}>
                      {event.start_date ? (
                        <>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase leading-none">
                            {new Date(event.start_date).toLocaleString('en', { month: 'short' })}
                          </span>
                          <span className="text-lg font-bold leading-tight" style={{ color: event.color ?? '#6366f1' }}>
                            {new Date(event.start_date).getDate()}
                          </span>
                        </>
                      ) : <CalendarDays className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{event.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {event.event_type && (
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', EVENT_TYPE_COLOR[event.event_type] ?? 'bg-muted text-muted-foreground')}>
                            {event.event_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {event.venue_name && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{event.venue_name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[event.status] ?? STATUS_STYLE.draft)}>
                        {event.status}
                      </span>
                      {event.start_date && <span className="text-[11px] text-muted-foreground">{formatRelative(event.start_date)}</span>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Sales Pipeline</h2></div>
              <Link href="/crm" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">Full CRM <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {crmLoading ? (
              <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-8 rounded" />)}</div>
            ) : (
              <div className="p-5">
                <div className="space-y-3">
                  {(crmData?.by_stage ?? []).map((stage: any) => {
                    const pct = crmData?.total_leads > 0 ? (stage.count / crmData.total_leads) * 100 : 0
                    return (
                      <div key={stage.status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 capitalize shrink-0">{stage.status?.replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium w-6 text-right tabular-nums">{stage.count}</span>
                        <span className="text-xs text-muted-foreground w-20 text-right tabular-nums">{formatINR(stage.value ?? 0)}</span>
                      </div>
                    )
                  })}
                </div>
                {crmData?.total_value > 0 && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total pipeline</span>
                    <span className="font-semibold">{formatINR(crmData.total_value)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Event',   href: '/events/new', icon: CalendarDays, g: 'from-violet-500 to-purple-600' },
                { label: 'Add Lead',    href: '/crm',        icon: Users,       g: 'from-emerald-500 to-teal-600' },
                { label: 'New Invoice', href: '/finance',    icon: FileText,    g: 'from-amber-500 to-orange-500' },
                { label: 'AI Generate', href: '/ai',         icon: Sparkles,    g: 'from-fuchsia-500 to-violet-600' },
                { label: 'Add Vendor',  href: '/vendors',    icon: Truck,       g: 'from-sky-500 to-blue-600' },
                { label: 'Analytics',   href: '/analytics',  icon: BarChart3,   g: 'from-rose-500 to-pink-600' },
              ].map(({ label, href, icon: Icon, g }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm', g)}>
                    <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight group-hover:text-primary transition-colors">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Finance snapshot */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Finance (30d)</h2></div>
              <Link href="/finance" className="text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="w-3.5 h-3.5" /></Link>
            </div>
            {finLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-7 rounded" />)}</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Revenue', value: finData?.total_revenue ?? 0, color: 'text-green-400' },
                  { label: 'Expenses', value: finData?.total_expenses ?? 0, color: 'text-red-400' },
                  { label: 'Receivables', value: finData?.pending_amount ?? 0, color: 'text-amber-400' },
                  { label: 'Net', value: (finData?.total_revenue ?? 0) - (finData?.total_expenses ?? 0), color: 'text-violet-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn('font-semibold tabular-nums', color)}>{formatINR(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Alerts</h2></div>
              <Link href="/notifications" className="text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="w-3.5 h-3.5" /></Link>
            </div>
            {notifications.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 4).map((n: any) => (
                  <div key={n.id} className="px-4 py-3 flex gap-3 items-start">
                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                      n.type === 'alert' ? 'bg-red-400' : n.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="bg-card border border-violet-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <h2 className="text-sm font-semibold">AI Insights</h2>
            </div>
            <div className="space-y-2.5">
              {[
                { tip: 'Review staffing for events in the next 7 days.', icon: UserSquare2 },
                { tip: 'Vendor contracts pending signature need attention.', icon: Truck },
                { tip: 'Budget utilisation is trending above 75%.', icon: BarChart3 },
              ].map(({ tip, icon: Icon }, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
                  <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
            <Link href="/ai" className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium mt-4 transition-colors">
              Open AI Assistant <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Modules</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {[
            { label: 'Events', href: '/events', icon: CalendarDays },
            { label: 'CRM', href: '/crm', icon: Users },
            { label: 'Finance', href: '/finance', icon: Wallet },
            { label: 'Venues', href: '/venues', icon: MapPin },
            { label: 'Vendors', href: '/vendors', icon: Truck },
            { label: 'Guests', href: '/guests', icon: UserSquare2 },
            { label: 'Inventory', href: '/inventory', icon: Package },
            { label: 'Team', href: '/team', icon: Users },
            { label: 'Production', href: '/production', icon: Zap },
            { label: 'Analytics', href: '/analytics', icon: BarChart3 },
            { label: 'Marketing', href: '/marketing', icon: Activity },
            { label: 'Documents', href: '/documents', icon: FileText },
            { label: 'Playbooks', href: '/playbooks', icon: ShieldCheck },
            { label: 'AI', href: '/ai', icon: Sparkles },
            { label: 'Support', href: '/support', icon: Bell },
            { label: 'Settings', href: '/settings', icon: ShieldCheck },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-center group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-600/10 group-hover:from-violet-500/20 group-hover:to-purple-600/20 flex items-center justify-center transition-all">
                <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
