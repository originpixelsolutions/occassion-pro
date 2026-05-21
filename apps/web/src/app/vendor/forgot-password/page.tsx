'use client'

/**
 * Vendor Portal — Forgot Password
 * Calls POST /vendor-portal/auth/forgot-password
 */

import { useState } from 'react'
import { Building2, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

export default function VendorForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      // Always show success to avoid email enumeration
      setSent(true)
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {sent ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm text-zinc-500 mb-6">
                If an account exists for <span className="text-zinc-300">{email}</span>, we've sent a password reset link.
              </p>
              <Link
                href="/vendor/login"
                className="block w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm py-2.5 rounded-xl transition-colors text-center"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-white mb-1">Reset password</h1>
              <p className="text-sm text-zinc-500 mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoFocus
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
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-zinc-800 text-center">
                <Link href="/vendor/login" className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors">
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
