'use client'

/**
 * Vendor Portal — Login
 * Calls POST /vendor-portal/auth/login
 * Stores session_token in localStorage as 'vp_session'
 */

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function LoginForm() {
  const router       = useRouter()
  const params       = useSearchParams()
  const redirectTo   = params.get('redirect') ?? '/vendor/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Invalid email or password.')
        return
      }
      // Store session
      localStorage.setItem('vp_session', data.session_token)
      if (data.vendor) localStorage.setItem('vp_vendor', JSON.stringify(data.vendor))
      router.replace(redirectTo)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-white mb-1">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-6">Access your event assignments and payments.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
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

            {/* Error */}
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
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between">
            <Link
              href="/vendor/forgot-password"
              className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
            >
              Forgot password?
            </Link>
            <Link
              href="/vendor/register"
              className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          For event staff access, contact your administrator.
        </p>
      </div>
    </div>
  )
}

export default function VendorLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
