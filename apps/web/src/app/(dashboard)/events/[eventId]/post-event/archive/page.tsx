'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Archive, Lock, CheckCircle, AlertTriangle, Download,
  FileText, Users, DollarSign, Briefcase, BarChart2, Star,
} from 'lucide-react'
import { useArchiveStatus, useArchiveEvent } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const ARCHIVE_CHECKLIST = [
  { key: 'checklist_complete', label: 'Wrap-up checklist complete', icon: CheckCircle },
  { key: 'budget_finalized', label: 'Budget reconciliation finalized', icon: DollarSign },
  { key: 'settlements_done', label: 'All vendor settlements paid', icon: Briefcase },
  { key: 'report_generated', label: 'Event report generated', icon: FileText },
  { key: 'thank_you_sent', label: 'Thank-you messages sent', icon: Users },
  { key: 'surveys_sent', label: 'Feedback surveys sent', icon: BarChart2 },
  { key: 'testimonials_collected', label: 'Testimonials collected', icon: Star },
]

const DATA_INCLUDED = [
  'Full event details & timeline',
  'Complete guest list & attendance records',
  'Budget & financial transactions',
  'Vendor contracts & settlement records',
  'Staff roster & shift logs',
  'All generated documents & reports',
  'Feedback survey results',
  'Testimonials & media',
  'Communication logs',
  'Audit trail',
]

export default function ArchivePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = useArchiveStatus(tenant, eventId)
  const archive = useArchiveEvent(tenant, eventId)

  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const status = data ?? {}
  const isArchived = status.is_archived ?? false
  const archivedAt = status.archived_at
  const readiness = status.readiness ?? {}
  const allReady = ARCHIVE_CHECKLIST.every(c => readiness[c.key])
  const readyCount = ARCHIVE_CHECKLIST.filter(c => readiness[c.key]).length

  function handleArchive() {
    archive.mutate(undefined, { onSuccess: () => setShowConfirm(false) })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Archive Event</h1>
          <p className="text-white/40 text-sm mt-0.5">Finalize and archive all event data</p>
        </div>

        {/* Archived state */}
        {isArchived ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Archive className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-300">Event Archived</h2>
              <p className="text-sm text-white/40 mt-1">
                This event was archived on {new Date(archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
              <Lock className="w-4 h-4" />
              Event is read-only
            </div>
            {status.archive_url && (
              <a
                href={status.archive_url}
                download
                className="flex items-center justify-center gap-2 mx-auto w-fit px-5 py-2.5 rounded-xl text-sm bg-white/[0.05] border border-white/[0.1] text-white/70 hover:bg-white/[0.08]"
              >
                <Download className="w-4 h-4" />
                Download Archive ZIP
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Readiness checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-white/60">Pre-Archive Checklist</h2>
                <span className="text-xs text-white/30">{readyCount}/{ARCHIVE_CHECKLIST.length} complete</span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {ARCHIVE_CHECKLIST.map((item, idx) => {
                  const ready = readiness[item.key] ?? false
                  const Icon = item.icon
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0',
                        ready ? 'bg-emerald-500/5' : '',
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', ready ? 'text-emerald-400' : 'text-white/20')} />
                      <span className={cn('text-sm flex-1', ready ? 'text-white/60' : 'text-white/40')}>
                        {item.label}
                      </span>
                      {ready ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-white/20" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', allReady ? 'bg-emerald-500' : 'bg-indigo-500')}
                  style={{ width: `${(readyCount / ARCHIVE_CHECKLIST.length) * 100}%` }}
                />
              </div>
            </div>

            {/* What gets archived */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Archive Package Includes
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {DATA_INCLUDED.map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                    <span className="text-emerald-500">·</span> {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            {!allReady && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300/70">
                  {ARCHIVE_CHECKLIST.length - readyCount} pre-archive task{ARCHIVE_CHECKLIST.length - readyCount !== 1 ? 's' : ''} still pending.
                  You can still archive now, but it's recommended to complete all tasks first.
                </p>
              </div>
            )}

            {/* Archive button */}
            <button
              onClick={() => setShowConfirm(true)}
              className={cn(
                'w-full py-3.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all border',
                allReady
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent hover:from-indigo-400 hover:to-violet-400'
                  : 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10',
              )}
            >
              <Archive className="w-4 h-4" />
              {allReady ? 'Archive Event' : 'Archive Anyway'}
            </button>
          </>
        )}

      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Archive this event?</h3>
              <p className="text-sm text-white/50 mt-2">
                This is <strong className="text-white">permanent and irreversible</strong>. The event will be locked
                in read-only mode and a full data archive package will be created.
              </p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Type <strong className="text-white/70">ARCHIVE</strong> to confirm</label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="ARCHIVE"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none font-mono tracking-widest uppercase"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setConfirmText('') }}
                className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={confirmText !== 'ARCHIVE' || archive.isPending}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-40"
              >
                {archive.isPending ? 'Archiving…' : 'Archive Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
