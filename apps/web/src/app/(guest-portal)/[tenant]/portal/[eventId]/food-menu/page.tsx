'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, UtensilsCrossed, Loader2, Leaf } from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  description?: string
  is_vegetarian?: boolean
  is_vegan?: boolean
  allergens?: string[]
  calories?: number
}

interface MenuCourse {
  id: string
  name: string
  type?: string
  items: MenuItem[]
}

interface MenuData {
  menu_name?: string
  serving_style?: string
  courses: MenuCourse[]
}

export default function FoodMenuPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [data, setData] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    guestApi.get<MenuData>(`/guest-portal/${eventId}/sections/food-menu`, eventId)
      .then(d => {
        setData(d)
        if (d?.courses?.length) setActiveTab(d.courses[0].id)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const activeCourse = data?.courses?.find(c => c.id === activeTab)

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UtensilsCrossed size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Food Menu</h1>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
        </div>
      ) : !data?.courses?.length ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#555' }}>
          <UtensilsCrossed size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Menu coming soon</p>
        </div>
      ) : (
        <>
          {/* Menu header */}
          {(data.menu_name || data.serving_style) && (
            <div style={{ padding: '16px 20px 0' }}>
              {data.menu_name && <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#ddd' }}>{data.menu_name}</h2>}
              {data.serving_style && (
                <span style={{ fontSize: 12, color: 'var(--portal-brand)', background: 'var(--portal-brand-10)', border: '1px solid var(--portal-brand-20)', borderRadius: 4, padding: '2px 8px' }}>
                  {data.serving_style}
                </span>
              )}
            </div>
          )}

          {/* Course tabs */}
          <div style={{ display: 'flex', gap: 8, padding: '16px 20px', overflowX: 'auto' }}>
            {data.courses.map(course => (
              <button
                key={course.id}
                onClick={() => setActiveTab(course.id)}
                style={{
                  padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                  whiteSpace: 'nowrap', cursor: 'pointer',
                  border: activeTab === course.id ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                  background: activeTab === course.id ? 'var(--portal-brand-10)' : 'transparent',
                  color: activeTab === course.id ? 'var(--portal-brand)' : '#888',
                  flexShrink: 0,
                }}
              >
                {course.name}
              </button>
            ))}
          </div>

          {/* Items */}
          {activeCourse && (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activeCourse.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: idx < activeCourse.items.length - 1 ? '1px solid #1e1e1e' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: item.description ? 4 : 0 }}>
                      {(item.is_vegetarian || item.is_vegan) && (
                        <Leaf size={12} style={{ color: item.is_vegan ? '#10b981' : '#22c55e', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f5' }}>{item.name}</span>
                    </div>
                    {item.description && (
                      <p style={{ margin: 0, fontSize: 13, color: '#888', lineHeight: 1.5 }}>{item.description}</p>
                    )}
                    {item.allergens?.length ? (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {item.allergens.map(a => (
                          <span key={a} style={{ fontSize: 10, background: '#2d2010', color: '#f59e0b', border: '1px solid #4a3010', borderRadius: 4, padding: '1px 6px' }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {item.calories && (
                    <span style={{ fontSize: 12, color: '#666', flexShrink: 0, paddingTop: 2 }}>{item.calories} kcal</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
