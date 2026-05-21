'use client'
import { useState, useEffect, use } from 'react'
import { CheckCircle, XCircle, Loader2, ChevronDown, User, Mail, Phone } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ────────────────────────────────────────────name───────────────────

interface RegistrationForm {
  event_id: string
  slug: string
  is_active: boolean
  deadline?: string
  max_registrations?: number
  require_approval: boolean
  collect_phone: boolean
  collect_company: boolean
  collect_designation: boolean
  collect_city: boolean
  collect_category: boolean
  allowed_categories: string[]
  welcome_message: string
  success_message: string
  primary_color: string
  background_color: string
  text_color: string
  button_color: string
  button_text_color: string
  font_family: string
  border_radius: string
  event: {
    id: string
    name: string
    start_date?: string
    end_date?: string
    venue?: { name: string; city?: string }
    logo_url?: string
    tagline?: string
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [regForm, setRegForm] = useState<RegistrationForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'submitted' | 'closed'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [designation, setDesignation] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    fetch(`${API}/public/register/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(d.error); return }
        setRegForm(d)
        if (!d.is_active) setStep('closed')
      })
      .catch(() => setError('Unable to load registration form'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !regForm) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Registration Not Found</h2>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>{error ?? 'This registration form does not exist.'}</p>
        </div>
      </div>
    )
  }

  const {
    primary_color: primary, background_color: bg, text_color: txt,
    button_color: btn, button_text_color: btnTxt, font_family: font,
  } = regForm

  const brMap: Record<string, string> = { sharp: '0', default: '8px', rounded: '12px', pill: '24px' }
  const br = brMap[regForm.border_radius] ?? '8px'

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '11px 14px',
    border: `1.5px solid ${primary}40`, borderRadius: br,
    backgroundColor: bg, color: txt, fontFamily: font,
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: txt, fontFamily: font, marginBottom: '6px',
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', backgroundColor: bg, fontFamily: font, padding: '24px 16px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: bg, border: `1px solid ${primary}25`,
    borderRadius: br, padding: '28px 24px',
    maxWidth: '480px', margin: '0 auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
  }

  const e = regForm.event

  // ── Closed ──
  if (step === 'closed') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: txt, margin: '0 0 8px', fontFamily: font }}>
            Registration Closed
          </h2>
          <p style={{ fontSize: 14, color: `${txt}70`, fontFamily: font, margin: 0 }}>
            {regForm.deadline
              ? `Registration for ${e.name} has closed.`
              : 'Registration is currently not accepting new guests.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Submitted ──
  if (step === 'submitted') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#22c55e20', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle style={{ width: 36, height: 36, color: '#22c55e' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: txt, margin: '0 0 12px', fontFamily: font }}>
            You're Registered!
          </h2>
          <p style={{ fontSize: 14, color: `${txt}80`, fontFamily: font, lineHeight: 1.7, margin: 0 }}>
            {regForm.success_message || `You've successfully registered for ${e.name}. We'll be in touch!`}
          </p>
          {regForm.require_approval && (
            <p style={{ fontSize: 12, color: `${txt}60`, fontFamily: font, marginTop: 12 }}>
              Your registration is pending approval. You'll receive a confirmation once approved.
            </p>
          )}
          <div style={{ marginTop: 24, padding: '16px', backgroundColor: `${primary}10`, borderRadius: br, border: `1px solid ${primary}20` }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: primary, fontFamily: font, margin: '0 0 8px' }}>
              {e.name}
            </p>
            {e.start_date && (
              <p style={{ fontSize: 12, color: `${txt}70`, fontFamily: font, margin: '0 0 4px' }}>
                📅 {new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            {e.venue?.name && (
              <p style={{ fontSize: 12, color: `${txt}70`, fontFamily: font, margin: 0 }}>
                📍 {e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSubmitError('')
    if (!fullName.trim() || !email.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/public/register/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || undefined,
          company: company || undefined,
          designation: designation || undefined,
          city: city || undefined,
          category: category || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data?.message ?? 'Registration failed. Please try again.')
      } else {
        setStep('submitted')
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={pageStyle}>
      {/* Event header */}
      <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto 24px' }}>
        {e.logo_url ? (
          <img src={e.logo_url} alt={e.name} style={{ height: 52, objectFit: 'contain', margin: '0 auto 12px' }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: `${primary}20`, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>🎪</div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: txt, fontFamily: font, margin: '0 0 6px' }}>
          {e.name}
        </h1>
        {e.tagline && (
          <p style={{ fontSize: 14, color: `${txt}60`, fontFamily: font, margin: '0 0 10px', fontStyle: 'italic' }}>{e.tagline}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          {e.start_date && (
            <span style={{ fontSize: 12, color: `${txt}60`, fontFamily: font }}>
              📅 {new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {e.venue?.name && (
            <span style={{ fontSize: 12, color: `${txt}60`, fontFamily: font }}>
              📍 {e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Registration card */}
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: txt, fontFamily: font, margin: '0 0 6px', textAlign: 'center' }}>
          Register to Attend
        </h2>
        {regForm.welcome_message && (
          <p style={{ fontSize: 13, color: `${txt}70`, fontFamily: font, margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
            {regForm.welcome_message}
          </p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: `${txt}40` }} />
            <input
              required value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }}
              placeholder="Your full name"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: `${txt}40` }} />
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }}
              placeholder="you@example.com"
            />
          </div>
        </div>

        {regForm.collect_phone && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: `${txt}40` }} />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36 }} placeholder="+91 98765 43210" />
            </div>
          </div>
        )}

        {(regForm.collect_company || regForm.collect_designation) && (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: regForm.collect_company && regForm.collect_designation ? '1fr 1fr' : '1fr', marginBottom: 16 }}>
            {regForm.collect_company && (
              <div>
                <label style={labelStyle}>Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)}
                  style={inputStyle} placeholder="Organisation" />
              </div>
            )}
            {regForm.collect_designation && (
              <div>
                <label style={labelStyle}>Designation</label>
                <input value={designation} onChange={e => setDesignation(e.target.value)}
                  style={inputStyle} placeholder="Role / Title" />
              </div>
            )}
          </div>
        )}

        {regForm.collect_city && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)}
              style={inputStyle} placeholder="Where are you based?" />
          </div>
        )}

        {regForm.collect_category && regForm.allowed_categories.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>I am attending as</label>
            <div style={{ position: 'relative' }}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}>
                <option value="">Select category</option>
                {regForm.allowed_categories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: `${txt}60`, pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        {submitError && (
          <div style={{
            padding: '10px 14px', backgroundColor: '#ef444415',
            border: '1px solid #ef444430', borderRadius: br,
            color: '#ef4444', fontSize: 13, fontFamily: font, marginBottom: 16,
          }}>
            ⚠️ {submitError}
          </div>
        )}

        {regForm.deadline && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: '#f59e0b12', border: '1px solid #f59e0b30',
            borderRadius: br, padding: '10px 12px', marginBottom: 16, fontSize: 12,
            color: '#f59e0b', fontFamily: font,
          }}>
            ⏰ Registration closes: {new Date(regForm.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !fullName || !email}
          style={{
            width: '100%', padding: 14,
            backgroundColor: (!fullName || !email) ? `${btn}60` : btn,
            color: btnTxt, border: 'none', borderRadius: br,
            fontWeight: 700, fontSize: 15, cursor: submitting || !fullName || !email ? 'not-allowed' : 'pointer',
            fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Registering...
            </>
          ) : 'Complete Registration'}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        <p style={{ fontSize: 11, color: `${txt}40`, textAlign: 'center', marginTop: 14, fontFamily: font }}>
          By registering, you agree to share your details with the event organiser.
        </p>
      </form>

      <p style={{ textAlign: 'center', fontSize: 11, color: `${txt}30`, marginTop: 24, fontFamily: font }}>
        Powered by OccasionPro
      </p>
    </div>
  )
}
