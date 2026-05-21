'use client'

/**
 * VendorQuotesDrawer — slide-over panel for staff to view and review
 * quotes submitted by a vendor for a specific event assignment.
 *
 * Staff can:
 *  - See all submitted quotes with amounts, descriptions, documents
 *  - Mark a quote as Under Review / Approved / Rejected
 *  - Add an internal review note
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X, Loader2, Receipt, CheckCircle2, XCircle, Clock,
  AlertCircle, FileText, ExternalLink, ChevronDown,
  Building2, DollarSign, Tag, MessageSquare,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type QuoteStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'

interface Quote {
  id: string
  service_description: string
  amount: number
  currency_code: string
  notes: string | null
  file_url: string | null
  status: QuoteStatus
  review_note: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  vendor: {
    id: string
    name: string
    business_name: string | null
    email: string
  } | null
  reviewer: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface Assignment {
  id: string
  vendorName: string
  vendorEmail: string
  vendorCategory: string
  serviceDescription: string | null
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, {
  label: string
  badge: string
  dot: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  submitted:    { label: 'Submitted',    badge: 'text-amber-400  bg-amber-500/10  border-amber-500/20',  dot: 'bg-amber-400',   icon: Clock         },
  under_review: { label: 'Under Review', badge: 'text-blue-400   bg-blue-500/10   border-blue-500/20',   dot: 'bg-blue-400',    icon: Clock         },
  approved:     { label: 'Approved',     badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     badge: 'text-red-400    bg-red-500/10    border-red-500/20',    dot: 'bg-red-400',     icon: XCircle       },
  withdrawn:    { label: 'Withdrawn',    badge: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',   dot: 'bg-zinc-500',    icon: XCircle       },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Review Panel ─────────────────────────────────────────────────────────────

function ReviewPanel({
  quote,
  onReviewed,
}: {
  quote: Quote
  onReviewed: () => void
}) {
  const [open, setOpen]         = useState(false)
  const [newStatus, setNewStatus] = useState<'approved' | 'rejected' | 'under_review'>(
    quote.status === 'withdrawn' ? 'under_review' : (quote.status as any),
  )
  const [note, setNote]         = useState(quote.review_note ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  if (quote.status === 'withdrawn') return null

  async function submit() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/staff/quotes/${quote.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, review_note: note.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to update quote.')
        return
      }
      setOpen(false)
      onReviewed()
    } catch {
      setError('Network error.')
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        Review this quote
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Set Status</label>
            <div className="flex gap-2 flex-wrap">
              {(['under_review', 'approved', 'rejected'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewStatus(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-all ${
                    newStatus === s
                      ? STATUS_CONFIG[s].badge + ' ring-1 ring-inset ' + STATUS_CONFIG[s].dot.replace('bg-', 'ring-')
                      : 'text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Review Note (visible to vendor)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Explain your decision or ask for clarification…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Review
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quote Card ───────────────────────────────────────────────────────────────

function QuoteCard({ quote, onReviewed }: { quote: Quote; onReviewed: () => void }) {
  const cfg  = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.submitted
  const Icon = cfg.icon

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug">{quote.service_description}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{formatDate(quote.created_at)}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border font-medium shrink-0 ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-center gap-1.5 text-sm mb-3">
        <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="text-emerald-400 font-semibold text-base">
          {formatCurrency(quote.amount, quote.currency_code)}
        </span>
      </div>

      {/* Notes */}
      {quote.notes && (
        <p className="text-xs text-zinc-400 leading-relaxed mb-3 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/40">
          {quote.notes}
        </p>
      )}

      {/* Document link */}
      {quote.file_url && (
        <a
          href={quote.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mb-3 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          View Document
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Reviewer note */}
      {quote.review_note && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
          <p className="text-xs text-zinc-400">
            <span className="text-violet-400 font-medium">Review note: </span>
            {quote.review_note}
          </p>
          {quote.reviewed_at && (
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {quote.reviewer?.full_name ?? 'Staff'} · {formatDateTime(quote.reviewed_at)}
            </p>
          )}
        </div>
      )}

      {/* Review panel (for actionable statuses) */}
      {(quote.status === 'submitted' || quote.status === 'under_review') && (
        <ReviewPanel quote={quote} onReviewed={onReviewed} />
      )}
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface VendorQuotesDrawerProps {
  assignment: Assignment
  onClose: () => void
}

export default function VendorQuotesDrawer({ assignment, onClose }: VendorQuotesDrawerProps) {
  const [quotes, setQuotes]   = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/staff/assignments/${assignment.id}/quotes`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load quotes')
      const data = await res.json()
      setQuotes(data.quotes ?? [])
    } catch {
      setError('Failed to load quotes.')
    } finally { setLoading(false) }
  }, [assignment.id])

  useEffect(() => { load() }, [load])

  // Status summary
  const summary = {
    total:     quotes.length,
    submitted: quotes.filter(q => q.status === 'submitted').length,
    approved:  quotes.filter(q => q.status === 'approved').length,
    rejected:  quotes.filter(q => q.status === 'rejected').length,
    pending:   quotes.filter(q => ['submitted', 'under_review'].includes(q.status)).length,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 inset-y-0 z-50 w-full max-w-md flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-cyan-400 shrink-0" />
              <h2 className="text-sm font-semibold text-white truncate">Vendor Quotes</h2>
            </div>
            <p className="text-xs text-zinc-500 truncate">{assignment.vendorName}</p>
            <p className="text-xs text-zinc-600 truncate">{assignment.serviceDescription ?? assignment.vendorCategory}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        {!loading && quotes.length > 0 && (
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-5 flex-wrap">
            {[
              { label: 'Total',    value: summary.total,     color: 'text-white'        },
              { label: 'Pending',  value: summary.pending,   color: 'text-amber-400'    },
              { label: 'Approved', value: summary.approved,  color: 'text-emerald-400'  },
              { label: 'Rejected', value: summary.rejected,  color: 'text-red-400'      },
            ].map(s => (
              <div key={s.label} className="flex items-baseline gap-1">
                <span className={`text-base font-bold ${s.color}`}>{s.value}</span>
                <span className="text-[11px] text-zinc-600">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Receipt className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400 font-medium">No quotes submitted yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                The vendor hasn't submitted any quotes for this assignment.
              </p>
            </div>
          ) : (
            quotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onReviewed={load}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            {summary.pending > 0
              ? `${summary.pending} quote${summary.pending > 1 ? 's' : ''} awaiting review`
              : 'All quotes reviewed'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
