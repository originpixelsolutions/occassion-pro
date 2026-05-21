'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { useGuestPortal } from '@/hooks/use-guest-portal'
import { ArrowLeft, Bell, QrCode, Download, Share2, Loader2 } from 'lucide-react'

interface InviteData {
  guest_name: string
  event_name: string
  event_date: string
  venue_name?: string
  invitation_code?: string
  qr_code_url?: string
  invitation_card_url?: string
  table_number?: string
  seat_number?: string
  category?: string
}

export default function MyInvitesPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string
  const { isLoggedIn, isLoading: authLoading, portalData } = useGuestPortal(eventId)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace(`/${tenant}/portal/${eventId}/login`)
  }, [authLoading, isLoggedIn, tenant, eventId, router])

  const guest = portalData?.guest
  const event = portalData?.event

  const handleShare = async () => {
    const url = window.location.href.replace('/my-invites', '')
    if (navigator.share) {
      await navigator.share({ title: event?.name ?? 'Event', url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>My Invitation</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Invitation Card */}
        <div style={{
          background: 'linear-gradient(135deg, var(--portal-brand) 0%, #1a1a2e 100%)',
          borderRadius: 20,
          padding: '28px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Invitation for
            </p>
            <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 800, color: '#fff' }}>
              {guest?.full_name ?? guest?.name ?? 'Guest'}
            </h2>

            <div style={{ marginBottom: 6 }}>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Event</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>{event?.name ?? 'Event'}</p>
            </div>

            {event?.start_date && (
              <div style={{ marginBottom: 6 }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Date</p>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
                  {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}

            {guest?.category && (
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                {guest.category}
              </span>
            )}
          </div>
        </div>

        {/* Seat Info */}
        {(guest?.table_number || guest?.seat_number) && (
          <div className="portal-card" style={{ display: 'flex', gap: 20 }}>
            {guest.table_number && (
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Table</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--portal-brand)' }}>{guest.table_number}</div>
              </div>
            )}
            {guest.seat_number && (
              <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #262626', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Seat</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--portal-brand)' }}>{guest.seat_number}</div>
              </div>
            )}
          </div>
        )}

        {/* QR Code */}
        {guest?.invitation_code && (
          <div className="portal-card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{
              width: 120, height: 120, margin: '0 auto 16px',
              background: '#fff', borderRadius: 12, padding: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <QrCode size={96} style={{ color: '#000' }} />
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>Your check-in code</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: 'var(--portal-brand)' }}>
              {guest.invitation_code}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleShare}
            className="portal-btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Share2 size={16} /> Share Portal
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
