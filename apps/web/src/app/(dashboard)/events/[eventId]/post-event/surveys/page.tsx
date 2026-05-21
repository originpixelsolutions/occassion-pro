'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Plus, BarChart2, Users, MessageSquare, Download, Star } from 'lucide-react'
import { usePostEventSurveys, useCreateSurvey } from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const SURVEY_TYPE_COLORS: Record<string, string> = {
  guest: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  vendor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  team: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  client: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const QUESTION_TYPES = ['rating', 'multiple_choice', 'text', 'yes_no']

function CreateSurveyModal({ onClose, tenant, eventId }: { onClose: () => void; tenant: string; eventId: string }) {
  const create = useCreateSurvey(tenant, eventId)
  const [surveyType, setSurveyType] = useState('guest')
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([
    { id: 1, type: 'rating', text: 'How would you rate the overall event?', required: true },
    { id: 2, type: 'text', text: 'What was your favourite part of the event?', required: false },
    { id: 3, type: 'text', text: 'Any suggestions for improvement?', required: false },
  ])

  function addQuestion() {
    setQuestions(prev => [...prev, { id: Date.now(), type: 'text', text: '', required: false }])
  }

  function removeQuestion(id: number) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function updateQuestion(id: number, field: string, value: any) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(
      { survey_type: surveyType, title, questions: questions.map(({ id, ...rest }) => rest) },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Create Feedback Survey</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Survey Type</label>
              <select
                value={surveyType}
                onChange={e => setSurveyType(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="guest">Guest Survey</option>
                <option value="vendor">Vendor Survey</option>
                <option value="team">Team Survey</option>
                <option value="client">Client Survey</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Title</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event Feedback 2025"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white/60">Questions</h4>
              <button type="button" onClick={addQuestion} className="text-xs text-indigo-400 hover:text-indigo-300">
                + Add Question
              </button>
            </div>

            {questions.map((q, idx) => (
              <div key={q.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 w-5">{idx + 1}.</span>
                  <input
                    value={q.text}
                    onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                    placeholder="Enter question…"
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
                  />
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(q.id, 'type', e.target.value)}
                    className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded text-xs text-white/60 focus:outline-none"
                  >
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-white/40">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={e => updateQuestion(q.id, 'required', e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Req
                  </label>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(q.id)} className="text-white/20 hover:text-red-400 text-sm">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !title}
              className="px-4 py-2 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {create.isPending ? 'Creating…' : 'Create Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 w-12 flex-shrink-0">
        {[...Array(parseInt(label))].map((_, i) => (
          <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/40 w-8 text-right">{count}</span>
    </div>
  )
}

function SurveyCard({ survey }: { survey: any }) {
  const typeColor = SURVEY_TYPE_COLORS[survey.survey_type] ?? SURVEY_TYPE_COLORS.guest
  const avgRating = survey.results?.average_rating

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">{survey.title}</h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize', typeColor)}>
              {survey.survey_type}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-white/30 flex items-center gap-1">
              <Users className="w-3 h-3" /> {survey.response_count ?? 0} responses
            </span>
            {avgRating && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400" /> {avgRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <a
          href={`/api/${survey.tenant}/events/_/post-event/surveys/${survey.id}/export`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white/40 border border-white/[0.06] hover:bg-white/[0.05]"
        >
          <Download className="w-3 h-3" /> CSV
        </a>
      </div>

      {/* Rating distribution */}
      {survey.results?.rating_distribution && (
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map(r => (
            <RatingBar
              key={r}
              label={String(r)}
              count={survey.results.rating_distribution[r] ?? 0}
              total={survey.response_count ?? 1}
            />
          ))}
        </div>
      )}

      {/* Text responses */}
      {survey.results?.text_samples?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Recent Feedback</div>
          {survey.results.text_samples.slice(0, 2).map((sample: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/50 italic">
              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0 text-white/20" />
              "{sample}"
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SurveysPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = usePostEventSurveys(tenant, eventId)
  const [creating, setCreating] = useState(false)

  const surveys: any[] = data?.surveys ?? []
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Feedback Surveys</h1>
            <p className="text-white/40 text-sm mt-0.5">{surveys.length} surveys · {totalResponses} total responses</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm hover:bg-indigo-400"
          >
            <Plus className="w-4 h-4" /> New Survey
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {(['guest', 'vendor', 'team', 'client'] as const).map(type => {
            const typeSurveys = surveys.filter(s => s.survey_type === type)
            const typeColor = SURVEY_TYPE_COLORS[type]
            return (
              <div key={type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className={cn('text-[10px] uppercase tracking-wider font-medium mb-1 capitalize', typeColor.split(' ')[1])}>{type}</div>
                <div className="text-xl font-bold text-white">{typeSurveys.length}</div>
                <div className="text-xs text-white/30">{typeSurveys.reduce((s, sv) => s + (sv.response_count ?? 0), 0)} responses</div>
              </div>
            )
          })}
        </div>

        {/* Survey list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : surveys.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <BarChart2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No surveys yet. Create one to start collecting feedback.</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 px-4 py-2 rounded-xl text-sm bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20"
            >
              Create First Survey
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.map((s: any) => <SurveyCard key={s.id} survey={s} />)}
          </div>
        )}

      </div>

      {creating && (
        <CreateSurveyModal onClose={() => setCreating(false)} tenant={tenant} eventId={eventId} />
      )}
    </div>
  )
}
