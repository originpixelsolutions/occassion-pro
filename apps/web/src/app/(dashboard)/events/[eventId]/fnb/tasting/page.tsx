'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatDate, cn } from '@/lib/utils'
import { FlaskConical, Plus, Pencil, Trash2, X, Check, AlertCircle, Calendar, MapPin } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const STATUSES = ['scheduled','completed','cancelled','rescheduled']
const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-rose-500/10 text-rose-400',
  rescheduled: 'bg-amber-500/10 text-amber-400',
}
const STATUS_ICONS: Record<string, string> = {
  scheduled: '📅', completed: '✅', cancelled: '❌', rescheduled: '🔄',
}

interface TastingFormProps {
  initial?: any
  onSave: (d: any) => void
  onClose: () => void
  loading: boolean
}

function TastingForm({ initial, onSave, onClose, loading }: TastingFormProps) {
  const [form, setForm] = useState({
    scheduled_at: initial?.scheduled_at ? new Date(initial.scheduled_at).toISOString().slice(0, 16) : '',
    location: initial?.location ?? '',
    status: initial?.status ?? 'scheduled',
    feedback_notes: initial?.feedback_notes ?? '',
    items_approved: (initial?.items_approved ?? []).join('\n'),
    items_rejected: (initial?.items_rejected ?? []).join('\n'),
    items_modified: (initial?.items_modified ?? []).join('\n'),
    follow_up_required: initial?.follow_up_required ?? false,
    follow_up_notes: initial?.follow_up_notes ?? '',
    attendees: (initial?.attendees ?? []).join(', '),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Tasting Session' : 'Schedule Tasting Session'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Scheduled Date & Time</label>
              <input type="datetime-local" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Location</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Venue, caterer's kitchen, office..." value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Attendees (comma-separated)</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Client name, Event manager name..."
              value={form.attendees} onChange={e => setForm(p => ({ ...p, attendees: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Feedback Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={3} placeholder="General feedback from the tasting..." value={form.feedback_notes}
              onChange={e => setForm(p => ({ ...p, feedback_notes: e.target.value }))} />
          </div>
          {form.status === 'completed' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-emerald-400 mb-1 block flex items-center gap-1"><Check className="w-3 h-3" /> Approved</label>
                <textarea className="w-full bg-background border border-emerald-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                  rows={3} placeholder="One item per line" value={form.items_approved}
                  onChange={e => setForm(p => ({ ...p, items_approved: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-rose-400 mb-1 block">✗ Rejected</label>
                <textarea className="w-full bg-background border border-rose-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                  rows={3} placeholder="One item per line" value={form.items_rejected}
                  onChange={e => setForm(p => ({ ...p, items_rejected: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-amber-400 mb-1 block">~ Modified</label>
                <textarea className="w-full bg-background border border-amber-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                  rows={3} placeholder="One item per line" value={form.items_modified}
                  onChange={e => setForm(p => ({ ...p, items_modified: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.follow_up_required} onChange={e => setForm(p => ({ ...p, follow_up_required: e.target.checked }))} className="rounded" />
              <span className="text-sm">Follow-up required</span>
            </label>
          </div>
          {form.follow_up_required && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Follow-up Notes</label>
              <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                rows={2} value={form.follow_up_notes} onChange={e => setForm(p => ({ ...p, follow_up_notes: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => {
              const attendees = form.attendees.split(',').map(a => a.trim()).filter(Boolean)
              const items_approved = form.items_approved.split('\n').map(a => a.trim()).filter(Boolean)
              const items_rejected = form.items_rejected.split('\n').map(a => a.trim()).filter(Boolean)
              const items_modified = form.items_modified.split('\n').map(a => a.trim()).filter(Boolean)
              onSave({ ...form, attendees, items_approved, items_rejected, items_modified })
            }}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (initial ? 'Update' : 'Schedule Tasting')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FnbTastingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`, 'x-tenant-id': tenantId ?? '', 'Content-Type': 'application/json',
  }), [session, tenantId])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const r = await fetch(`${API}/fnb/events/${eventId}/tasting`, { headers: headers() })
    setSessions(await r.json())
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async (form: any) => {
    setSaving(true)
    try {
      const url = modal.editing ? `${API}/fnb/tasting/${modal.editing.id}` : `${API}/fnb/events/${eventId}/tasting`
      await fetch(url, { method: modal.editing ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(form) })
      await load()
      setModal({ open: false })
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this tasting session?')) return
    await fetch(`${API}/fnb/tasting/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  if (loading) return <div className="space-y-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl" />)}</div>

  const scheduled = sessions.filter(s => s.status === 'scheduled')
  const completed = sessions.filter(s => s.status === 'completed')
  const others = sessions.filter(s => !['scheduled','completed'].includes(s.status))

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold">Tasting Sessions</h2>
          {scheduled.length > 0 && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{scheduled.length} upcoming</span>}
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Schedule Tasting
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No tasting sessions</p>
          <p className="text-sm text-muted-foreground mb-4">Schedule food tastings with your catering vendor before the event</p>
          <button onClick={() => setModal({ open: true })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Schedule Tasting
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {[['Upcoming', scheduled], ['Completed', completed], ['Other', others]].map(([label, group]) => {
            if ((group as any[]).length === 0) return null
            return (
              <div key={label as string}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{label as string}</h3>
                <div className="space-y-3">
                  {(group as any[]).map(session => (
                    <div key={session.id} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{STATUS_ICONS[session.status]}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_STYLES[session.status])}>
                                {session.status}
                              </span>
                              {session.follow_up_required && (
                                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Follow-up needed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {session.scheduled_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(session.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              )}
                              {session.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {session.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setModal({ open: true, editing: session })}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => del(session.id)}
                            className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {session.attendees?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {session.attendees.map((a: string) => (
                            <span key={a} className="text-xs bg-accent/50 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                        </div>
                      )}

                      {session.feedback_notes && (
                        <p className="text-sm text-muted-foreground mb-3">{session.feedback_notes}</p>
                      )}

                      {/* Item outcome lists */}
                      {(session.items_approved?.length > 0 || session.items_rejected?.length > 0 || session.items_modified?.length > 0) && (
                        <div className="grid grid-cols-3 gap-3">
                          {session.items_approved?.length > 0 && (
                            <div>
                              <p className="text-xs text-emerald-400 font-medium mb-1.5">✓ Approved ({session.items_approved.length})</p>
                              <div className="space-y-1">
                                {session.items_approved.map((item: string, i: number) => (
                                  <div key={i} className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded">{item}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {session.items_rejected?.length > 0 && (
                            <div>
                              <p className="text-xs text-rose-400 font-medium mb-1.5">✗ Rejected ({session.items_rejected.length})</p>
                              <div className="space-y-1">
                                {session.items_rejected.map((item: string, i: number) => (
                                  <div key={i} className="text-xs bg-rose-500/10 text-rose-300 px-2 py-1 rounded">{item}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {session.items_modified?.length > 0 && (
                            <div>
                              <p className="text-xs text-amber-400 font-medium mb-1.5">~ Modified ({session.items_modified.length})</p>
                              <div className="space-y-1">
                                {session.items_modified.map((item: string, i: number) => (
                                  <div key={i} className="text-xs bg-amber-500/10 text-amber-300 px-2 py-1 rounded">{item}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {session.follow_up_notes && (
                        <div className="mt-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10 text-xs text-amber-300">
                          <strong>Follow-up:</strong> {session.follow_up_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <TastingForm initial={modal.editing} onSave={save} onClose={() => setModal({ open: false })} loading={saving} />
      )}
    </div>
  )
}
