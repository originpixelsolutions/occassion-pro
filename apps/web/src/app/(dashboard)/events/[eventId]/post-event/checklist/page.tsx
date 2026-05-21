'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckSquare, Square, RefreshCw, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import {
  usePostEventChecklist, useUpdateChecklistItem,
  useCompleteAllChecklist, useResetChecklist,
} from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  venue: 'text-blue-400 bg-blue-500/10',
  finance: 'text-emerald-400 bg-emerald-500/10',
  vendors: 'text-amber-400 bg-amber-500/10',
  guests: 'text-violet-400 bg-violet-500/10',
  team: 'text-cyan-400 bg-cyan-500/10',
  documents: 'text-indigo-400 bg-indigo-500/10',
}

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue',
  finance: 'Finance',
  vendors: 'Vendors',
  guests: 'Guests',
  team: 'Team',
  documents: 'Documents',
}

function ChecklistGroup({ category, items, tenant, eventId }: {
  category: string; items: any[]; tenant: string; eventId: string
}) {
  const [open, setOpen] = useState(true)
  const update = useUpdateChecklistItem(tenant, eventId)
  const completedCount = items.filter(i => i.is_completed).length
  const colorClass = CATEGORY_COLORS[category] ?? 'text-white/50 bg-white/10'
  const labelClass = colorClass.split(' ')[0]

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/30" />
        )}
        <span className={cn('text-xs font-semibold uppercase tracking-wider', labelClass)}>
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-white/30">
            {completedCount}/{items.length}
          </span>
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
        </div>
      </button>

      {/* Items */}
      {open && (
        <div className="border-t border-white/[0.04]">
          {items.map(item => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors',
                item.is_completed ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]',
              )}
            >
              <button
                onClick={() =>
                  update.mutate({ itemId: item.id, data: { is_completed: !item.is_completed } })
                }
                className="mt-0.5 flex-shrink-0"
              >
                {item.is_completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-white/30 hover:text-white/60" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm transition-colors',
                  item.is_completed ? 'text-white/40 line-through' : 'text-white/80',
                )}>
                  {item.task}
                </span>
                {item.notes && (
                  <p className="text-xs text-white/30 mt-0.5">{item.notes}</p>
                )}
                {item.is_completed && item.completed_at && (
                  <p className="text-[10px] text-white/20 mt-0.5">
                    Completed {new Date(item.completed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {item.is_required && !item.is_completed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 flex-shrink-0">
                  Required
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PostEventChecklistPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = usePostEventChecklist(tenant, eventId)
  const completeAll = useCompleteAllChecklist(tenant, eventId)
  const reset = useResetChecklist(tenant, eventId)
  const [showReset, setShowReset] = useState(false)

  const groups: Record<string, any[]> = data?.groups ?? {}
  const allItems = Object.values(groups).flat()
  const completedCount = allItems.filter(i => i.is_completed).length
  const totalCount = allItems.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Wrap-Up Checklist</h1>
            <p className="text-white/40 text-sm mt-0.5">{completedCount} of {totalCount} tasks completed</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 border border-white/10 hover:bg-white/[0.05]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={() => completeAll.mutate()}
              disabled={completeAll.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Complete All
            </button>
          </div>
        </div>

        {/* Overall progress */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/50">Overall progress</span>
            <span className="text-sm font-semibold text-white">{pct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
            />
          </div>
        </div>

        {/* Groups */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groups).map(([category, items]) => (
              <ChecklistGroup
                key={category}
                category={category}
                items={items}
                tenant={tenant}
                eventId={eventId}
              />
            ))}
          </div>
        )}

        {/* Reset confirm dialog */}
        {showReset && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-lg font-semibold text-white">Reset checklist?</h3>
              <p className="text-sm text-white/50">
                This will uncheck all items and clear completion records. This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowReset(false)} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
                  Cancel
                </button>
                <button
                  onClick={() => { reset.mutate(); setShowReset(false) }}
                  className="px-4 py-2 rounded-lg text-sm bg-red-500/80 text-white hover:bg-red-500"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
