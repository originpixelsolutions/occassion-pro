'use client'

/**
 * Guest Portal — Self Registration
 *
 * Shown to NEW guests (not yet on the guest list).
 * Collects: full name, email (optional), dietary preferences.
 * On submit → PATCH /guest-portal/:eventId/me → redirect to /home
 */

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react'
import { ConsentCheckbox } from '@/components/dpdp/ConsentCheckbox'

const DIETARY_OPTIONS = [
  'No restrictions',
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Other',
]

const MEAL_PREFS = ['No preference', 'Veg', 'Non-Veg', 'Vegan', 'Jain']

export default function GuestRegisterPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string

  const [form, setForm] = useState({
    full_name: '',
    meal_preference: 'No preference',
    dietary_requirements: '',
    special_requests: '',
  })
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [consentGiven,  setConsentGiven]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Please enter your name'); return }
    if (!consentGiven) { setError('Please accept the privacy consent to continue.'); return }
    setError('')
    setLoading(true)
    try {
      await guestApi.patch(`/guest-portal/${eventId}/me`, eventId, form)
      router.replace(`/${tenant}/portal/${eventId}/home`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontSize: 13, color: '#888' }}>Register</span>
      </div>

      <div style={{ flex: 1, padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--portal-brand-10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserPlus size={20} style={{ color: 'var(--portal-brand)' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Welcome!</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Tell us a bit about yourself</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
              Full Name <span style={{ color: 'var(--portal-brand)' }}>*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name"
              autoFocus
            />
          </div>

          {/* Meal Preference */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
              Meal Preference
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MEAL_PREFS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, meal_preference: m }))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: form.meal_preference === m
                      ? '1.5px solid var(--portal-brand)'
                      : '1.5px solid #2e2e2e',
                    background: form.meal_preference === m
                      ? 'var(--portal-brand-10)'
                      : 'transparent',
                    color: form.meal_preference === m ? 'var(--portal-brand)' : '#888',
                    transition: 'all 0.15s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Requirements */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
              Dietary Requirements
            </label>
            <select
              value={form.dietary_requirements}
              onChange={e => setForm(f => ({ ...f, dietary_requirements: e.target.value }))}
            >
              <option value="">Select if applicable</option>
              {DIETARY_OPTIONS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Special Requests */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500 }}>
              Special Requests <span style={{ color: '#555' }}>(optional)</span>
            </label>
            <textarea
              value={form.special_requests}
              onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))}
              placeholder="Wheelchair access, baby chair, etc."
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>

          {/* DPDP Consent — required */}
          <div style={{ padding: '12px 0' }}>
            <ConsentCheckbox
              tenantName={tenant}
              tenantId={tenant}
              eventId={eventId}
              subjectType="guest"
              consentType="data_processing"
              onConsentChange={setConsentGiven}
            />
          </div>

          {error && (
            <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="portal-btn" type="submit" disabled={loading}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
                  </span>
                : 'View My Portal →'
              }
            </button>
            <button
              type="button"
              onClick={() => router.replace(`/${tenant}/portal/${eventId}/home`)}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13, padding: 8 }}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
