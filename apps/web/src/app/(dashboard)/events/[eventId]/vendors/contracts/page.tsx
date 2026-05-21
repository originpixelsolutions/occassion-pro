'use client'

/**
 * OccasionPro — Event Vendor Contracts
 *
 * Lists all vendor contracts tied to an event.
 * - Full status pipeline: draft → sent → signed → cancelled
 * - Create new contract (vendor, title, value, due date, notes)
 * - Inline status transitions with optimistic UI
 * - Filter by status
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Plus, Search, CheckCircle2, Clock, Send,
  XCircle, AlertCircle, ChevronDown, X, Loader2,
  ArrowLeft, Building2, DollarSign, Calendar, Edit3,
  FileSignature, MoreHorizontal, RefreshCw, Download,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled'

interface Contract {
  id: string
  title: string
  status: ContractStatus
  vendor_id: string
  event_id: string
  agreed_amount: number | null
  currency_code: string
  effective_date: string | null
  expiry_date: string | null
  notes: string | null
  signed_by: string | null
  created_at: string
  updated_at: string
  vendor?: {
    id: string
    name: string
    business_name: string | null
    email: string
    category: string
  }
}

interface Vendor {
  id: string
  name: string
  business_name: string | null
  email: string
  category: string
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContractStatus, {
  label: string
  badge: string
  icon: typeof Clock
  next?: ContractStatus
  nextLabel?: string
}> = {
  draft:     { label: 'Draft',     badge: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20',    icon: Edit3,         next: 'sent',   nextLabel: 'Send to Vendor' },
  sent:      { label: 'Sent',      badge: 'text-blue-400   bg-blue-500/10   border-blue-500/20',    icon: Send,          next: 'signed', nextLabel: 'Mark as Signed' },
  signed:    { label: 'Signed',    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2,  },
  cancelled: { label: 'Cancelled', badge: 'text-red-400    bg-red-500/10    border-red-500/20',     icon: XCircle,       },
}

const ALL_STATUSES: ContractStatus[] = ['draft', 'sent', 'signed', 'cancelled']

// ── Create Contract Modal ─────────────────────────────────────────────────────

function CreateContractModal({
  eventId,
  vendors,
  token,
  onClose,
  onCreated,
}: {
  eventId: string
  vendors: Vendor[]
  token: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    vendor_id: '',
    title: '',
    agreed_amount: '',
    currency_code: 'INR',
    effective_date: '',
    expiry_date: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vendor_id || !form.title) { setError('Vendor and title are required.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/vendors/${form.vendor_id}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          event_id: eventId,
          agreed_amount: form.agreed_amount ? parseFloat(form.agreed_amount) : null,
          currency_code: form.currency_code,
          effective_date: form.effective_date || null,
          expiry_date: form.expiry_date || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create contract')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg bg-[#0f0f18] border border-border rounded-2xl shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <FileSignature className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="font-semibold text-sm">New Contract</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Vendor */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Vendor *</label>
          <select
            value={form.vendor_id}
            onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            required
          >
            <option value="">Select vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.business_name || v.name} · {v.category}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Contract Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Photography Services Agreement"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            required
          />
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contract Value</label>
            <input
              type="number"
              value={form.agreed_amount}
              onChange={e => setForm(f => ({ ...f, agreed_amount: e.target.value }))}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <select
              value={form.currency_code}
              onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            >
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Effective Date</label>
            <input
              type="date"
              value={form.effective_date}
              onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Expiry Date</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="Scope of work, key terms, special conditions…"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Contract
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Contract Card ─────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  token,
  onUpdated,
}: {
  contract: Contract
  token: string
  onUpdated: () => void
}) {
  const [updating, setUpdating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const cfg = STATUS_CONFIG[contract.status]
  const StatusIcon = cfg.icon

  const advance = async () => {
    if (!cfg.next) return
    setUpdating(true)
    try {
      await fetch(`${API}/vendors/${contract.vendor_id}/contracts/${contract.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: cfg.next }),
      })
      onUpdated()
    } finally { setUpdating(false) }
  }

  const cancel = async () => {
    setMenuOpen(false)
    setUpdating(true)
    try {
      await fetch(`${API}/vendors/${contract.vendor_id}/contracts/${contract.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      onUpdated()
    } finally { setUpdating(false) }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-white/15 transition-all group">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-violet-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{contract.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.badge)}>
                  <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
                  {cfg.label}
                </span>
                {contract.vendor && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {contract.vendor.business_name || contract.vendor.name}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {cfg.next && (
                <button
                  onClick={advance}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {cfg.nextLabel}
                </button>
              )}
              {contract.status !== 'cancelled' && contract.status !== 'signed' && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-8 z-20 w-36 bg-[#0f0f18] border border-border rounded-xl shadow-xl overflow-hidden">
                        <button
                          onClick={cancel}
                          className="w-full text-left px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Contract
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            {contract.agreed_amount != null && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {formatCurrency(contract.agreed_amount)}
              </span>
            )}
            {contract.effective_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Effective {formatDate(contract.effective_date)}
              </span>
            )}
            {contract.expiry_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Expires {formatDate(contract.expiry_date)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created {formatDate(contract.created_at)}
            </span>
          </div>

          {contract.notes && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">{contract.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VendorContractsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { token } = useAuth()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ContractStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [contractsRes, vendorsRes] = await Promise.all([
        fetch(`${API}/events/${eventId}/contracts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/vendors?pageSize=200`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const contractsData = await contractsRes.json()
      const vendorsData = await vendorsRes.json()
      setContracts(contractsData.data ?? contractsData ?? [])
      setVendors(vendorsData.data ?? vendorsData ?? [])
    } finally {
      setLoading(false)
    }
  }, [token, eventId])

  useEffect(() => { load() }, [load])

  const filtered = contracts.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.vendor?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.vendor?.business_name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // Status summary counts
  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = contracts.filter(c => c.status === s).length
    return acc
  }, {} as Record<ContractStatus, number>)

  const totalValue = contracts
    .filter(c => c.status !== 'cancelled' && c.agreed_amount != null)
    .reduce((sum, c) => sum + (c.agreed_amount ?? 0), 0)

  return (
    <div className="flex flex-col h-full space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}/vendors`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Vendors
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Contracts</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-violet-400" />
            Vendor Contracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
            {totalValue > 0 && ` · ${formatCurrency(totalValue)} total value`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Contract
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_STATUSES.map(s => {
          const scfg = STATUS_CONFIG[s]
          const SIcon = scfg.icon
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(prev => prev === s ? 'all' : s)}
              className={cn(
                'bg-card border rounded-xl p-3 text-left transition-all',
                filterStatus === s ? 'border-violet-500/50 bg-violet-500/5' : 'border-border hover:border-white/15'
              )}
            >
              <div className="flex items-center justify-between">
                <SIcon className={cn('w-4 h-4', s === 'signed' ? 'text-emerald-400' : s === 'sent' ? 'text-blue-400' : s === 'cancelled' ? 'text-red-400' : 'text-zinc-400')} />
                <span className="text-lg font-bold tabular-nums">{counts[s]}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{scfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contracts or vendors…"
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-xs focus:outline-none focus:border-violet-500/50 placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {filterStatus !== 'all' && (
          <button
            onClick={() => setFilterStatus('all')}
            className="flex items-center gap-1 px-2.5 py-2 border border-violet-500/40 rounded-xl text-xs text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            <X className="w-3 h-3" /> Clear filter
          </button>
        )}
        <button
          onClick={load}
          className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors ml-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contract list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-violet-400" />
          </div>
          <p className="font-semibold">
            {contracts.length === 0 ? 'No contracts yet' : 'No contracts match your filter'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {contracts.length === 0
              ? 'Create your first vendor contract to start tracking agreements.'
              : 'Try changing the search or status filter.'}
          </p>
          {contracts.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Contract
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(contract => (
            <ContractCard
              key={contract.id}
              contract={contract}
              token={token ?? ''}
              onUpdated={load}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && token && (
        <CreateContractModal
          eventId={eventId}
          vendors={vendors}
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
