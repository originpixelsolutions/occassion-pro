'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  X, Search, MessageCircle, Ticket, Home, ChevronRight,
  ThumbsUp, ThumbsDown, Send, Loader2, AlertCircle,
  CheckCircle2, Clock, Zap, ArrowLeft, User, Bot,
  HeadphonesIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  usePlatformSupport,
  SupportTicket,
  SupportMessage,
  FAQ,
} from './usePlatformSupport'

type Tab = 'home' | 'chat' | 'tickets'
type ChatStep = 'search' | 'faq_result' | 'form' | 'submitted'

const CATEGORIES = ['Billing', 'Features', 'Technical', 'Account', 'Events', 'General']

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-500/20 text-blue-400' },
  bot_handled: { label: 'Answered',    color: 'bg-emerald-500/20 text-emerald-400' },
  escalated:   { label: 'Escalated',   color: 'bg-amber-500/20 text-amber-400' },
  in_progress: { label: 'In Progress', color: 'bg-violet-500/20 text-violet-400' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-600/20 text-emerald-300' },
  closed:      { label: 'Closed',      color: 'bg-muted text-muted-foreground' },
}

interface SupportDrawerProps {
  open: boolean
  onClose: () => void
}

export function SupportDrawer({ open, onClose }: SupportDrawerProps) {
  const support = usePlatformSupport()
  const [tab, setTab] = useState<Tab>('home')

  // Chat state
  const [chatStep, setChatStep]         = useState<ChatStep>('search')
  const [searchQuery, setSearchQuery]   = useState('')
  const [faqResults, setFaqResults]     = useState<FAQ[]>([])
  const [selectedFaq, setSelectedFaq]   = useState<FAQ | null>(null)
  const [searching, setSearching]       = useState(false)
  const [faqThumbDone, setFaqThumbDone] = useState(false)
  const [subject, setSubject]           = useState('')
  const [description, setDescription]   = useState('')
  const [category, setCategory]         = useState('General')
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null)

  // Ticket thread state
  const [activeTicket, setActiveTicket]       = useState<SupportTicket | null>(null)
  const [messages, setMessages]               = useState<SupportMessage[]>([])
  const [replyText, setReplyText]             = useState('')
  const [sendingMsg, setSendingMsg]           = useState(false)
  const [loadingThread, setLoadingThread]     = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Reset chat state when drawer opens
  useEffect(() => {
    if (open) { resetChat() }
  }, [open])

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription on active ticket messages
  useEffect(() => {
    if (!activeTicket) return
    const channel = supabase
      .channel(`support_messages:${activeTicket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${activeTicket.id}` },
        payload => {
          setMessages(prev => [...prev, payload.new as SupportMessage])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTicket?.id])

  function resetChat() {
    setChatStep('search')
    setSearchQuery('')
    setFaqResults([])
    setSelectedFaq(null)
    setFaqThumbDone(false)
    setSubject('')
    setDescription('')
    setCategory('General')
    setSubmittedTicket(null)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const results = await support.searchFaqs(searchQuery)
    setFaqResults(results)
    setSearching(false)
    if (results.length > 0) {
      setSelectedFaq(results[0])
      setChatStep('faq_result')
    } else {
      setSubject(searchQuery)
      setChatStep('form')
    }
  }

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) return
    const ticket = await support.createTicket({ subject, description, category })
    setSubmittedTicket(ticket)
    setChatStep('submitted')
  }

  async function openTicketThread(ticket: SupportTicket) {
    setLoadingThread(true)
    setActiveTicket(ticket)
    setTab('tickets')
    try {
      const full = await support.getTicket(ticket.id)
      setActiveTicket(full)
      setMessages(full.support_messages ?? [])
    } finally {
      setLoadingThread(false)
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !activeTicket) return
    setSendingMsg(true)
    try {
      await support.addMessage(activeTicket.id, replyText)
      setReplyText('')
      // Refresh ticket
      const full = await support.getTicket(activeTicket.id)
      setActiveTicket(full)
      setMessages(full.support_messages ?? [])
    } finally {
      setSendingMsg(false)
    }
  }

  function backToTicketList() {
    setActiveTicket(null)
    setMessages([])
    setReplyText('')
    support.loadTickets()
  }

  if (!open) return null

  return (
    <div className="fixed bottom-24 right-6 z-[998] w-[420px] max-w-[calc(100vw-2rem)] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 7rem)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-4 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {activeTicket && (
            <button onClick={backToTicketList} className="p-1 rounded hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          )}
          <div>
            <p className="font-semibold text-white text-sm">
              {activeTicket ? `#${activeTicket.ticket_number}` : 'OccasionPro Support'}
            </p>
            <p className="text-violet-200 text-xs">
              {activeTicket ? activeTicket.title : 'How can we help you?'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* ── Tab Bar (only when not in thread) ────────────────────────────── */}
      {!activeTicket && (
        <div className="flex border-b border-border shrink-0">
          {([
            { id: 'home',    label: 'Home',    icon: Home },
            { id: 'chat',    label: 'New',     icon: MessageCircle },
            { id: 'tickets', label: 'My Tickets', icon: Ticket },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                tab === id
                  ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === 'tickets' && support.openTicketCount > 0 && (
                <span className="ml-0.5 bg-violet-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {support.openTicketCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Ticket Thread View */}
        {activeTicket && (
          <TicketThread
            ticket={activeTicket}
            messages={messages}
            loading={loadingThread}
            replyText={replyText}
            sending={sendingMsg}
            onReplyChange={setReplyText}
            onSend={sendReply}
            onEscalate={async () => {
              await support.escalate(activeTicket.id)
              const full = await support.getTicket(activeTicket.id)
              setActiveTicket(full)
              setMessages(full.support_messages ?? [])
            }}
            messagesEndRef={messagesEndRef}
          />
        )}

        {/* Home Tab */}
        {!activeTicket && tab === 'home' && (
          <HomeTab
            categories={CATEGORIES}
            tickets={support.tickets.slice(0, 3)}
            onCategoryClick={async (cat) => {
              setTab('chat')
              setChatStep('search')
              setSearchQuery(cat)
            }}
            onNewTicket={() => { setTab('chat'); resetChat() }}
            onTicketClick={openTicketThread}
          />
        )}

        {/* Chat / New Ticket Tab */}
        {!activeTicket && tab === 'chat' && (
          <ChatTab
            step={chatStep}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            faqResults={faqResults}
            selectedFaq={selectedFaq}
            setSelectedFaq={setSelectedFaq}
            faqThumbDone={faqThumbDone}
            setFaqThumbDone={setFaqThumbDone}
            searching={searching}
            subject={subject}
            setSubject={setSubject}
            description={description}
            setDescription={setDescription}
            category={category}
            setCategory={setCategory}
            submittedTicket={submittedTicket}
            submitting={support.submitting}
            onSearch={handleSearch}
            onShowForm={() => { setSubject(searchQuery); setChatStep('form') }}
            onSubmit={handleSubmit}
            onReset={resetChat}
            onViewTicket={(t) => { setSubmittedTicket(null); openTicketThread(t) }}
          />
        )}

        {/* My Tickets Tab */}
        {!activeTicket && tab === 'tickets' && (
          <TicketListTab
            tickets={support.tickets}
            onTicketClick={openTicketThread}
            onNewTicket={() => { setTab('chat'); resetChat() }}
          />
        )}
      </div>
    </div>
  )
}

// ── Home Tab ────────────────────────────────────────────────────────────────

function HomeTab({ categories, tickets, onCategoryClick, onNewTicket, onTicketClick }: {
  categories: string[]
  tickets: SupportTicket[]
  onCategoryClick: (cat: string) => void
  onNewTicket: () => void
  onTicketClick: (t: SupportTicket) => void
}) {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="bg-muted/40 rounded-xl p-4 text-center">
        <HeadphonesIcon className="w-8 h-8 text-violet-400 mx-auto mb-2" />
        <p className="font-semibold text-foreground text-sm">Hi there! 👋</p>
        <p className="text-xs text-muted-foreground mt-1">Search our knowledge base or contact support below.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Browse by topic</p>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryClick(cat)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 text-left text-sm text-foreground transition-colors"
            >
              <span className="text-violet-400 text-xs">●</span>
              {cat}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNewTicket}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        Contact Support
      </button>

      {tickets.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent activity</p>
          <div className="flex flex-col gap-1.5">
            {tickets.map(t => (
              <TicketRow key={t.id} ticket={t} onClick={() => onTicketClick(t)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab(props: {
  step: ChatStep
  searchQuery: string; setSearchQuery: (v: string) => void
  faqResults: FAQ[]
  selectedFaq: FAQ | null; setSelectedFaq: (f: FAQ) => void
  faqThumbDone: boolean; setFaqThumbDone: (v: boolean) => void
  searching: boolean
  subject: string; setSubject: (v: string) => void
  description: string; setDescription: (v: string) => void
  category: string; setCategory: (v: string) => void
  submittedTicket: SupportTicket | null
  submitting: boolean
  onSearch: () => void
  onShowForm: () => void
  onSubmit: () => void
  onReset: () => void
  onViewTicket: (t: SupportTicket) => void
}) {
  const { step, searchQuery, setSearchQuery, faqResults, selectedFaq, setSelectedFaq,
    faqThumbDone, setFaqThumbDone, searching, subject, setSubject, description,
    setDescription, category, setCategory, submittedTicket, submitting,
    onSearch, onShowForm, onSubmit, onReset, onViewTicket } = props

  if (step === 'search') {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div>
          <p className="font-semibold text-foreground text-sm mb-1">What can we help with?</p>
          <p className="text-xs text-muted-foreground mb-3">Search our knowledge base for instant answers.</p>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
              placeholder="e.g. How do I upgrade my plan?"
              className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={onSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground text-center mb-2">Or contact us directly</p>
          <button onClick={onShowForm} className="w-full py-2 rounded-lg border border-border hover:bg-muted/50 text-sm text-foreground transition-colors">
            Create a support ticket
          </button>
        </div>
      </div>
    )
  }

  if (step === 'faq_result' && selectedFaq) {
    return (
      <div className="p-4 flex flex-col gap-4">
        {/* Bot message bubble */}
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="bg-muted/40 rounded-xl rounded-tl-sm px-3 py-3 flex-1">
            <p className="text-xs font-semibold text-violet-400 mb-1.5">Here's what I found:</p>
            <p className="text-sm font-medium text-foreground mb-2">{selectedFaq.question}</p>
            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {selectedFaq.answer}
            </div>
          </div>
        </div>

        {/* Multiple results tabs */}
        {faqResults.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {faqResults.slice(0, 4).map((f, i) => (
              <button
                key={f.id}
                onClick={() => setSelectedFaq(f)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  f.id === selectedFaq.id
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                Result {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Thumbs rating */}
        {!faqThumbDone ? (
          <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground flex-1">Was this helpful?</p>
            <button
              onClick={() => setFaqThumbDone(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Yes
            </button>
            <button
              onClick={() => { setFaqThumbDone(true); setTimeout(onShowForm, 300) }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors"
            >
              <ThumbsDown className="w-3.5 h-3.5" /> No
            </button>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground">Thanks for your feedback!</p>
        )}

        <div className="border-t border-border pt-3 flex gap-2">
          <button onClick={onReset} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            Search again
          </button>
          <button onClick={onShowForm} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors">
            Still need help?
          </button>
        </div>
      </div>
    )
  }

  if (step === 'form') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold text-foreground text-sm mb-0.5">Create a support ticket</p>
          <p className="text-xs text-muted-foreground">Our team usually responds within 24 hours.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-violet-500 text-foreground"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe your issue in detail..."
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onReset} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !subject.trim() || !description.trim()}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Submit'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'submitted' && submittedTicket) {
    const wasAnswered = submittedTicket.status === 'bot_handled'
    return (
      <div className="p-4 flex flex-col gap-4">
        {wasAnswered ? (
          <>
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted/40 rounded-xl rounded-tl-sm px-3 py-3 flex-1">
                <p className="text-xs font-semibold text-violet-400 mb-1.5">I found an answer for you:</p>
                {submittedTicket.bot_answer && (
                  <div className="text-sm text-foreground/80 leading-relaxed">
                    {submittedTicket.bot_answer.answer}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground text-center">
              Ticket #{submittedTicket.ticket_number} created. Not satisfied?{' '}
              <button onClick={() => onViewTicket(submittedTicket)} className="text-violet-400 hover:underline">
                Open the thread
              </button>{' '}
              to escalate to our team.
            </div>
          </>
        ) : (
          <div className="text-center py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-violet-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Ticket #{submittedTicket.ticket_number} created</p>
              <p className="text-xs text-muted-foreground mt-1">Our team has been notified. Usual response time is within 24 hours.</p>
            </div>
            <button
              onClick={() => onViewTicket(submittedTicket)}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              View ticket thread
            </button>
          </div>
        )}
        <button onClick={onReset} className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors">
          Submit another ticket
        </button>
      </div>
    )
  }

  return null
}

// ── Ticket List Tab ─────────────────────────────────────────────────────────

function TicketListTab({ tickets, onTicketClick, onNewTicket }: {
  tickets: SupportTicket[]
  onTicketClick: (t: SupportTicket) => void
  onNewTicket: () => void
}) {
  if (tickets.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center gap-3">
        <Ticket className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No support tickets yet.</p>
        <button onClick={onNewTicket} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
          Contact Support
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-1.5">
      {tickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => onTicketClick(t)} />)}
    </div>
  )
}

// ── Ticket Row ──────────────────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: SupportTicket; onClick: () => void }) {
  const status = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: 'bg-muted text-muted-foreground' }
  const msgCount = ticket._msg_count?.[0]?.count ?? 0

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 text-left transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground font-mono">{ticket.ticket_number}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', status.color)}>{status.label}</span>
        </div>
        <p className="text-sm text-foreground truncate font-medium">{ticket.title ?? ticket.subject}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {msgCount > 0 && ` · ${msgCount} message${msgCount !== 1 ? 's' : ''}`}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </button>
  )
}

// ── Ticket Thread ───────────────────────────────────────────────────────────

function TicketThread({ ticket, messages, loading, replyText, sending, onReplyChange, onSend, onEscalate, messagesEndRef }: {
  ticket: SupportTicket
  messages: SupportMessage[]
  loading: boolean
  replyText: string
  sending: boolean
  onReplyChange: (v: string) => void
  onSend: () => void
  onEscalate: () => void
  messagesEndRef: React.RefObject<HTMLDivElement>
}) {
  const status = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: 'bg-muted text-muted-foreground' }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const resolved = ['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="flex flex-col h-full">
      {/* Status strip */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/20 shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', status.color)}>{status.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-4">No messages yet.</p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Escalate hint */}
      {ticket.status === 'bot_handled' && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 flex-1">Not satisfied with the bot answer?</p>
          <button onClick={onEscalate} className="text-xs text-amber-400 hover:text-amber-300 font-medium underline transition-colors">
            Escalate
          </button>
        </div>
      )}

      {/* Reply box */}
      {!resolved && (
        <div className="px-3 py-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={e => onReplyChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
              disabled={sending}
            />
            <button
              onClick={onSend}
              disabled={!replyText.trim() || sending}
              className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
      {resolved && (
        <p className="text-xs text-center text-muted-foreground py-3 border-t border-border shrink-0">
          This ticket has been resolved.
        </p>
      )}
    </div>
  )
}

// ── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: SupportMessage }) {
  const isUser  = message.sender_type === 'user'
  const isBot   = message.sender_type === 'bot'
  const isAdmin = message.sender_type === 'super_admin'

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isBot   ? 'bg-violet-600' :
        isAdmin ? 'bg-blue-600' :
        'bg-muted',
      )}>
        {isBot   ? <Bot  className="w-3.5 h-3.5 text-white" /> :
         isAdmin ? <HeadphonesIcon className="w-3.5 h-3.5 text-white" /> :
                   <User className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[78%] px-3 py-2.5 rounded-xl text-sm leading-relaxed',
        isUser  ? 'bg-violet-600 text-white rounded-tr-sm' :
        isAdmin ? 'bg-blue-600/20 text-foreground rounded-tl-sm border border-blue-500/20' :
                  'bg-muted/50 text-foreground/90 rounded-tl-sm',
      )}>
        {isAdmin && (
          <p className="text-[10px] text-blue-400 font-semibold mb-1">Support Team</p>
        )}
        <p className="whitespace-pre-wrap">{message.message}</p>
        <p className={cn(
          'text-[10px] mt-1',
          isUser ? 'text-white/60 text-right' : 'text-muted-foreground',
        )}>
          {new Date(message.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
