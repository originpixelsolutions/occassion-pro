'use client'
import { use, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  useConferenceRegistrations, useConferenceTickets,
  useCreateRegistration, useUpdateRegistration, useCheckIn,
} from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import {
  Users, Search, QrCode, Plus, CheckCircle2, Clock, X,
  Filter, Download, UserCheck, AlertCircle, RefreshCw,
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  checked_in: { label: 'Checked In', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  waitlisted: { label: 'Waitlisted', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  no_show:    { label: 'No Show',    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

function CheckInModal({ onClose, onCheckIn }: { onClose: () => void; onCheckIn: (n: string) => void }) {
  const [regNum, setRegNum] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!regNum.trim()) { setError('Enter a registration number'); return }
    onCheckIn(regNum.trim().toUpperCase())
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><QrCode className="w-4 h-4 text-green-400" /> Check In Attendee</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Registration Number / QR Code</label>
          <input
            autoFocus
            value={regNum}
            onChange={e => { setRegNum(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. CONF-001234"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50 font-mono"
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-black text-xs font-bold rounded-lg transition-colors">
            <UserCheck className="w-3.5 h-3.5 inline mr-1.5" /> Check In
          </button>
        </div>
      </div>
    </div>
  )
}

function AddRegistrationModal({ tickets, onClose, onSave }: { tickets: any[]; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    ticket_id: tickets[0]?.id ?? '',
    first_name: '', last_name: '', email: '', phone: '',
    company: '', job_title: '', dietary_requirements: '',
    badge_name: '', is_complimentary: false,
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add Registration</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'first_name', label: 'First Name', required: true },
            { key: 'last_name', label: 'Last Name', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'phone', label: 'Phone' },
            { key: 'company', label: 'Company' },
            { key: 'job_title', label: 'Job Title' },
            { key: 'badge_name', label: 'Badge Name' },
            { key: 'dietary_requirements', label: 'Dietary Needs' },
          ].map(({ key, label, type = 'text', required }) => (
            <div key={key} className={key === 'email' ? 'col-span-2' : ''}>
              <label className="block text-xs text-muted-foreground mb-1">{label}{required && ' *'}</label>
              <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Ticket *</label>
            <select value={form.ticket_id} onChange={e => setForm(p => ({ ...p, ticket_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {tickets.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_complimentary} onChange={e => setForm(p => ({ ...p, is_complimentary: e.target.checked }))} />
              Complimentary (auto-confirm, no payment)
            </label>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg">
            Register
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConferenceRegistrationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCheckIn, setShowCheckIn] = useState(searchParams.get('action') === 'checkin')
  const [showAdd, setShowAdd] = useState(searchParams.get('action') === 'add')
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; name?: string; error?: string } | null>(null)

  const { data: regData, isLoading, refetch } = useConferenceRegistrations(tenant, eventId, { status, search, page })
  const { data: tickets = [] } = useConferenceTickets(tenant, eventId)
  const createReg = useCreateRegistration(tenant, eventId)
  const checkIn = useCheckIn(tenant, eventId)

  const registrations = regData?.data ?? []
  const total = regData?.total ?? 0

  const handleCheckIn = async (regNum: string) => {
    try {
      const result = await checkIn.mutateAsync({ registration_number: regNum })
      setCheckInResult({ success: true, name: `${result.first_name} ${result.last_name}` })
      setTimeout(() => setCheckInResult(null), 3000)
      setShowCheckIn(false)
      refetch()
    } catch (e: any) {
      setCheckInResult({ success: false, error: e.message })
      setTimeout(() => setCheckInResult(null), 3000)
    }
  }

  return (
    <div className="space-y-5">
      {/* Check-in result toast */}
      {checkInResult && (
        <div className={cn(
          'fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 shadow-lg',
          checkInResult.success
            ? 'bg-green-500/20 border-green-500/30 text-green-300'
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        )}>
          {checkInResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {checkInResult.success ? `✓ ${checkInResult.name} checked in!` : checkInResult.error}
        </div>
      )}

      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={handleCheckIn} />}
      {showAdd && (
        <AddRegistrationModal
          tickets={tickets}
          onClose={() => setShowAdd(false)}
          onSave={async d => { await createReg.mutateAsync(d); setShowAdd(false) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /> Registrations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{total} total registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCheckIn(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors">
            <QrCode className="w-3.5 h-3.5" /> Check In
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, email, reg #..."
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <a href={`/api/tenant/events/${eventId}/conference/registrations/export`}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </a>
      </div>

      {/* Status summary chips */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([v, { label, color }]) => {
          const count = registrations.filter((r: any) => r.status === v).length
          if (count === 0 && total > 0) return null
          return (
            <button key={v} onClick={() => setStatus(status === v ? '' : v)}
              className={cn('px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all', color, status === v ? 'ring-1 ring-offset-1 ring-current' : '')}>
              {label} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-card border border-border rounded-lg" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {registrations.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No registrations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Attendee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Reg #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Checked In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {registrations.map((r: any) => (
                    <tr key={r.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.first_name} {r.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.registration_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.ticket?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', STATUS_CONFIG[r.status]?.color ?? '')}>
                          {STATUS_CONFIG[r.status]?.label ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.company ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.checked_in_at ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {new Date(r.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : r.status === 'confirmed' ? (
                          <button onClick={() => handleCheckIn(r.registration_number)}
                            className="text-xs text-blue-400 hover:underline">Check in</button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {((page-1)*50)+1}–{Math.min(page*50, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p-1)}
              className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors">Prev</button>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p+1)}
              className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
