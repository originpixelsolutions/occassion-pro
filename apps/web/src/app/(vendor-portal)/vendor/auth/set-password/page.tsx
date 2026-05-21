'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/vendor-portal/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to set password')
      router.push('/vendor/auth/login?reset=1')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-red-400 text-sm">Invalid or missing reset token.</p>
        <Link href="/vendor/auth/forgot-password" className="text-sm text-violet-400 hover:text-violet-300">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-zinc-300 mb-1.5">New password</label>
        <input
          type="password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          required
          minLength={8}
          className="w-full px-4 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-300 mb-1.5">Confirm password</label>
        <input
          type="password"
          value={form.confirm}
          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          required
          className="w-full px-4 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
          placeholder="Repeat password"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all"
      >
        {loading ? 'Setting password…' : 'Set password'}
      </button>
    </form>
  )
}

export default function VendorSetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-indigo-950/20 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OP</span>
            </div>
            <span className="text-white font-semibold text-lg">OccasionPro</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Set Your Password</h1>
          <p className="text-zinc-400 text-sm mt-1">Create a secure password to access the vendor portal</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
          <Suspense fallback={<div className="text-zinc-400 text-sm text-center">Loading…</div>}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
