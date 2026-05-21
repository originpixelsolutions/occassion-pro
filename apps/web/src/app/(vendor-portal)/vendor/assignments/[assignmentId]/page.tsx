'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface AssignmentDetail {
  id: string
  event_name: string
  event_date: string
  event_location?: string
  service_description: string
  agreed_amount: number
  currency_code: string
  status: string
  tenant_name: string
  vendor_response_note?: string
  messages: Message[]
  quotes: Quote[]
}

interface Message {
  id: string
  sender_type: 'team' | 'vendor'
  content: string
  created_at: string
  is_read_by_vendor: boolean
}

interface Quote {
  id: string
  service_description: string
  amount: number
  currency_code: string
  status: string
  notes?: string
  created_at: string
  reviewed_at?: string
  review_note?: string
}

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  declined: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

function fmtCurrency(amount: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const router = useRouter()

  const [data, setData] = useState<AssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'messages' | 'quotes'>('overview')
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [responding, setResponding] = useState(false)
  const [quoteForm, setQuoteForm] = useState({ service_description: '', amount: '', notes: '' })
  const [submittingQuote, setSubmittingQuote] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function token() { return localStorage.getItem('vendor_session_token') ?? '' }

  async function load() {
    try {
      const r = await fetch(`/api/v1/vendor-portal/events/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch { router.push('/vendor/assignments') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [assignmentId])

  useEffect(() => {
    if (tab === 'messages') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [tab, data?.messages])

  async function respond(response: 'confirmed' | 'declined') {
    setResponding(true)
    try {
      const r = await fetch(`/api/v1/vendor-portal/events/${assignmentId}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      if (!r.ok) throw new Error()
      await load()
    } catch {} finally { setResponding(false) }
  }

  async function sendMessage() {
    if (!msgText.trim() || sending) return
    setSending(true)
    try {
      const r = await fetch(`/api/v1/vendor-portal/events/${assignmentId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgText.trim() }),
      })
      if (!r.ok) throw new Error()
      setMsgText('')
      await load()
    } catch {} finally { setSending(false) }
  }

  async function submitQuote() {
    if (!quoteForm.service_description.trim() || !quoteForm.amount) return
    setSubmittingQuote(true)
    try {
      const r = await fetch(`/api/v1/vendor-portal/events/${assignmentId}/quotes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_description: quoteForm.service_description,
          amount: parseFloat(quoteForm.amount),
          notes: quoteForm.notes,
          currency_code: data?.currency_code ?? 'INR',
        }),
      })
      if (!r.ok) throw new Error()
      setQuoteForm({ service_description: '', amount: '', notes: '' })
      setShowQuoteForm(false)
      await load()
    } catch {} finally { setSubmittingQuote(false) }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-40 bg-zinc-900/60 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  const QUOTE_STATUS: Record<string, string> = {
    submitted: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    under_review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved: 'bg-green-500/15 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/vendor/assignments" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to assignments
      </Link>

      {/* Header card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg font-semibold text-white">{data.event_name}</h1>
              <span className={`px-2 py-0.5 text-xs rounded border capitalize ${STATUS_STYLES[data.status] ?? ''}`}>
                {data.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">{data.tenant_name}</p>
            <p className="text-zinc-500 text-xs mt-1">
              {fmtDate(data.event_date)}
              {data.event_location && ` · ${data.event_location}`}
            </p>
          </div>
          {data.agreed_amount && (
            <div className="text-right flex-shrink-0">
              <p className="text-zinc-400 text-xs">Agreed amount</p>
              <p className="text-xl font-semibold text-white">{fmtCurrency(data.agreed_amount, data.currency_code)}</p>
            </div>
          )}
        </div>

        {data.service_description && (
          <p className="text-zinc-300 text-sm mt-4 pt-4 border-t border-zinc-800">{data.service_description}</p>
        )}

        {/* Respond buttons */}
        {data.status === 'invited' && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-3">
            <p className="text-amber-400 text-sm flex-1">You've been invited to this event. Please respond:</p>
            <button
              onClick={() => respond('declined')}
              disabled={responding}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => respond('confirmed')}
              disabled={responding}
              className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {responding ? 'Saving…' : 'Accept'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['overview', 'messages', 'quotes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors relative ${
              tab === t
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {t}
            {t === 'messages' && data.messages.filter(m => m.sender_type === 'team' && !m.is_read_by_vendor).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[9px] text-white flex items-center justify-center">
                {data.messages.filter(m => m.sender_type === 'team' && !m.is_read_by_vendor).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-2">Event details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Organiser</span><span className="text-white">{data.tenant_name}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Date</span><span className="text-white">{fmtDate(data.event_date)}</span></div>
              {data.event_location && <div className="flex justify-between"><span className="text-zinc-400">Venue</span><span className="text-white">{data.event_location}</span></div>}
            </div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-2">Engagement</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Status</span><span className="capitalize text-white">{data.status.replace('_', ' ')}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Service</span><span className="text-white text-right max-w-[60%] truncate">{data.service_description || '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="text-white">{data.agreed_amount ? fmtCurrency(data.agreed_amount, data.currency_code) : 'TBD'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Messages */}
      {tab === 'messages' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col" style={{ height: '500px' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {data.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-zinc-600 text-sm">No messages yet. Start the conversation.</p>
              </div>
            ) : (
              data.messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === 'vendor' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                    m.sender_type === 'vendor'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                  }`}>
                    <p className="text-sm leading-relaxed">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_type === 'vendor' ? 'text-violet-300' : 'text-zinc-500'}`}>
                      {fmtDate(m.created_at)} {fmtTime(m.created_at)}
                      {m.sender_type === 'team' && ' · Organiser'}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          {['confirmed', 'in_progress', 'invited'].includes(data.status) && (
            <div className="border-t border-zinc-800 p-3 flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={sendMessage}
                disabled={!msgText.trim() || sending}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Quotes */}
      {tab === 'quotes' && (
        <div className="space-y-4">
          {data.quotes.length === 0 && !showQuoteForm && (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-10 text-center">
              <p className="text-zinc-500 text-sm">No quotes submitted yet</p>
              <button
                onClick={() => setShowQuoteForm(true)}
                className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Submit a quote
              </button>
            </div>
          )}

          {data.quotes.map(q => (
            <div key={q.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white text-sm font-medium">{q.service_description}</p>
                  {q.notes && <p className="text-zinc-400 text-xs mt-1">{q.notes}</p>}
                  <p className="text-zinc-500 text-xs mt-1">Submitted {fmtDate(q.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1.5">
                  <p className="text-white font-semibold">{fmtCurrency(q.amount, q.currency_code)}</p>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded border capitalize ${QUOTE_STATUS[q.status] ?? ''}`}>
                    {q.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {q.review_note && (
                <p className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                  <span className="text-zinc-500">Organiser note: </span>{q.review_note}
                </p>
              )}
            </div>
          ))}

          {/* Submit quote form */}
          {showQuoteForm ? (
            <div className="bg-zinc-900/60 border border-violet-500/30 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-medium text-white">New quote</h3>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Service description *</label>
                <input
                  type="text"
                  value={quoteForm.service_description}
                  onChange={e => setQuoteForm(f => ({ ...f, service_description: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                  placeholder="e.g. Full day wedding photography"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Amount ({data.currency_code}) *</label>
                <input
                  type="number"
                  value={quoteForm.amount}
                  onChange={e => setQuoteForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Notes (optional)</label>
                <textarea
                  value={quoteForm.notes}
                  onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Additional terms, inclusions, exclusions…"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowQuoteForm(false); setQuoteForm({ service_description: '', amount: '', notes: '' }) }}
                  className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg text-sm hover:border-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitQuote}
                  disabled={submittingQuote || !quoteForm.service_description || !quoteForm.amount}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submittingQuote ? 'Submitting…' : 'Submit quote'}
                </button>
              </div>
            </div>
          ) : data.quotes.length > 0 && (
            <button
              onClick={() => setShowQuoteForm(true)}
              className="px-4 py-2 border border-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-lg text-sm transition-colors"
            >
              + Submit another quote
            </button>
          )}
        </div>
      )}
    </div>
  )
}
