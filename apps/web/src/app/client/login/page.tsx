'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

export default function ClientLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle set-password flow from invite link
  const inviteToken = searchParams.get('token')
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSet, setPasswordSet] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${API}/client-portal/auth/login`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      const redirect = searchParams.get('redirect') || '/client/dashboard'
      router.push(redirect)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    setError(''); setSettingPassword(true)
    try {
      const res = await fetch(`${API}/client-portal/auth/set-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to set password')
      setPasswordSet(true)
    } catch (err: any) { setError(err.message) } finally { setSettingPassword(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-lg">✦</div>
          <h1 className="text-white text-2xl font-semibold">OccasionPro</h1>
          <p className="text-white/40 text-sm mt-1">
            {inviteToken ? 'Set your password to get started' : 'Client Portal'}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {inviteToken ? (
            passwordSet ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white font-semibold">Password set!</p>
                <p className="text-white/50 text-sm mt-2">You can now log in with your email and password.</p>
                <button onClick={() => router.push('/client/login')} className="mt-4 text-violet-400 text-sm hover:text-violet-300">Go to Login →</button>
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <h2 className="text-white font-semibold text-lg">Set Your Password</h2>
                <p className="text-white/50 text-sm">Choose a secure password for your client account.</p>
                <div>
                  <label className="text-white/60 text-sm block mb-2">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-violet-500" required />
                </div>
                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={settingPassword}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50">
                  {settingPassword ? 'Setting password…' : 'Set Password & Continue'}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-violet-500"
                  placeholder="you@company.com" />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-violet-500"
                  placeholder="••••••••" />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <p className="text-center text-white/30 text-sm">
                Don't have an account? Check your invitation email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
