'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface RunsheetItem {
  id: string
  start_time: string
  end_time?: string
  title: string
  description?: string
  location?: string
  category?: string
  is_milestone?: boolean
}

export default function ItineraryPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string

  const [items, setItems] = useState<RunsheetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    guestApi.get<RunsheetItem[]>(`/guest-portal/${eventId}/sections/itinerary`, eventId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [eventId])

  const fmt = (t: string) => {
    try {
      return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch { return t }
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Itinerary</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Calendar size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Schedule coming soon</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Timeline line */}
            <div style={{ position: 'absolute', left: 23, top: 24, bottom: 24, width: 2, background: '#2e2e2e' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', gap: 16, paddingBottom: 20 }}>
                  {/* Dot */}
                  <div style={{
                    width: 48, flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: item.is_milestone ? 'var(--portal-brand)' : '#2e2e2e',
                      border: `2px solid ${item.is_milestone ? 'var(--portal-brand)' : '#444'}`,
                      marginTop: 4,
                      zIndex: 1,
                      boxShadow: item.is_milestone ? '0 0 0 4px var(--portal-brand-20)' : 'none',
                    }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: 0 }}>
                    <div
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #262626',
                        borderRadius: 14,
                        padding: '14px 16px',
                        cursor: item.description ? 'pointer' : 'default',
                      }}
                      onClick={() => item.description && setExpanded(expanded === item.id ? null : item.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Clock size={12} style={{ color: '#666' }} />
                            <span style={{ fontSize: 12, color: '#666' }}>
                              {fmt(item.start_time)}{item.end_time ? ` – ${fmt(item.end_time)}` : ''}
                            </span>
                            {item.category && (
                              <span style={{
                                fontSize: 10,
                                background: 'var(--portal-brand-10)',
                                color: 'var(--portal-brand)',
                                border: '1px solid var(--portal-brand-20)',
                                borderRadius: 4,
                                padding: '1px 6px',
                              }}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f5' }}>{item.title}</div>
                          {item.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <MapPin size={11} style={{ color: '#666' }} />
                              <span style={{ fontSize: 12, color: '#666' }}>{item.location}</span>
                            </div>
                          )}
                        </div>
                        {item.description && (
                          <div style={{ color: '#555', flexShrink: 0 }}>
                            {expanded === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        )}
                      </div>

                      {expanded === item.id && item.description && (
                        <div style={{
                          marginTop: 12, paddingTop: 12,
                          borderTop: '1px solid #262626',
                          fontSize: 13, color: '#aaa', lineHeight: 1.6,
                        }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
