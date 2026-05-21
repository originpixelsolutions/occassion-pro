'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Plus, ClipboardCheck, Star, BarChart3,
  Send, Copy, ExternalLink, ChevronDown, ChevronUp,
  MessageSquare, ThumbsUp, ThumbsDown, Users,
  CheckCircle2, Clock, Trash2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type QuestionType = 'rating' | 'text' | 'multiple_choice' | 'yes_no' | 'nps'

type SurveyQuestion = {
  id: string
  type: QuestionType
  question: string
  required: boolean
  options?: string[]
}

type Survey = {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'active' | 'closed'
  response_count: number
  questions: SurveyQuestion[]
  short_code: string | null
  created_at: string
}

type SurveyResponse = {
  id: string
  survey_id: string
  respondent_name: string | null
  answers: Record<string, string | number>
  submitted_at: string
  nps_score: number | null
}

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ElementType }[] = [
  { type: 'rating',          label: 'Star Rating (1–5)',  icon: Star },
  { type: 'nps',             label: 'NPS Score (0–10)',   icon: BarChart3 },
  { type: 'text',            label: 'Open Text',          icon: MessageSquare },
  { type: 'yes_no',          label: 'Yes / No',           icon: ThumbsUp },
  { type: 'multiple_choice', label: 'Multiple Choice',    icon: ClipboardCheck },
]

const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  { id: '1', type: 'rating',  question: 'How would you rate the overall event experience?', required: true },
  { id: '2', type: 'rating',  question: 'How was the food and beverage quality?',           required: false },
  { id: '3', type: 'rating',  question: 'How satisfied were you with the venue?',           required: false },
  { id: '4', type: 'nps',     question: 'How likely are you to recommend this event to a friend? (0–10)', required: false },
  { id: '5', type: 'text',    question: 'What did you enjoy most about the event?',         required: false },
  { id: '6', type: 'text',    question: 'What could we improve for next time?',             required: false },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn('w-4 h-4', i < value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EventSurveysPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'surveys' | 'responses'>('surveys')
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null)

  // Create survey state
  const [showCreate, setShowCreate] = useState(false)
  const [newSurvey, setNewSurvey] = useState({ title: '', description: '' })
  const [questions, setQuestions] = useState<SurveyQuestion[]>(DEFAULT_QUESTIONS)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return
    setLoading(true)
    const [{ data: surveyData }, { data: respData }] = await Promise.all([
      supabase.from('event_surveys').select('*').eq('event_id', eventId).eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }),
      supabase.from('survey_responses').select('*').in('survey_id', (await supabase.from('event_surveys').select('id').eq('event_id', eventId).then(r => r.data?.map(s => s.id) ?? [])),
      ).order('submitted_at', { ascending: false }),
    ])
    setSurveys(surveyData ?? [])
    setResponses(respData ?? [])
    setLoading(false)
  }, [eventId, profile?.tenant_id, supabase])

  useEffect(() => { load() }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────

  const createSurvey = async () => {
    if (!newSurvey.title.trim()) return
    await supabase.from('event_surveys').insert({
      event_id: eventId,
      tenant_id: profile!.tenant_id,
      title: newSurvey.title,
      description: newSurvey.description || null,
      status: 'draft',
      questions: questions,
      response_count: 0,
      short_code: Math.random().toString(36).slice(2, 8),
    })
    setShowCreate(false)
    setNewSurvey({ title: '', description: '' })
    setQuestions(DEFAULT_QUESTIONS)
    load()
  }

  const updateStatus = async (id: string, status: Survey['status']) => {
    await supabase.from('event_surveys').update({ status }).eq('id', id)
    setSurveys(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const deleteSurvey = async (id: string) => {
    await supabase.from('event_surveys').delete().eq('id', id)
    setSurveys(prev => prev.filter(s => s.id !== id))
  }

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/survey/${code}`)
  }

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { id: Date.now().toString(), type: 'text', question: '', required: false },
    ])
  }

  const removeQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id))

  // ── Analytics ──────────────────────────────────────────────────────────────

  const totalResponses = responses.length
  const npsScores = responses.filter(r => r.nps_score != null).map(r => r.nps_score!)
  const avgNps = npsScores.length > 0 ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length * 10) / 10 : null
  const promoters   = npsScores.filter(s => s >= 9).length
  const detractors  = npsScores.filter(s => s <= 6).length
  const npsScore    = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event Overview
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Surveys</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-violet-500" />
            Feedback Surveys
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Collect structured feedback from attendees</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Survey
        </button>
      </div>

      {/* NPS Summary */}
      {npsScore !== null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Responses', value: totalResponses,                  color: 'text-foreground' },
            { label: 'NPS Score',       value: npsScore,                         color: npsScore >= 50 ? 'text-green-600' : npsScore >= 0 ? 'text-yellow-600' : 'text-red-600' },
            { label: 'Promoters',       value: `${promoters}`,                  color: 'text-green-600' },
            { label: 'Detractors',      value: `${detractors}`,                 color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['surveys', 'responses'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab} {tab === 'responses' && totalResponses > 0 && <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{totalResponses}</span>}
          </button>
        ))}
      </div>

      {/* Surveys list */}
      {activeTab === 'surveys' && !loading && (
        <div className="space-y-3">
          {surveys.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="font-medium mb-1">No surveys yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create a survey to collect attendee feedback</p>
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Create Your First Survey
              </button>
            </div>
          ) : (
            surveys.map(survey => {
              const expanded = expandedSurvey === survey.id
              return (
                <div key={survey.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSurvey(expanded ? null : survey.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{survey.title}</p>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          survey.status === 'active' ? 'bg-green-100 text-green-700' :
                          survey.status === 'closed' ? 'bg-muted text-muted-foreground' :
                          'bg-yellow-100 text-yellow-700',
                        )}>
                          {survey.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {survey.questions?.length ?? 0} questions · {survey.response_count} responses
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {survey.short_code && survey.status === 'active' && (
                        <button
                          onClick={e => { e.stopPropagation(); copyLink(survey.short_code!) }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Link
                        </button>
                      )}
                      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-border space-y-3">
                      {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
                      <div className="space-y-1.5">
                        {(survey.questions ?? []).map((q, i) => (
                          <div key={q.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{i + 1}</span>
                            <span>{q.question}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {survey.status === 'draft' && (
                          <button onClick={() => updateStatus(survey.id, 'active')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">
                            <Send className="w-3.5 h-3.5" /> Activate
                          </button>
                        )}
                        {survey.status === 'active' && (
                          <button onClick={() => updateStatus(survey.id, 'closed')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Close Survey
                          </button>
                        )}
                        <button onClick={() => deleteSurvey(survey.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Responses */}
      {activeTab === 'responses' && !loading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {responses.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No responses yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {['Respondent', 'NPS Score', 'Submitted', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {responses.map(r => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{r.respondent_name ?? 'Anonymous'}</td>
                    <td className="px-4 py-3">
                      {r.nps_score != null ? (
                        <span className={cn(
                          'font-bold',
                          r.nps_score >= 9 ? 'text-green-600' : r.nps_score >= 7 ? 'text-yellow-600' : 'text-red-600',
                        )}>
                          {r.nps_score}/10
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Survey Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 my-4">
            <h2 className="text-lg font-bold mb-4">Create Survey</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Survey Title *</label>
                <input
                  autoFocus
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newSurvey.title}
                  onChange={e => setNewSurvey(p => ({ ...p, title: e.target.value }))}
                  placeholder="Post-Event Feedback"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newSurvey.description}
                  onChange={e => setNewSurvey(p => ({ ...p, description: e.target.value }))}
                  placeholder="Tell us about your experience"
                />
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Questions ({questions.length})</label>
                  <button onClick={addQuestion} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <input
                        className="flex-1 bg-transparent text-sm border-none outline-none"
                        value={q.question}
                        onChange={e => setQuestions(prev => prev.map(qx => qx.id === q.id ? { ...qx, question: e.target.value } : qx))}
                        placeholder="Question text..."
                      />
                      <select
                        className="text-xs border border-border rounded px-1.5 py-1 bg-background"
                        value={q.type}
                        onChange={e => setQuestions(prev => prev.map(qx => qx.id === q.id ? { ...qx, type: e.target.value as QuestionType } : qx))}
                      >
                        {QUESTION_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                      <button onClick={() => removeQuestion(q.id)} className="text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={createSurvey} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Create Survey</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
