'use client'
import { use } from 'react'
import Link from 'next/link'
import { useConferenceDashboard, useConferenceSettings, useUpdateConferenceSettings } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Ticket, Users, Mic2, CalendarClock, Building2, Award,
  MessageSquare, BarChart3, GraduationCap, Network, Settings,
  TrendingUp, CheckCircle2, ArrowRight, Sparkles, ToggleLeft, ToggleRight,
} from 'lucide-react'

const MODULES = [
  { id: 'tickets',     label: 'Ticketing',      icon: Ticket,        color: 'text-violet-400', bg: 'bg-violet-500/10', desc: 'Ticket types, sales & pricing' },
  { id: 'registrations', label: 'Registrations', icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10',   desc: 'Attendees, check-in & badging' },
  { id: 'speakers',    label: 'Speakers',        icon: Mic2,          color: 'text-green-400',  bg: 'bg-green-500/10',  desc: 'Speaker profiles & sessions' },
  { id: 'agenda',      label: 'Agenda',          icon: CalendarClock, color: 'text-amber-400',  bg: 'bg-amber-500/10',  desc: 'Sessions, tracks & rooms' },
  { id: 'sponsors',    label: 'Sponsors',        icon: Award,         color: 'text-yellow-400', bg: 'bg-yellow-500/10', desc: 'Sponsor tiers & packages' },
  { id: 'exhibitors',  label: 'Exhibitors',      icon: Building2,     color: 'text-orange-400', bg: 'bg-orange-500/10', desc: 'Exhibition booths & floor plan' },
  { id: 'live',        label: 'Live Features',   icon: MessageSquare, color: 'text-red-400',    bg: 'bg-red-500/10',    desc: 'Q&A, polls & announcements' },
  { id: 'networking',  label: 'Networking',      icon: Network,       color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   desc: 'Attendee connections & meetings' },
  { id: 'ceu',         label: 'CEU Credits',     icon: GraduationCap, color: 'text-pink-400',   bg: 'bg-pink-500/10',   desc: 'Continuing education tracking' },
]

export default function ConferenceHubPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: dashboard, isLoading } = useConferenceDashboard(tenant, eventId)
  const { data: settings } = useConferenceSettings(tenant, eventId)
  const updateSettings = useUpdateConferenceSettings(tenant, eventId)

  const stats = dashboard?.stats ?? {}
  const enabled = settings?.is_enabled ?? false

  const STAT_CARDS = [
    { label: 'Total Registrations', value: stats.total_registrations ?? 0, sub: `${stats.confirmed_registrations ?? 0} confirmed`, color: 'text-blue-400' },
    { label: 'Checked In', value: stats.checked_in ?? 0, sub: `of ${stats.confirmed_registrations ?? 0}`, color: 'text-green-400' },
    { label: 'Sessions',  value: stats.total_sessions ?? 0, sub: `${stats.live_sessions ?? 0} live now`, color: 'text-amber-400' },
    { label: 'Speakers',  value: stats.total_speakers ?? 0, sub: `${stats.confirmed_speakers ?? 0} confirmed`, color: 'text-violet-400' },
    { label: 'Sponsors',  value: stats.total_sponsors ?? 0, sub: 'active', color: 'text-yellow-400' },
    { label: 'Revenue',   value: formatCurrency(stats.estimated_revenue ?? 0), sub: `+ ${formatCurrency(stats.sponsor_revenue ?? 0)} sponsorship`, color: 'text-green-400' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-card border border-border rounded-xl w-1/3" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}
        </div>
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" /> Conference Hub
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Full conference operations in one place</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateSettings.mutate({ is_enabled: !enabled })}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              enabled
                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {enabled ? 'Conference Active' : 'Activate Conference'}
          </button>
          <Link
            href={`/events/${eventId}/conference/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Settings
          </Link>
        </div>
      </div>

      {/* Enable banner */}
      {!enabled && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Conference mode is disabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enable to unlock ticketing, registrations, sessions, speakers, and live features</p>
            </div>
          </div>
          <button
            onClick={() => updateSettings.mutate({ is_enabled: true })}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-colors"
          >
            Enable Now
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Feature toggles */}
      {enabled && settings && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Feature Flags</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: 'ticketing_enabled', label: 'Ticketing' },
              { key: 'live_qa_enabled', label: 'Live Q&A' },
              { key: 'polling_enabled', label: 'Polls' },
              { key: 'networking_enabled', label: 'Networking' },
              { key: 'ceu_tracking_enabled', label: 'CEU Tracking' },
            ].map(({ key, label }) => {
              const isOn = settings[key] ?? false
              return (
                <button
                  key={key}
                  onClick={() => updateSettings.mutate({ [key]: !isOn })}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                    isOn
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                      : 'bg-background border-border text-muted-foreground'
                  )}
                >
                  {isOn ? <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-border" />}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map(({ id, label, icon: Icon, color, bg, desc }) => (
          <Link
            key={id}
            href={`/events/${eventId}/conference/${id}`}
            className="group bg-card border border-border rounded-xl p-5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                <Icon className={cn('w-5 h-5', color)} />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-sm font-semibold mt-3">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" /> Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <Link href={`/events/${eventId}/conference/registrations?action=checkin`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/20 transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" /> Check In Attendee
          </Link>
          <Link href={`/events/${eventId}/conference/registrations?action=add`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/20 transition-colors">
            <Users className="w-3.5 h-3.5" /> Add Registration
          </Link>
          <Link href={`/events/${eventId}/conference/live`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Go Live
          </Link>
          <Link href={`/events/${eventId}/conference/agenda?action=session`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs hover:bg-amber-500/20 transition-colors">
            <CalendarClock className="w-3.5 h-3.5" /> Add Session
          </Link>
          <a
            href={`/api/tenant/events/${eventId}/conference/registrations/export`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-muted-foreground rounded-lg text-xs hover:text-foreground transition-colors"
          >
            Export Registrations CSV
          </a>
        </div>
      </div>
    </div>
  )
}
