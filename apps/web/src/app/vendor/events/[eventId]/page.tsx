'use client'

/**
 * Vendor Portal — Event Assignment Detail
 * GET  /vendor-portal/events/:assignmentId
 * POST /vendor-portal/events/:assignmentId/respond   { action: 'accept'|'decline', note? }
 * GET  /vendor-portal/events/:assignmentId/messages  (staff↔vendor thread)
 * POST /vendor-portal/events/:assignmentId/messages  { content }
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, CalendarDays, MapPin, Tag, DollarSign, CheckCircle2,
  XCircle, Clock, MessageSquare, Send, Loader2, AlertCircle,
  Star, FileText, Receipt,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface EventDetail {
  id: string
  name: string
  event_date: string | null
  event_type: string | null
  venue: string | null
  description: string | null
}

interface Assignment {
  id: string
  status: string
  service_description: string | null
  agreed_amount: number | null
  currency_code: string
  vendor_response_note: string | null
  responded_at: string | null
  rating: number | null
  rating_note: string | null
  event: EventDetail
}

interface Message {
  id: string
  sender_type: 'team' | 'vendor'
  content: string
  is_read_by_vendor: boolean
  created_at: string
}

interface Quote {
  id: string
  service_description: string
  amount: number
  currency_code: string
  notes: string | null
  file_url: string | null
  status: 'submitted' | 'under_review' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  review_note: string | null
}

const QUOTE_STATUS_COLORS: Record<string, string> = {
  submitted:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  under_review: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  approved:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rejected:     'text-red-400 bg-red-500/10 border-red-500/20',
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  invited:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  confirmed:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  in_progress: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  completed:   'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  cancelled:   'text-red-400 bg-red-500/10 border-red-500/20',
  declined:    'text-red-400 bg-red-500/10 border-red-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  invited: 'Invited', confirmed: 'Confirmed', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined',
}

function formatCurrency(amount: number | null, currency = 'INR') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function VendorEventDetailPage() {
  const router = useRouter()
  const { eventId: assignmentId } = useParams<{ eventId: string }>()

  const [assignment, setAssignment]   = useState<Assignment | null>(null)
  const [messages, setMessages]       = useState<Message[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [activeTab, setActiveTab]     = useState<'details' | 'messages' | 'quotes'>('details')

  // Respond state
  const [responding, setResponding]   = useState(false)
  const [responseNote, setResponseNote] = useState('')
  const [respondError, setRespondError] = useState('')

  // Message state
  const [msgContent, setMsgContent]   = useState('')
  const [sending, setSending]         = useState(false)
  const [msgError, setMsgError]       = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Quote state
  const [quotes, setQuotes]                 = useState<Quote[]>([])
  const [quotesLoading, setQuotesLoading]   = useState(false)
  const [quoteDesc, setQuoteDesc]           = useState('')
  const [quoteAmount, setQuoteAmount]       = useState('')
  const [quoteCurrency, setQuoteCurrency]   = useState('INR')
  const [quoteNotes, setQuoteNotes]         = useState('')
  const [quoteFileUrl, setQuoteFileUrl]     = useState('')
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteError, setQuoteError]         = useState('')
  const [quoteSuccess, setQuoteSuccess]     = useState('')

  function getSession() {
    const s = localStorage.getItem('vp_session')
    if (!s) { router.replace('/vendor/login'); return null }
    return s
  }

  const loadMessages = useCallback(async () => {
    const session = localStorage.getItem('vp_session')
    if (!session) return
    try {
      const res = await fetch(`${API}/vendor-portal/events/${assignmentId}/messages`, {
        headers: { 'X-Vendor-Session': session },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? data)
      }
    } catch {}
  }, [assignmentId])

  const loadQuotes = useCallback(async () => {
    const session = localStorage.getItem('vp_session')
    if (!session) return
    setQuotesLoading(true)
    try {
      const res = await fetch(`${API}/vendor-portal/events/${assignmentId}/quotes`, {
        headers: { 'X-Vendor-Session': session },
      })
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.quotes ?? [])
      }
    } catch {}
    finally { setQuotesLoading(false) }
  }, [assignmentId])

  useEffect(() => {
    const session = getSession()
    if (!session) return

    async function init() {
      try {
        const [aRes] = await Promise.all([
          fetch(`${API}/vendor-portal/events/${assignmentId}`, {
            headers: { 'X-Vendor-Session': session! },
          }),
        ])
        if (aRes.status === 401) { router.replace('/vendor/login'); return }
        if (aRes.ok) {
          const data = await aRes.json()
          setAssignment(data.assignment ?? data)
        } else {
          setError('Assignment not found.')
        }
        await loadMessages()
      } catch {
        setError('Failed to load assignment.')
      } finally {
        setLoading(false)
      }
    }
    init()

    pollRef.current = setInterval(loadMessages, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [assignmentId, loadMessages, router])

  useEffect(() => {
    if (activeTab === 'messages') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    if (activeTab === 'quotes') {
      loadQuotes()
    }
  }, [messages, activeTab, loadQuotes])

  async function handleRespond(action: 'accept' | 'decline') {
    const session = getSession()
    if (!session) return
    setResponding(true)
    setRespondError('')
    try {
      const res = await fetch(`${API}/vendor-portal/events/${assignmentId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vendor-Session': session },
        body: JSON.stringify({ action, note: responseNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setRespondError(data.message ?? 'Failed to respond.'); return }
      setAssignment(prev => prev ? { ...prev, status: action === 'accept' ? 'confirmed' : 'declined', vendor_response_note: responseNote.trim() || null } : prev)
      setResponseNote('')
    } catch {
      setRespondError('Network error.')
    } finally {
      setResponding(false)
    }
  }

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault()
    const session = getSession()
    if (!session) return
    if (!quoteDesc.trim()) { setQuoteError('Service description is required.'); return }
    const amt = parseFloat(quoteAmount)
    if (!quoteAmount || isNaN(amt) || amt <= 0) { setQuoteError('Enter a valid amount greater than 0.'); return }
    setQuoteSubmitting(true)
    setQuoteError('')
    setQuoteSuccess('')
    try {
      const res = await fetch(`${API}/vendor-portal/events/${assignmentId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vendor-Session': session },
        body: JSON.stringify({
          service_description: quoteDesc.trim(),
          amount: amt,
          currency_code: quoteCurrency,
          notes: quoteNotes.trim() || undefined,
          file_url: quoteFileUrl.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setQuoteError(data.message ?? 'Failed to submit quote.'); return }
      setQuoteSuccess('Quote submitted successfully!')
      setQuoteDesc(''); setQuoteAmount(''); setQuoteNotes(''); setQuoteFileUrl('')
      await loadQuotes()
    } catch {
      setQuoteError('Network error.')
    } finally {
      setQuoteSubmitting(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgContent.trim()) return
    const session = getSession()
    if (!session) return
    setSending(true)
    setMsgError('')
    try {
      const res = await fetch(`${API}/vendor-portal/events/${assignmentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vendor-Session': session },
        body: JSON.stringify({ content: msgContent.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMsgError(d.message ?? 'Failed to send.'); return
      }
      setMsgContent('')
      await loadMessages()
    } catch {
      setMsgError('Network error.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (error || !assignment) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error || 'Assignment not found.'}</p>
        </div>
        <button onClick={() => router.back()} className="mt-4 text-sm text-zinc-500 hover:text-white flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    )
  }

  const ev = assignment.event

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => router.push('/vendor/events')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        My Events
      </button>

      {/* Event Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{ev?.name ?? 'Event'}</h1>
            {ev?.event_type && (
              <span className="text-xs text-zinc-500 mt-0.5 block">{ev.event_type}</span>
            )}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${STATUS_COLORS[assignment.status] ?? ''}`}>
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <CalendarDays className="w-4 h-4 text-zinc-600 shrink-0" />
            <span>{formatDate(ev?.event_date)}</span>
          </div>
          {ev?.venue && (
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="w-4 h-4 text-zinc-600 shrink-0" />
              <span className="truncate">{ev.venue}</span>
            </div>
          )}
          {assignment.service_description && (
            <div className="flex items-center gap-2 text-zinc-400 col-span-2">
              <Tag className="w-4 h-4 text-zinc-600 shrink-0" />
              <span>{assignment.service_description}</span>
            </div>
          )}
          {assignment.agreed_amount != null && (
            <div className="flex items-center gap-2 col-span-2">
              <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-emerald-400 font-semibold">
                {formatCurrency(assignment.agreed_amount, assignment.currency_code)}
              </span>
            </div>
          )}
        </div>

        {ev?.description && (
          <p className="mt-3 text-sm text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
            {ev.description}
          </p>
        )}
      </div>

      {/* Invitation Response (only when invited) */}
      {assignment.status === 'invited' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-300">Respond to Invitation</h2>
          </div>
          <p className="text-xs text-amber-400/70 mb-4">
            Please accept or decline this event assignment. You can add an optional note.
          </p>
          <textarea
            value={responseNote}
            onChange={e => setResponseNote(e.target.value)}
            placeholder="Add a note (optional)…"
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-amber-500 mb-3"
          />
          {respondError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{respondError}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleRespond('accept')}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
            >
              {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept
            </button>
            <button
              onClick={() => handleRespond('decline')}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-red-400 font-medium text-sm py-2.5 rounded-xl transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Rating (if completed and rated) */}
      {assignment.status === 'completed' && assignment.rating != null && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Your Rating</h2>
          </div>
          <div className="flex items-center gap-1 mb-1">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-5 h-5 ${i <= assignment.rating! ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
            ))}
            <span className="text-sm font-semibold text-white ml-1">{assignment.rating}/5</span>
          </div>
          {assignment.rating_note && (
            <p className="text-sm text-zinc-500 mt-1">"{assignment.rating_note}"</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([
          { key: 'details',  label: 'Details',                          icon: null },
          { key: 'messages', label: `Messages${messages.length ? ` (${messages.length})` : ''}`, icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { key: 'quotes',   label: `Quotes${quotes.length ? ` (${quotes.length})` : ''}`,       icon: <Receipt className="w-3.5 h-3.5" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
              activeTab === key
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Assignment Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[assignment.status] ?? ''}`}>
                {STATUS_LABELS[assignment.status] ?? assignment.status}
              </span>
            </div>
            {assignment.service_description && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500">Service</span>
                <span className="text-zinc-300 text-right">{assignment.service_description}</span>
              </div>
            )}
            {assignment.agreed_amount != null && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Agreed Amount</span>
                <span className="text-emerald-400 font-semibold">
                  {formatCurrency(assignment.agreed_amount, assignment.currency_code)}
                </span>
              </div>
            )}
            {assignment.vendor_response_note && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Your Note</span>
                <span className="text-zinc-300 text-right">{assignment.vendor_response_note}</span>
              </div>
            )}
            {assignment.responded_at && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Responded</span>
                <span className="text-zinc-400">{formatTime(assignment.responded_at)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quote / Invoice Tab */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          {/* Submit new quote */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Submit a Quote / Invoice</h3>
            </div>
            <form onSubmit={handleSubmitQuote} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Service Description *</label>
                <textarea
                  value={quoteDesc}
                  onChange={e => setQuoteDesc(e.target.value)}
                  placeholder="Describe the service you are quoting for…"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Amount *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={quoteAmount}
                    onChange={e => setQuoteAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Currency</label>
                  <select
                    value={quoteCurrency}
                    onChange={e => setQuoteCurrency(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                    <option value="GBP">GBP £</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Notes</label>
                <textarea
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  placeholder="Any additional notes or terms…"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Document Link (optional)</label>
                <input
                  type="url"
                  value={quoteFileUrl}
                  onChange={e => setQuoteFileUrl(e.target.value)}
                  placeholder="https://… (link to PDF invoice or quote)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {quoteError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{quoteError}</p>
                </div>
              )}
              {quoteSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400">{quoteSuccess}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={quoteSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
              >
                {quoteSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {quoteSubmitting ? 'Submitting…' : 'Submit Quote'}
              </button>
            </form>
          </div>

          {/* Submitted quotes list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-3">Submitted Quotes</h3>
            {quotesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : quotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No quotes submitted yet</p>
                <p className="text-xs text-zinc-600 mt-1">Use the form above to submit your first quote.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map(q => (
                  <div key={q.id} className="border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-white font-medium">{q.service_description}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${QUOTE_STATUS_COLORS[q.status] ?? ''}`}>
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-400 font-semibold">
                        {formatCurrency(q.amount, q.currency_code)}
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-500 text-xs">{new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {q.notes && (
                      <p className="text-xs text-zinc-500 mt-2 border-t border-zinc-800 pt-2">{q.notes}</p>
                    )}
                    {q.review_note && (
                      <p className="text-xs text-zinc-400 mt-2 italic">Reviewer note: {q.review_note}</p>
                    )}
                    {q.file_url && (
                      <a
                        href={q.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-2"
                      >
                        <FileText className="w-3 h-3" /> View Document
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden" style={{ minHeight: '360px' }}>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: '400px' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No messages yet</p>
                <p className="text-xs text-zinc-600 mt-1">Send a message to the event team.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isVendor = msg.sender_type === 'vendor'
                return (
                  <div key={msg.id} className={`flex ${isVendor ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] flex flex-col gap-1 ${isVendor ? 'items-end' : 'items-start'}`}>
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isVendor
                          ? 'bg-cyan-600 text-white rounded-tr-sm'
                          : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-600">
                          {isVendor ? 'You' : 'Event Team'}
                        </span>
                        <span className="text-[10px] text-zinc-700">·</span>
                        <span className="text-[11px] text-zinc-600">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Compose */}
          {msgError && (
            <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{msgError}</p>
            </div>
          )}
          <form
            onSubmit={handleSendMessage}
            className="px-4 py-3 border-t border-zinc-800 flex items-end gap-2"
          >
            <textarea
              value={msgContent}
              onChange={e => setMsgContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e as any)
                }
              }}
              placeholder="Message the event team…"
              rows={2}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={sending || !msgContent.trim()}
              className="w-9 h-9 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
