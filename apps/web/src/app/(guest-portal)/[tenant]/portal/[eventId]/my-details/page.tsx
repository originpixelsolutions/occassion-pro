'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { useGuestPortal } from '@/hooks/use-guest-portal'
import { ArrowLeft, UserCircle, Loader2, CheckCircle2 } from 'lucide-react'

const MEAL_PREFS = ['No preference', 'Veg', 'Non-Veg', 'Vegan', 'Jain']
const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Other']

export default function MyDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string
  const { isLoggedIn, isLoading: authLoading, portalData } = useGuestPortal(eventId)

  const [form, setForm] = useState({
    full_name: '',
    meal_preference: 'No preference',
    dietary_requirements: '',
    special_requests: '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace(`/${tenant}/portal/${eventId}/login`)
  }, [authLoading, isLoggedIn, tenant, eventId, router])

  useEffect(() => {
    if (portalData?.guest) {
      setForm({
        full_name: portalData.guest.full_name ?? portalData.guest.name ?? '',
        meal_preference: portalData.guest.meal_preference ?? 'No preference',
        dietary_requirements: portalData.guest.dietary_requirements ?? '',
        special_requests: portalData.guest.special_requests ?? '',
      })
    }
  }, [portalData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await guestApi.patch(`/guest-portal/${eventId}/me`, eventId, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCircle size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>My Profile</h1>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>Full Name</label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>Meal Preference</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MEAL_PREFS.map(m => (
              <button
                key={m} type="button"
                onClick={() => setForm(f => ({ ...f, meal_preference: m }))}
                style={{
                  padding: '8px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: form.meal_preference === m ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                  background: form.meal_preference === m ? 'var(--portal-brand-10)' : 'transparent',
                  color: form.meal_preference === m ? 'var(--portal-brand)' : '#888',
                }}
              >{m}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>Dietary Requirements</label>
          <select value={form.dietary_requirements} onChange={e => setForm(f => ({ ...f, dietary_requirements: e.target.value }))}>
            {DIETARY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>Special Requests</label>
          <textarea
            value={form.special_requests}
            onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))}
            placeholder="Wheelchair access, dietary notes, etc."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {error && (
          <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
            {error}
          </div>
        )}

        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d2d1f', border: '1px solid #1a5c3a', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#4ade80' }}>
            <CheckCircle2 size={16} /> Profile saved!
          </div>
        )}

        <button className="portal-btn" type="submit" disabled={loading}>
          {loading
            ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
              </span>
            : 'Save Changes'
          }
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
