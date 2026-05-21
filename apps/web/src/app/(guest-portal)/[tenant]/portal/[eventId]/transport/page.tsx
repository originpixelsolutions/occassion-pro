'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Truck, MapPin, Clock, Phone, Loader2 } from 'lucide-react'

interface TransportData {
  parking_available?: boolean
  parking_info?: string
  shuttle_service?: boolean
  shuttle_schedule?: Array<{ from: string; to: string; time: string; seats?: number }>
  transport_notes?: string
  nearby_transit?: Array<{ type: string; name: string; distance?: string }>
  valet?: boolean
  valet_info?: string
  contact_name?: string
  contact_phone?: string
}

export default function TransportPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [data, setData] = useState<TransportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<TransportData>(`/guest-portal/${eventId}/sections/transport`, eventId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const InfoCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="portal-card">
      <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Transport</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Truck size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Transport info coming soon</p>
          </div>
        ) : (
          <>
            {/* Shuttle Service */}
            {data.shuttle_service && data.shuttle_schedule?.length ? (
              <InfoCard title="Shuttle Service">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.shuttle_schedule.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#111', borderRadius: 10, padding: '12px 14px',
                    }}>
                      <Clock size={14} style={{ color: 'var(--portal-brand)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.from} → {s.to}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{s.time}{s.seats ? ` · ${s.seats} seats` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </InfoCard>
            ) : null}

            {/* Parking */}
            {data.parking_available !== undefined && (
              <InfoCard title="Parking">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: data.parking_info ? 8 : 0 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: data.parking_available ? '#10b981' : '#ef4444',
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {data.parking_available ? 'Parking available at venue' : 'Limited / no parking at venue'}
                  </span>
                </div>
                {data.parking_info && <p style={{ margin: 0, fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{data.parking_info}</p>}
              </InfoCard>
            )}

            {/* Valet */}
            {data.valet && (
              <InfoCard title="Valet Service">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: data.valet_info ? 8 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Valet parking available</span>
                </div>
                {data.valet_info && <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>{data.valet_info}</p>}
              </InfoCard>
            )}

            {/* Nearby Transit */}
            {data.nearby_transit?.length ? (
              <InfoCard title="Nearby Transit">
                {data.nearby_transit.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < data.nearby_transit!.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                    <MapPin size={14} style={{ color: '#666', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>({t.type})</span>
                    </div>
                    {t.distance && <span style={{ fontSize: 12, color: '#666' }}>{t.distance}</span>}
                  </div>
                ))}
              </InfoCard>
            ) : null}

            {/* Notes */}
            {data.transport_notes && (
              <InfoCard title="Notes">
                <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.7 }}>{data.transport_notes}</p>
              </InfoCard>
            )}

            {/* Contact */}
            {data.contact_name && (
              <div className="portal-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Transport Contact</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{data.contact_name}</div>
                </div>
                {data.contact_phone && (
                  <a href={`tel:${data.contact_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--portal-brand-10)', color: 'var(--portal-brand)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    <Phone size={14} /> Call
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
