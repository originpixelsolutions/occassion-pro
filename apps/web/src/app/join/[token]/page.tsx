'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface InvitationInfo {
  id: string
  email: string
  role: 'event_manager' | 'team_lead' | 'team_member'
  invited_by_name: string
  workspace_name: string
  workspace_logo?: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Workspace Owner',
  event_manager: 'Event Manager',
  team_lead: 'Team Lead',
  team_member: 'Team Member',
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500']

  if (!password) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? colors[score - 1] : 'bg-zinc-700'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? 'text-green-400' : 'text-zinc-600'}`}>
            <span>{c.ok ? '✓' : '○'}</span> {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load invitation info
  useEffect(() => {
    if (!token) return
    fetch(`/api/v1/invite/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.statusCode && data.statusCode >= 400) {
          setLoadError(data.message ?? 'Invalid invitation link')
        } else {
          setInfo(data)
        }
      })
      .catch(() => setLoadError('Failed to load invitation'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!name.trim()) { setSubmitError('Please enter your full name'); return }
    if (password.length < 8) { setSubmitError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setSubmitError('Passwords do not match'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.message ?? 'Failed to accept invitation')
      } else {
        setSuccess(true)
        // Redirect to login after 2s
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Error: invalid / expired / revoked ────────────────────────────────────────
  if (loadError || !info) {
    const isExpired = info?.status === 'expired'
    const isRevoked = info?.status === 'revoked'
    const isAccepted = info?.status === 'accepted'

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">
            {isExpired ? 'Invitation Expired' : isRevoked ? 'Invitation Revoked' : isAccepted ? 'Already Accepted' : 'Invalid Invitation'}
          </h1>
          <p className="text-zinc-400 text-sm mb-6">
            {isExpired
              ? 'This invitation link has expired. Please ask your workspace admin to send a new invite.'
              : isRevoked
              ? 'This invitation has been revoked. Please contact your workspace admin.'
              : isAccepted
              ? 'This invitation has already been accepted. Please log in to your account.'
              : loadError ?? 'This invitation link is invalid or has expired.'}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Account Created!</h1>
          <p className="text-zinc-400 text-sm mb-1">
            You've joined <span className="text-white font-medium">{info.workspace_name}</span> as a{' '}
            <span className="text-violet-400">{ROLE_LABELS[info.role] ?? info.role}</span>.
          </p>
          <p className="text-zinc-500 text-xs">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  // ── Main invite form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg">OccasionPro</span>
          </div>
        </div>

        {/* Invitation card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-4">
          {/* Workspace info */}
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-zinc-800">
            {info.workspace_logo ? (
              <img src={info.workspace_logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-400 text-base font-semibold">
                  {info.workspace_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{info.workspace_name}</p>
              <p className="text-zinc-500 text-xs">{info.invited_by_name} has invited you to join</p>
            </div>
            <span className="ml-auto flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-medium">
              {ROLE_LABELS[info.role] ?? info.role}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-zinc-400 text-xs mb-0.5">Signing up as</p>
              <p className="text-white text-sm font-medium">{info.email}</p>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                autoFocus
                className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-3 py-2.5 pr-10 bg-zinc-800/60 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className={`w-full px-3 py-2.5 bg-zinc-800/60 border rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 ${
                  confirm && confirm !== password
                    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-zinc-700 focus:border-violet-500 focus:ring-violet-500/30'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="text-red-400 text-xs mt-1">Passwords don't match</p>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-red-400 text-xs">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim() || password.length < 8 || password !== confirm}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account & join'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-600 text-xs">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
