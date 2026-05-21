'use client'

/**
 * Guest Portal — Landing Page
 *
 * Unauthenticated entry point. Shows cover image, event name, date, and CTA.
 * Redirects to /home if already logged in, or /login to authenticate.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getGuestSession, guestApi } from '@/lib/guest-portal-api'
import { Calendar, MapPin, Loader2 } from 'lucide-react'

interface EventData {
  id: string
  name: string
  start_date: string
  end_date?: string
  venue_name?: string
  venue_address?: string
  cover_image_url?: string
  hero_image_url?: string
  portal_title?: string
  welcome_message?: string
  brand_color?: string
  host_name?: string
  login_enabled?: boolean
}

export default function PortalLandingPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const session = getGuestSession(eventId)
    if (session) {
      // Validate session quickly
      guestApi.get<any>(`/guest-portal/${eventId}/portal`, eventId)
        .then(() => router.replace(`/${tenant}/portal/${eventId}/home`))
        .catch(() => setCheckingSession(false))
    } else {
      setCheckingSession(false)
    }
  }, [eventId, tenant, router])

  useEffect(() => {
    if (checkingSession) return
    const API = process.env.NEXT_PUBLIC_API_URL ?? '/api'
    fetch(`${API}/guest-portal/${eventId}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setEvent(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId, checkingSession])

  if (checkingSession || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const coverImage = event?.cover_image_url ?? event?.hero_image_url
  const eventDate = event?.start_date ? new Date(event.start_date) : null

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Cover Image */}
      <div style={{
        position: 'relative',
        height: 300,
        background: coverImage ? `url(${coverImage}) center/cover` : 'linear-gradient(135deg, var(--portal-brand) 0%, #1a1a2e 100%)',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)',
        }} />
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
          {event?.host_name && (
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {event.host_name}
            </p>
          )}
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {event?.portal_title ?? event?.name ?? 'Welcome'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Event Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {eventDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 14 }}>
              <Calendar size={16} style={{ color: 'var(--portal-brand)', flexShrink: 0 }} />
              <span>
                {eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          )}
          {event?.venue_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 14 }}>
              <MapPin size={16} style={{ color: 'var(--portal-brand)', flexShrink: 0 }} />
              <span>{event.venue_name}</span>
            </div>
          )}
        </div>

        {/* Welcome Message */}
        {event?.welcome_message && (
          <div style={{
            background: 'var(--portal-brand-10)',
            border: '1px solid var(--portal-brand-20)',
            borderRadius: 14,
            padding: '16px 18px',
            fontSize: 14,
            color: '#ddd',
            lineHeight: 1.6,
          }}>
            {event.welcome_message}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {event?.login_enabled !== false && (
            <button
              className="portal-btn"
              onClick={() => router.push(`/${tenant}/portal/${eventId}/login`)}
            >
              View My Invitation
            </button>
          )}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#555', margin: 0 }}>
            You'll receive a one-time code to verify your identity
          </p>
        </div>
      </div>
    </div>
  )
}
