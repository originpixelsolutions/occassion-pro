'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'

export default function ClientSetPasswordPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params)
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')
    try {
      const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
      if (!session) throw new Error('Session not found. Please sign in again.')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Session': session,
        },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to set password')

      setDone(true)
      setTimeout(() => router.push(`/${tenant}/client/dashboard`), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="font-semibold text-lg">Password set!</p>
          <p className="text-sm text-zinc-400">Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set your password</h1>
          <p className="text-sm text-zinc-500 mt-1">You'll use this to sign in next time</p>
        </div>

        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl py-3 text-sm transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting…</> : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
