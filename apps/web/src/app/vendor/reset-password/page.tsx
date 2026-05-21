'use client'

/**
 * Vendor Portal — Reset Password
 * Reads ?token=... from URL
 * Calls POST /vendor-portal/auth/reset-password with { token, password }
 */

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setError('Invalid or missing reset token. Please request a new link.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Failed to reset password. The link may have expired.')
        return
      }
      // Auto-login if session returned
      if (data.session_token) {
        localStorage.setItem('vp_session', data.session_token)
        if (data.vendor) localStorage.setItem('vp_vendor', JSON.stringify(data.vendor))
        router.replace('/vendor/dashboard')
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Invalid link</h2>
          <p className="text-sm text-zinc-500 mb-6">This reset link is invalid or missing. Please request a new one.</p>
          <Link
            href="/vendor/forgot-password"
            className="block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors text-center"
          >
            Request Reset Link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Password updated</h2>
          <p className="text-sm text-zinc-500 mb-6">Your password has been reset successfully.</p>
          <Link
            href="/vendor/login"
            className="block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors text-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
            <Building2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">OccasionPro</p>
            <p className="text-xs text-cyan-400 font-medium leading-tight">Vendor Portal</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-white mb-1">Set new password</h1>
          <p className="text-sm text-zinc-500 mb-6">Choose a strong password for your vendor account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function VendorResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
