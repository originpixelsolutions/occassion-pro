'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function ClientVerifyPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid link — no token found.')
      return
    }
    verify()
  }, [token])

  const verify = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client-portal/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tenant_id: tenant }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')

      localStorage.setItem('cp_session', data.session_token)
      localStorage.setItem('cp_tenant', tenant)
      localStorage.setItem('cp_client', JSON.stringify(data.client))

      setStatus('success')

      // Redirect: set password first if needed, else dashboard
      setTimeout(() => {
        if (data.needs_password) {
          router.replace(`/${tenant}/client/auth/set-password`)
        } else {
          router.replace(`/${tenant}/client/dashboard`)
        }
      }, 1200)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-5">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
            <p className="text-sm text-zinc-400">Verifying your link…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-emerald-500/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="font-semibold text-lg">You're in!</p>
            <p className="text-sm text-zinc-400">Redirecting you now…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-red-500/10">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="font-semibold text-lg">Link invalid or expired</p>
            <p className="text-sm text-zinc-400">{message}</p>
            <button
              onClick={() => router.push(`/${tenant}/client/auth`)}
              className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Request a new link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
