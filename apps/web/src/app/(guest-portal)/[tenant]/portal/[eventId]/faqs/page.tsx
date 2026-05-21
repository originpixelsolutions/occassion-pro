'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Faq {
  id: string
  question: string
  answer: string
  sort_order?: number
}

export default function FaqsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    guestApi.get<Faq[]>(`/guest-portal/${eventId}/sections/faqs`, eventId)
      .then(data => setFaqs(Array.isArray(data) ? data : []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false))
  }, [eventId])

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HelpCircle size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>FAQs</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : faqs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <HelpCircle size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No FAQs yet</p>
          </div>
        ) : (
          faqs.map(faq => (
            <div
              key={faq.id}
              style={{
                background: '#1a1a1a',
                border: open === faq.id ? '1px solid var(--portal-brand-20)' : '1px solid #262626',
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              <button
                onClick={() => setOpen(open === faq.id ? null : faq.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', gap: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f5', flex: 1 }}>{faq.question}</span>
                <div style={{ color: open === faq.id ? 'var(--portal-brand)' : '#666', flexShrink: 0 }}>
                  {open === faq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {open === faq.id && (
                <div style={{
                  padding: '0 18px 16px',
                  fontSize: 14, color: '#aaa', lineHeight: 1.7,
                  borderTop: '1px solid #262626',
                  paddingTop: 14,
                }}>
                  {faq.answer}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
