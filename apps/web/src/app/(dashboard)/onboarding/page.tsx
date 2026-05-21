'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, ChevronRight, Sparkles, Building2,
  CalendarDays, Users, Compass, PartyPopper, ArrowRight,
  Loader2, Mail, Plus, X, Check, MapPin, Globe,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingStatus {
  completed: boolean
  step: number
  completed_at: string | null
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return <div className="absolute w-2 h-2 rounded-sm animate-bounce" style={style} />
}

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][i % 6],
      animationDelay: `${Math.random() * 2}s`,
      animationDuration: `${1 + Math.random() * 2}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
      opacity: Math.random() * 0.8 + 0.2,
    } as React.CSSProperties,
  }))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(p => <ConfettiPiece key={p.id} style={p.style} />)}
    </div>
  )
}

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Welcome', icon: Building2, shortLabel: 'Setup' },
  { id: 2, title: 'First Event', icon: CalendarDays, shortLabel: 'Event' },
  { id: 3, title: 'Invite Team', icon: Users, shortLabel: 'Team' },
  { id: 4, title: 'Feature Tour', icon: Compass, shortLabel: 'Tour' },
  { id: 5, title: 'All Set!', icon: PartyPopper, shortLabel: 'Done' },
]

// ─── Step 1: Welcome + Company Setup ─────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({ name: '', industry: '', size: '' })
  const [saving, setSaving] = useState(false)
  const { session } = useAuth()

  const industries = [
    'Wedding & Events', 'Corporate Events', 'Music & Entertainment',
    'Sports Events', 'Conference & Expo', 'Government & Public',
    'Religious & Community', 'Other',
  ]
  const sizes = ['1–5 people', '6–20 people', '21–50 people', '51–200 people', '200+ people']

  const handleSubmit = async () => {
    if (!form.name.trim() || !session?.access_token) return
    setSaving(true)
    try {
      // Update tenant name/industry
      await fetch(`${API}/v1/tenants/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          settings: { industry: form.industry, team_size: form.size },
        }),
      })
      onNext()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-2">
          <Sparkles className="w-7 h-7 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Welcome to OccasionPro</h2>
        <p className="text-muted-foreground text-sm">Let's get your workspace ready in 2 minutes.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Company / Agency Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sharma Events & Productions"
            className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">Industry</label>
          <select
            value={form.industry}
            onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <option value="">Select your industry…</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">Team Size</label>
          <div className="flex flex-wrap gap-2">
            {sizes.map(s => (
              <button
                key={s}
                onClick={() => setForm(f => ({ ...f, size: s }))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.size === s
                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-border',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!form.name.trim() || saving}
        className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  )
}

// ─── Step 2: First Event Quick-Create ─────────────────────────────────────────

function StepFirstEvent({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [form, setForm] = useState({ name: '', type: '', date: '', venue: '' })
  const [saving, setSaving] = useState(false)
  const { session } = useAuth()

  const eventTypes = [
    'Wedding', 'Corporate Event', 'Concert', 'Conference',
    'Birthday', 'Product Launch', 'Trade Show', 'Other',
  ]

  const handleCreate = async () => {
    if (!form.name.trim() || !session?.access_token) return
    setSaving(true)
    try {
      await fetch(`${API}/v1/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          event_type: form.type || 'Other',
          start_date: form.date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          venue_name: form.venue,
        }),
      })
      onNext()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-2">
          <CalendarDays className="w-7 h-7 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Create Your First Event</h2>
        <p className="text-muted-foreground text-sm">Start by planning your first event. You can always add more details later.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Event Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Priya & Raj Wedding"
            className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">Event Type</label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.type === t
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-border',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />Event Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              <Globe className="w-3.5 h-3.5 inline mr-1" />Venue (optional)
            </label>
            <input
              type="text"
              value={form.venue}
              onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
              placeholder="e.g. Taj Hotel, Mumbai"
              className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 h-11 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground text-sm font-medium transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleCreate}
          disabled={!form.name.trim() || saving}
          className="flex-1 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Event <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Invite Team ──────────────────────────────────────────────────────

function StepInviteTeam({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [emails, setEmails] = useState<string[]>([''])
  const [role, setRole] = useState('event_manager')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { session } = useAuth()

  const addEmail = () => setEmails(e => [...e, ''])
  const removeEmail = (i: number) => setEmails(e => e.filter((_, idx) => idx !== i))
  const setEmail = (i: number, v: string) => setEmails(e => e.map((x, idx) => idx === i ? v : x))

  const validEmails = emails.filter(e => e.includes('@'))

  const handleSend = async () => {
    if (!validEmails.length || !session?.access_token) return
    setSending(true)
    try {
      await Promise.all(validEmails.map(email =>
        fetch(`${API}/v1/team/invite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, role }),
        })
      ))
      setSent(true)
      setTimeout(onNext, 1500)
    } finally {
      setSending(false)
    }
  }

  const roles = [
    { value: 'event_manager', label: 'Event Manager', desc: 'Manage events, vendors, guests' },
    { value: 'team_lead', label: 'Team Lead', desc: 'Coordinate team tasks' },
    { value: 'team_member', label: 'Team Member', desc: 'View and update assigned tasks' },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <Users className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Invite Your Team</h2>
        <p className="text-muted-foreground text-sm">Bring your team on board. They'll get an email to join your workspace.</p>
      </div>

      <div className="space-y-4">
        {/* Role selector */}
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">Invite as</label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={cn(
                  'p-2.5 rounded-lg border text-left transition-colors',
                  role === r.value
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-border',
                )}
              >
                <div className="text-xs font-semibold">{r.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Email fields */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/80">Email Addresses</label>
          {emails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(i, e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 h-10 px-3 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {emails.length > 1 && (
                <button onClick={() => removeEmail(i)} className="w-10 h-10 flex items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {emails.length < 5 && (
            <button onClick={addEmail} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add another
            </button>
          )}
        </div>
      </div>

      {sent && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Invitations sent! Moving to next step…
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 h-11 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground text-sm font-medium transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleSend}
          disabled={!validEmails.length || sending || sent}
          className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <><Check className="w-4 h-4" /> Sent!</> : <>Send Invites <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Feature Tour ─────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📋', name: 'Events', desc: 'Create and manage events with full operational control — timelines, runsheets, guests, and vendors all in one place.' },
  { icon: '👥', name: 'Guests', desc: 'Invite guests, manage RSVPs, handle accommodation, generate vouchers, and run a live check-in system.' },
  { icon: '💰', name: 'Finance', desc: 'Track budgets, raise invoices, manage expenses, and get real-time P&L insights across all your events.' },
  { icon: '🏪', name: 'Vendors', desc: 'Build your vendor network, manage contracts, track deliverables, and run payments all in one place.' },
  { icon: '🤖', name: 'AI Assistant', desc: 'Generate proposals, optimize budgets, predict risks, and automate communication with AI built right in.' },
  { icon: '📊', name: 'Analytics', desc: 'Get deep business intelligence on revenue, profitability, team performance, and client satisfaction.' },
]

function StepFeatureTour({ onNext }: { onNext: () => void }) {
  const [viewed, setViewed] = useState<Set<number>>(new Set())

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-2">
          <Compass className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">What OccasionPro Can Do</h2>
        <p className="text-muted-foreground text-sm">A quick tour of the most powerful features at your disposal.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f, i) => (
          <button
            key={i}
            onClick={() => setViewed(v => new Set([...v, i]))}
            className={cn(
              'p-3.5 rounded-xl border text-left transition-all group relative',
              viewed.has(i)
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-muted/20 border-border/40 hover:border-border hover:bg-muted/30',
            )}
          >
            {viewed.has(i) && (
              <div className="absolute top-2 right-2">
                <Check className="w-3 h-3 text-amber-400" />
              </div>
            )}
            <div className="text-xl mb-1">{f.icon}</div>
            <div className={cn('text-sm font-semibold', viewed.has(i) ? 'text-amber-400' : 'text-foreground')}>{f.name}</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{f.desc}</div>
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
      >
        I'm ready! <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Step 5: Celebration ──────────────────────────────────────────────────────

function StepCelebration({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="relative space-y-6 text-center">
      <Confetti />

      <div className="relative z-10 space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 mb-2">
          <PartyPopper className="w-10 h-10 text-violet-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">You're all set! 🎉</h2>
          <p className="text-muted-foreground mt-2">
            Your OccasionPro workspace is ready. Let's go build something extraordinary.
          </p>
        </div>
      </div>

      {/* Achievement cards */}
      <div className="relative z-10 grid grid-cols-3 gap-3">
        {[
          { emoji: '🏢', label: 'Workspace', sub: 'Configured' },
          { emoji: '🔒', label: 'Security', sub: 'Active' },
          { emoji: '🤖', label: 'AI', sub: 'Ready' },
        ].map((card, i) => (
          <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/40">
            <div className="text-2xl">{card.emoji}</div>
            <div className="text-xs font-semibold text-foreground mt-1">{card.label}</div>
            <div className="text-[10px] text-emerald-400">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="relative z-10 p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-violet-400">Pro tip:</span> Check out the <span className="text-foreground font-medium">AI Assistant</span> to generate your first event proposal in seconds.
        </p>
      </div>

      <button
        onClick={onFinish}
        className="relative z-10 w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20"
      >
        <Sparkles className="w-5 h-5" /> Go to Dashboard
      </button>
    </div>
  )
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = i + 1 < current
        const isCurrent = i + 1 === current
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all flex-shrink-0',
              isCompleted ? 'bg-violet-600 border-violet-600 text-white' :
              isCurrent ? 'bg-violet-500/10 border-violet-500 text-violet-400' :
              'bg-transparent border-border/40 text-muted-foreground',
            )}>
              {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 rounded-full transition-all',
                isCompleted ? 'bg-violet-600' : 'bg-border/40',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Onboarding Page ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const { session } = useAuth()
  const router = useRouter()

  // Check if onboarding already completed
  useEffect(() => {
    if (!session?.access_token) return
    fetch(`${API}/v1/tenants/me/onboarding`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: OnboardingStatus | null) => {
        if (data?.completed) {
          router.replace('/dashboard')
        } else if (data?.step) {
          // Resume from last step
          setStep(Math.min(data.step + 1, 5))
        }
      })
      .finally(() => setCheckingStatus(false))
  }, [session?.access_token])

  const advanceStep = useCallback(async (nextStep: number) => {
    if (!session?.access_token) return
    try {
      await fetch(`${API}/v1/tenants/me/onboarding/step/${nextStep - 1}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch {
      // Best-effort — don't block UX on API failure
    }
    setStep(nextStep)
  }, [session?.access_token])

  const completeOnboarding = useCallback(async () => {
    if (!session?.access_token) return
    try {
      await fetch(`${API}/v1/tenants/me/onboarding/step/5`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch { /* best-effort */ }
    router.push('/dashboard')
  }, [session?.access_token])

  const skipOnboarding = useCallback(async () => {
    if (!session?.access_token) return
    try {
      await fetch(`${API}/v1/tenants/me/onboarding/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch { /* best-effort */ }
    router.push('/dashboard')
  }, [session?.access_token])

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Header with skip */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">OccasionPro</span>
          </div>
          {step < 5 && (
            <button
              onClick={skipOnboarding}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded"
            >
              Skip setup
            </button>
          )}
        </div>

        {/* Progress */}
        <StepProgress current={step} total={5} />

        {/* Step card */}
        <div className="relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20">
          {step === 1 && <StepWelcome onNext={() => advanceStep(2)} />}
          {step === 2 && <StepFirstEvent onNext={() => advanceStep(3)} onSkip={() => advanceStep(3)} />}
          {step === 3 && <StepInviteTeam onNext={() => advanceStep(4)} onSkip={() => advanceStep(4)} />}
          {step === 4 && <StepFeatureTour onNext={() => advanceStep(5)} />}
          {step === 5 && <StepCelebration onFinish={completeOnboarding} />}
        </div>

        {/* Step count */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Step {step} of {STEPS.length}
        </p>
      </div>
    </div>
  )
}
