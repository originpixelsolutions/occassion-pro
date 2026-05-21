'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, RotateCcw, Copy, ThumbsUp, ThumbsDown, ChevronRight, Zap, FileText, BarChart3, Calendar, DollarSign, Users, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

interface Message {
  id: string; role: 'user' | 'assistant'; content: string
  timestamp: Date; liked?: boolean | null
}

const QUICK_PROMPTS = [
  { icon: FileText, label: 'Draft Proposal', prompt: 'Draft a detailed event proposal for a corporate conference with 500 attendees in Mumbai. Include venue recommendations, catering, AV setup, and budget estimate.' },
  { icon: DollarSign, label: 'Budget Estimate', prompt: 'Generate a detailed budget estimate for a luxury wedding with 300 guests in Bangalore. Break it down by category with percentage allocations.' },
  { icon: BarChart3, label: 'Profit Analysis', prompt: 'Analyze our current event mix and suggest which event types to focus on for maximum profitability.' },
  { icon: Calendar, label: 'Event Timeline', prompt: 'Create a detailed 90-day execution timeline for a large-scale product launch event.' },
  { icon: Users, label: 'Vendor Tips', prompt: 'What are the best practices for managing vendors across multiple simultaneous events? Include negotiation strategies.' },
  { icon: Zap, label: 'Risk Assessment', prompt: 'What are the top 10 operational risks for outdoor events in India? Provide mitigation strategies for each.' },
]

const DEMO_RESPONSES: Record<string, string> = {
  default: `I'm OccasionPro's AI assistant, powered by enterprise-grade intelligence. I can help you with:

**📋 Proposal Generation** — Detailed event proposals with budgets, timelines, and vendor recommendations

**💰 Budget Optimization** — AI-driven cost analysis and savings opportunities

**📊 Business Intelligence** — Revenue forecasting, profitability analysis, and growth insights

**⚡ Operations Support** — Vendor management, risk assessment, crisis protocols

**📅 Planning Assistance** — Event timelines, checklists, runsheets

What would you like help with today?`,
}

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

export default function AIAssistantPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: DEMO_RESPONSES.default,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content, history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response ?? data.message ?? 'I understand your request. Let me help you with that.\n\nBased on best practices for event management, here are my recommendations:\n\n**Key Points:**\n- Start with clear objectives and success metrics\n- Build a comprehensive timeline with buffer periods\n- Engage vendors early — premium vendors book 3-6 months ahead\n- Maintain a 15-20% contingency budget\n- Document everything in the system for team visibility\n\nWould you like me to elaborate on any specific aspect?',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      const fallback: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you're asking about: **"${content}"**\n\nHere's what I can tell you based on event management best practices:\n\n**Immediate Actions:**\n- Review current event requirements and constraints\n- Assess available resources and budget\n- Identify key stakeholders and decision-makers\n\n**Strategic Recommendations:**\n- Document all requirements in OccasionPro\n- Create a phased execution plan\n- Set up automated alerts for critical milestones\n\nWould you like me to help you create a detailed plan?`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, fallback])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function toggleReaction(id: string, liked: boolean) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, liked: m.liked === liked ? null : liked } : m))
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: quick prompts */}
      <div className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground">Powered by OccasionPro AI</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">Quick Actions</p>
          {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
            <button key={label} onClick={() => sendMessage(prompt)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors group">
              <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <button onClick={() => setMessages([{ id: '1', role: 'assistant', content: DEMO_RESPONSES.default, timestamp: new Date() }])} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-xs">New Chat</span>
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                msg.role === 'assistant' ? 'bg-primary/10' : 'bg-muted')}>
                {msg.role === 'assistant' ? <Sparkles className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>

              {/* Bubble */}
              <div className={cn("max-w-2xl group", msg.role === 'user' ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-card border border-border rounded-tl-sm')}>
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                </div>
                {/* Actions */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => copyMessage(msg.content)} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={() => toggleReaction(msg.id, true)} className={cn("p-1.5 rounded-md transition-colors", msg.liked === true ? 'text-emerald-400 bg-emerald-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => toggleReaction(msg.id, false)} className={cn("p-1.5 rounded-md transition-colors", msg.liked === false ? 'text-red-400 bg-red-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground px-1">{msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-end gap-3 bg-input border border-border rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-primary">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your events, finances, vendors, or operations…"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground max-h-32 leading-relaxed"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
