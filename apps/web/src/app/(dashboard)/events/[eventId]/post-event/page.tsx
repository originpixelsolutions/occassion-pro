'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckSquare, Users, DollarSign, Briefcase, Heart, BarChart2,
  FileText, Star, Archive, MessageCircle, Clock, ChevronRight,
} from 'lucide-react'
import { usePostEventStatus } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const MODULES = [
  {
    id: 'checklist',
    label: 'Wrap-Up Checklist',
    description: 'Track all post-event tasks',
    icon: CheckSquare,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    statusKey: 'checklist_progress',
  },
  {
    id: 'headcount',
    label: 'Headcount Recon',
    description: 'Confirm final attendance numbers',
    icon: Users,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    statusKey: 'headcount_done',
  },
  {
    id: 'budget',
    label: 'Budget Reconciliation',
    description: 'Final budget vs actuals review',
    icon: DollarSign,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    statusKey: 'budget_finalized',
  },
  {
    id: 'vendors',
    label: 'Vendor Settlements',
    description: 'Settle all vendor payments',
    icon: Briefcase,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    statusKey: 'settlements_progress',
  },
  {
    id: 'thankyou',
    label: 'Thank-You Messages',
    description: 'Send gratitude to guests & team',
    icon: Heart,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    statusKey: 'thank_you_sent',
  },
  {
    id: 'surveys',
    label: 'Feedback Surveys',
    description: 'Collect post-event feedback',
    icon: BarChart2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    statusKey: 'surveys_sent',
  },
  {
    id: 'report',
    label: 'Event Report',
    description: 'Generate internal & client reports',
    icon: FileText,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    statusKey: 'report_generated',
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    description: 'Collect & manage testimonials',
    icon: Star,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    statusKey: 'testimonials_collected',
  },
  {
    id: 'archive',
    label: 'Archive Event',
    description: 'Finalize & archive all data',
    icon: Archive,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    statusKey: 'archived',
  },
]

function CircularProgress({ value }: { value: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={value === 100 ? '#10b981' : '#6366f1'}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-white">{value}%</div>
        <div className="text-[10px] text-white/50 uppercase tracking-wider">complete</div>
      </div>
    </div>
  )
}

function ModuleCard({ mod, status, eventId }: { mod: typeof MODULES[0]; status: any; eventId: string }) {
  const Icon = mod.icon
  const statusVal = status?.[mod.statusKey]
  const done = statusVal === true || statusVal === 100
  const progress = typeof statusVal === 'number' ? statusVal : done ? 100 : 0

  return (
    <Link
      href={`/events/${eventId}/post-event/${mod.id}`}
      className={cn(
        'group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200',
        'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]',
      )}
    >
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', mod.bg)}>
        <Icon className={cn('w-5 h-5', mod.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{mod.label}</span>
          {done && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
              Done
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5">{mod.description}</p>
        {typeof statusVal === 'number' && (
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden w-full">
            <div
              className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 flex-shrink-0 transition-colors" />
    </Link>
  )
}

export default function PostEventHubPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data: status, isLoading } = usePostEventStatus(tenant, eventId)

  const overallPct = status?.overall_completion_pct ?? 0
  const completedCount = status?.completed_modules ?? 0
  const totalModules = MODULES.length

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">Post-Event Wrap-Up</h1>
          <p className="text-white/40 text-sm mt-1">Complete all tasks to fully close out this event</p>
        </div>

        {/* Progress summary */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex items-center gap-8">
          <CircularProgress value={isLoading ? 0 : overallPct} />
          <div className="flex-1 space-y-4">
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Modules completed</div>
              <div className="text-3xl font-bold text-white">
                {completedCount}
                <span className="text-white/30 text-xl font-normal"> / {totalModules}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Checklist', key: 'checklist_pct', suffix: '%' },
                { label: 'Settlements', key: 'settlements_pct', suffix: '%' },
                { label: 'Reports', key: 'reports_count', suffix: ' reports' },
              ].map(s => (
                <div key={s.key} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                  <div className="text-white/40 text-xs mb-0.5">{s.label}</div>
                  <div className="text-lg font-semibold text-white">
                    {status?.[s.key] ?? 0}{s.suffix}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modules grid */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider px-1">Modules</h2>
          <div className="grid grid-cols-1 gap-2">
            {MODULES.map(mod => (
              <ModuleCard key={mod.id} mod={mod} status={status} eventId={eventId} />
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
          <Clock className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-indigo-300/70">
            Complete the checklist, reconcile budgets, settle vendors, and generate reports before archiving.
            Once archived, the event is locked and read-only.
          </p>
        </div>

      </div>
    </div>
  )
}
