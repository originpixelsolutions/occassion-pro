'use client'

/**
 * Public invite acceptance page
 * Route: /invite?token=<64-hex>
 *
 * Flow:
 *  1. Read ?token= from URL
 *  2. GET /v1/invite/info?token=  → show workspace + role info
 *  3. User fills name + password → POST /v1/invite/accept
 *  4. Auto sign-in via Supabase then redirect to dashboard
 */

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  CheckCircle2, Loader2, AlertTriangle, Eye, EyeOff,
  Building2, User, Lock, ArrowRight, Sparkles,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { ConsentCheckbox } from '@/components/dpdp/ConsentCheckbox'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface InviteInfo {
  email: string
  name: string | null
  role: string
  workspace: {
    id: string
    name: string
    logo_url: string | null
  }
}

const ROLE_LABELS: Record<string, string> = {
  event_manager: 'Event Manager',
  team_lead:     'Team Lead',
  team_member:   'Team Member',
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function InvitePage() {
  const params = useSearchParams()
  const router = useRouter()
  const token  = params.get('token') ?? ''

  // Fetch state
  const [info, setInfo]       = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState('')

  // Form state
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState('')
  const [done, setDone]             = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  // ── 1. Load invite info ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setFetchErr('No invitation token found in this link.')
      setLoading(false)
      return
    }

    fetch(`${API}/invite/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.statusCode >= 400) {
          setFetchErr(data.message ?? 'Invalid or expired invitation.')
        } else {
          setInfo(data)
          if (data.name) setName(data.name)
        }
      })
      .catch(() => setFetchErr('Could not load invitation details.'))
      .finally(() => setLoading(false))
  }, [token])

  // ── 2. Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitErr('')

    if (!name.trim())              return setSubmitErr('Name is required.')
    if (password.length < 8)       return setSubmitErr('Password must be at least 8 characters.')
    if (password !== confirm)      return setSubmitErr('Passwords do not match.')

    setSubmitting(true)
    try {
      const res  = await fetch(`${API}/invite/accept`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, name: name.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitErr(data.message ?? 'Failed to accept invitation.')
        return
      }

      // Auto sign-in with the credentials we just created
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
        email: info!.email,
        password,
      })

      if (!signInErr && session?.session) {
        localStorage.setItem('op_token',  session.session.access_token)
        localStorage.setItem('op_tenant', data.tenant_id)
        setDone(true)
        setTimeout(() => router.replace('/dashboard'), 1500)
      } else {
        // Sign-in failed but account was created — send to login
        setDone(true)
        setTimeout(() => router.replace('/login'), 1500)
      }
    } catch {
      setSubmitErr('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error / invalid token ──────────────────────────────────────────────────
  if (fetchErr) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold">Invitation Invalid</h1>
          <p className="text-muted-foreground text-sm">{fetchErr}</p>
          <p className="text-xs text-muted-foreground">
            Please ask your workspace admin to send a new invite link.
          </p>
        </div>
      </div>
    )
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold">Account Created!</h1>
          <p className="text-muted-foreground text-sm">
            Welcome to <strong>{info?.workspace.name}</strong>. Redirecting you to the dashboard…
          </p>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  const roleLabel = ROLE_LABELS[info!.role] ?? info!.role

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">

        {/* Logo / brand */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">OccasionPro</span>
          </div>
        </div>

        {/* Invitation card */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

          {/* Workspace info */}
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {info!.workspace.logo_url ? (
                <img src={info!.workspace.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <Building2 className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">You've been invited to join</p>
              <p className="font-semibold text-sm">{info!.workspace.name}</p>
            </div>
            <div className="ml-auto">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                {roleLabel}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-lg font-bold mb-0.5">Set up your account</h1>
            <p className="text-sm text-muted-foreground">
              Joining as <span className="text-foreground font-medium">{info!.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Your full name"
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat password"
                  className={`w-full bg-background border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                    confirm && confirm !== password
                      ? 'border-red-500/50 focus:ring-red-500'
                      : 'border-border'
                  }`}
                />
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
              )}
            </div>

            {/* DPDP Consent */}
            <div className="pt-1">
              <ConsentCheckbox
                tenantName={info!.workspace.name}
                tenantId={info!.workspace.id}
                subjectType="team_member"
                subjectEmail={info!.email}
                consentType="data_processing"
                onConsentChange={setConsentGiven}
              />
            </div>

            {submitErr && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{submitErr}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !consentGiven}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
              ) : (
                <>Accept Invitation <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:underline">Sign in</a>
        </p>

        <p className="text-center text-xs text-muted-foreground/60 space-x-2">
          <a href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/data-request" className="hover:text-muted-foreground transition-colors">Your Data Rights</a>
        </p>
      </div>
    </div>
  )
}

// ─── Suspense wrapper (required for useSearchParams in Next.js App Router) ────

export default function InvitePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <InvitePage />
    </Suspense>
  )
}
