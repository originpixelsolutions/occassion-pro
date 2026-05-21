'use client'
import { use, useState } from 'react'
import { useLiveQuestions, useLivePolls, useUpdateQuestionStatus, useCreatePoll, useUpdatePollStatus } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import { Zap, MessageSquare, BarChart3, Plus, ChevronUp, Check, X, MessageCircleReply, Radio, PlayCircle, StopCircle, Trash2 } from 'lucide-react'

const QUESTION_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  answered:  'bg-green-500/10 text-green-400 border-green-500/20',
  dismissed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function PollModal({ onSave, onClose }: { onSave: (d: any) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)

  const addOption = () => setOptions(p => [...p, ''])
  const removeOption = (i: number) => setOptions(p => p.filter((_, idx) => idx !== i))
  const updateOption = (i: number, v: string) => setOptions(p => p.map((o, idx) => idx === i ? v : o))

  const handleSave = () => {
    const validOptions = options.filter(o => o.trim())
    if (!question.trim() || validOptions.length < 2) return
    onSave({
      question: question.trim(),
      options: validOptions.map((text, i) => ({ id: `opt_${i}`, text, votes_count: 0 })),
      allow_multiple_votes: allowMultiple,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-400" /> Create Poll</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Question *</label>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Ask your audience..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Options (min 2)</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={opt} onChange={e => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={addOption} className="text-xs text-violet-400 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add option
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)} />
          Allow multiple selections
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg">
            Create Poll
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ q, onAction }: { q: any; onAction: (id: string, status: string) => void }) {
  return (
    <div className={cn('bg-card border rounded-xl p-4 space-y-2 transition-colors', q.status === 'pending' ? 'border-yellow-500/20' : 'border-border')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm">{q.question_text}</p>
          {q.is_anonymous ? (
            <p className="text-xs text-muted-foreground mt-1">Anonymous</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">{q.attendee_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{q.upvote_count ?? 0}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', QUESTION_STATUS_COLORS[q.status] ?? '')}>
          {q.status}
        </span>
        {q.status === 'pending' && (
          <div className="flex items-center gap-1">
            <button onClick={() => onAction(q.id, 'approved')}
              className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors" title="Approve">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onAction(q.id, 'dismissed')}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {q.status === 'approved' && (
          <button onClick={() => onAction(q.id, 'answered')}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors">
            <MessageCircleReply className="w-3.5 h-3.5" /> Mark Answered
          </button>
        )}
      </div>
    </div>
  )
}

function PollCard({ poll, onActivate, onClose }: { poll: any; onActivate: () => void; onClose: () => void }) {
  const totalVotes = (poll.options as any[])?.reduce((s: number, o: any) => s + (o.votes_count ?? 0), 0) ?? 0

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{poll.question}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize shrink-0',
          poll.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          poll.status === 'closed' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20')}>
          {poll.status === 'active' && <><Radio className="w-2.5 h-2.5 inline mr-1" />Live</>}
          {poll.status !== 'active' && poll.status}
        </span>
      </div>

      <div className="space-y-1.5">
        {(poll.options as any[])?.map((opt: any) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0
          return (
            <div key={opt.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{opt.text}</span>
                <span className="font-medium">{pct}% ({opt.votes_count})</span>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {poll.status === 'draft' && (
          <button onClick={onActivate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors">
            <PlayCircle className="w-3.5 h-3.5" /> Activate
          </button>
        )}
        {poll.status === 'active' && (
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors">
            <StopCircle className="w-3.5 h-3.5" /> Close Poll
          </button>
        )}
      </div>
    </div>
  )
}

export default function ConferenceLivePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: questionsData, isLoading: qLoading } = useLiveQuestions(tenant, eventId)
  const { data: pollsData, isLoading: pLoading } = useLivePolls(tenant, eventId)
  const updateQuestion = useUpdateQuestionStatus(tenant, eventId)
  const createPoll = useCreatePoll(tenant, eventId)
  const updatePoll = useUpdatePollStatus(tenant, eventId)

  const questions: any[] = questionsData ?? []
  const polls: any[] = pollsData ?? []

  const [tab, setTab] = useState<'qa' | 'polls'>('qa')
  const [qFilter, setQFilter] = useState('pending')
  const [showPollModal, setShowPollModal] = useState(false)

  const filteredQ = qFilter ? questions.filter(q => q.status === qFilter) : questions
  const activePoll = polls.find(p => p.status === 'active')

  const handleQuestionAction = async (id: string, status: string) => {
    await updateQuestion.mutateAsync({ questionId: id, status })
  }

  if (qLoading || pLoading) return (
    <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}</div>
  )

  return (
    <div className="space-y-5">
      {showPollModal && (
        <PollModal
          onClose={() => setShowPollModal(false)}
          onSave={async d => {
            await createPoll.mutateAsync(d)
            setShowPollModal(false)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-400" /> Live Features
            {activePoll && <span className="flex items-center gap-1 text-xs font-normal text-green-400"><Radio className="w-3 h-3" /> Poll Active</span>}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Refreshes every 5 seconds · {questions.length} questions · {polls.length} polls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        {(['qa', 'polls'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
              tab === t ? 'bg-violet-500/20 text-violet-300' : 'text-muted-foreground hover:text-foreground')}>
            {t === 'qa' ? <><MessageSquare className="w-3.5 h-3.5" /> Q&amp;A ({questions.length})</> : <><BarChart3 className="w-3.5 h-3.5" /> Polls ({polls.length})</>}
          </button>
        ))}
      </div>

      {/* Q&A Panel */}
      {tab === 'qa' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {['pending', 'approved', 'answered', 'dismissed', ''].map(s => (
              <button key={s} onClick={() => setQFilter(s)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                  qFilter === s ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-card border-border text-muted-foreground hover:border-violet-500/20')}>
                {s === '' ? `All (${questions.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${questions.filter(q => q.status === s).length})`}
              </button>
            ))}
          </div>

          {filteredQ.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No {qFilter} questions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQ
                .sort((a, b) => (b.upvote_count ?? 0) - (a.upvote_count ?? 0))
                .map(q => (
                  <QuestionCard key={q.id} q={q} onAction={handleQuestionAction} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Polls Panel */}
      {tab === 'polls' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowPollModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Poll
            </button>
          </div>

          {polls.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No polls created yet</p>
              <button onClick={() => setShowPollModal(true)} className="mt-3 text-xs text-violet-400 hover:underline">Create first poll</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {polls.map(poll => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onActivate={() => updatePoll.mutateAsync({ pollId: poll.id, status: 'active' })}
                  onClose={() => updatePoll.mutateAsync({ pollId: poll.id, status: 'closed' })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
