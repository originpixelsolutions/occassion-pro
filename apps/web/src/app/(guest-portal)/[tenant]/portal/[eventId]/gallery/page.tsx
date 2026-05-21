'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Image, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface MediaItem {
  id: string
  url: string
  thumbnail_url?: string
  caption?: string
  type?: 'image' | 'video'
}

export default function GalleryPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    guestApi.get<MediaItem[]>(`/guest-portal/${eventId}/sections/gallery`, eventId)
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [eventId])

  const nav = (dir: number) => {
    if (lightbox === null) return
    setLightbox((lightbox + dir + items.length) % items.length)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox === null) return
      if (e.key === 'ArrowRight') nav(1)
      if (e.key === 'ArrowLeft') nav(-1)
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, items.length])

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Gallery</h1>
        </div>
        {items.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>{items.length} photos</span>
        )}
      </div>

      <div style={{ padding: '24px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Image size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Gallery coming soon</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 3,
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setLightbox(idx)}
                style={{
                  aspectRatio: '1',
                  background: `url(${item.thumbnail_url ?? item.url}) center/cover`,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {item.type === 'video' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      ▶
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 100,
            display: 'flex', flexDirection: 'column',
          }}
          onClick={() => setLightbox(null)}
        >
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}
            onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 13, color: '#888' }}>{lightbox + 1} / {items.length}</span>
            <button onClick={() => setLightbox(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>

          {/* Image */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}
            onClick={e => e.stopPropagation()}>
            <img
              src={items[lightbox].url}
              alt={items[lightbox].caption ?? ''}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
            />
          </div>

          {/* Caption */}
          {items[lightbox].caption && (
            <div style={{ textAlign: 'center', padding: '12px 20px', fontSize: 13, color: '#888' }}>
              {items[lightbox].caption}
            </div>
          )}

          {/* Nav arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); nav(-1) }}
                style={{
                  position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                  width: 40, height: 40, cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nav(1) }}
                style={{
                  position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                  width: 40, height: 40, cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
