'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'

export default function ClientLoginPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params)
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, tenant_id: tenant }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      // Store session token
      localStorage.setItem('cp_session', data.session_token)
      localStorage.setItem('cp_tenant', tenant)
      localStorage.setItem('cp_client', JSON.stringify(data.client))
      router.push(`/${tenant}/client/dashboard`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in with your email and password</p>
        </div>

        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl py-3 text-sm transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push(`/${tenant}/client/auth`)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Get a magic link instead
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
