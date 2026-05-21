'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

export default function ClientAuthPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), tenant_id: tenant }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || 'Failed to send link')
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to view your event details</p>
        </div>

        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-500/10">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Check your inbox</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  We sent a sign-in link to <strong className="text-white">{email}</strong>
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                The link expires in 24 hours. Check your spam folder if you don't see it.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendLink} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-white/5 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <>Send magic link <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push(`/${tenant}/client/auth/login`)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Sign in with password instead
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
