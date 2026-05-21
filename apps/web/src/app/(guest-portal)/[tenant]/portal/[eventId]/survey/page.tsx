'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { useGuestPortal } from '@/hooks/use-guest-portal'
import { ArrowLeft, ClipboardList, Loader2, CheckCircle2 } from 'lucide-react'

interface SurveyQuestion {
  id: string
  text: string
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no'
  options?: string[]
  required?: boolean
}

interface SurveyData {
  id: string
  title: string
  description?: string
  questions: SurveyQuestion[]
}

export default function SurveyPage() {
  const params = useParams()
  const router = useRouter()
  const tenant = params.tenant as string
  const eventId = params.eventId as string
  const { isLoggedIn, isLoading: authLoading } = useGuestPortal(eventId)

  const [survey, setSurvey] = useState<SurveyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace(`/${tenant}/portal/${eventId}/login`)
  }, [authLoading, isLoggedIn, tenant, eventId, router])

  useEffect(() => {
    guestApi.get<SurveyData>(`/guest-portal/${eventId}/sections/survey`, eventId)
      .then(setSurvey)
      .catch(() => setSurvey(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const setAnswer = (qId: string, value: any) => setAnswers(a => ({ ...a, [qId]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey) return
    const missing = survey.questions.filter(q => q.required && !answers[q.id])
    if (missing.length) { setError(`Please answer: ${missing[0].text}`); return }
    setError('')
    setSubmitting(true)
    try {
      await guestApi.post(`/guest-portal/${eventId}/sections/survey/submit`, eventId, {
        surveyId: survey.id,
        answers,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <CheckCircle2 size={56} style={{ color: '#10b981', marginBottom: 16 }} />
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Thank you!</h2>
      <p style={{ margin: '0 0 32px', color: '#888', textAlign: 'center' }}>Your feedback has been submitted.</p>
      <button className="portal-btn" onClick={() => router.push(`/${tenant}/portal/${eventId}/home`)} style={{ maxWidth: 200 }}>
        Back to Home
      </button>
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
          <ClipboardList size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Survey</h1>
        </div>
      </div>

      {!survey ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#555' }}>
          <ClipboardList size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>No survey available yet</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{survey.title}</h2>
            {survey.description && <p style={{ margin: 0, fontSize: 14, color: '#888', lineHeight: 1.6 }}>{survey.description}</p>}
          </div>

          {survey.questions.map((q, idx) => (
            <div key={q.id}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#ddd' }}>
                {idx + 1}. {q.text}
                {q.required && <span style={{ color: 'var(--portal-brand)', marginLeft: 4 }}>*</span>}
              </label>

              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  rows={3}
                  placeholder="Your answer..."
                  style={{ resize: 'none' }}
                />
              )}

              {q.type === 'rating' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button"
                      onClick={() => setAnswer(q.id, n)}
                      style={{
                        width: 48, height: 48, borderRadius: 12, fontSize: 18, cursor: 'pointer',
                        border: answers[q.id] === n ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                        background: answers[q.id] === n ? 'var(--portal-brand-10)' : '#1a1a1a',
                        color: answers[q.id] >= n ? '#f59e0b' : '#555',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'yes_no' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {['Yes', 'No'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                        border: answers[q.id] === opt ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                        background: answers[q.id] === opt ? 'var(--portal-brand-10)' : '#1a1a1a',
                        color: answers[q.id] === opt ? 'var(--portal-brand)' : '#888',
                      }}
                    >{opt}</button>
                  ))}
                </div>
              )}

              {q.type === 'multiple_choice' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {q.options.map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      style={{
                        padding: '12px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                        border: answers[q.id] === opt ? '1.5px solid var(--portal-brand)' : '1.5px solid #2e2e2e',
                        background: answers[q.id] === opt ? 'var(--portal-brand-10)' : '#1a1a1a',
                        color: answers[q.id] === opt ? 'var(--portal-brand)' : '#aaa',
                        fontWeight: answers[q.id] === opt ? 600 : 400,
                      }}
                    >{opt}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div style={{ background: '#2d1515', border: '1px solid #5c2020', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#ff8080' }}>
              {error}
            </div>
          )}

          <button className="portal-btn" type="submit" disabled={submitting}>
            {submitting
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</span>
              : 'Submit Survey'
            }
          </button>
        </form>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
