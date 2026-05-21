'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  BarChart2, ChevronDown, ChevronUp, ClipboardList, Edit3,
  ExternalLink, Loader2, MessageSquare, Plus, Send, Star,
  Trash2, Users, XCircle, CheckCircle2, TrendingUp, AlertTriangle,
  Copy, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { SmartAlert } from '@/components/ui/smart-alert'
import { calcNPS, scoreSentiment } from '@/hooks/use-event-intelligence'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Survey {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'closed'
  survey_type: 'post_event' | 'pre_event' | 'vendor' | 'staff' | 'custom'
  is_anonymous: boolean
  nps_enabled: boolean
  send_auto: boolean
  auto_send_after_hours: number
  public_url_slug?: string
  response_count: number
  avg_nps_score?: number
  created_at: string
  questions?: Question[]
}

interface Question {
  id?: string
  question_type: 'rating' | 'nps' | 'text' | 'multiple_choice' | 'yes_no' | 'scale'
  question_text: string
  is_required: boolean
  order_index: number
  options?: string[]
}

interface SurveyStats {
  total: number; active: number; draft: number; closed: number
  totalResponses: number; avgNps: number | null
}

interface SurveyResponse {
  id: string
  submitted_at: string
  answers: Array<{ question_id: string; question_text: string; answer: unknown }>
  nps_score?: number
  overall_rating?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

function getTenantId() {
  try { return localStorage.getItem('tenantId') ?? '' } catch { return '' }
}

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'x-tenant-id': getTenantId(),
    'Content-Type': 'application/json',
  }
}

const TYPE_LABELS: Record<string, string> = {
  post_event: 'Post-Event', pre_event: 'Pre-Event', vendor: 'Vendor',
  staff: 'Staff', custom: 'Custom',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20' },
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  closed: { label: 'Closed', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
}

const Q_TYPES: Array<{ value: Question['question_type']; label: string }> = [
  { value: 'rating', label: 'Star Rating (1–5)' },
  { value: 'nps', label: 'NPS Score (0–10)' },
  { value: 'text', label: 'Open Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'scale', label: 'Scale (1–10)' },
]

const DEFAULT_QUESTIONS: Question[] = [
  { question_type: 'rating', question_text: 'How would you rate the overall event experience?', is_required: true, order_index: 0 },
  { question_type: 'nps', question_text: 'How likely are you to recommend this event to a friend or colleague?', is_required: true, order_index: 1 },
  { question_type: 'text', question_text: 'What did you enjoy most about the event?', is_required: false, order_index: 2 },
  { question_type: 'text', question_text: 'What could we improve for next time?', is_required: false, order_index: 3 },
]

// ─── NPS Gauge Component ──────────────────────────────────────────────────────

function NpsGauge({ score }: { score: number }) {
  const color = score >= 50 ? 'text-emerald-400' : score >= 0 ? 'text-amber-400' : 'text-red-400'
  const bg = score >= 50 ? 'bg-emerald-500' : score >= 0 ? 'bg-amber-500' : 'bg-red-500'
  const pct = Math.round(((score + 100) / 200) * 100) // map -100..100 to 0..100%
  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between">
        <span className={`text-3xl font-bold ${color}`}>{score > 0 ? `+${score}` : score}</span>
        <span className="text-xs text-muted-foreground mb-1">NPS</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Survey Card ──────────────────────────────────────────────────────────────

function SurveyCard({
  survey, onEdit, onDelete, onToggleStatus, onViewResponses,
}: {
  survey: Survey
  onEdit: (s: Survey) => void
  onDelete: (id: string) => void
  onToggleStatus: (s: Survey) => void
  onViewResponses: (s: Survey) => void
}) {
  const st = STATUS_CONFIG[survey.status]
  const publicUrl = survey.public_url_slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${survey.public_url_slug}`
    : null

  // Smart: response rate alert — if active and <30% response after 48h since creation
  const hoursOld = (Date.now() - new Date(survey.created_at).getTime()) / 3600000
  const showLowResponse = survey.status === 'active' && hoursOld > 48 && survey.response_count < 5

  return (
    <div className="bg-card/60 border border-border/60 rounded-2xl p-5 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
            <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[survey.survey_type]}</span>
            {survey.is_anonymous && <span className="text-[10px] text-blue-400">Anonymous</span>}
            {survey.nps_enabled && <span className="text-[10px] text-violet-400">NPS</span>}
          </div>
          <h3 className="font-semibold text-foreground truncate">{survey.title}</h3>
          {survey.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{survey.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(survey)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(survey.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Smart alert: low response rate */}
      {showLowResponse && (
        <div className="mb-3">
          <SmartAlert severity="warning" compact title="Low response rate" message={`Only ${survey.response_count} responses after 48h — consider sending a reminder`} />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 py-3 border-t border-b border-border/40 mb-3">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{survey.response_count}</p>
          <p className="text-[10px] text-muted-foreground">Responses</p>
        </div>
        {survey.avg_nps_score != null && (
          <div className="text-center">
            <p className={`text-lg font-bold ${survey.avg_nps_score >= 7 ? 'text-emerald-400' : survey.avg_nps_score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
              {survey.avg_nps_score.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg NPS</p>
          </div>
        )}
        <div className="ml-auto text-right">
          {survey.send_auto && (
            <p className="text-[10px] text-blue-400">Auto-send {survey.auto_send_after_hours}h after event</p>
          )}
          <p className="text-[10px] text-muted-foreground">{new Date(survey.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {survey.response_count > 0 && (
          <button onClick={() => onViewResponses(survey)} className="flex items-center gap-1.5 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-lg hover:bg-violet-500/20 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" /> View Responses ({survey.response_count})
          </button>
        )}
        {publicUrl && (
          <button
            onClick={() => { navigator.clipboard.writeText(publicUrl); }}
            className="flex items-center gap-1.5 text-xs bg-muted/50 text-muted-foreground border border-border/50 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
        )}
        <button
          onClick={() => onToggleStatus(survey)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ml-auto ${
            survey.status === 'active'
              ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
          }`}
        >
          {survey.status === 'active'
            ? <><ToggleRight className="w-3.5 h-3.5" /> Close Survey</>
            : <><ToggleLeft className="w-3.5 h-3.5" /> {survey.status === 'draft' ? 'Activate' : 'Reopen'}</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Question Builder ─────────────────────────────────────────────────────────

function QuestionBuilder({
  questions, onChange,
}: { questions: Question[]; onChange: (qs: Question[]) => void }) {
  function addQ() {
    onChange([...questions, {
      question_type: 'text', question_text: '', is_required: false,
      order_index: questions.length,
    }])
  }

  function updateQ(i: number, updates: Partial<Question>) {
    onChange(questions.map((q, idx) => idx === i ? { ...q, ...updates } : q))
  }

  function removeQ(i: number) {
    onChange(questions.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, order_index: idx })))
  }

  function moveQ(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= questions.length) return
    const qs = [...questions]
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
    onChange(qs.map((q, idx) => ({ ...q, order_index: idx })))
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="bg-muted/30 border border-border/40 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-xs text-muted-foreground font-mono mt-2 w-5 shrink-0">{i + 1}.</span>
            <div className="flex-1 space-y-2">
              <input
                value={q.question_text}
                onChange={e => updateQ(i, { question_text: e.target.value })}
                placeholder="Enter question text…"
                className="w-full bg-background/80 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={q.question_type}
                  onChange={e => updateQ(i, { question_type: e.target.value as Question['question_type'] })}
                  className="bg-background/80 border border-border/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-500/60"
                >
                  {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox" checked={q.is_required}
                    onChange={e => updateQ(i, { is_required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
                {q.question_type === 'multiple_choice' && (
                  <input
                    value={(q.options ?? []).join(', ')}
                    onChange={e => updateQ(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Option 1, Option 2, Option 3"
                    className="flex-1 bg-background/80 border border-border/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => moveQ(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted/60 disabled:opacity-30">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveQ(i, 1)} disabled={i === questions.length - 1} className="p-1 rounded hover:bg-muted/60 disabled:opacity-30">
                <ChevronDown className="w-3 h-3" />
              </button>
              <button onClick={() => removeQ(i)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addQ} className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/60 hover:border-border rounded-xl py-3 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Question
      </button>
    </div>
  )
}

// ─── Responses Drawer ─────────────────────────────────────────────────────────

function ResponsesDrawer({ survey, responses, onClose }: { survey: Survey; responses: SurveyResponse[]; onClose: () => void }) {
  // Smart: NPS breakdown
  const npsScores = responses.flatMap(r =>
    r.answers.filter(a => a.question_text?.toLowerCase().includes('likely') || r.nps_score != null)
      .map(a => typeof a.answer === 'number' ? a.answer : r.nps_score ?? 0)
  ).filter(s => s >= 0 && s <= 10)

  const npsData = npsScores.length > 0 ? calcNPS(npsScores) : null

  // Smart: sentiment on open text
  const textAnswers = responses.flatMap(r =>
    r.answers.filter(a => typeof a.answer === 'string' && (a.answer as string).length > 10)
      .map(a => a.answer as string)
  )
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  textAnswers.forEach(t => sentimentCounts[scoreSentiment(t)]++)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-background border-l border-border/60 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <h3 className="font-semibold text-foreground">{survey.title}</h3>
            <p className="text-xs text-muted-foreground">{responses.length} responses</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Analytics summary */}
          {(npsData || textAnswers.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {npsData && (
                <div className="bg-card/60 border border-border/60 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">NPS Score</p>
                  <NpsGauge score={npsData.nps} />
                  <div className="flex gap-3 mt-3 text-xs">
                    <span className="text-emerald-400">{npsData.promoters}% Promoters</span>
                    <span className="text-zinc-400">{npsData.passives}% Passive</span>
                    <span className="text-red-400">{npsData.detractors}% Detractors</span>
                  </div>
                </div>
              )}
              {textAnswers.length > 0 && (
                <div className="bg-card/60 border border-border/60 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">Sentiment Analysis</p>
                  <div className="space-y-2">
                    {[
                      { key: 'positive', label: 'Positive', color: 'bg-emerald-500' },
                      { key: 'neutral', label: 'Neutral', color: 'bg-zinc-500' },
                      { key: 'negative', label: 'Negative', color: 'bg-red-500' },
                    ].map(s => {
                      const count = sentimentCounts[s.key as keyof typeof sentimentCounts]
                      const pct = textAnswers.length > 0 ? Math.round((count / textAnswers.length) * 100) : 0
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-xs">
                          <span className="w-16 text-muted-foreground">{s.label}</span>
                          <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual responses */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Individual Responses</h4>
            {responses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No responses yet</div>
            ) : responses.map((r, i) => (
              <div key={r.id} className="bg-card/40 border border-border/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Response #{i + 1}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="space-y-2">
                  {r.answers.map((a, j) => (
                    <div key={j} className="text-xs">
                      <p className="text-muted-foreground mb-0.5">{a.question_text}</p>
                      <p className="text-foreground font-medium">
                        {typeof a.answer === 'number'
                          ? <span className="flex items-center gap-1">{Array.from({ length: 5 }, (_, k) => <Star key={k} className={`w-3 h-3 ${k < a.answer ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />)}</span>
                          : String(a.answer)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function SurveyModal({
  survey, eventId, onClose, onSaved,
}: {
  survey: Partial<Survey> | null
  eventId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: survey?.title ?? '',
    description: survey?.description ?? '',
    survey_type: (survey?.survey_type ?? 'post_event') as Survey['survey_type'],
    is_anonymous: survey?.is_anonymous ?? true,
    nps_enabled: survey?.nps_enabled ?? true,
    send_auto: survey?.send_auto ?? false,
    auto_send_after_hours: survey?.auto_send_after_hours ?? 24,
    status: (survey?.status ?? 'draft') as Survey['status'],
  })
  const [questions, setQuestions] = useState<Question[]>(survey?.questions ?? DEFAULT_QUESTIONS)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const isNew = !survey?.id
      const url = isNew ? `${API}/surveys` : `${API}/surveys/${survey!.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const body = { ...form, event_id: eventId }

      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const saved = await res.json()

      // Save questions
      await fetch(`${API}/surveys/${saved.id}/questions`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ questions }),
      })

      onSaved()
    } catch { alert('Failed to save survey') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="font-semibold text-foreground">{survey?.id ? 'Edit Survey' : 'Create Survey'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1.5">Survey Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
                placeholder="e.g. Post-Event Guest Satisfaction Survey" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/60 resize-none"
                placeholder="Brief description shown to respondents…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Survey Type</label>
              <select value={form.survey_type} onChange={e => setForm(f => ({ ...f, survey_type: e.target.value as Survey['survey_type'] }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Survey['status'] }))}
                className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="bg-muted/20 border border-border/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-foreground mb-1">Survey Options</p>
            {[
              { key: 'is_anonymous', label: 'Anonymous responses', desc: 'Respondent identity not collected' },
              { key: 'nps_enabled', label: 'Enable NPS tracking', desc: 'Track Net Promoter Score automatically' },
              { key: 'send_auto', label: 'Auto-send after event', desc: 'Automatically send to all guests' },
            ].map(opt => (
              <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={form[opt.key as keyof typeof form] as boolean}
                  onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                  className="mt-0.5 rounded" />
                <div>
                  <p className="text-sm text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
            {form.send_auto && (
              <div className="pl-7">
                <label className="text-xs text-muted-foreground block mb-1">Hours after event end</label>
                <input type="number" value={form.auto_send_after_hours} min={1} max={168}
                  onChange={e => setForm(f => ({ ...f, auto_send_after_hours: parseInt(e.target.value) || 24 }))}
                  className="bg-background/80 border border-border/60 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none" />
              </div>
            )}
          </div>

          {/* Question builder */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-foreground">Questions ({questions.length})</p>
              <button onClick={() => setQuestions(DEFAULT_QUESTIONS)}
                className="text-xs text-violet-400 hover:text-violet-300">Reset to defaults</button>
            </div>
            <QuestionBuilder questions={questions} onChange={setQuestions} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : survey?.id ? 'Save Changes' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedbackSurveysPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<Survey> | null | 'new'>(null)
  const [responsesDrawer, setResponsesDrawer] = useState<{ survey: Survey; responses: SurveyResponse[] } | null>(null)
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sv, st] = await Promise.all([
        fetch(`${API}/surveys/events/${eventId}`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/surveys/events/${eventId}/stats`, { headers: headers() }).then(r => r.json()),
      ])
      setSurveys(Array.isArray(sv) ? sv : [])
      setStats(st)
    } catch {}
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function viewResponses(s: Survey) {
    setLoadingResponses(s.id)
    try {
      const data = await fetch(`${API}/surveys/${s.id}/responses`, { headers: headers() }).then(r => r.json())
      setResponsesDrawer({ survey: s, responses: Array.isArray(data) ? data : [] })
    } catch {}
    setLoadingResponses(null)
  }

  async function toggleStatus(s: Survey) {
    const newStatus = s.status === 'active' ? 'closed' : 'active'
    await fetch(`${API}/surveys/${s.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ status: newStatus }),
    })
    load()
  }

  async function deleteSurvey(id: string) {
    if (!confirm('Delete this survey? All responses will be lost.')) return
    await fetch(`${API}/surveys/${id}`, { method: 'DELETE', headers: headers() })
    load()
  }

  async function openEdit(s: Survey) {
    // Fetch full survey with questions
    const data = await fetch(`${API}/surveys/${s.id}`, { headers: headers() }).then(r => r.json())
    setModal(data)
  }

  // Smart alerts at page level
  const pageAlerts: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; message?: string }> = []
  if (stats && stats.active > 0 && stats.totalResponses === 0) {
    pageAlerts.push({ id: 'no-responses', severity: 'warning', title: 'Active surveys with no responses', message: 'Share the survey link with your guests to start collecting feedback' })
  }
  const avgNps = stats?.avgNps
  if (avgNps != null && avgNps < 0) {
    pageAlerts.push({ id: 'nps-negative', severity: 'critical', title: 'Negative NPS score', message: `Current NPS is ${avgNps} — review feedback to identify issues immediately` })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback & Surveys</h1>
          <p className="text-sm text-muted-foreground mt-1">Collect guest satisfaction data and track NPS</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Survey
        </button>
      </div>

      {/* Smart alerts */}
      {pageAlerts.length > 0 && (
        <div className="space-y-2">
          {pageAlerts.map(a => <SmartAlert key={a.id} severity={a.severity} title={a.title} message={a.message} />)}
        </div>
      )}

      {/* KPI stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Surveys', value: stats.total, icon: ClipboardList, color: 'violet' },
            { label: 'Active', value: stats.active, icon: ToggleRight, color: 'emerald' },
            { label: 'Draft', value: stats.draft, icon: Edit3, color: 'zinc' },
            { label: 'Responses', value: stats.totalResponses, icon: Users, color: 'blue' },
            { label: 'Avg NPS', value: stats.avgNps != null ? (stats.avgNps > 0 ? `+${stats.avgNps}` : String(stats.avgNps)) : '—', icon: TrendingUp, color: stats.avgNps != null && stats.avgNps >= 30 ? 'emerald' : stats.avgNps != null && stats.avgNps >= 0 ? 'amber' : 'red' },
          ].map(k => {
            const colors: Record<string, string> = {
              violet: 'text-violet-400 bg-violet-400/10',
              emerald: 'text-emerald-400 bg-emerald-400/10',
              blue: 'text-blue-400 bg-blue-400/10',
              amber: 'text-amber-400 bg-amber-400/10',
              red: 'text-red-400 bg-red-400/10',
              zinc: 'text-zinc-400 bg-zinc-400/10',
            }
            return (
              <div key={k.label} className="bg-card/60 border border-border/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[k.color]}`}>
                    <k.icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Survey list */}
      {surveys.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-2xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No surveys yet</p>
          <button onClick={() => setModal('new')} className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors">
            Create your first survey
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surveys.map(s => (
            <SurveyCard
              key={s.id}
              survey={s}
              onEdit={openEdit}
              onDelete={deleteSurvey}
              onToggleStatus={toggleStatus}
              onViewResponses={survey => {
                setLoadingResponses(survey.id)
                viewResponses(survey)
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal !== null && (
        <SurveyModal
          survey={modal === 'new' ? null : modal}
          eventId={eventId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {responsesDrawer && (
        <ResponsesDrawer
          survey={responsesDrawer.survey}
          responses={responsesDrawer.responses}
          onClose={() => setResponsesDrawer(null)}
        />
      )}
    </div>
  )
}
