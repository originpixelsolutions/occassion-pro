'use client'

/**
 * Vendor Portal — Register
 * Calls POST /vendor-portal/auth/register
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { ConsentCheckbox } from '@/components/dpdp/ConsentCheckbox'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

export default function VendorRegisterPage() {
  const router = useRouter()

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    if (!consentGiven) { setError('Please accept the privacy consent to continue.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/vendor-portal/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Registration failed. Please try again.')
        return
      }
      // Auto-login if token returned
      if (data.session_token) {
        localStorage.setItem('vp_session', data.session_token)
        if (data.vendor) localStorage.setItem('vp_vendor', JSON.stringify(data.vendor))
        router.replace('/vendor/dashboard')
        return
      }
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Account created!</h2>
          <p className="text-sm text-zinc-500 mb-6">Your vendor account is ready. Sign in to continue.</p>
          <Link
            href="/vendor/login"
            className="block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors text-center"
          >
            Go to Login
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
          <h1 className="text-lg font-semibold text-white mb-1">Create account</h1>
          <p className="text-sm text-zinc-500 mb-6">Register as a vendor to receive event assignments.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

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
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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

            {/* Confirm */}
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

            {/* DPDP Consent */}
            <div className="pt-1">
              <ConsentCheckbox
                tenantName="OccasionPro"
                tenantId="platform"
                subjectType="vendor"
                subjectEmail={email}
                consentType="data_processing"
                onConsentChange={setConsentGiven}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !consentGiven}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-800 text-center space-y-2">
            <Link href="/vendor/login" className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors">
              Already have an account? Sign in
            </Link>
            <div className="flex items-center justify-center gap-3 text-xs text-zinc-700">
              <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link href="/data-request" className="hover:text-zinc-500 transition-colors">Your Data Rights</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
