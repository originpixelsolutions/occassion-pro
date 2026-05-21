'use client'

/**
 * Guest Portal — OTP Login
 *
 * Step 1: Enter mobile number → Step 2: Enter OTP
 * On success, stores JWT in localStorage and redirects to /home
 */

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { setGuestSession } from '@/lib/guest-portal-api'
import { ArrowLeft, Phone, Shield, Loader2, CheckCircle2 } from 'lucide-react'

type Step = 'mobile' | 'otp' | 'register'

export default function GuestPortalLogin() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string

  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL ?? '/api'

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer(t => {
          if (t <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [resendTimer])

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mobile.trim()) { setError('Please enter your mobile number'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/guest-portal/${eventId}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Failed to send OTP')
      setStep('otp')
      setResendTimer(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (otpValue?: string) => {
    const code = otpValue ?? otp.join('')
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/guest-portal/${eventId}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Invalid OTP')
      // Store token and redirect
      if (data.token) setGuestSession(eventId, data.token)
      if (data.is_new_guest) {
        router.replace(`/${tenant}/portal/${eventId}/register`)
      } else {
        router.replace(`/${tenant}/portal/${eventId}/home`)
      }
    } catch (err: any) {
      setError(err.message)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[idx] = digit
    setOtp(newOtp)
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (newOtp.every(d => d !== '')) handleVerifyOtp(newOtp.join(''))
  }

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const digits = pasted.split('')
      setOtp(digits)
      handleVerifyOtp(pasted)
      e.preventDefault()
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => step === 'otp' ? setStep('mobile') : router.back()}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontSize: 13, color: '#888' }}>
          {step === 'mobile' ? 'Login' : 'Verify'}
        </span>
      </div>

      <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['mobile', 'otp'].map((s, i) => (
            <div key={s} style={{
              height: 3,
              flex: 1,
              borderRadius: 99,
              background: i === 0 || step === 'otp' ? 'var(--portal-brand)' : '#2e2e2e',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {step === 'mobile' && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Phone size={20} style={{ color: 'var(--portal-brand)' }} />
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Enter your number</h2>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#888' }}>
                We'll send a one-time code to verify your identity
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>
                Mobile Number
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: '#666', fontSize: 14,
                }}>+</span>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="91 XXXXX XXXXX"
                  style={{ paddingLeft: 26 }}
                  autoFocus
                  inputMode="tel"
                />
              </div>
            </div>

            {error && (
              <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
                {error}
              </div>
            )}

            <button className="portal-btn" type="submit" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending...
                </span>
              ) : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Shield size={20} style={{ color: 'var(--portal-brand)' }} />
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Verify OTP</h2>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#888' }}>
                Sent to <strong style={{ color: '#ddd' }}>+{mobile}</strong>
              </p>
            </div>

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpInput(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  style={{
                    width: 48,
                    height: 56,
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: 700,
                    borderRadius: 12,
                    padding: 0,
                    border: digit ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                    caretColor: 'var(--portal-brand)',
                  }}
                />
              ))}
            </div>

            {error && (
              <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
                {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Verifying...</span>
              </div>
            )}

            {/* Resend */}
            <div style={{ textAlign: 'center', fontSize: 14 }}>
              {resendTimer > 0 ? (
                <span style={{ color: '#666' }}>Resend in {resendTimer}s</span>
              ) : (
                <button
                  onClick={handleRequestOtp as any}
                  style={{ background: 'none', border: 'none', color: 'var(--portal-brand)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
