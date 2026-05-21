/**
 * OccasionPro — Tenant Registration Page
 * Route: /register
 * Public. Step 1 of tenant sign-up: email + password.
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const BENEFITS = [
  '14-day free trial — no credit card needed',
  'Full access to all modules during trial',
  'Cancel anytime, no questions asked',
  'Data export always available',
]

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Registration failed')
      // Store temp registration token for subsequent steps
      localStorage.setItem('op_reg_token', data.token)
      // Store credentials so we can establish a Supabase session after step 3
      // (backend auto-confirms the email, so signInWithPassword will work immediately)
      sessionStorage.setItem('op_reg_email', email)
      sessionStorage.setItem('op_reg_pw', password)
      router.push('/register/workspace')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Password strength helper
  function pwStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
    if (pw.length === 0) return { level: 0, label: '' }
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { level: 1, label: 'Weak' }
    if (score <= 2) return { level: 2, label: 'Fair' }
    return { level: 3, label: 'Strong' }
  }

  const strength = pwStrength(password)
  const strengthColor = { 0: '', 1: 'bg-red-500', 2: 'bg-amber-500', 3: 'bg-emerald-500' }[strength.level]

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 border-r border-white/8 p-12 bg-zinc-950">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">OccasionPro</span>
        </Link>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs mb-6">
            <Sparkles className="w-3 h-3" />
            Free 14-day trial
          </div>
          <h2 className="text-3xl font-bold text-white mb-3 leading-snug">
            The enterprise platform for serious event companies.
          </h2>
          <p className="text-zinc-400 text-base mb-10 leading-relaxed">
            Join hundreds of event companies that manage everything — guests, budget, vendors, runsheets, F&B, and more — from a single AI-powered platform.
          </p>
          <ul className="space-y-4">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-zinc-600 text-sm">© 2026 OccasionPro</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">OccasionPro</span>
        </Link>

        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {['Account', 'Workspace', 'Plan'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  i === 0
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-white/20 text-zinc-500'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-sm ${i === 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>{step}</span>
                {i < 2 && <div className="w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-zinc-400 text-sm mb-8">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
              Sign in
            </Link>
          </p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Priya Sharma"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/70 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="priya@eventstudio.in"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/70 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/70 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength bar */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(n => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          n <= strength.level ? strengthColor : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength.level === 1 ? 'text-red-400' :
                    strength.level === 2 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-xs text-zinc-600 text-center leading-relaxed">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
