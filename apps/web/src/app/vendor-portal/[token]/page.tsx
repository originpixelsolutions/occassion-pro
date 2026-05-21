'use client'

import { useState, useEffect, useRef } from 'react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationBell } from '@/components/notifications'
import { useParams } from 'next/navigation'
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Package,
  Send,
  Upload,
  XCircle,
  AlertCircle,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from 'lucide-react'
import { getGreeting, getGreetingEmoji } from '@/lib/greeting'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorPortalData {
  vendor: {
    id: string
    name: string
    email: string
    phone?: string
    company_name?: string
  }
  contract: {
    id: string
    service_type: string
    status: string
    contract_value: number
    start_date?: string
    end_date?: string
    payment_status?: string
    paid_amount?: number
    notes?: string
  }
  event: {
    id: string
    name: string
    event_type: string
    start_date: string
    end_date?: string
    status: string
    expected_guests?: number
  }
  deliverables: Deliverable[]
  messages: Message[]
  otherContracts: OtherContract[]
}

interface Deliverable {
  id: string
  title: string
  description?: string
  file_url?: string
  file_name?: string
  deliverable_type: string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected'
  review_notes?: string
  submitted_at: string
  reviewed_at?: string
}

interface Message {
  id: string
  message: string
  from_vendor: boolean
  sender_name?: string
  created_at: string
  read_at?: string
}

interface OtherContract {
  id: string
  service_type: string
  status: string
  contract_value: number
  start_date?: string
  events?: { id: string; name: string; start_date: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    approved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
    submitted: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    under_review: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    active: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    signed: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    draft: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
    paid: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    partial: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    overdue: 'text-red-400 bg-red-400/10 border-red-400/20',
    pending: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  }
  return map[status] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
}

function DeliverableStatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-400" />
  if (status === 'under_review') return <Clock className="w-4 h-4 text-amber-400" />
  return <Clock className="w-4 h-4 text-blue-400" />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [data, setData] = useState<VendorPortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'deliverables' | 'messages' | 'contracts'>('overview')

  // Deliverable form state
  const [submitForm, setSubmitForm] = useState({ title: '', description: '', file_url: '', file_name: '', deliverable_type: 'document' })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Message state
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    fetchDashboard()
  }, [token])

  useEffect(() => {
    if (data?.messages) setMessages(data.messages)
  }, [data])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchDashboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/vendor-portal/access/${token}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Unable to load portal')
      }
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function submitDeliverable() {
    if (!submitForm.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/vendor-portal/access/${token}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitSuccess(true)
      setSubmitForm({ title: '', description: '', file_url: '', file_name: '', deliverable_type: 'document' })
      // Refresh deliverables
      await fetchDashboard()
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch {
      alert('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return
    setSendingMsg(true)
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      message: newMessage,
      from_vendor: true,
      sender_name: data?.vendor.name ?? 'You',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    const text = newMessage
    setNewMessage('')
    try {
      const res = await fetch(`${API}/vendor-portal/access/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error('Send failed')
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      setNewMessage(text)
      alert('Failed to send message.')
    } finally {
      setSendingMsg(false)
    }
  }

  // ─── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your vendor portal…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-foreground text-xl font-semibold">Portal Unavailable</h2>
          <p className="text-zinc-400 text-sm">{error}</p>
          <p className="text-muted-foreground text-xs">If you believe this is an error, please contact the event team.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { vendor, contract, event, deliverables, otherContracts } = data
  const unreadCount = messages.filter(m => !m.from_vendor && !m.read_at).length
  const paidPct = contract.contract_value > 0
    ? Math.round(((contract.paid_amount ?? 0) / contract.contract_value) * 100)
    : 0

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600/20 border border-violet-500/30 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-none">OccasionPro Vendor Portal</p>
              <h1 className="text-sm font-semibold text-foreground leading-tight">{vendor.company_name ?? vendor.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor(contract.status)}`}>
              {contract.status.toUpperCase()}
            </span>
            <NotificationBell variant="compact" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Welcome */}
        {(() => {
          const firstName = vendor.name.split(' ')[0]
          const daysUntil = Math.ceil((new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          const pendingDeliverables = deliverables.filter(d => d.status === 'submitted' || d.status === 'under_review').length
          return (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {getGreeting()}, {firstName} {getGreetingEmoji()}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {daysUntil > 0 ? (
                  <><span className="font-medium text-foreground">{event.name}</span>{' is in '}
                    <span className="font-medium text-foreground">{daysUntil} day{daysUntil !== 1 ? 's' : ''}</span>
                    {pendingDeliverables > 0 && (
                      <>{' · '}<span className="font-medium text-violet-400">{pendingDeliverables} deliverable{pendingDeliverables !== 1 ? 's' : ''} pending review</span></>
                    )}
                  </>
                ) : daysUntil === 0 ? (
                  <><span className="font-medium text-foreground">{event.name}</span>{' is '}<span className="font-medium text-violet-400">today!</span></>
                ) : (
                  <span className="font-medium text-foreground">{event.name}</span>
                )}
              </p>
            </div>
          )
        })()}

        {/* ── Event Banner ── */}
        <div className="bg-gradient-to-br from-violet-500/8 to-card border border-violet-500/20 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="space-y-1">
              <p className="text-xs text-violet-400 font-medium uppercase tracking-wide">{event.event_type}</p>
              <h2 className="text-2xl font-bold text-foreground">{event.name}</h2>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(event.start_date)}
                  {event.end_date && event.end_date !== event.start_date && ` – ${fmtDate(event.end_date)}`}
                </span>
                {event.expected_guests && (
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {event.expected_guests.toLocaleString()} guests
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-card/80 border border-border/50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Contract Value</p>
                <p className="text-lg font-bold text-foreground">{fmtCurrency(contract.contract_value)}</p>
              </div>
              <div className="bg-card/80 border border-border/50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className={`text-lg font-bold ${paidPct === 100 ? 'text-emerald-400' : paidPct > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                  {paidPct}%
                </p>
              </div>
            </div>
          </div>

          {/* Payment progress bar */}
          {contract.contract_value > 0 && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid: {fmtCurrency(contract.paid_amount ?? 0)}</span>
                <span>Remaining: {fmtCurrency(contract.contract_value - (contract.paid_amount ?? 0))}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-1">
          {([
            { key: 'overview', label: 'Overview', icon: Building2 },
            { key: 'deliverables', label: `Deliverables${deliverables.length > 0 ? ` (${deliverables.length})` : ''}`, icon: Package },
            { key: 'messages', label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: MessageSquare },
            ...(otherContracts.length > 0 ? [{ key: 'contracts', label: 'Other Contracts', icon: FileText }] : []),
          ] as { key: typeof tab; label: string; icon: React.FC<{ className?: string }> }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-lg font-medium transition-all ${
                tab === t.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <t.icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vendor Info */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Your Details</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{vendor.name}</p>
                    {vendor.company_name && <p className="text-xs text-zinc-400">{vendor.company_name}</p>}
                  </div>
                </div>
                {vendor.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                    <a href={`mailto:${vendor.email}`} className="text-sm text-violet-400 hover:underline">{vendor.email}</a>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                    <a href={`tel:${vendor.phone}`} className="text-sm text-zinc-300 hover:text-foreground">{vendor.phone}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Contract Info */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Contract Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Service Type</span>
                  <span className="text-sm text-foreground font-medium">{contract.service_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(contract.status)}`}>
                    {contract.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Payment</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(contract.payment_status ?? 'pending')}`}>
                    {contract.payment_status ?? 'pending'}
                  </span>
                </div>
                {contract.start_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-400">Start Date</span>
                    <span className="text-sm text-foreground">{fmtDate(contract.start_date)}</span>
                  </div>
                )}
                {contract.end_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-400">End Date</span>
                    <span className="text-sm text-foreground">{fmtDate(contract.end_date)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-3 flex justify-between">
                  <span className="text-sm text-zinc-400">Contract Value</span>
                  <span className="text-sm text-foreground font-semibold">{fmtCurrency(contract.contract_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Amount Paid</span>
                  <span className="text-sm text-emerald-400 font-semibold">{fmtCurrency(contract.paid_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {contract.notes && (
              <div className="md:col-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Notes from Team</h3>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{contract.notes}</p>
              </div>
            )}

            {/* Recent deliverables summary */}
            {deliverables.length > 0 && (
              <div className="md:col-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Recent Deliverables</h3>
                  <button onClick={() => setTab('deliverables')} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {deliverables.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-3 py-2">
                      <DeliverableStatusIcon status={d.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{d.title}</p>
                        <p className="text-xs text-zinc-500">{fmtDate(d.submitted_at)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(d.status)}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'deliverables' && (
          <div className="space-y-6">
            {/* Submit Form */}
            <div className="bg-zinc-900/60 border border-violet-800/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-foreground">Submit a Deliverable</h3>
              </div>
              {submitSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Deliverable submitted successfully!
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={submitForm.title}
                    onChange={e => setSubmitForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Final stage layout design"
                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1.5">Description</label>
                  <textarea
                    value={submitForm.description}
                    onChange={e => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe what you're submitting…"
                    rows={3}
                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/60 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">File URL</label>
                  <input
                    type="url"
                    value={submitForm.file_url}
                    onChange={e => setSubmitForm(f => ({ ...f, file_url: e.target.value }))}
                    placeholder="https://drive.google.com/…"
                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">File Name</label>
                  <input
                    type="text"
                    value={submitForm.file_name}
                    onChange={e => setSubmitForm(f => ({ ...f, file_name: e.target.value }))}
                    placeholder="layout_v2.pdf"
                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Type</label>
                  <select
                    value={submitForm.deliverable_type}
                    onChange={e => setSubmitForm(f => ({ ...f, deliverable_type: e.target.value }))}
                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500/60"
                  >
                    <option value="document">Document</option>
                    <option value="design">Design</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                    <option value="spreadsheet">Spreadsheet</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={submitDeliverable}
                  disabled={!submitForm.title.trim() || submitting}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {submitting ? 'Submitting…' : 'Submit Deliverable'}
                </button>
              </div>
            </div>

            {/* Deliverables List */}
            {deliverables.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No deliverables submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliverables.map(d => (
                  <div key={d.id} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <DeliverableStatusIcon status={d.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{d.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(d.status)}`}>
                              {d.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-full">
                              {d.deliverable_type}
                            </span>
                          </div>
                          {d.description && <p className="text-sm text-zinc-400 mt-1">{d.description}</p>}
                          {d.file_url && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 mt-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {d.file_name ?? 'View file'}
                            </a>
                          )}
                          <p className="text-xs text-zinc-600 mt-2">Submitted {fmtDate(d.submitted_at)}</p>
                        </div>
                      </div>
                    </div>
                    {d.review_notes && (
                      <div className={`mt-3 pt-3 border-t border-zinc-800 flex gap-2 ${d.status === 'rejected' ? 'text-red-400' : 'text-zinc-400'}`}>
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium mb-0.5">Review notes</p>
                          <p className="text-xs">{d.review_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="flex flex-col h-[calc(100vh-22rem)] min-h-[400px] bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
            {/* Messages thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <div className="text-center">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from_vendor ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] space-y-1 ${msg.from_vendor ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2">
                        {!msg.from_vendor && (
                          <span className="text-xs text-zinc-500">{msg.sender_name ?? 'Team'}</span>
                        )}
                        <span className="text-xs text-zinc-600">{fmtTime(msg.created_at)}</span>
                      </div>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.from_vendor
                            ? 'bg-violet-600 text-white rounded-tr-sm'
                            : 'bg-muted text-zinc-200 rounded-tl-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-zinc-800/60 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message…"
                  className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/60"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sendingMsg}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'contracts' && otherContracts.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Your other active contracts with this company.</p>
            {otherContracts.map(c => (
   