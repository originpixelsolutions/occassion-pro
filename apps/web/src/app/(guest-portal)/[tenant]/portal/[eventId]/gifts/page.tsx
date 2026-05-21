'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Gift, ExternalLink, Loader2 } from 'lucide-react'

interface GiftItem {
  id: string
  name: string
  description?: string
  price?: number
  currency?: string
  image_url?: string
  link?: string
  is_claimed?: boolean
  priority?: 'must_have' | 'nice_to_have' | 'optional'
}

interface GiftsData {
  wishlist_name?: string
  items: GiftItem[]
  registry_message?: string
}

export default function GiftsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [data, setData] = useState<GiftsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<GiftsData>(`/guest-portal/${eventId}/sections/gifts`, eventId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const fmt = (price: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price)
  }

  const priorityColor: Record<string, string> = {
    must_have: '#f59e0b',
    nice_to_have: '#6366f1',
    optional: '#6b7280',
  }

  const priorityLabel: Record<string, string> = {
    must_have: '⭐ Must Have',
    nice_to_have: 'Nice to Have',
    optional: 'Optional',
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gift size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Gift Registry</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : !data?.items?.length ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Gift size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Gift registry coming soon</p>
          </div>
        ) : (
          <>
            {data.registry_message && (
              <div className="portal-card" style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>
                {data.registry_message}
              </div>
            )}

            {data.items.map(item => (
              <div key={item.id} className="portal-card" style={{ opacity: item.is_claimed ? 0.5 : 1 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  {item.image_url && (
                    <div style={{
                      width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                      background: `url(${item.image_url}) center/cover`,
                      border: '1px solid #2e2e2e',
                    }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: item.is_claimed ? '#666' : '#f5f5f5' }}>
                        {item.name}
                        {item.is_claimed && <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>(Claimed)</span>}
                      </div>
                      {item.priority && (
                        <span style={{
                          fontSize: 10, borderRadius: 4, padding: '2px 6px',
                          background: priorityColor[item.priority] + '20',
                          color: priorityColor[item.priority],
                          flexShrink: 0,
                        }}>
                          {priorityLabel[item.priority]}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p style={{ margin: '4px 0', fontSize: 13, color: '#888', lineHeight: 1.5 }}>{item.description}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      {item.price && (
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--portal-brand)' }}>
                          {fmt(item.price, item.currency)}
                        </span>
                      )}
                      {item.link && !item.is_claimed && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 12px', borderRadius: 8,
                            background: 'var(--portal-brand-10)',
                            color: 'var(--portal-brand)',
                            textDecoration: 'none', fontSize: 13, fontWeight: 600,
                          }}
                        >
                          Buy <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
