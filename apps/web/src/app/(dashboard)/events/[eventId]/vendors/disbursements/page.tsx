'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  CreditCard,
  Building2,
  Smartphone,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Send,
  X,
  Check,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

type MilestoneStatus = 'pending' | 'approval_pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed'
type DisbursementStatus = 'queued' | 'processing' | 'processed' | 'reversed' | 'cancelled' | 'failed'

interface Milestone {
  id: string
  name: string
  milestone_type: string
  amount: number
  percentage_of_total: number | null
  due_date: string | null
  status: MilestoneStatus
  sort_order: number
  notes: string | null
  vendor_disbursements: Disbursement[]
  disbursement_approvals: Approval[]
}

interface Disbursement {
  id: string
  amount: number
  status: DisbursementStatus
  payment_mode: string
  razorpay_payout_id: string | null
  reference_number: string | null
  processed_at: string | null
  failure_reason: string | null
}

interface Approval {
  id: string
  approver_id: string
  status: 'pending' | 'approved' | 'rejected'
  comments: string | null
  decided_at: string | null
}

interface PaymentSchedule {
  id: string
  vendor_id: string
  total_amount: number
  currency: string
  status: string
  notes: string | null
  vendors: { id: string; name: string; category: string; contact_name: string }
  vendor_payment_milestones: Milestone[]
}

interface ReconciliationRow {
  schedule_id: string
  vendor_id: string
  total_amount: number
  total_disbursed: number
  total_outstanding: number
  balance_due: number
  paid_milestones: number
  total_milestones: number
}

interface Reconciliation {
  schedules: ReconciliationRow[]
  totals: { totalScheduled: number; totalDisbursed: number; totalOutstanding: number; balanceDue: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MILESTONE_STATUS: Record<MilestoneStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:          { label: 'Pending',        color: 'text-zinc-400 bg-zinc-800',          icon: <Clock className="w-3 h-3" /> },
  approval_pending: { label: 'Awaiting OK',    color: 'text-amber-400 bg-amber-500/10',     icon: <Clock className="w-3 h-3 animate-pulse" /> },
  approved:         { label: 'Approved',       color: 'text-blue-400 bg-blue-500/10',       icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:         { label: 'Rejected',       color: 'text-red-400 bg-red-500/10',         icon: <XCircle className="w-3 h-3" /> },
  processing:       { label: 'Processing',     color: 'text-violet-400 bg-violet-500/10',   icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  paid:             { label: 'Paid',           color: 'text-emerald-400 bg-emerald-500/10', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:           { label: 'Failed',         color: 'text-red-400 bg-red-500/10',         icon: <AlertCircle className="w-3 h-3" /> },
}

const DISBURSEMENT_STATUS: Record<DisbursementStatus, { label: string; color: string }> = {
  queued:     { label: 'Queued',      color: 'text-zinc-400' },
  processing: { label: 'Processing',  color: 'text-blue-400' },
  processed:  { label: 'Processed',   color: 'text-emerald-400' },
  reversed:   { label: 'Reversed',    color: 'text-amber-400' },
  cancelled:  { label: 'Cancelled',   color: 'text-zinc-500' },
  failed:     { label: 'Failed',      color: 'text-red-400' },
}

const MILESTONE_TYPES = [
  { value: 'booking_advance', label: 'Booking Advance' },
  { value: 'pre_event',       label: 'Pre-event' },
  { value: 'post_event',      label: 'Post-event' },
  { value: 'manual',          label: 'Manual' },
]

function fmt(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Milestone Row ────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  currency,
  onRequestApproval,
  onDisburse,
}: {
  milestone: Milestone
  currency: string
  onRequestApproval: (id: string) => void
  onDisburse: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = MILESTONE_STATUS[milestone.status]
  const latestDisbursement = milestone.vendor_disbursements?.[0]

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-900/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-zinc-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{milestone.name}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>
          {milestone.due_date && (
            <p className="text-xs text-zinc-500 mt-0.5">Due: {fmtDate(milestone.due_date)}</p>
          )}
        </div>
        <span className="text-sm font-semibold text-white">{fmt(milestone.amount, currency)}</span>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {milestone.status === 'pending' && (
            <button
              onClick={() => onRequestApproval(milestone.id)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium transition-colors flex items-center gap-1"
            >
              <ThumbsUp className="w-3 h-3" />
              Request Approval
            </button>
          )}
          {milestone.status === 'approved' && (
            <button
              onClick={() => onDisburse(milestone.id)}
              className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              Disburse
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-zinc-900/30 border-t border-zinc-800 space-y-3">
          {/* Approvals */}
          {milestone.disbursement_approvals?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">Approvals</p>
              <div className="space-y-1.5">
                {milestone.disbursement_approvals.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <span className={`flex items-center gap-1 ${
                      a.status === 'approved' ? 'text-emerald-400' :
                      a.status === 'rejected' ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                      {a.status === 'approved' ? <Check className="w-3 h-3" /> :
                       a.status === 'rejected' ? <X className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {a.status}
                    </span>
                    {a.comments && <span className="text-zinc-600">— {a.comments}</span>}
                    {a.decided_at && <span className="text-zinc-700 ml-auto">{fmtDate(a.decided_at)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disbursement record */}
          {latestDisbursement && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">Disbursement</p>
              <div className="flex items-center gap-4 text-xs">
                <span className={DISBURSEMENT_STATUS[latestDisbursement.status].color}>
                  {DISBURSEMENT_STATUS[latestDisbursement.status].label}
                </span>
                <span className="text-zinc-500">{latestDisbursement.payment_mode.replace('_', ' ')}</span>
                {latestDisbursement.reference_number && (
                  <span className="font-mono text-zinc-400">UTR: {latestDisbursement.reference_number}</span>
                )}
                {latestDisbursement.processed_at && (
                  <span className="text-zinc-600 ml-auto">{fmtDate(latestDisbursement.processed_at)}</span>
                )}
                {latestDisbursement.failure_reason && (
                  <span className="text-red-400">{latestDisbursement.failure_reason}</span>
                )}
              </div>
            </div>
          )}

          {milestone.notes && (
            <p className="text-xs text-zinc-500 italic">{milestone.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Schedule Card ────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onRequestApproval,
  onDisburse,
}: {
  schedule: PaymentSchedule
  onRequestApproval: (milestoneId: string) => void
  onDisburse: (milestoneId: string) => void
}) {
  const milestones = schedule.vendor_payment_milestones ?? []
  const paidAmount = milestones.filter(m => m.status === 'paid').reduce((s, m) => s + m.amount, 0)
  const paidPct = schedule.total_amount > 0 ? Math.round((paidAmount / schedule.total_amount) * 100) : 0

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-medium text-white">{schedule.vendors?.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{schedule.vendors?.category}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">{fmt(schedule.total_amount, schedule.currency)}</p>
            <p className="text-xs text-zinc-500">Total contract</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>Disbursed: {fmt(paidAmount, schedule.currency)}</span>
            <span>{paidPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium text-zinc-400 mb-3">
          Payment Milestones ({milestones.length})
        </p>
        {milestones
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(m => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              currency={schedule.currency}
              onRequestApproval={onRequestApproval}
              onDisburse={onDisburse}
            />
          ))}
      </div>
    </div>
  )
}

// ─── Create Schedule Modal ────────────────────────────────────────────────────

function CreateScheduleModal({
  eventId,
  onClose,
  onCreated,
}: {
  eventId: string
  onClose: () => void
  onCreated: () => void
}) {
  const api = useApi()
  const [vendorId, setVendorId] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [notes, setNotes] = useState('')
  const [milestones, setMilestones] = useState([
    { name: 'Booking Advance', milestone_type: 'booking_advance', amount: '', percentage: '30', due_date: '' },
    { name: 'Pre-event',       milestone_type: 'pre_event',       amount: '', percentage: '50', due_date: '' },
    { name: 'Post-event',      milestone_type: 'post_event',      amount: '', percentage: '20', due_date: '' },
  ])
  const [vendors, setVendors] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/api/v1/vendors?event_id=${eventId}`)
      .then(d => setVendors(d?.vendors ?? d ?? []))
      .catch(() => {})
  }, [eventId])

  // Auto-fill amounts when total changes
  useEffect(() => {
    const total = parseFloat(totalAmount)
    if (!total) return
    setMilestones(prev => prev.map(m => ({
      ...m,
      amount: m.percentage ? String(Math.round(total * parseFloat(m.percentage) / 100)) : m.amount,
    })))
  }, [totalAmount])

  function updateMilestone(i: number, field: string, value: string) {
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  function addMilestone() {
    setMilestones(prev => [...prev, { name: '', milestone_type: 'manual', amount: '', percentage: '', due_date: '' }])
  }

  function removeMilestone(i: number) {
    setMilestones(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleCreate() {
    if (!vendorId || !totalAmount) { setError('Vendor and total amount are required'); return }
    setSaving(true)
    setError('')
    try {
      await api.post(`/api/v1/disbursements/events/${eventId}/schedules`, {
        vendor_id: vendorId,
        total_amount: parseFloat(totalAmount),
        currency,
        notes,
        milestones: milestones
          .filter(m => m.name && m.amount)
          .map((m, i) => ({
            name: m.name,
            milestone_type: m.milestone_type,
            amount: parseFloat(m.amount),
            percentage_of_total: m.percentage ? parseFloat(m.percentage) : undefined,
            due_date: m.due_date || undefined,
            sort_order: i,
          })),
      })
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Create Payment Schedule</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Vendor + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Vendor *</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm">
                <option value="">Select vendor…</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Total Contract Amount *</label>
              <div className="flex items-center rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="px-2 py-2.5 bg-zinc-800 text-zinc-400 text-xs border-r border-zinc-700">
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
                <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm resize-none" />
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400">Payment Milestones</label>
              <button onClick={addMilestone} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                <Plus className="w-3.5 h-3.5" />Add
              </button>
            </div>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)}
                    placeholder="Milestone name"
                    className="col-span-3 px-2.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xs" />
                  <select value={m.milestone_type} onChange={e => updateMilestone(i, 'milestone_type', e.target.value)}
                    className="col-span-3 px-2 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xs">
                    {MILESTONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input type="number" value={m.amount} onChange={e => updateMilestone(i, 'amount', e.target.value)}
                    placeholder="Amount"
                    className="col-span-2 px-2.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xs" />
                  <input type="date" value={m.due_date} onChange={e => updateMilestone(i, 'due_date', e.target.value)}
                    className="col-span-3 px-2.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xs" />
                  <button onClick={() => removeMilestone(i)} className="col-span-1 p-1.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-red-400 transition-colors justify-self-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Disburse Modal ───────────────────────────────────────────────────────────

function DisburseModal({
  milestoneId,
  eventId,
  onClose,
  onSuccess,
}: {
  milestoneId: string
  eventId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const api = useApi()
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [paymentMode, setPaymentMode] = useState('bank_transfer')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // For simplicity, load accounts for first vendor found
  // In production this would be scoped to the specific vendor
  useEffect(() => {
    // We'd need the vendor_id here; for MVP show a simple form
  }, [])

  async function handleDisburse() {
    if (!selectedAccount) { setError('Select a bank account'); return }
    setSending(true)
    setError('')
    try {
      await api.post(`/api/v1/disbursements/milestones/${milestoneId}/disburse`, {
        bank_account_id: selectedAccount,
        payment_mode: paymentMode,
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Disbursement failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Initiate Disbursement</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm">
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
              <option value="imps">IMPS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Bank Account</label>
            <input
              type="text"
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              placeholder="Bank account ID (UUID)"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono"
            />
            <p className="text-xs text-zinc-600 mt-1">Enter the vendor's bank account ID</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-4 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          This will initiate a real payout via Razorpay. This action cannot be undone.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-700 text-white text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDisburse}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : 'Disburse Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'schedules' | 'reconciliation'

export default function DisbursementsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const api = useApi()

  const [tab, setTab] = useState<Tab>('schedules')
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [disburseMilestoneId, setDisburseMilestoneId] = useState<string | null>(null)
  const [approvalMilestoneId, setApprovalMilestoneId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        api.get(`/api/v1/disbursements/events/${eventId}/schedules`),
        api.get(`/api/v1/disbursements/events/${eventId}/reconciliation`),
      ])
      setSchedules(s ?? [])
      setReconciliation(r)
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function handleRequestApproval(milestoneId: string) {
    // Simple self-approval for demo (in production you'd pick approvers from team)
    try {
      await api.post(`/api/v1/disbursements/milestones/${milestoneId}/request-approval`, {
        approver_ids: [], // Would be populated from team member picker
      })
      await load()
    } catch (e: any) {
      alert(e?.message ?? 'Failed')
    }
  }

  const totals = reconciliation?.totals
  const totalSchedules = schedules.length
  const totalPaid = schedules.reduce((s, sc) =>
    s + sc.vendor_payment_milestones.filter(m => m.status === 'paid').reduce((a, m) => a + m.amount, 0), 0)
  const totalPending = schedules.reduce((s, sc) =>
    s + sc.vendor_payment_milestones.filter(m => m.status === 'pending').reduce((a, m) => a + m.amount, 0), 0)
  const awaitingApproval = schedules.reduce((s, sc) =>
    s + sc.vendor_payment_milestones.filter(m => m.status === 'approval_pending').length, 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-semibold text-white">Vendor Disbursements</h1>
              <p className="text-xs text-zinc-500">Payout scheduling & approval workflow</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Schedules',      value: totalSchedules,                          icon: <Building2 className="w-4 h-4" />,   color: 'text-white' },
            { label: 'Total Paid',     value: fmt(totalPaid),                          icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400' },
            { label: 'Pending',        value: fmt(totalPending),                       icon: <Clock className="w-4 h-4" />,       color: 'text-amber-400' },
            { label: 'Need Approval',  value: `${awaitingApproval} milestone${awaitingApproval !== 1 ? 's' : ''}`, icon: <AlertCircle className="w-4 h-4" />, color: awaitingApproval > 0 ? 'text-amber-400' : 'text-zinc-500' },
          ].map(k => (
            <div key={k.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">{k.icon}<span className="text-xs">{k.label}</span></div>
              <p className={`text-lg font-bold truncate ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-zinc-800">
        <div className="flex items-center gap-1 -mb-px">
          {([
            { id: 'schedules',       label: 'Schedules' },
            { id: 'reconciliation',  label: 'Reconciliation' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'schedules' && (
          <div className="max-w-3xl space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-zinc-800 animate-pulse" />)
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <DollarSign className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm mb-4">No payment schedules yet</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Payment Schedule
                </button>
              </div>
            ) : (
              schedules.map(s => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onRequestApproval={handleRequestApproval}
                  onDisburse={(id) => setDisburseMilestoneId(id)}
                />
              ))
            )}
          </div>
        )}

        {tab === 'reconciliation' && reconciliation && (
          <div className="max-w-3xl">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Scheduled', value: fmt(totals?.totalScheduled ?? 0), color: 'text-white' },
                { label: 'Disbursed',       value: fmt(totals?.totalDisbursed ?? 0),   color: 'text-emerald-400' },
                { label: 'Outstanding',     value: fmt(totals?.totalOutstanding ?? 0), color: 'text-amber-400' },
                { label: 'Balance Due',     value: fmt(totals?.balanceDue ?? 0),       color: 'text-red-400' },
              ].map(c => (
                <div key={c.label} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Per-vendor table */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-5 text-xs font-medium text-zinc-400 bg-zinc-800/60 px-4 py-3 gap-4">
                <span className="col-span-1">Vendor</span>
                <span className="text-right">Scheduled</span>
                <span className="text-right">Disbursed</span>
                <span className="text-right">Balance</span>
                <span className="text-right">Progress</span>
              </div>
              {reconciliation.schedules.map((row, i) => {
                const pct = row.total_amount > 0 ? Math.round((row.total_disbursed / row.total_amount) * 100) : 0
                const schedule = schedules.find(s => s.id === row.schedule_id)
                return (
                  <div key={row.schedule_id} className={`grid grid-cols-5 px-4 py-3 gap-4 items-center text-sm ${i > 0 ? 'border-t border-zinc-800' : ''}`}>
                    <span className="col-span-1 font-medium text-white truncate">{schedule?.vendors?.name ?? '—'}</span>
                    <span className="text-right text-zinc-300">{fmt(row.total_amount)}</span>
                    <span className="text-right text-emerald-400">{fmt(row.total_disbursed)}</span>
                    <span className={`text-right ${row.balance_due > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {fmt(row.balance_due)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 w-8">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateScheduleModal
          eventId={eventId}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {disburseMilestoneId && (
        <DisburseModal
          milestoneId={disburseMilestoneId}
          eventId={eventId}
          onClose={() => setDisburseMilestoneId(null)}
          onSuccess={load}
        />
      )}
    </div>
  )
}
