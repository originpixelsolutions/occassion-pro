'use client'
import { useState, useEffect, use } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown, Calendar, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConsentCheckbox } from '@/components/dpdp/ConsentCheckbox'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RsvpFormData {
  id: string
  name: string
  public_slug: string
  is_active: boolean
  deadline?: string
  max_responses?: number
  password_protected: boolean
  moderation_enabled: boolean
  show_plus_one: boolean
  show_meal_preference: boolean
  show_dietary: boolean
  show_accommodation: boolean
  show_transport: boolean
  show_tshirt_size: boolean
  show_emergency_contact: boolean
  show_message_to_host: boolean
  primary_color: string
  background_color: string
  text_color: string
  button_color: string
  button_text_color: string
  font_family: string
  border_radius: string
  thankyou_message: string
  thankyou_redirect_url?: string
  custom_questions: {
    id: string
    question_text: string
    question_type: string
    options: string[]
    is_required: boolean
    sort_order: number
  }[]
  event: {
    id: string
    name: string
    start_date?: string
    end_date?: string
    venue?: { name: string; address?: string; city?: string }
    logo_url?: string
    tagline?: string
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicRsvpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [formData, setFormData] = useState<RsvpFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'password' | 'submitted' | 'closed'>('form')
  const [submitting, setSubmitting] = useState(false)

  // Form values
  const [attendance, setAttendance] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [plusOneName, setPlusOneName] = useState('')
  const [plusOneDietary, setPlusOneDietary] = useState('')
  const [meal, setMeal] = useState('')
  const [dietary, setDietary] = useState('')
  const [needAccom, setNeedAccom] = useState(false)
  const [accomCheckin, setAccomCheckin] = useState('')
  const [accomCheckout, setAccomCheckout] = useState('')
  const [accomRoom, setAccomRoom] = useState('')
  const [needTransport, setNeedTransport] = useState(false)
  const [transportPickup, setTransportPickup] = useState('')
  const [tshirtSize, setTshirtSize] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [hostMessage, setHostMessage] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | string[]>>({})
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)

  useEffect(() => {
    fetch(`${API}/public/rsvp/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(d.error); return }
        setFormData(d)
        if (!d.is_active) setStep('closed')
        else if (d.password_protected) setStep('password')
      })
      .catch(() => setError('Unable to load RSVP form'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Form Not Found</h2>
          <p className="text-sm text-muted-foreground">{error ?? 'This RSVP form does not exist or has been removed.'}</p>
        </div>
      </div>
    )
  }

  const {
    primary_color: primary, background_color: bg, text_color: txt,
    button_color: btn, button_text_color: btnTxt, font_family: font,
  } = formData

  const brMap: Record<string, string> = { sharp: '0', default: '8px', rounded: '12px', pill: '24px' }
  const br = brMap[formData.border_radius] ?? '8px'

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px 14px',
    border: `1.5px solid ${primary}40`, borderRadius: br,
    backgroundColor: bg, color: txt, fontFamily: font,
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: txt, fontFamily: font, marginBottom: '6px',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attendance) return
    setSubmitting(true)
    try {
      const body = {
        attendance,
        plus_one_name: plusOneName || undefined,
        plus_one_dietary: plusOneDietary || undefined,
        meal_preference: meal || undefined,
        dietary_notes: dietary || undefined,
        accommodation_needed: needAccom,
        accom_checkin_date: accomCheckin || undefined,
        accom_checkout_date: accomCheckout || undefined,
        accom_room_type: accomRoom || undefined,
        transport_needed: needTransport,
        transport_pickup_location: transportPickup || undefined,
        tshirt_size: tshirtSize || undefined,
        emergency_contact_name: emergencyName || undefined,
        emergency_contact_phone: emergencyPhone || undefined,
        message_to_host: hostMessage || undefined,
        custom_answers: customAnswers,
      }
      const res = await fetch(`${API}/public/rsvp/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setStep('submitted')
        if (formData.thankyou_redirect_url) {
          setTimeout(() => { window.location.href = formData.thankyou_redirect_url! }, 3000)
        }
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const verifyPassword = async () => {
    // Backend accepts password as query param on the GET /public/rsvp/:slug?password=xxx endpoint
    const res = await fetch(`${API}/public/rsvp/${slug}?password=${encodeURIComponent(password)}`)
    const data = await res.json()
    if (res.ok && data?.id) setStep('form')
    else setPasswordError('Incorrect password. Please try again.')
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', backgroundColor: bg, fontFamily: font,
    padding: '24px 16px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: bg, border: `1px solid ${primary}25`,
    borderRadius: br, padding: '28px 24px',
    maxWidth: '500px', margin: '0 auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
  }

  // ── Closed ──
  if (step === 'closed') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <AlertCircle style={{ width: 48, height: 48, color: '#f59e0b', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: txt, fontFamily: font, margin: '0 0 8px' }}>
            RSVP Closed
          </h2>
          <p style={{ fontSize: 14, color: `${txt}80`, fontFamily: font, margin: 0 }}>
            {formData.deadline
              ? `The deadline for this RSVP was ${new Date(formData.deadline).toLocaleDateString()}.`
              : 'This RSVP form is no longer accepting responses.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Password ──
  if (step === 'password') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: `${primary}15`, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: txt, fontFamily: font, margin: '0 0 8px' }}>
            Password Required
          </h2>
          <p style={{ fontSize: 13, color: `${txt}70`, fontFamily: font, margin: '0 0 20px' }}>
            Enter the event password to access this RSVP form.
          </p>
          <input
            type="password" value={password}
            onChange={e => { setPassword(e.target.value); setPasswordError('') }}
            onKeyDown={e => e.key === 'Enter' && verifyPassword()}
            style={{ ...inputStyle, marginBottom: '12px', textAlign: 'center' }}
            placeholder="Event password"
          />
          {passwordError && (
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, fontFamily: font }}>{passwordError}</p>
          )}
          <button onClick={verifyPassword} style={{
            width: '100%', padding: '12px', backgroundColor: btn, color: btnTxt,
            border: 'none', borderRadius: br, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: font,
          }}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ── Submitted ──
  if (step === 'submitted') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: '#22c55e20', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle style={{ width: 32, height: 32, color: '#22c55e' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: txt, fontFamily: font, margin: '0 0 12px' }}>
            {attendance === 'yes' ? '🎉 See you there!' : attendance === 'no' ? 'Thanks for letting us know' : 'RSVP Received!'}
          </h2>
          <p style={{ fontSize: 14, color: `${txt}80`, fontFamily: font, lineHeight: 1.6, margin: 0 }}>
            {formData.thankyou_message}
          </p>
          {formData.moderation_enabled && (
            <p style={{ fontSize: 12, color: `${txt}60`, fontFamily: font, marginTop: 12 }}>
              Your RSVP is pending review. We'll confirm shortly.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Form ──
  const e = formData.event

  return (
    <div style={pageStyle}>
      {/* Event header */}
      <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto 24px' }}>
        {e.logo_url ? (
          <img src={e.logo_url} alt={e.name}
            style={{ height: 52, objectFit: 'contain', margin: '0 auto 12px' }} />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            backgroundColor: `${primary}20`, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>🎪</div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: txt, fontFamily: font, margin: '0 0 8px' }}>
          {e.name}
        </h1>
        {e.tagline && (
          <p style={{ fontSize: 14, color: `${txt}70`, fontFamily: font, margin: '0 0 10px', fontStyle: 'italic' }}>
            {e.tagline}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          {e.start_date && (
            <span style={{ fontSize: 12, color: `${txt}70`, fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
              📅 {new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {e.venue?.name && (
            <span style={{ fontSize: 12, color: `${txt}70`, fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
              📍 {e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* RSVP Card */}
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: txt, fontFamily: font, margin: '0 0 20px', textAlign: 'center' }}>
          {formData.name}
        </h2>

        {/* Attendance */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Will you attend? <span style={{ color: '#ef4444' }}>*</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['yes', '✓ Yes, I\'ll be there!', '#22c55e'], ['maybe', '~ Maybe', '#f59e0b'], ['no', '✕ Can\'t make it', '#ef4444']] as const).map(([val, label, col]) => (
              <button
                key={val} type="button"
                onClick={() => setAttendance(val)}
                style={{
                  flex: 1, padding: '10px 4px', border: `2px solid ${attendance === val ? col : `${primary}20`}`,
                  borderRadius: br, cursor: 'pointer', fontSize: 12, fontWeight: attendance === val ? 700 : 500,
                  color: attendance === val ? col : `${txt}80`, fontFamily: font,
                  backgroundColor: attendance === val ? `${col}12` : 'transparent',
                  transition: 'all 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Plus one */}
        {formData.show_plus_one && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Bringing a Plus One?</label>
            <input
              value={plusOneName}
              onChange={e => setPlusOneName(e.target.value)}
              style={inputStyle}
              placeholder="Guest name (leave blank if not bringing anyone)"
            />
            {plusOneName && (
              <input
                value={plusOneDietary}
                onChange={e => setPlusOneDietary(e.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Plus one's dietary requirements (optional)"
              />
            )}
          </div>
        )}

        {/* Meal */}
        {formData.show_meal_preference && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Meal Preference</label>
            <div style={{ position: 'relative' }}>
              <select value={meal} onChange={e => setMeal(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}>
                <option value="">Select preference</option>
                <option value="veg">🥦 Vegetarian</option>
                <option value="non_veg">🍖 Non-Vegetarian</option>
                <option value="vegan">🌱 Vegan</option>
                <option value="jain">Jain</option>
                <option value="halal">🌙 Halal</option>
                <option value="kosher">✡ Kosher</option>
                <option value="gluten_free">🌾 Gluten Free</option>
              </select>
              <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: `${txt}60`, pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        {/* Dietary */}
        {formData.show_dietary && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Dietary Requirements / Allergies</label>
            <input
              value={dietary}
              onChange={e => setDietary(e.target.value)}
              style={inputStyle}
              placeholder="Any allergies, intolerances, or special requirements?"
            />
          </div>
        )}

        {/* Accommodation */}
        {formData.show_accommodation && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Accommodation</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: needAccom ? 12 : 0 }}>
              <div style={{
                width: 18, height: 18, border: `2px solid ${needAccom ? primary : `${primary}40`}`,
                borderRadius: 4, backgroundColor: needAccom ? primary : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
                onClick={() => setNeedAccom(v => !v)}
              >
                {needAccom && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, color: txt, fontFamily: font }} onClick={() => setNeedAccom(v => !v)}>
                I need accommodation
              </span>
            </label>
            {needAccom && (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Check-in</label>
                  <input type="date" value={accomCheckin} onChange={e => setAccomCheckin(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Check-out</label>
                  <input type="date" value={accomCheckout} onChange={e => setAccomCheckout(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ position: 'relative' }}>
                    <select value={accomRoom} onChange={e => setAccomRoom(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}>
                      <option value="">Room type preference</option>
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="twin">Twin</option>
                      <option value="suite">Suite</option>
                    </select>
                    <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: `${txt}60`, pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transport */}
        {formData.show_transport && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Transport</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: needTransport ? 12 : 0 }}>
              <div style={{
                width: 18, height: 18, border: `2px solid ${needTransport ? primary : `${primary}40`}`,
                borderRadius: 4, backgroundColor: needTransport ? primary : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
                onClick={() => setNeedTransport(v => !v)}
              >
                {needTransport && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, color: txt, fontFamily: font }} onClick={() => setNeedTransport(v => !v)}>
                I need transport arrangements
              </span>
            </label>
            {needTransport && (
              <input
                value={transportPickup}
                onChange={e => setTransportPickup(e.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Pickup location / address"
              />
            )}
          </div>
        )}

        {/* T-shirt */}
        {formData.show_tshirt_size && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>T-Shirt Size</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const).map(s => (
                <button key={s} type="button"
                  onClick={() => setTshirtSize(tshirtSize === s ? '' : s)}
                  style={{
                    padding: '7px 14px', border: `2px solid ${tshirtSize === s ? primary : `${primary}20`}`,
                    borderRadius: br, cursor: 'pointer', fontSize: 13, fontWeight: tshirtSize === s ? 700 : 500,
                    color: tshirtSize === s ? primary : `${txt}70`, fontFamily: font,
                    backgroundColor: tshirtSize === s ? `${primary}12` : 'transparent',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Emergency contact */}
        {formData.show_emergency_contact && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Emergency Contact</label>
            <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)}
              style={inputStyle} placeholder="Contact name" />
            <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
              style={{ ...inputStyle, marginTop: 8 }} placeholder="Contact phone number" />
          </div>
        )}

        {/* Message to host */}
        {formData.show_message_to_host && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Message to Host</label>
            <textarea value={hostMessage} onChange={e => setHostMessage(e.target.value)}
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' as const }}
              placeholder="Anything you'd like us to know?" />
          </div>
        )}

        {/* Custom questions */}
        {formData.custom_questions?.map(q => (
          <div key={q.id} style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              {q.question_text}
              {q.is_required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {q.question_type === 'textarea' ? (
              <textarea
                value={(customAnswers[q.id] as string) ?? ''}
                onChange={e => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                required={q.is_required}
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' as const }}
              />
            ) : q.question_type === 'dropdown' ? (
              <div style={{ position: 'relative' }}>
                <select
                  value={(customAnswers[q.id] as string) ?? ''}
                  onChange={e => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  required={q.is_required}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                >
                  <option value="">Select an option</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: `${txt}60`, pointerEvents: 'none' }} />
              </div>
            ) : q.question_type === 'checkbox' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map(o => {
                  const checked = Array.isArray(customAnswers[q.id])
                    ? (customAnswers[q.id] as string[]).includes(o)
                    : false
                  return (
                    <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div style={{
                        width: 18, height: 18, border: `2px solid ${checked ? primary : `${primary}40`}`,
                        borderRadius: 4, backgroundColor: checked ? primary : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                        onClick={() => {
                          const curr = (customAnswers[q.id] as string[]) ?? []
                          setCustomAnswers(prev => ({
                            ...prev,
                            [q.id]: checked ? curr.filter(x => x !== o) : [...curr, o],
                          }))
                        }}
                      >
                        {checked && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14, color: txt, fontFamily: font }}>{o}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <input
                type={q.question_type}
                value={(customAnswers[q.id] as string) ?? ''}
                onChange={e => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                required={q.is_required}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        {/* DPDP Consent */}
        <div style={{ marginBottom: 20 }}>
          <ConsentCheckbox
            tenantName={formData.event.name}
            tenantId={formData.event.id}
            eventId={formData.event.id}
            subjectType="guest"
            consentType="data_processing"
            onConsentChange={setConsentGiven}
          />
        </div>

        {/* Deadline warning */}
        {formData.deadline && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: '#f59e0b12', border: '1px solid #f59e0b30',
            borderRadius: br, padding: '10px 12px', marginBottom: 16, fontSize: 12,
            color: '#f59e0b', fontFamily: font,
          }}>
            ⏰ RSVP deadline: {new Date(formData.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!attendance || submitting || !consentGiven}
          style={{
            width: '100%', padding: 14, backgroundColor: !attendance ? `${btn}60` : btn,
            color: btnTxt, border: 'none', borderRadius: br, fontWeight: 700, fontSize: 15,
            cursor: !attendance || submitting ? 'not-allowed' : 'pointer',
            fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          {submitting ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Submitting...
            </>
          ) : 'Submit RSVP'}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </form>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 11, color: `${txt}40`, marginTop: 24, fontFamily: font }}>
        Powered by OccasionPro
      </p>
    </div>
  )
}
