'use client'
import { use, useState } from 'react'
import { useConferenceNetworking, useUpdateConnectionStatus } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import { Network, Check, X, Calendar, Users, Clock, Search } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  accepted:  'bg-green-500/10 text-green-400 border-green-500/20',
  declined:  'bg-red-500/10 text-red-400 border-red-500/20',
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  met:       'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

function MeetingModal({ connection, onSave, onClose }: { connection: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    meeting_time: '',
    meeting_location: '',
    meeting_notes: '',
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" /> Schedule Meeting</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Between <span className="text-foreground font-medium">{connection.requester_name}</span> and <span className="text-foreground font-medium">{connection.recipient_name}</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Meeting Time</label>
            <input type="datetime-local" value={form.meeting_time} onChange={e => setForm(p => ({ ...p, meeting_time: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Location / Room</label>
            <input value={form.meeting_location} onChange={e => setForm(p => ({ ...p, meeting_location: e.target.value }))}
              placeholder="e.g. Networking Lounge, Table 4"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={form.meeting_notes} onChange={e => setForm(p => ({ ...p, meeting_notes: e.target.value }))} rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg">
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectionCard({ conn, onAccept, onDecline, onSchedule }: {
  conn: any
  onAccept: () => void
  onDecline: () => void
  onSchedule: () => void
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-blue-500/20 transition-colors">
      <div className="flex items-start gap-3">
        {/* Requester */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
              {conn.requester_name?.[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{conn.requester_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{conn.requester_company}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground my-1">
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="shrink-0">wants to connect with</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
              {conn.recipient_name?.[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{conn.recipient_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{conn.recipient_company}</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', STATUS_COLORS[conn.status] ?? '')}>
            {conn.status}
          </span>
        </div>
      </div>

      {conn.message && (
        <p className="text-xs text-muted-foreground mt-3 p-2 bg-background rounded-lg italic">"{conn.message}"</p>
      )}

      {conn.meeting_time && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-400">
          <Clock className="w-3 h-3" />
          <span>{new Date(conn.meeting_time).toLocaleString()}</span>
          {conn.meeting_location && <span className="text-muted-foreground">· {conn.meeting_location}</span>}
        </div>
      )}

      {conn.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <button onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors">
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors">
            <X className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}

      {conn.status === 'accepted' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <button onClick={onSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-500/20 transition-colors">
            <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConferenceNetworkingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: connections = [], isLoading } = useConferenceNetworking(tenant, eventId)
  const updateStatus = useUpdateConnectionStatus(tenant, eventId)

  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [schedulingConn, setSchedulingConn] = useState<any>(null)

  const filtered = (connections as any[])
    .filter(c => !filter || c.status === filter)
    .filter(c => !search || [c.requester_name, c.recipient_name, c.requester_company, c.recipient_company]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())))

  const stats = {
    total: (connections as any[]).length,
    pending: (connections as any[]).filter((c: any) => c.status === 'pending').length,
    accepted: (connections as any[]).filter((c: any) => c.status === 'accepted').length,
    scheduled: (connections as any[]).filter((c: any) => c.status === 'scheduled').length,
    met: (connections as any[]).filter((c: any) => c.status === 'met').length,
  }

  if (isLoading) return (
    <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl" />)}</div>
  )

  return (
    <div className="space-y-5">
      {schedulingConn && (
        <MeetingModal
          connection={schedulingConn}
          onClose={() => setSchedulingConn(null)}
          onSave={async d => {
            await updateStatus.mutateAsync({ connectionId: schedulingConn.id, status: 'scheduled', ...d })
            setSchedulingConn(null)
          }}
        />
      )}

      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Network className="w-5 h-5 text-blue-400" /> Networking</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{stats.total} connection requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Accepted', value: stats.accepted, color: 'text-green-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-400' },
          { label: 'Met', value: stats.met, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search attendees..."
            className="pl-8 pr-3 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus:border-blue-500/50 w-48" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {connections.length === 0 ? 'No connection requests yet' : 'No matches for current filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((conn: any) => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onAccept={() => updateStatus.mutateAsync({ connectionId: conn.id, status: 'accepted' })}
              onDecline={() => updateStatus.mutateAsync({ connectionId: conn.id, status: 'declined' })}
              onSchedule={() => setSchedulingConn(conn)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
