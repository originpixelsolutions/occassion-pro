'use client'

/**
 * Guest Portal — OTP Login
 * Route: /guest/[eventId]/login
 * Also handles personalised links: /guest/[eventId]/g/[guestCode] (redirect here pre-filled)
 */

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

type Step = 'mobile' | 'otp' | 'loading'

export default function GuestPortalLogin() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState(searchParams.get('mobile') || '')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [eventData, setEventData] = useState<{ title: string; brand_color: string; portal_title?: string; hero_image_url?: string; welcome_message?: string } | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Load event branding
  useEffect(() => {
    if (!eventId) return
    fetch(`${API}/guest-portal/${eventId}/settings`)
      .then(r => r.json())
      .then(d => setEventData(d))
      .catch(() => {})
  }, [eventId])

  // OTP countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const brandColor = eventData?.brand_color || '#7c3aed'

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!mobile.trim()) { setError('Please enter your mobile number'); return }

    setSending(true)
    try {
      const res = await fetch(`${API}/guest-portal/${eventId}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP')
      setStep('otp')
      setCountdown(30)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
    if (newOtp.every(d => d) && !newOtp.includes('')) {
      handleVerifyOTP(newOtp.join(''))
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  async function handleVerifyOTP(otpValue?: string) {
    const code = otpValue || otp.join('')
    if (code.length < 6) { setError('Please enter the 6-digit OTP'); return }
    setError('')
    setVerifying(true)
    try {
      const res = await fetch(`${API}/guest-portal/${eventId}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mobile: mobile.trim(), otp: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')
      router.push(`/guest/${eventId}/portal`)
    } catch (err: any) {
      setError(err.message)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } finally {
      setVerifying(false)
    }
  }

  async function resendOTP() {
    if (countdown > 0) return
    setError('')
    setSending(true)
    try {
      await fetch(`${API}/guest-portal/${eventId}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() }),
      })
      setOtp(['', '', '', '', '', ''])
      setCountdown(30)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError('Failed to resend OTP')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1025 50%, #0f1a2a 100%)' }}>
      {/* Hero image overlay */}
      {eventData?.hero_image_url && (
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `url(${eventData.hero_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      <div className="relative flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: brandColor }}
          />

          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Logo / Title */}
            <div className="text-center mb-8">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}88)` }}
              >
                ✦
              </div>
              <h1 className="text-xl font-semibold text-white">
                {eventData?.portal_title || 'Guest Portal'}
              </h1>
              <p className="text-sm text-white/50 mt-1">Verify your identity to continue</p>
            </div>

            {step === 'mobile' ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm select-none">
                      +91
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="9876543210"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                      maxLength={10}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending || mobile.length < 10}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: sending || mobile.length < 10 ? '#374151' : `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
                >
                  {sending ? 'Sending OTP…' : 'Send OTP'}
                </button>

                <p className="text-xs text-center text-white/30">
                  OTP will be sent via SMS. Valid for 10 minutes.
                </p>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-white/60 text-sm">
                    Enter the 6-digit OTP sent to
                  </p>
                  <p className="text-white font-medium">
                    +91 {mobile.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                    <button
                      onClick={() => { setStep('mobile'); setOtp(['','','','','','']); setError('') }}
                      className="ml-2 text-xs text-violet-400 hover:text-violet-300"
                    >
                      Change
                    </button>
                  </p>
                </div>

                {/* OTP boxes */}
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-bold bg-white/5 border-2 rounded-xl text-white focus:outline-none transition-all"
                      style={{ borderColor: digit ? brandColor : 'rgba(255,255,255,0.1)' }}
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  onClick={() => handleVerifyOTP()}
                  disabled={verifying || otp.includes('')}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: verifying || otp.includes('') ? '#374151' : `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
                >
                  {verifying ? 'Verifying…' : 'Verify & Continue'}
                </button>

                <p className="text-center text-sm">
                  {countdown > 0 ? (
                    <span className="text-white/40">Resend in {countdown}s</span>
                  ) : (
                    <button
                      onClick={resendOTP}
                      disabled={sending}
                      className="text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      {sending ? 'Sending…' : 'Resend OTP'}
                    </button>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Powered by */}
          {!eventData?.hide_powered_by && (
            <p className="text-center text-white/20 text-xs mt-6">
              Powered by <span className="text-white/40 font-medium">OccasionPro</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
