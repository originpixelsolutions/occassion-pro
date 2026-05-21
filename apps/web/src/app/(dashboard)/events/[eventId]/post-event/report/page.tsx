'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, Download, Clock, Eye, Users, Building2 } from 'lucide-react'
import { usePostEventReports, useGenerateReport } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const REPORT_TYPES = [
  {
    type: 'internal' as const,
    label: 'Internal Report',
    description: 'Detailed operational report for your team — budget breakdown, staff performance, vendor settlements, lessons learned.',
    icon: Building2,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  {
    type: 'client' as const,
    label: 'Client Report',
    description: 'Executive summary for the client — highlights, attendance, ROI snapshot, testimonials, and photo gallery link.',
    icon: Users,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
]

function ReportCard({ report }: { report: any }) {
  const isInternal = report.report_type === 'internal'
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-colors">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isInternal ? 'bg-indigo-500/10' : 'bg-violet-500/10')}>
        <FileText className={cn('w-5 h-5', isInternal ? 'text-indigo-400' : 'text-violet-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white capitalize">{report.report_type} Report</span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded border font-medium',
            isInternal ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-violet-400 bg-violet-500/10 border-violet-500/20',
          )}>
            v{report.version ?? 1}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(report.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {report.generated_by_name && (
            <span className="text-xs text-white/30">by {report.generated_by_name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {report.report_url && (
          <a
            href={report.report_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/50 border border-white/[0.08] hover:bg-white/[0.05]"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </a>
        )}
        {report.report_url && (
          <a
            href={report.report_url}
            download
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        )}
      </div>
    </div>
  )
}

export default function PostEventReportPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = usePostEventReports(tenant, eventId)
  const generate = useGenerateReport(tenant, eventId)
  const [generating, setGenerating] = useState<string | null>(null)

  const reports: any[] = data?.reports ?? []

  function handleGenerate(type: 'internal' | 'client') {
    setGenerating(type)
    generate.mutate({ report_type: type }, { onSettled: () => setGenerating(null) })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Event Report</h1>
          <p className="text-white/40 text-sm mt-0.5">Generate comprehensive reports for internal review and client delivery</p>
        </div>

        {/* Generate options */}
        <div className="grid grid-cols-2 gap-4">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon
            const isRunning = generate.isPending && generating === rt.type
            return (
              <div key={rt.type} className={cn('rounded-2xl border p-5 space-y-4', rt.border, rt.bg)}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', rt.bg, 'border', rt.border)}>
                    <Icon className={cn('w-5 h-5', rt.color)} />
                  </div>
                  <h3 className={cn('text-base font-semibold', rt.color)}>{rt.label}</h3>
                </div>
                <p className="text-sm text-white/50">{rt.description}</p>
                <button
                  onClick={() => handleGenerate(rt.type)}
                  disabled={generate.isPending}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-sm font-medium transition-all',
                    'border flex items-center justify-center gap-2',
                    rt.color, rt.border,
                    'hover:bg-white/[0.05] disabled:opacity-50',
                  )}
                >
                  {isRunning ? (
                    <>Generating…</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Generate {rt.label}</>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Report includes */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-medium text-white/60 mb-4">Report Contents</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-indigo-400 font-medium mb-2 uppercase tracking-wider">Internal Report</div>
              <ul className="space-y-1 text-white/40 text-xs">
                {['Event overview & timeline', 'Full budget vs actual breakdown', 'Vendor settlement summary', 'Staff roster & performance notes', 'Headcount reconciliation', 'Operational issues & resolutions', 'Lessons learned & recommendations'].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">·</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs text-violet-400 font-medium mb-2 uppercase tracking-wider">Client Report</div>
              <ul className="space-y-1 text-white/40 text-xs">
                {['Executive highlights', 'Final attendance & headcount', 'Highlights & key moments', 'Guest satisfaction scores', 'Testimonials & feedback excerpts', 'Thank-you message delivery stats', 'ROI summary & next event CTA'].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-violet-500 mt-0.5">·</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Generated reports */}
        {(reports.length > 0 || isLoading) && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">Generated Reports</h2>
            {isLoading ? (
              [...Array(2)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />
              ))
            ) : (
              reports.map((r: any) => <ReportCard key={r.id} report={r} />)
            )}
          </div>
        )}

      </div>
    </div>
  )
}
