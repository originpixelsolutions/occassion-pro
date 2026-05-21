'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Clock, CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

function cpFetch(path: string, opts?: RequestInit) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-Client-Session': session } : {}),
      ...(opts?.headers || {}),
    },
  })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Awaiting your review', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  changes_requested: { label: 'Changes requested', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
}

export default function ClientApprovalsPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const router = useRouter()
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accessLevel, setAccessLevel] = useState<string>('view_only')

  useEffect(() => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }

    // Fetch overview to get access_level
    cpFetch(`/client-portal/events/${eventId}`)
      .then(r => r.json())
      .then(d => { if (d.access_level) setAccessLevel(d.access_level) })

    cpFetch(`/client-portal/events/${eventId}/approvals`)
      .then(r => {
        if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return null }
        return r.json()
      })
      .then(d => { if (d) setApprovals(d.approvals || []) })
      .finally(() => setLoading(false))
  }, [eventId, tenant])

  const handleReview = async (approvalId: string, status: 'approved' | 'changes_requested') => {
    setSubmitting(true)
    try {
      await cpFetch(`/client-portal/events/${eventId}/approvals/${approvalId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, comment: comment.trim() || undefined }),
      })
      setApprovals(prev => prev.map(a =>
        a.id === approvalId ? { ...a, status, review_comment: comment } : a,
      ))
      setReviewing(null)
      setComment('')
    } finally {
      setSubmitting(false)
    }
  }

  const canReview = accessLevel === 'collaborator' || accessLevel === 'full_access'
  const pending = approvals.filter(a => a.status === 'pending')
  const reviewed = approvals.filter(a => a.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Approvals</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {pending.length} pending · {reviewed.length} reviewed
        </p>
      </div>

      {approvals.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <CheckSquare className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 text-sm">No approval requests yet</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pending Review</h3>
          {pending.map(ap => (
            <div key={ap.id} className="bg-[#13131a] border border-amber-500/20 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sm">{ap.title}</h4>
                  {ap.description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{ap.description}</p>}
                  {ap.deadline && (
                    <p className="text-xs text-zinc-500 mt-1.5">
                      Due {new Date(ap.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 shrink-0">
                  Pending
                </span>
              </div>

              {ap.file_url && (
                <a
                  href={ap.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View attached file →
                </a>
              )}

              {canReview && (
                reviewing === ap.id ? (
                  <div className="space-y-3 border-t border-white/6 pt-4">
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Add a comment (optional)…"
                      rows={2}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(ap.id, 'approved')}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(ap.id, 'changes_requested')}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <XCircle className="w-3 h-3" /> Request changes
                      </button>
                      <button
                        onClick={() => { setReviewing(null); setComment('') }}
                        className="px-3 py-1.5 border border-white/8 text-zinc-400 text-xs rounded-lg hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReviewing(ap.id)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Leave a review
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reviewed</h3>
          {reviewed.map(ap => {
            const cfg = STATUS_CONFIG[ap.status] || STATUS_CONFIG.pending
            const Icon = cfg.icon
            return (
              <div key={ap.id} className="bg-[#13131a] border border-white/8 rounded-xl p-4 flex items-start gap-4 opacity-70">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.color.split(' ').slice(1).join(' '))}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{ap.title}</h4>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  {ap.review_comment && (
                    <p className="text-xs text-zinc-500 mt-1 italic">"{ap.review_comment}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
