'use client'
import { use, useState } from 'react'
import { useConferenceSessions, useCreateSession, useUpdateSession, useUpdateSessionStatus, useDeleteSession } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import {
  CalendarClock, Plus, Pencil, Trash2, Video, Users, GraduationCap,
  X, Clock, MapPin, Mic2, Radio, LayoutGrid, List,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

const SESSION_TYPE_COLORS: Record<string, string> = {
  keynote:    'bg-violet-500/10 text-violet-400 border-violet-500/20',
  panel:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  workshop:   'bg-green-500/10 text-green-400 border-green-500/20',
  breakout:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  lightning:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  networking: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  fireside:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  demo:       'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  live:       'bg-green-500/10 text-green-400 border-green-500/20',
  completed:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/20',
}

function SessionModal({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => void; onClose: () => void }) {
  const toLocal = (iso: string | undefined) => iso ? iso.slice(0,16) : ''

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    session_type: initial?.session_type ?? 'breakout',
    track: initial?.track ?? '',
    room: initial?.room ?? '',
    room_capacity: initial?.room_capacity ?? '',
    starts_at: toLocal(initial?.starts_at),
    ends_at: toLocal(initial?.ends_at),
    day_number: initial?.day_number ?? 1,
    is_virtual: initial?.is_virtual ?? false,
    stream_url: initial?.stream_url ?? '',
    max_attendees: initial?.max_attendees ?? '',
    ceu_credits: initial?.ceu_credits ?? 0,
    ceu_type: initial?.ceu_type ?? '',
    difficulty_level: initial?.difficulty_level ?? 'all',
    is_featured: initial?.is_featured ?? false,
    requires_signup: initial?.requires_signup ?? false,
    language: initial?.language ?? 'en',
    tags: initial?.tags?.join(', ') ?? '',
  })

  const handleSave = () => {
    onSave({
      ...form,
      room_capacity: form.room_capacity ? parseInt(String(form.room_capacity)) : null,
      max_attendees: form.max_attendees ? parseInt(String(form.max_attendees)) : null,
      ceu_credits: parseFloat(String(form.ceu_credits)) || 0,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Edit Session' : 'Add Session'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Session Type</label>
            <select value={form.session_type} onChange={e => setForm(p => ({ ...p, session_type: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {['keynote','panel','workshop','breakout','lightning','networking','fireside','demo','poster','exhibition'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Track</label>
            <input value={form.track} onChange={e => setForm(p => ({ ...p, track: e.target.value }))}
              placeholder="e.g. Main Stage, Technical, Business"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Start Time *</label>
            <input type="datetime-local" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">End Time *</label>
            <input type="datetime-local" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Room / Venue</label>
            <input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Day Number</label>
            <input type="number" value={form.day_number} onChange={e => setForm(p => ({ ...p, day_number: parseInt(e.target.value) || 1 }))}
              min={1} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">CEU Credits</label>
            <input type="number" value={form.ceu_credits} onChange={e => setForm(p => ({ ...p, ceu_credits: e.target.value }))}
              step="0.25" min="0"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Difficulty</label>
            <select value={form.difficulty_level} onChange={e => setForm(p => ({ ...p, difficulty_level: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {['all','beginner','intermediate','advanced'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Tags (comma separated)</label>
            <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="AI, Cloud, Security"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>
        <div className="flex gap-4 flex-wrap">
          {[
            { key: 'is_virtual', label: 'Virtual Session' },
            { key: 'is_featured', label: 'Featured' },
            { key: 'requires_signup', label: 'Requires Signup' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg">
            {initial ? 'Update Session' : 'Add Session'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConferenceAgendaPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const [day, setDay] = useState<number | undefined>(undefined)
  const [track, setTrack] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const { data: sessionsData, isLoading } = useConferenceSessions(tenant, eventId, { day, track })
  const createSession = useCreateSession(tenant, eventId)
  const updateSession = useUpdateSession(tenant, eventId)
  const updateStatus = useUpdateSessionStatus(tenant, eventId)
  const deleteSession = useDeleteSession(tenant, eventId)

  const [showModal, setShowModal] = useState(false)
  const [editSession, setEditSession] = useState<any>(null)

  const sessions: any[] = sessionsData?.sessions ?? []
  const byDay: Record<number, any[]> = sessionsData?.byDay ?? {}
  const days = Object.keys(byDay).map(Number).sort()
  const tracks = [...new Set(sessions.map((s: any) => s.track).filter(Boolean))]

  const filteredSessions = sessions.filter((s: any) => {
    if (day && s.day_number !== day) return false
    if (track && s.track !== track) return false
    return true
  })

  if (isLoading) return <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      {(showModal || editSession) && (
        <SessionModal
          initial={editSession}
          onClose={() => { setShowModal(false); setEditSession(null) }}
          onSave={async d => {
            if (editSession) await updateSession.mutateAsync({ sessionId: editSession.id, ...d })
            else await createSession.mutateAsync(d)
            setShowModal(false); setEditSession(null)
          }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-400" /> Agenda</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} sessions · {days.length} day{days.length !== 1 ? 's' : ''} · {tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('grid')} className={cn('px-2.5 py-1.5 text-xs transition-colors', view === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('list')} className={cn('px-2.5 py-1.5 text-xs transition-colors', view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Session
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setDay(undefined)} className={cn('px-3 py-1 text-xs rounded-full border transition-colors', !day ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-border text-muted-foreground hover:text-foreground')}>
          All Days
        </button>
        {days.map(d => (
          <button key={d} onClick={() => setDay(day === d ? undefined : d)}
            className={cn('px-3 py-1 text-xs rounded-full border transition-colors', day === d ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-border text-muted-foreground hover:text-foreground')}>
            Day {d}
          </button>
        ))}
        {tracks.length > 0 && (
          <select value={track} onChange={e => setTrack(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none ml-2">
            <option value="">All Tracks</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Sessions */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <CalendarClock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No sessions yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-amber-400 hover:underline">Add first session</button>
        </div>
      ) : view === 'list' ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Session</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Room</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSessions.map((s: any) => (
                <tr key={s.id} className="hover:bg-background/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{s.title}</p>
                    {s.speakers?.length > 0 && (
                      <p className="text-xs text-muted-foreground">{s.speakers.map((sp: any) => `${sp.speaker?.first_name} ${sp.speaker?.last_name}`).join(', ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {s.starts_at ? format(parseISO(s.starts_at), 'HH:mm') : '—'}
                    {s.ends_at ? ` – ${format(parseISO(s.ends_at), 'HH:mm')}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.room ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border capitalize', SESSION_TYPE_COLORS[s.session_type] ?? 'bg-card border-border text-muted-foreground')}>
                      {s.session_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={s.status} onChange={e => updateStatus.mutate({ sessionId: s.id, status: e.target.value })}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium bg-transparent capitalize focus:outline-none', STATUS_COLORS[s.status] ?? '')}>
                      {['scheduled','live','completed','cancelled'].map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditSession(s)} className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Delete session?')) deleteSession.mutate(s.id) }} className="p-1 hover:bg-red-500/10 rounded transition-colors text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSessions.map((s: any) => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border capitalize font-medium', SESSION_TYPE_COLORS[s.session_type] ?? '')}>{s.session_type}</span>
                    {s.is_virtual && <Video className="w-3 h-3 text-cyan-400" />}
                    {s.ceu_credits > 0 && <GraduationCap className="w-3 h-3 text-pink-400" />}
                  </div>
                  <p className="text-sm font-semibold leading-tight">{s.title}</p>
                  {s.speakers?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Mic2 className="w-3 h-3" />
                      {s.speakers.slice(0,2).map((sp: any) => `${sp.speaker?.first_name} ${sp.speaker?.last_name}`).join(', ')}
                      {s.speakers.length > 2 && ` +${s.speakers.length - 2}`}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.starts_at ? format(parseISO(s.starts_at), 'HH:mm') : '—'}</span>
                    {s.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.room}</span>}
                    {s.track && <span className="truncate">{s.track}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select value={s.status} onChange={e => updateStatus.mutate({ sessionId: s.id, status: e.target.value })}
                    className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium bg-transparent capitalize focus:outline-none cursor-pointer', STATUS_COLORS[s.status] ?? '')}>
                    {['scheduled','live','completed','cancelled'].map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                {s.status === 'live' && <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"><Radio className="w-3 h-3" /> LIVE</span>}
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => setEditSession(s)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm('Delete session?')) deleteSession.mutate(s.id) }} className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
