'use client'

/**
 * OccasionPro — Event Vendors Page
 *
 * Staff view: lists all vendor assignments for an event.
 * - Assign new vendors (search existing or add inline)
 * - View assignment status, agreed amount, service description
 * - Update status / add internal notes / rate vendor
 * - Open message drawer for each assignment
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Truck, Plus, Search, Filter, MessageSquare, Star,
  CheckCircle2, Clock, XCircle, AlertCircle, Loader2,
  ChevronDown, Building2, Mail, Phone, Tag, DollarSign,
  Edit3, MoreHorizontal, BadgeCheck, Receipt, Sparkles, FileText,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const AssignVendorModal   = dynamic(() => import('@/components/event-vendors/AssignVendorModal'),   { ssr: false })
const VendorMessageDrawer = dynamic(() => import('@/components/event-vendors/VendorMessageDrawer'), { ssr: false })
const VendorQuotesDrawer  = dynamic(() => import('@/components/event-vendors/VendorQuotesDrawer'),  { ssr: false })

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssignmentStatus = 'invited' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'declined'

interface Assignment {
  id: string
  status: AssignmentStatus
  service_description: string | null
  agreed_amount: number | null
  currency_code: string
  tenant_rating: number | null
  vendor_notes: string | null
  vendor_response_note: string | null
  responded_at: string | null
  invited_at: string
  confirmed_at: string | null
  completed_at: string | null
  unread_count?: number
  pending_quotes_count?: number
  vendor: {
    id: string
    name: string
    business_name: string | null
    email: string
    category: string
    phone: string | null
    avatar_url: string | null
    score: number | null
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AssignmentStatus, {
  label: string; dot: string; badge: string; icon: typeof Clock
}> = {
  invited:     { label: 'Invited',     dot: 'bg-amber-400',   badge: 'text-amber-400  bg-amber-500/10  border-amber-500/20',  icon: Clock },
  confirmed:   { label: 'Confirmed',   dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', dot: 'bg-blue-400',    badge: 'text-blue-400   bg-blue-500/10   border-blue-500/20',   icon: Clock },
  completed:   { label: 'Completed',   dot: 'bg-zinc-400',    badge: 'text-zinc-300   bg-zinc-500/10   border-zinc-500/20',   icon: BadgeCheck },
  cancelled:   { label: 'Cancelled',   dot: 'bg-red-400',     badge: 'text-red-400    bg-red-500/10    border-red-500/20',    icon: XCircle },
  declined:    { label: 'Declined',    dot: 'bg-red-400',     badge: 'text-red-400    bg-red-500/10    border-red-500/20',    icon: XCircle },
}

const STATUS_ORDER: AssignmentStatus[] = ['invited','confirmed','in_progress','completed','cancelled','declined']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null, code = 'INR') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 })
    .format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StarRating({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={`${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`w-3.5 h-3.5 ${n <= (value ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Edit Assignment Popover ──────────────────────────────────────────────────

function EditAssignmentSheet({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: Assignment
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus]   = useState<AssignmentStatus>(assignment.status)
  const [rating, setRating]   = useState<number | null>(assignment.tenant_rating)
  const [notes, setNotes]     = useState(assignment.vendor_notes ?? '')
  const [desc, setDesc]       = useState(assignment.service_description ?? '')
  const [amount, setAmount]   = useState(String(assignment.agreed_amount ?? ''))
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/staff/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status,
          tenant_rating: rating,
          vendor_notes: notes.trim() || null,
          service_description: desc.trim() || null,
          agreed_amount: amount ? parseFloat(amount) : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to save.')
        return
      }
      onSaved(); onClose()
    } catch {
      setError('Network error.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Edit Assignment</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Vendor info (read-only) */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
              {assignment.vendor.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{assignment.vendor.name}</p>
              <p className="text-xs text-zinc-500 truncate">{assignment.vendor.category} · {assignment.vendor.email}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as AssignmentStatus)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          {/* Service description */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Service Description</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the services…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Agreed Amount ({assignment.currency_code})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Internal rating */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Internal Rating (not shown to vendor)</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Internal notes */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Internal Notes (staff only)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes visible only to your team…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-violet-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-300 hover:text-white border border-zinc-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assignment Card ──────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  onEdit,
  onMessage,
  onQuotes,
}: {
  assignment: Assignment
  onEdit: (a: Assignment) => void
  onMessage: (id: string) => void
  onQuotes: (a: Assignment) => void
}) {
  const cfg = STATUS_CONFIG[assignment.status]
  const Icon = cfg.icon
  const hasUnread = (assignment.unread_count ?? 0) > 0
  const pendingQuotes = assignment.pending_quotes_count ?? 0

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 hover:border-zinc-700 transition-all group">
      <div className="flex items-start gap-4">

        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-300 shrink-0">
          {assignment.vendor.name.charAt(0).toUpperCase()}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{assignment.vendor.name}</span>
                {assignment.vendor.business_name && (
                  <span className="text-xs text-zinc-500">· {assignment.vendor.business_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500">{assignment.vendor.email}</span>
                <span className="text-zinc-700 text-xs">·</span>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onQuotes(assignment)}
                className="relative p-2 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
                title="View quotes"
              >
                <Receipt className="w-4 h-4" />
                {pendingQuotes > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-amber-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {pendingQuotes}
                  </span>
                )}
              </button>
              <button
                onClick={() => onMessage(assignment.id)}
                className="relative p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Open messages"
              >
                <MessageSquare className="w-4 h-4" />
                {hasUnread && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-cyan-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => onEdit(assignment)}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Edit assignment"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Tag className="w-3 h-3" />
              {assignment.vendor.category}
            </span>
            {assignment.agreed_amount != null && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <DollarSign className="w-3 h-3" />
                {formatCurrency(assignment.agreed_amount, assignment.currency_code)}
              </span>
            )}
            {assignment.vendor.score != null && (
              <div className="flex items-center gap-1">
                <StarRating value={Math.round(assignment.vendor.score / 20)} />
                <span className="text-xs text-zinc-500">{assignment.vendor.score}/100</span>
              </div>
            )}
            {assignment.tenant_rating != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-600">Your rating:</span>
                <StarRating value={assignment.tenant_rating} />
              </div>
            )}
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <Clock className="w-3 h-3" />
              Invited {formatDate(assignment.invited_at)}
            </span>
          </div>

          {/* Description */}
          {assignment.service_description && (
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {assignment.service_description}
            </p>
          )}

          {/* Vendor response note */}
          {assignment.vendor_response_note && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
              <p className="text-xs text-zinc-500">
                <span className="text-zinc-400 font-medium">Vendor note: </span>
                {assignment.vendor_response_note}
              </p>
            </div>
          )}

          {/* Internal notes */}
          {assignment.vendor_notes && (
            <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <p className="text-xs text-amber-300/70">
                <span className="text-amber-300/90 font-medium">Internal: </span>
                {assignment.vendor_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventVendorsPage() {
  const params = useParams<{ eventId: string }>()
  const router  = useRouter()
  const eventId = params?.eventId ?? ''

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all')
  const [showAssign, setShowAssign]         = useState(false)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [messagingId, setMessagingId]       = useState<string | null>(null)
  const [quotesAssignment, setQuotesAssignment] = useState<Assignment | null>(null)
  const [toast, setToast]                   = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/vendor-portal/staff/events/${eventId}/assignments`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAssignments(data.assignments ?? data)
    } catch {
      showToast('Failed to load vendor assignments', false)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  function showToast(text: string, ok = true) {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = assignments.filter(a => {
    const matchSearch =
      !search ||
      a.vendor.name.toLowerCase().includes(search.toLowerCase()) ||
      a.vendor.email.toLowerCase().includes(search.toLowerCase()) ||
      (a.vendor.business_name ?? '').toLowerCase().includes(search.toLowerCase())

    const matchStatus = statusFilter === 'all' || a.status === statusFilter

    return matchSearch && matchStatus
  })

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total:     assignments.length,
    confirmed: assignments.filter(a => a.status === 'confirmed').length,
    invited:   assignments.filter(a => a.status === 'invited').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    totalValue: assignments.reduce((sum, a) => sum + (a.agreed_amount ?? 0), 0),
  }

  const editingAssignment = editingId
    ? assignments.find(a => a.id === editingId) ?? null
    : null

  return (
    <div className="h-full flex flex-col bg-zinc-950">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              Vendor Management
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Assign and coordinate vendors for this event
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/events/${eventId}/vendors/ai-recommend`)}
              className="flex items-center gap-1.5 px-3 py-2 border border-violet-500/30 hover:border-violet-500/60 text-violet-400 hover:text-violet-300 text-sm font-medium rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI Recommend
            </button>
            <button
              onClick={() => router.push(`/events/${eventId}/vendors/contracts`)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border hover:border-white/20 text-muted-foreground hover:text-foreground text-sm font-medium rounded-xl transition-colors"
            >
              <FileText className="w-4 h-4" />
              Contracts
            </button>
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Vendor
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-5 flex-wrap">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-white' },
            { label: 'Confirmed', value: stats.confirmed, color: 'text-emerald-400' },
            { label: 'Invited',   value: stats.invited,   color: 'text-amber-400' },
            { label: 'Completed', value: stats.completed, color: 'text-zinc-400' },
          ].map(s => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
          ))}
          {stats.totalValue > 0 && (
            <div className="flex items-baseline gap-1.5 ml-auto">
              <span className="text-xl font-bold text-emerald-400">
                {formatCurrency(stats.totalValue)}
              </span>
              <span className="text-xs text-zinc-500">total committed</span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-800">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              statusFilter === 'all' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                statusFilter === s ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <Truck className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-400 font-medium">
              {search || statusFilter !== 'all' ? 'No vendors match your filters' : 'No vendors assigned yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => setShowAssign(true)}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign first vendor
              </button>
            )}
          </div>
        ) : (
          filtered.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onEdit={a => setEditingId(a.id)}
              onMessage={setMessagingId}
              onQuotes={setQuotesAssignment}
            />
          ))
        )}
      </div>

      {/* Modals / drawers */}
      {showAssign && (
        <AssignVendorModal
          eventId={eventId}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { load(); showToast('Vendor assigned successfully') }}
        />
      )}

      {editingAssignment && (
        <EditAssignmentSheet
          assignment={editingAssignment}
          onClose={() => setEditingId(null)}
          onSaved={() => { load(); showToast('Assignment updated') }}
        />
      )}

      {messagingId && (
        <VendorMessageDrawer
          assignmentId={messagingId}
          onClose={() => setMessagingId(null)}
        />
      )}

      {quotesAssignment && (
        <VendorQuotesDrawer
          assignment={{
            id: quotesAssignment.id,
            vendorName: quotesAssignment.vendor.name,
            vendorEmail: quotesAssignment.vendor.email,
            vendorCategory: quotesAssignment.vendor.category,
            serviceDescription: quotesAssignment.service_description,
          }}
          onClose={() => setQuotesAssignment(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${
          toast.ok
            ? 'bg-zinc-900 border-zinc-700 text-white'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.ok
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <AlertCircle className="w-4 h-4" />
          }
          {toast.text}
        </div>
      )}
    </div>
  )
}
