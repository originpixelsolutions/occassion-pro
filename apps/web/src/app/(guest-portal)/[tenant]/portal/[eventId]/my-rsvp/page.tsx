'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { useGuestPortal } from '@/hooks/use-guest-portal'
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, Users } from 'lucide-react'

const RSVP_OPTIONS = [
  { value: 'confirmed', label: 'Yes, I\'ll be there! 🎉', color: '#10b981', icon: <CheckCircle2 size={18} /> },
  { value: 'declined', label: 'Unable to attend', color: '#ef4444', icon: <XCircle size={18} /> },
  { value: 'maybe', label: 'Maybe / Not sure', color: '#f59e0b', icon: <Clock size={18} /> },
]

export default function MyRsvpPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string
  const { isLoggedIn, isLoading: authLoading, portalData } = useGuestPortal(eventId)

  const [rsvpStatus, setRsvpStatus] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace(`/${tenant}/portal/${eventId}/login`)
  }, [authLoading, isLoggedIn, tenant, eventId, router])

  useEffect(() => {
    if (portalData?.guest) {
      setRsvpStatus(portalData.guest.rsvp_status ?? '')
      setGuestCount(portalData.guest.guest_count ?? 1)
    }
  }, [portalData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rsvpStatus) { setError('Please select your RSVP status'); return }
    setError('')
    setLoading(true)
    try {
      await guestApi.post(`/guest-portal/${eventId}/sections/rsvp`, eventId, {
        rsvp_status: rsvpStatus,
        guest_count: guestCount,
        message,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (success) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>
        {rsvpStatus === 'confirmed' ? '🎉' : rsvpStatus === 'declined' ? '😢' : '🤔'}
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>RSVP Updated!</h2>
      <p style={{ margin: '0 0 32px', color: '#888', textAlign: 'center', fontSize: 14 }}>
        {rsvpStatus === 'confirmed'
          ? "We're so excited to see you!"
          : rsvpStatus === 'declined'
          ? "We'll miss you, but thank you for letting us know."
          : "Thanks for letting us know. We hope to see you there!"}
      </p>
      <button className="portal-btn" onClick={() => router.push(`/${tenant}/portal/${eventId}/home`)} style={{ maxWidth: 200 }}>
        Back to Home
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>My RSVP</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* RSVP Options */}
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 12, fontWeight: 500 }}>
            Will you be attending?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RSVP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRsvpStatus(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 18px',
                  borderRadius: 14,
                  border: rsvpStatus === opt.value ? `1.5px solid ${opt.color}` : '1.5px solid #2e2e2e',
                  background: rsvpStatus === opt.value ? `${opt.color}15` : '#1a1a1a',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  color: rsvpStatus === opt.value ? opt.color : '#aaa',
                }}
              >
                {opt.icon}
                <span style={{ fontSize: 15, fontWeight: rsvpStatus === opt.value ? 600 : 400 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guest Count (show if confirmed) */}
        {rsvpStatus === 'confirmed' && (
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Number of guests (including you)
              </div>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button type="button"
                onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #2e2e2e', background: '#1a1a1a', color: '#f5f5f5', fontSize: 20, cursor: 'pointer' }}>
                −
              </button>
              <span style={{ fontSize: 22, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{guestCount}</span>
              <button type="button"
                onClick={() => setGuestCount(Math.min(20, guestCount + 1))}
                style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #2e2e2e', background: '#1a1a1a', color: '#f5f5f5', fontSize: 20, cursor: 'pointer' }}>
                +
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
            Message to host <span style={{ color: '#555' }}>(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Any message for the host..."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {error && (
          <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
            {error}
          </div>
        )}

        <button className="portal-btn" type="submit" disabled={loading}>
          {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</span> : 'Confirm RSVP'}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
