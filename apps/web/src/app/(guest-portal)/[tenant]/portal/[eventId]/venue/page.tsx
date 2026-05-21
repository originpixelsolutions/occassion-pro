'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, MapPin, Navigation, Phone, Globe, Loader2, ExternalLink } from 'lucide-react'

interface VenueData {
  event_name: string
  start_date: string
  end_date?: string
  venue_name?: string
  venue_address?: string
  venue_city?: string
  venue_country?: string
  venue_phone?: string
  venue_website?: string
  venue_maps_url?: string
  venue_latitude?: number
  venue_longitude?: number
  dress_code?: string
  parking_info?: string
  arrival_notes?: string
}

export default function VenuePage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [data, setData] = useState<VenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<VenueData>(`/guest-portal/${eventId}/sections/venue`, eventId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const fullAddress = [data?.venue_address, data?.venue_city, data?.venue_country].filter(Boolean).join(', ')

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Venue</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : !data?.venue_name ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <MapPin size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Venue details coming soon</p>
          </div>
        ) : (
          <>
            {/* Main venue card */}
            <div className="portal-card">
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>{data.venue_name}</h2>
              {fullAddress && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#aaa', fontSize: 14 }}>
                  <MapPin size={14} style={{ color: 'var(--portal-brand)', marginTop: 2, flexShrink: 0 }} />
                  <span>{fullAddress}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {(data.venue_maps_url || (data.venue_latitude && data.venue_longitude)) && (
                <a
                  href={data.venue_maps_url ?? `https://maps.google.com/?q=${data.venue_latitude},${data.venue_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px', borderRadius: 12, textDecoration: 'none',
                    background: 'var(--portal-brand)', color: '#fff', fontSize: 14, fontWeight: 600,
                  }}
                >
                  <Navigation size={16} /> Get Directions
                </a>
              )}
              {data.venue_phone && (
                <a
                  href={`tel:${data.venue_phone}`}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px', borderRadius: 12, textDecoration: 'none',
                    background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#f5f5f5', fontSize: 14,
                  }}
                >
                  <Phone size={16} /> Call Venue
                </a>
              )}
            </div>

            {/* Additional info */}
            {[
              { label: 'Dress Code', value: data.dress_code },
              { label: 'Parking', value: data.parking_info },
              { label: 'Arrival Notes', value: data.arrival_notes },
            ].filter(item => item.value).map(item => (
              <div key={item.label} className="portal-card">
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.6 }}>{item.value}</div>
              </div>
            ))}

            {data.venue_website && (
              <a
                href={data.venue_website}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px', borderRadius: 12, textDecoration: 'none',
                  background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 13,
                }}
              >
                <Globe size={14} /> View Venue Website <ExternalLink size={12} />
              </a>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
