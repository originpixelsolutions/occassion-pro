'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useEvent } from '@/hooks/use-events'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Sparkles, Send, Bot, User, RefreshCw,
  FileText, DollarSign, Users, AlertTriangle,
  Lightbulb, BarChart3, Zap, Copy, ThumbsUp,
  CalendarDays, Truck, Brain,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant'

type Message = {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isStreaming?: boolean
}

type PromptSuggestion = {
  label: string
  prompt: string
  icon: React.ElementType
  category: string
}

// ── Suggestions ────────────────────────────────────────────────────────────────

const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  { icon: FileText,      category: 'Proposals',   label: 'Draft event proposal',    prompt: 'Write a professional event proposal for this event, including objectives, agenda outline, estimated budget breakdown, and expected outcomes.' },
  { icon: DollarSign,    category: 'Finance',      label: 'Budget analysis',          prompt: 'Analyse this event\'s budget. Are there any high-risk areas or overspends? Suggest 3 ways to optimise costs without compromising quality.' },
  { icon: AlertTriangle, category: 'Risk',         label: 'Risk assessment',          prompt: 'Perform a risk assessment for this event. List potential risks across logistics, weather, vendors, guests, and safety — rated by likelihood and impact.' },
  { icon: Users,         category: 'Guests',       label: 'Guest experience tips',    prompt: 'Suggest 5 ways to elevate the guest experience for this event. Focus on personalisation, surprise moments, and seamless logistics.' },
  { icon: CalendarDays,  category: 'Timeline',     label: 'Generate runsheet',        prompt: 'Create a detailed runsheet/timeline for this event from setup to breakdown, with timings for each activity and responsible team member.' },
  { icon: Truck,         category: 'Vendors',      label: 'Vendor briefing',          prompt: 'Draft a comprehensive vendor briefing document for this event, covering load-in times, contacts, technical requirements, and key rules.' },
  { icon: BarChart3,     category: 'Analytics',    label: 'Post-event report',        prompt: 'Create a post-event report template for this event with sections for: attendance, feedback scores, budget vs actuals, highlights, and lessons learned.' },
  { icon: Lightbulb,     category: 'Creative',     label: 'Theme ideas',              prompt: 'Suggest 5 creative theme ideas for this event. For each, describe the ambiance, décor direction, F&B pairing, and entertainment options.' },
  { icon: Zap,           category: 'Automation',   label: 'Communication plan',       prompt: 'Build a communication plan for this event: what to send to guests, vendors, and the team — and at what intervals before/during/after the event.' },
]

// ── Chat Message ───────────────────────────────────────────────────────────────

function ChatMessage({ message, onCopy }: { message: Message; onCopy: (text: string) => void }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-violet-100 dark:bg-violet-900/40',
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-violet-600" />}
      </div>
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border rounded-tl-sm',
          message.isStreaming && 'animate-pulse',
        )}>
          {message.content}
          {message.isStreaming && <span className="ml-1 inline-block w-1.5 h-4 bg-current align-middle animate-blink" />}
        </div>
        {!isUser && !message.isStreaming && (
          <button
            onClick={() => onCopy(message.content)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start ml-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EventAIPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { data: event } = useEvent(eventId)
  const { profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Check AI toggle ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.tenant_id) return
    supabase.from('tenants').select('ai_enabled').eq('id', profile.tenant_id).single().then(({ data }) => {
      setAiEnabled(data?.ai_enabled !== false)
    })
  }, [profile?.tenant_id, supabase])

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Welcome message ────────────────────────────────────────────────────────

  useEffect(() => {
    if (event && messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Hello! I'm your AI event assistant for **${event.name}**.\n\nI can help you with proposals, budgets, risk assessments, runsheets, vendor briefings, guest experience ideas, and more.\n\nWhat would you like help with today?`,
        timestamp: new Date(),
      }])
    }
  }, [event, messages.length])

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || loading || !aiEnabled) return

    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Build event context for the AI
    const eventContext = event ? `
Event: ${event.name}
Type: ${event.event_type ?? 'Event'}
Date: ${event.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBD'}
Venue: ${event.venue_id ? 'Assigned' : 'Not assigned'}
Guest Count: ${event.max_attendees ?? 'TBD'}
Budget: ${event.budget ? `₹${Number(event.budget).toLocaleString()}` : 'TBD'}
Status: ${event.status}
` : ''

    // Streaming assistant response
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          context: eventContext,
          eventId,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) throw new Error('AI request failed')

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: fullText, isStreaming: true } : m,
          ))
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: fullText || 'I apologize, I couldn\'t generate a response. Please try again.', isStreaming: false } : m,
      ))
    } catch {
      // Fallback response when AI API not yet configured
      const fallbacks: Record<string, string> = {
        proposal: `# Event Proposal — ${event?.name ?? 'Event'}\n\n## Overview\nThis proposal outlines the key elements for a successful ${event?.event_type ?? 'event'} experience.\n\n## Objectives\n- Deliver a memorable attendee experience\n- Stay within the allocated budget of ${event?.budget ? `₹${Number(event?.budget).toLocaleString()}` : 'TBD'}\n- Achieve all operational milestones on time\n\n## Proposed Timeline\n- T-60 days: Vendor confirmations\n- T-30 days: Guest communications\n- T-7 days: Final runsheet\n- Day of: Execution\n\n*This is an AI-generated draft. Please customise for your specific requirements.*`,
        budget: `## Budget Analysis\n\nBased on your event details:\n\n**Key Risk Areas:**\n1. F&B — typically 35–40% of event budget; ensure vendor lock-in early\n2. AV/Tech — allow 10% contingency for on-site changes\n3. Décor — volatile pricing; get fixed quotes in writing\n\n**Optimisation Tips:**\n- Bundle vendor contracts for volume discounts\n- Set up a 15% contingency reserve before allocating to categories\n- Review per-head catering rates vs. buffet/token models for your guest count\n\n*Connect the AI API in your settings for deeper analysis.*`,
      }

      const key = Object.keys(fallbacks).find(k => userText.toLowerCase().includes(k))
      const fallbackContent = fallbacks[key ?? ''] ?? `I'm here to help with "${event?.name ?? 'your event'}"!\n\nI can assist with:\n• **Proposals** — professional event proposals\n• **Budget analysis** — cost optimisation recommendations\n• **Risk assessment** — identifying and mitigating risks\n• **Runsheets** — detailed timelines\n• **Vendor briefings** — comprehensive briefing documents\n\nThe AI API connection needs to be configured in Settings → Integrations to enable full AI chat. In the meantime, try one of the suggestion prompts above!`

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: fallbackContent, isStreaming: false } : m,
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, aiEnabled, event, eventId, messages])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearChat = () => setMessages([])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Event Overview
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">AI Assistant</span>
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Clear chat
        </button>
      </div>

      {!aiEnabled ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="font-medium mb-1">AI is disabled</p>
            <p className="text-sm text-muted-foreground">Your workspace administrator has disabled the AI features. Contact them to enable it.</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Sidebar — suggestions */}
          <div className="hidden lg:flex flex-col w-56 shrink-0 gap-2 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Quick Prompts</p>
            {PROMPT_SUGGESTIONS.map((s, i) => {
              const Icon = s.icon
              return (
                <button
                  key={i}
                  onClick={() => sendMessage(s.prompt)}
                  disabled={loading}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-colors group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-snug">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Chat pane */}
          <div className="flex flex-col flex-1 bg-card border border-border rounded-2xl overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} onCopy={handleCopy} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Mobile prompt chips */}
            <div className="flex gap-2 px-4 pb-2 overflow-x-auto lg:hidden">
              {PROMPT_SUGGESTIONS.slice(0, 4).map((s, i) => {
                const Icon = s.icon
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.prompt)}
                    disabled={loading}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </button>
                )
              })}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  rows={1}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
                  placeholder="Ask anything about this event..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0',
                    loading || !input.trim()
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 px-1">
                AI responses are suggestions only — always verify critical information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
