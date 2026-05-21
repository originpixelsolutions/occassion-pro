'use client'
import { use, useState } from 'react'
import { useConferenceCEU, useIssueCEU, useBulkIssueCEU, useConferenceSessions } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn, formatCurrency } from '@/lib/utils'
import { GraduationCap, Plus, X, Award, Download, Zap, BookOpen, CheckCircle2 } from 'lucide-react'

const CREDIT_TYPE_COLORS: Record<string, string> = {
  cpe:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cle:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  cme:   'bg-green-500/10 text-green-400 border-green-500/20',
  pdu:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  other: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function IssueCEUModal({ registrations, sessions, onSave, onClose }: {
  registrations: any[]
  sessions: any[]
  onSave: (d: any) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    registration_id: '',
    session_id: '',
    credit_type: 'cpe',
    credits_earned: '1',
    accreditation_body: '',
    notes: '',
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><GraduationCap className="w-4 h-4 text-green-400" /> Issue CEU Credit</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Attendee *</label>
            <select value={form.registration_id} onChange={e => setForm(p => ({ ...p, registration_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              <option value="">Select attendee…</option>
              {registrations.map(r => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name} ({r.registration_number})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Session</label>
            <select value={form.session_id} onChange={e => setForm(p => ({ ...p, session_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              <option value="">General / Conference-wide</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Credit Type</label>
              <select value={form.credit_type} onChange={e => setForm(p => ({ ...p, credit_type: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
                {Object.keys(CREDIT_TYPE_COLORS).map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Credits Earned</label>
              <input type="number" step="0.5" min="0.5" value={form.credits_earned}
                onChange={e => setForm(p => ({ ...p, credits_earned: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Accreditation Body</label>
            <input value={form.accreditation_body} onChange={e => setForm(p => ({ ...p, accreditation_body: e.target.value }))}
              placeholder="e.g. NASBA, AMA, PMI"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={() => onSave({ ...form, credits_earned: parseFloat(form.credits_earned) || 1, session_id: form.session_id || null })}
            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg">
            Issue Credit
          </button>
        </div>
      </div>
    </div>
  )
}

function BulkIssueCard({ session, onBulkIssue }: { session: any; onBulkIssue: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!confirm(`Bulk issue ${session.ceu_credits} ${session.ceu_credit_type?.toUpperCase()} credits to all checked-in attendees of "${session.title}"?`)) return
    setLoading(true)
    try { await onBulkIssue() } finally { setLoading(false) }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-green-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{session.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold', CREDIT_TYPE_COLORS[session.ceu_credit_type] ?? CREDIT_TYPE_COLORS.other)}>
              {session.ceu_credit_type?.toUpperCase() ?? 'CEU'}
            </span>
            <span className="text-xs text-muted-foreground">{session.ceu_credits} credit{session.ceu_credits !== 1 ? 's' : ''}</span>
            {session.ceu_accreditation_body && <span className="text-xs text-muted-foreground">· {session.ceu_accreditation_body}</span>}
          </div>
        </div>
      </div>
      <button onClick={handleClick} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50 shrink-0">
        <Zap className="w-3.5 h-3.5" />
        {loading ? 'Issuing…' : 'Bulk Issue'}
      </button>
    </div>
  )
}

export default function ConferenceCEUPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: ceuData, isLoading: ceuLoading } = useConferenceCEU(tenant, eventId)
  const { data: sessionsData, isLoading: sessionsLoading } = useConferenceSessions(tenant, eventId)
  const issueCEU = useIssueCEU(tenant, eventId)
  const bulkIssueCEU = useBulkIssueCEU(tenant, eventId)

  const credits: any[] = ceuData?.credits ?? []
  const registrations: any[] = ceuData?.registrations ?? []
  const sessions: any[] = sessionsData?.sessions ?? sessionsData ?? []
  const ceuSessions = sessions.filter(s => s.ceu_credits && s.ceu_credits > 0)

  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')

  const filteredCredits = filter ? credits.filter(c => c.credit_type === filter) : credits
  const totalCreditsIssued = credits.reduce((s: number, c: any) => s + (c.credits_earned ?? 0), 0)
  const uniqueAttendees = new Set(credits.map((c: any) => c.registration_id)).size

  if (ceuLoading || sessionsLoading) return (
    <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl" />)}</div>
  )

  return (
    <div className="space-y-6">
      {showModal && (
        <IssueCEUModal
          registrations={registrations}
          sessions={ceuSessions}
          onClose={() => setShowModal(false)}
          onSave={async d => {
            await issueCEU.mutateAsync(d)
            setShowModal(false)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5 text-green-400" /> CEU Credits</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{credits.length} credits issued · {totalCreditsIssued.toFixed(1)} total hours</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Issue Credit
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{credits.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Credits Issued</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{uniqueAttendees}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Attendees</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-400">{totalCreditsIssued.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Hours</p>
        </div>
      </div>

      {/* Bulk Issue Section */}
      {ceuSessions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400" /> Bulk Issue by Session
          </h3>
          <div className="space-y-2">
            {ceuSessions.map(s => (
              <BulkIssueCard
                key={s.id}
                session={s}
                onBulkIssue={() => bulkIssueCEU.mutateAsync(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Credits Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-green-400" /> Issued Credits
          </h3>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 py-1 text-xs focus:outline-none">
              <option value="">All Types</option>
              {Object.keys(CREDIT_TYPE_COLORS).map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        {filteredCredits.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
            <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No CEU credits issued yet</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-green-400 hover:underline">Issue first credit</button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Attendee</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Certificate #</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Credits</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Body</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Session</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredits.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{c.registration?.first_name} {c.registration?.last_name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.registration?.registration_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span className="font-mono text-[10px]">{c.certificate_number ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase', CREDIT_TYPE_COLORS[c.credit_type] ?? CREDIT_TYPE_COLORS.other)}>
                          {c.credit_type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{c.credits_earned}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.accreditation_body ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.session?.title ?? 'General'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
