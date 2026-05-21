'use client'

/**
 * OccasionPro Super Admin — DPDP Compliance Dashboard
 * Route: /super-admin/dpdp
 *
 * Displays all data subject requests across all tenants.
 * Allows admins to mark requests as Processing, Completed, or Rejected.
 * Protected: super_admin / owner roles only.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, RefreshCcw, Search, Filter, ChevronDown,
  CheckCircle2, XCircle, Clock, Loader2, AlertCircle,
  FileText, Edit3, Trash2, Download, Eye,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestType   = 'access' | 'correction' | 'erasure' | 'portability'
type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected'

interface DataRequest {
  id:              string
  reference:       string
  requestor_email: string
  request_type:    RequestType
  status:          RequestStatus
  tenant_id:       string | null
  notes:           string | null
  handled_by:      string | null
  created_at:      string
  updated_at:      string
}

interface Summary {
  pending:    number
  processing: number
  completed:  number
  rejected:   number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<RequestType, { label: string; icon: React.ReactNode; color: string }> = {
  access:      { label: 'Access',      icon: <FileText className="w-3.5 h-3.5" />, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  correction:  { label: 'Correction',  icon: <Edit3    className="w-3.5 h-3.5" />, color: 'text-blue-400    bg-blue-500/10    border-blue-500/20'    },
  erasure:     { label: 'Erasure',     icon: <Trash2   className="w-3.5 h-3.5" />, color: 'text-red-400    bg-red-500/10     border-red-500/20'     },
  portability: { label: 'Portability', icon: <Download className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
}

const STATUS_META: Record<RequestStatus, { label: string; color: string; dot: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-400    bg-amber-500/10    border-amber-500/20',    dot: 'bg-amber-400'    },
  processing: { label: 'Processing', color: 'text-blue-400     bg-blue-500/10     border-blue-500/20',     dot: 'bg-blue-400'     },
  completed:  { label: 'Completed',  color: 'text-emerald-400  bg-emerald-500/10  border-emerald-500/20',  dot: 'bg-emerald-400'  },
  rejected:   { label: 'Rejected',   color: 'text-red-400      bg-red-500/10      border-red-500/20',      dot: 'bg-red-400'      },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function TypeBadge({ type }: { type: RequestType }) {
  const meta = TYPE_META[type]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-medium ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-medium ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DpdpAdminPage() {
  const [requests,   setRequests]   = useState<DataRequest[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [statusFilt, setStatusFilt] = useState<RequestStatus | 'all'>('all')
  const [typeFilt,   setTypeFilt]   = useState<RequestType   | 'all'>('all')
  const [page,       setPage]       = useState(1)
  const [total,      setTotal]      = useState(0)

  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [notesModal, setNotesModal] = useState<{ id: string; action: 'processing' | 'completed' | 'rejected' } | null>(null)
  const [actionNotes, setActionNotes] = useState('')

  const LIMIT = 25

  // ── Fetch summary + requests ──────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    try {
      const res  = await fetch('/api/dpdp/summary')
      const data = await res.json()
      setSummary(data)
    } catch {}
  }, [])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
      })
      if (statusFilt !== 'all') params.set('status',      statusFilt)
      if (typeFilt   !== 'all') params.set('requestType', typeFilt)

      const res  = await fetch(`/api/dpdp/requests?${params}`)
      if (!res.ok) throw new Error('Failed to load requests')
      const data = await res.json()
      setRequests(data.data   ?? data)
      setTotal(data.total ?? data.length)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilt, typeFilt])

  useEffect(() => { fetchSummary()  }, [fetchSummary])
  useEffect(() => { fetchRequests() }, [fetchRequests])

  // ── Process action ────────────────────────────────────────────────────────

  const processRequest = async (id: string, action: 'processing' | 'completed' | 'rejected', notes?: string) => {
    setProcessing(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/dpdp/requests/${id}/process`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      })
      if (!res.ok) throw new Error('Action failed')
      await Promise.all([fetchRequests(), fetchSummary()])
    } catch {
      // surface inline error in future enhancement
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleActionClick = (id: string, action: 'processing' | 'completed' | 'rejected') => {
    if (action === 'processing') {
      // No notes needed — go straight
      processRequest(id, action)
    } else {
      setNotesModal({ id, action })
      setActionNotes('')
    }
  }

  const confirmAction = async () => {
    if (!notesModal) return
    await processRequest(notesModal.id, notesModal.action, actionNotes || undefined)
    setNotesModal(null)
    setActionNotes('')
  }

  // ── Filtered list (client-side search on email / reference) ──────────────

  const filtered = requests.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.requestor_email.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q)
    )
  })

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">DPDP Compliance</h1>
              <p className="text-xs text-zinc-500">Digital Personal Data Protection Act 2023</p>
            </div>
          </div>
          <button
            onClick={() => { fetchRequests(); fetchSummary() }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { key: 'pending',    label: 'Pending',    icon: <Clock        className="w-4 h-4" />, color: 'text-amber-400   bg-amber-500/10   border-amber-500/20'   },
                { key: 'processing', label: 'Processing', icon: <Loader2      className="w-4 h-4" />, color: 'text-blue-400    bg-blue-500/10    border-blue-500/20'    },
                { key: 'completed',  label: 'Completed',  icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { key: 'rejected',   label: 'Rejected',   icon: <XCircle      className="w-4 h-4" />, color: 'text-red-400    bg-red-500/10     border-red-500/20'     },
              ] as const
            ).map(({ key, label, icon, color }) => (
              <button
                key={key}
                onClick={() => { setStatusFilt(key); setPage(1) }}
                className={`
                  p-4 rounded-2xl border bg-zinc-900/50 text-left transition-all
                  ${statusFilt === key
                    ? `${color} bg-zinc-900 ring-1 ring-inset`
                    : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${statusFilt === key ? color : 'bg-zinc-800 text-zinc-400'}`}>
                  {icon}
                </div>
                <p className="text-2xl font-bold text-white">{summary[key as keyof Summary]}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by email or reference…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              value={statusFilt}
              onChange={e => { setStatusFilt(e.target.value as any); setPage(1) }}
              className="pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-violet-500 rounded-xl text-sm text-white outline-none appearance-none transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="relative">
            <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              value={typeFilt}
              onChange={e => { setTypeFilt(e.target.value as any); setPage(1) }}
              className="pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-violet-500 rounded-xl text-sm text-white outline-none appearance-none transition-colors cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="access">Access</option>
              <option value="correction">Correction</option>
              <option value="erasure">Erasure</option>
              <option value="portability">Portability</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Loading / Error */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading requests…</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-500">
              <Shield className="w-8 h-8 text-zinc-700" />
              <p className="text-sm">No data requests found</p>
              {(statusFilt !== 'all' || typeFilt !== 'all' || search) && (
                <button
                  onClick={() => { setStatusFilt('all'); setTypeFilt('all'); setSearch('') }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors mt-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Rows */}
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Reference</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Submitted</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filtered.map(req => (
                    <tr key={req.id} className="hover:bg-zinc-900/40 transition-colors group">
                      {/* Reference */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-violet-400">{req.reference}</span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-300 truncate max-w-[200px] block">{req.requestor_email}</span>
                        {req.notes && (
                          <span className="text-xs text-zinc-600 truncate max-w-[200px] block mt-0.5">{req.notes.slice(0, 60)}{req.notes.length > 60 ? '…' : ''}</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <TypeBadge type={req.request_type} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">{formatDate(req.created_at)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <ActionButtons
                          request={req}
                          isLoading={!!processing[req.id]}
                          onAction={handleActionClick}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-500">Page {page} of {Math.ceil(total / LIMIT)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * LIMIT >= total}
                className="px-3 py-1.5 text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Compliance note */}
        <div className="flex items-start gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <Shield className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-500 space-y-1">
            <p className="text-zinc-300 font-medium">DPDP Act 2023 Obligations</p>
            <p>
              Data Fiduciaries must respond to data subject requests within <strong className="text-zinc-300">30 days</strong> of receipt.
              Erasure requests must delete all personal data except where retention is required by law.
              Access requests must be accompanied by a complete data bundle.
              All actions are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Action confirmation modal */}
      {notesModal && (
        <ActionModal
          action={notesModal.action}
          notes={actionNotes}
          onNotesChange={setActionNotes}
          onConfirm={confirmAction}
          onCancel={() => { setNotesModal(null); setActionNotes('') }}
        />
      )}
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  request,
  isLoading,
  onAction,
}: {
  request:   DataRequest
  isLoading: boolean
  onAction:  (id: string, action: 'processing' | 'completed' | 'rejected') => void
}) {
  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-zinc-500 ml-auto" />
  }

  const { id, status } = request

  if (status === 'completed' || status === 'rejected') {
    return <span className="text-xs text-zinc-600">—</span>
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'pending' && (
        <button
          onClick={() => onAction(id, 'processing')}
          className="px-2.5 py-1 text-xs font-medium text-blue-400 border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
        >
          Mark Processing
        </button>
      )}
      <button
        onClick={() => onAction(id, 'completed')}
        className="px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
      >
        Complete
      </button>
      <button
        onClick={() => onAction(id, 'rejected')}
        className="px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
      >
        Reject
      </button>
    </div>
  )
}

// ─── Action modal ─────────────────────────────────────────────────────────────

function ActionModal({
  action,
  notes,
  onNotesChange,
  onConfirm,
  onCancel,
}: {
  action:        'processing' | 'completed' | 'rejected'
  notes:         string
  onNotesChange: (v: string) => void
  onConfirm:     () => void
  onCancel:      () => void
}) {
  const isComplete = action === 'completed'
  const isReject   = action === 'rejected'

  const title   = isComplete ? 'Complete Request' : isReject ? 'Reject Request' : 'Mark as Processing'
  const desc    = isComplete
    ? 'Mark this request as completed. For access requests, a data bundle will be emailed to the requestor. For erasure requests, the data will be anonymised.'
    : isReject
    ? 'Reject this data request. Please provide a reason — it will be included in the notification email to the requestor.'
    : 'Mark this request as in processing. The requestor will be notified.'

  const color   = isComplete ? 'bg-emerald-600 hover:bg-emerald-500' : isReject ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-400">
            {isReject ? 'Rejection Reason' : 'Notes (optional)'}
            {isReject && <span className="text-red-400 ml-1">*</span>}
          </label>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            rows={3}
            placeholder={isReject ? 'Reason for rejection…' : 'Optional internal notes…'}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl text-sm text-white placeholder-zinc-600 outline-none resize-none transition-colors"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isReject && !notes.trim()}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${color}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
