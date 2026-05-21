'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useEvents } from '@/hooks/use-events'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Users, Plus, Search, Filter, Download, Copy, Upload,
  Mail, Phone, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronDown, X, Loader2, Check, Star, RefreshCw,
  UserCheck, UserX, MoreHorizontal,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  full_name: string
  email?: string
  phone?: string
  rsvp_status: 'pending' | 'confirmed' | 'declined' | 'maybe' | 'no_response'
  is_vip?: boolean
  checked_in?: boolean
  table_no?: string
  dietary_requirements?: string
  guest_categories?: { name: string; color: string }
  copied_from_event_id?: string
}

interface CopyPreviewGuest extends Guest {
  is_duplicate: boolean
  duplicate_reason: 'email' | 'phone' | null
}

interface CopyPreview {
  total: number
  duplicates: number
  new: number
  guests: CopyPreviewGuest[]
}

// ── RSVP badge ────────────────────────────────────────────────────────────────

const RSVP_CONFIG = {
  confirmed:   { label: 'Confirmed',   icon: CheckCircle2, class: 'text-emerald-400 bg-emerald-400/10' },
  declined:    { label: 'Declined',    icon: XCircle,      class: 'text-red-400 bg-red-400/10' },
  maybe:       { label: 'Maybe',       icon: AlertCircle,  class: 'text-yellow-400 bg-yellow-400/10' },
  pending:     { label: 'Pending',     icon: Clock,        class: 'text-zinc-400 bg-zinc-400/10' },
  no_response: { label: 'No Response', icon: Clock,        class: 'text-zinc-500 bg-zinc-500/10' },
}

function RsvpBadge({ status }: { status: string }) {
  const cfg = RSVP_CONFIG[status as keyof typeof RSVP_CONFIG] ?? RSVP_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.class)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ── Copy from Event Modal ─────────────────────────────────────────────────────

function CopyModal({
  eventId,
  onClose,
  onSuccess,
}: {
  eventId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')
  const [sourceEventId, setSourceEventId] = useState('')
  const [strategy, setStrategy] = useState<'skip' | 'overwrite' | 'add_anyway'>('skip')
  const [preview, setPreview] = useState<CopyPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)

  const { data: eventsData } = useEvents()
  const otherEvents = (eventsData?.data ?? []).filter((e: any) => e.id !== eventId)

  const loadPreview = async () => {
    if (!sourceEventId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<CopyPreview>(
        `/events/${eventId}/guests/copy/preview?sourceEventId=${sourceEventId}`
      )
      setPreview(data)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const executeCopy = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.post(`/events/${eventId}/guests/copy`, {
        sourceEventId,
        duplicateStrategy: strategy,
      })
      setResult(data)
      setStep('done')
      onSuccess()
    } catch (e: any) {
      setError(e.message ?? 'Copy failed')
    } finally {
      setLoading(false)
    }
  }

  const sourceEvent = otherEvents.find((e: any) => e.id === sourceEventId)
  const displayGuests = preview
    ? showDuplicatesOnly
      ? preview.guests.filter((g) => g.is_duplicate)
      : preview.guests
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f0f18] border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Copy className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Copy Guests from Another Event</h2>
              <p className="text-xs text-muted-foreground">
                {step === 'select' ? 'Choose source event and strategy' :
                 step === 'preview' ? `Preview — ${preview?.total} guests from "${sourceEvent?.name}"` :
                 'Copy complete'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Select event ── */}
          {step === 'select' && (
            <div className="p-6 space-y-6">
              {/* Source event picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Source Event
                </label>
                {otherEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No other events found in your workspace.</p>
                ) : (
                  <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                    {otherEvents.map((e: any) => (
                      <button
                        key={e.id}
                        onClick={() => setSourceEventId(e.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                          sourceEventId === e.id
                            ? 'border-violet-500/60 bg-violet-500/10'
                            : 'border-border hover:border-border/80 hover:bg-white/3'
                        )}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: (e.color ?? '#7c3aed') + '20' }}
                        >
                          {e.event_type_data?.icon ?? '🎪'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.event_type?.replace(/_/g, ' ')}
                            {e.start_date && ` · ${new Date(e.start_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        {sourceEventId === e.id && (
                          <Check className="w-4 h-4 text-violet-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duplicate strategy */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  If a Guest Already Exists (matched by email or phone)
                </label>
                <div className="grid gap-2">
                  {[
                    {
                      value: 'skip',
                      label: 'Skip duplicates',
                      desc: 'Don\'t copy guests who already exist in this event',
                      icon: UserX,
                    },
                    {
                      value: 'overwrite',
                      label: 'Overwrite existing',
                      desc: 'Update existing guest records with data from the source event',
                      icon: RefreshCw,
                    },
                    {
                      value: 'add_anyway',
                      label: 'Add anyway',
                      desc: 'Create a new record even if a matching guest exists',
                      icon: UserCheck,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStrategy(opt.value as any)}
                        className={cn(
                          'flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                          strategy === opt.value
                            ? 'border-violet-500/60 bg-violet-500/10'
                            : 'border-border hover:border-border/80 hover:bg-white/3'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', strategy === opt.value ? 'text-violet-400' : 'text-muted-foreground')} />
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {strategy === opt.value && (
                          <Check className="w-4 h-4 text-violet-400 ml-auto shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && preview && (
            <div className="p-6 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Guests', value: preview.total, color: 'text-foreground' },
                  { label: 'New Guests', value: preview.new, color: 'text-emerald-400' },
                  { label: 'Duplicates', value: preview.duplicates, color: 'text-yellow-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-background border border-border rounded-xl p-3 text-center">
                    <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Strategy reminder */}
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Duplicates will be <strong className="mx-1">
                  {strategy === 'skip' ? 'skipped' : strategy === 'overwrite' ? 'overwritten' : 'added as new records'}
                </strong>
              </div>

              {/* Guest list */}
              {preview.duplicates > 0 && (
                <button
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                >
                  <Filter className="w-3 h-3" />
                  {showDuplicatesOnly ? 'Show all guests' : `Show ${preview.duplicates} duplicates only`}
                </button>
              )}

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {displayGuests.map((g) => (
                  <div
                    key={g.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg border',
                      g.is_duplicate
                        ? 'border-yellow-500/20 bg-yellow-500/5'
                        : 'border-border bg-background/50'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0 text-xs font-semibold text-violet-300">
                      {g.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {g.full_name}
                        {g.is_vip && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {g.email ?? g.phone ?? '—'}
                      </p>
                    </div>
                    {g.is_duplicate ? (
                      <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full shrink-0">
                        Dup · {g.duplicate_reason}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">
                        New
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold">Copy complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.copied} guest{result.copied !== 1 ? 's' : ''} added
                  {result.skipped > 0 && `, ${result.skipped} skipped`}
                  {result.overwritten > 0 && `, ${result.overwritten} updated`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-2">
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-400">{result.copied}</p>
                  <p className="text-xs text-muted-foreground">Added</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">{result.overwritten}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button
            onClick={step === 'preview' ? () => setStep('select') : onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === 'done' ? 'Close' : step === 'preview' ? '← Back' : 'Cancel'}
          </button>

          {step !== 'done' && (
            <button
              onClick={step === 'select' ? loadPreview : executeCopy}
              disabled={loading || (step === 'select' && !sourceEventId)}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 'select' ? 'Preview Copy' : 'Execute Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Guest Modal (quick inline form) ───────────────────────────────────────

function AddGuestModal({ eventId, onClose, onSuccess }: { eventId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', is_vip: false, dietary_requirements: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setLoading(true)
    setError('')
    try {
      await api.post(`/events/${eventId}/guests`, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to add guest')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md bg-[#0f0f18] border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Add Guest</h2>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        {[
          { key: 'full_name', label: 'Full Name *', placeholder: 'e.g. Priya Sharma', type: 'text' },
          { key: 'email', label: 'Email', placeholder: 'priya@example.com', type: 'email' },
          { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', type: 'tel' },
          { key: 'dietary_requirements', label: 'Dietary Requirements', placeholder: 'Vegan, Gluten-free…', type: 'text' },
        ].map(({ key, label, placeholder, type }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <input
              type={type}
              placeholder={placeholder}
              value={(form as any)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        ))}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_vip}
            onChange={(e) => setForm((f) => ({ ...f, is_vip: e.target.checked }))}
            className="rounded border-border"
          />
          <span className="text-sm">Mark as VIP</span>
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
        </label>
        {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.full_name.trim()}
            className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Guest
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GuestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [guests, setGuests] = useState<Guest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const [showAdd, setShowAdd] = useState(false)
  const [showCopy, setShowCopy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) qs.set('search', search)
      if (rsvpFilter) qs.set('rsvpStatus', rsvpFilter)
      const data = await api.get<{ data: Guest[]; count: number }>(
        `/events/${eventId}/guests?${qs}`
      )
      setGuests(data.data ?? [])
      setTotal(data.count ?? 0)
    } catch {
      // silently fail on network
    } finally {
      setLoading(false)
    }
  }, [eventId, search, rsvpFilter, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const rsvpCounts = guests.reduce<Record<string, number>>((acc, g) => {
    acc[g.rsvp_status] = (acc[g.rsvp_status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Guests</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            Guest List
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} guest{total !== 1 ? 's' : ''} · {rsvpCounts.confirmed ?? 0} confirmed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCopy(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-white/5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy from Event
          </button>
          <Link
            href={`/events/${eventId}/guests/import`}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-white/5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Guest
          </button>
        </div>
      </div>

      {/* Quick RSVP stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(RSVP_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon
          return (
            <button
              key={status}
              onClick={() => setRsvpFilter(rsvpFilter === status ? '' : status)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                rsvpFilter === status ? 'border-violet-500/60 bg-violet-500/10' : 'border-border hover:border-border/60 bg-card'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.class.split(' ')[0])} />
              <div>
                <p className="text-xs font-semibold tabular-nums">{rsvpCounts[status] ?? 0}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{cfg.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search guests…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {rsvpFilter && (
          <button
            onClick={() => setRsvpFilter('')}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs rounded-xl hover:bg-violet-500/20 transition-colors"
          >
            <Filter className="w-3 h-3" />
            {RSVP_CONFIG[rsvpFilter as keyof typeof RSVP_CONFIG]?.label}
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || rsvpFilter ? 'No guests match your filters' : 'No guests yet — add your first guest or copy from another event'}
            </p>
            {!search && !rsvpFilter && (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Guest
                </button>
                <button
                  onClick={() => setShowCopy(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy from Event
                </button>
                <Link
                  href={`/events/${eventId}/guests/import`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">RSVP</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Table</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Dietary</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Check-in</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g, i) => (
                    <tr
                      key={g.id}
                      className={cn(
                        'border-b border-border/50 hover:bg-white/2 transition-colors',
                        i === guests.length - 1 && 'border-b-0'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center text-xs font-semibold text-violet-300 shrink-0">
                            {g.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-1.5">
                              {g.full_name}
                              {g.is_vip && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                              {g.copied_from_event_id && (
                                <span className="text-[10px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-full">copied</span>
                              )}
                            </p>
                            {g.guest_categories && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: (g.guest_categories.color ?? '#7c3aed') + '20', color: g.guest_categories.color ?? '#a78bfa' }}
                              >
                                {g.guest_categories.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="space-y-0.5">
                          {g.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {g.email}
                            </p>
                          )}
                          {g.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {g.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RsvpBadge status={g.rsvp_status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {g.table_no ?? '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground max-w-[120px] truncate">
                        {g.dietary_requirements || '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {g.checked_in ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Checked in
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <button className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddGuestModal eventId={eventId} onClose={() => setShowAdd(false)} onSuccess={load} />
      )}
      {showCopy && (
        <CopyModal eventId={eventId} onClose={() => setShowCopy(false)} onSuccess={load} />
      )}
    </div>
  )
}
