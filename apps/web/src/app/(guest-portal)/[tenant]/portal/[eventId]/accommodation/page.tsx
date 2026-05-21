'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Bed, MapPin, Phone, Navigation, Loader2 } from 'lucide-react'

interface AccommodationData {
  guest_booking?: {
    hotel_name: string
    room_number?: string
    room_type?: string
    check_in: string
    check_out: string
    confirmation_number?: string
  }
  hotels: Array<{
    id: string
    name: string
    address?: string
    phone?: string
    maps_url?: string
    distance_from_venue?: string
    room_types?: Array<{ type: string; price?: number; currency?: string }>
    notes?: string
  }>
}

export default function AccommodationPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [data, setData] = useState<AccommodationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<AccommodationData>(`/guest-portal/${eventId}/sections/accommodation`, eventId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bed size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Stay & Accommodation</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : (
          <>
            {/* Personal booking */}
            {data?.guest_booking && (
              <div style={{
                background: 'var(--portal-brand-10)',
                border: '1px solid var(--portal-brand-20)',
                borderRadius: 16, padding: '18px 20px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--portal-brand)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  Your Booking
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{data.guest_booking.hotel_name}</h3>
                {data.guest_booking.room_type && (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#aaa' }}>{data.guest_booking.room_type}{data.guest_booking.room_number ? ` · Room ${data.guest_booking.room_number}` : ''}</p>
                )}
                <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>Check-in</div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(data.guest_booking.check_in)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>Check-out</div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(data.guest_booking.check_out)}</div>
                  </div>
                </div>
                {data.guest_booking.confirmation_number && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
                    Confirmation: <strong style={{ color: '#ddd' }}>{data.guest_booking.confirmation_number}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Hotel options */}
            {data?.hotels?.length ? (
              <>
                <div style={{ fontSize: 13, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Recommended Hotels
                </div>
                {data.hotels.map(hotel => (
                  <div key={hotel.id} className="portal-card">
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>{hotel.name}</h3>
                    {hotel.distance_from_venue && (
                      <div style={{ fontSize: 12, color: 'var(--portal-brand)', marginBottom: 8 }}>
                        📍 {hotel.distance_from_venue} from venue
                      </div>
                    )}
                    {hotel.address && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, fontSize: 13, color: '#888' }}>
                        <MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                        {hotel.address}
                      </div>
                    )}
                    {hotel.room_types?.length ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {hotel.room_types.map((rt, i) => (
                          <span key={i} style={{
                            fontSize: 12, padding: '4px 10px', borderRadius: 6,
                            background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#aaa',
                          }}>
                            {rt.type}
                            {rt.price ? ` · ₹${rt.price.toLocaleString()}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {hotel.notes && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>{hotel.notes}</p>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {hotel.maps_url && (
                        <a
                          href={hotel.maps_url} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, textDecoration: 'none', background: 'var(--portal-brand-10)', color: 'var(--portal-brand)', fontSize: 13, fontWeight: 600 }}
                        >
                          <Navigation size={14} /> Directions
                        </a>
                      )}
                      {hotel.phone && (
                        <a
                          href={`tel:${hotel.phone}`}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, textDecoration: 'none', background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#aaa', fontSize: 13 }}
                        >
                          <Phone size={14} /> Call
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : !data?.guest_booking && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
                <Bed size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 14 }}>Accommodation info coming soon</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
