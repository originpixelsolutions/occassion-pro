'use client'

/**
 * Guest Portal — Home Page
 *
 * Personalized welcome, event countdown timer, and navigation cards
 * for all enabled portal sections.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGuestPortal } from '@/hooks/use-guest-portal'
import { clearGuestSession } from '@/lib/guest-portal-api'
import {
  CalendarCheck, MapPin, Gift, Image, Bed, Truck,
  HelpCircle, Users, ClipboardList, Megaphone, UtensilsCrossed,
  CheckSquare, UserCircle, LogOut, ChevronRight, Loader2,
  Bell, Clock,
} from 'lucide-react'

interface SectionCard {
  key: string
  label: string
  icon: React.ReactNode
  href: string
  settingKey?: string
  color: string
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [diff, setDiff] = useState<null | { days: number; hours: number; minutes: number; seconds: number }>(null)

  useEffect(() => {
    const calc = () => {
      const ms = new Date(targetDate).getTime() - Date.now()
      if (ms <= 0) { setDiff(null); return }
      const s = Math.floor(ms / 1000)
      setDiff({
        days: Math.floor(s / 86400),
        hours: Math.floor((s % 86400) / 3600),
        minutes: Math.floor((s % 3600) / 60),
        seconds: s % 60,
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!diff) return null

  return (
    <div style={{
      background: 'var(--portal-brand-10)',
      border: '1px solid var(--portal-brand-20)',
      borderRadius: 16,
      padding: '16px 20px',
      display: 'flex',
      gap: 0,
      marginBottom: 24,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13 }}>
        <Clock size={14} style={{ color: 'var(--portal-brand)' }} />
        <span>Countdown</span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { v: diff.days, l: 'Days' },
          { v: diff.hours, l: 'Hrs' },
          { v: diff.minutes, l: 'Min' },
          { v: diff.seconds, l: 'Sec' },
        ].map(({ v, l }) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--portal-brand)', lineHeight: 1 }}>
              {String(v).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GuestPortalHome() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string
  const { guestName, isLoggedIn, isLoading, portalData } = useGuestPortal(eventId)

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace(`/${tenant}/portal/${eventId}/login`)
    }
  }, [isLoading, isLoggedIn, tenant, eventId, router])

  const settings = portalData?.settings ?? {}
  const event = portalData?.event ?? {}

  const sections: SectionCard[] = [
    {
      key: 'rsvp', label: 'My RSVP', icon: <CheckSquare size={20} />,
      href: `/${tenant}/portal/${eventId}/my-rsvp`, settingKey: 'section_rsvp', color: '#6366f1',
    },
    {
      key: 'schedule', label: 'Itinerary', icon: <CalendarCheck size={20} />,
      href: `/${tenant}/portal/${eventId}/itinerary`, settingKey: 'section_schedule', color: '#8b5cf6',
    },
    {
      key: 'venue', label: 'Venue', icon: <MapPin size={20} />,
      href: `/${tenant}/portal/${eventId}/venue`, settingKey: 'section_event_details', color: '#ec4899',
    },
    {
      key: 'accommodation', label: 'Stay', icon: <Bed size={20} />,
      href: `/${tenant}/portal/${eventId}/accommodation`, settingKey: 'section_accommodation', color: '#f59e0b',
    },
    {
      key: 'transport', label: 'Transport', icon: <Truck size={20} />,
      href: `/${tenant}/portal/${eventId}/transport`, settingKey: 'section_transport', color: '#10b981',
    },
    {
      key: 'food', label: 'Food Menu', icon: <UtensilsCrossed size={20} />,
      href: `/${tenant}/portal/${eventId}/food-menu`, settingKey: 'section_meal', color: '#f97316',
    },
    {
      key: 'gallery', label: 'Gallery', icon: <Image size={20} />,
      href: `/${tenant}/portal/${eventId}/gallery`, settingKey: 'section_gallery', color: '#14b8a6',
    },
    {
      key: 'gifts', label: 'Gift Registry', icon: <Gift size={20} />,
      href: `/${tenant}/portal/${eventId}/gifts`, settingKey: 'section_gift_registry', color: '#f43f5e',
    },
    {
      key: 'announcements', label: 'Updates', icon: <Megaphone size={20} />,
      href: `/${tenant}/portal/${eventId}/announcements`, settingKey: 'section_sessions', color: '#3b82f6',
    },
    {
      key: 'contacts', label: 'Contacts', icon: <Users size={20} />,
      href: `/${tenant}/portal/${eventId}/contacts`, settingKey: 'section_contact', color: '#a855f7',
    },
    {
      key: 'faqs', label: 'FAQs', icon: <HelpCircle size={20} />,
      href: `/${tenant}/portal/${eventId}/faqs`, settingKey: 'section_survey', color: '#6b7280',
    },
    {
      key: 'survey', label: 'Survey', icon: <ClipboardList size={20} />,
      href: `/${tenant}/portal/${eventId}/survey`, settingKey: 'section_survey', color: '#06b6d4',
    },
    {
      key: 'my-invites', label: 'My Invites', icon: <Bell size={20} />,
      href: `/${tenant}/portal/${eventId}/my-invites`, settingKey: undefined, color: '#84cc16',
    },
    {
      key: 'my-details', label: 'My Profile', icon: <UserCircle size={20} />,
      href: `/${tenant}/portal/${eventId}/my-details`, settingKey: undefined, color: '#94a3b8',
    },
  ]

  // Filter sections by portal settings
  const visibleSections = sections.filter(s => {
    if (!s.settingKey) return true
    return settings[s.settingKey] !== false
  })

  const handleLogout = () => {
    clearGuestSession(eventId)
    router.replace(`/${tenant}/portal/${eventId}`)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = guestName?.split(' ')[0] ?? 'there'

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      {/* Top Bar */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{greeting}</p>
          <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800 }}>
            {firstName} 👋
          </h2>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Event Name */}
      {event.name && (
        <div style={{ padding: '12px 20px 0' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarCheck size={14} style={{ color: 'var(--portal-brand)' }} />
            {event.name}
            {event.start_date && ` · ${new Date(event.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
      )}

      <div style={{ padding: '24px 20px 0' }}>
        {/* Countdown */}
        {event.start_date && new Date(event.start_date) > new Date() && (
          <CountdownTimer targetDate={event.start_date} />
        )}

        {/* RSVP Status Banner */}
        {portalData?.guest?.rsvp_status && (
          <div style={{
            background: portalData.guest.rsvp_status === 'confirmed'
              ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${portalData.guest.rsvp_status === 'confirmed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>
                {portalData.guest.rsvp_status === 'confirmed' ? '✅' : '⏳'}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: portalData.guest.rsvp_status === 'confirmed' ? '#10b981' : '#f59e0b' }}>
                  RSVP {portalData.guest.rsvp_status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {portalData.guest.rsvp_status === 'confirmed' ? "We're excited to see you!" : "Please confirm your attendance"}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/${tenant}/portal/${eventId}/my-rsvp`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Section Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {visibleSections.map(section => (
            <button
              key={section.key}
              onClick={() => router.push(section.href)}
              style={{
                background: '#1a1a1a',
                border: '1px solid #262626',
                borderRadius: 16,
                padding: '18px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.15s, background 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = section.color + '50')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#262626')}
            >
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: section.color + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: section.color,
              }}>
                {section.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f5' }}>{section.label}</div>
              </div>
              <div style={{ position: 'absolute', bottom: 14, right: 14, color: '#555' }}>
                <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
