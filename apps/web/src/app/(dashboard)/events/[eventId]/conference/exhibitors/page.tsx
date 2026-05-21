'use client'
import { use, useState } from 'react'
import { useConferenceExhibitors, useCreateExhibitor, useUpdateExhibitor } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import { Building2, Plus, Pencil, X, MapPin, Users, Zap, Wifi } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  setup:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  concluded: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function ExhibitorModal({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    status: initial?.status ?? 'pending',
    booth_number: initial?.booth_number ?? '',
    booth_size: initial?.booth_size ?? '',
    hall: initial?.hall ?? '',
    logo_url: initial?.logo_url ?? '',
    website_url: initial?.website_url ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? '',
    contact_name: initial?.contact_name ?? '',
    contact_email: initial?.contact_email ?? '',
    contact_phone: initial?.contact_phone ?? '',
    power_required: initial?.power_required ?? false,
    internet_required: initial?.internet_required ?? false,
    exhibitor_fee: initial?.exhibitor_fee ?? '',
    staff_count: initial?.staff_count ?? 2,
    notes: initial?.notes ?? '',
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Edit Exhibitor' : 'Add Exhibitor'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Company Name *</label>
            <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          {[
            { key: 'booth_number', label: 'Booth Number' },
            { key: 'booth_size', label: 'Booth Size' },
            { key: 'hall', label: 'Hall / Area' },
            { key: 'category', label: 'Category' },
            { key: 'contact_name', label: 'Contact Name' },
            { key: 'contact_email', label: 'Contact Email' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Staff Count</label>
            <input type="number" value={form.staff_count} onChange={e => setForm(p => ({ ...p, staff_count: parseInt(e.target.value) || 2 }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Exhibitor Fee (₹)</label>
            <input type="number" value={form.exhibitor_fee} onChange={e => setForm(p => ({ ...p, exhibitor_fee: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
        </div>
        <div className="flex gap-4">
          {[
            { key: 'power_required', label: '⚡ Power Required' },
            { key: 'internet_required', label: '📶 Internet Required' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={() => onSave({ ...form, exhibitor_fee: form.exhibitor_fee ? parseFloat(String(form.exhibitor_fee)) : null })}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg">
            {initial ? 'Update' : 'Add Exhibitor'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConferenceExhibitorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: exhibitors = [], isLoading } = useConferenceExhibitors(tenant, eventId)
  const createExhibitor = useCreateExhibitor(tenant, eventId)
  const updateExhibitor = useUpdateExhibitor(tenant, eventId)

  const [showModal, setShowModal] = useState(false)
  const [editExhibitor, setEditExhibitor] = useState<any>(null)
  const [filter, setFilter] = useState('')

  const filtered = filter ? exhibitors.filter((e: any) => e.status === filter) : exhibitors
  const halls = [...new Set((exhibitors as any[]).map((e: any) => e.hall).filter(Boolean))]

  if (isLoading) return <div className="animate-pulse space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      {(showModal || editExhibitor) && (
        <ExhibitorModal
          initial={editExhibitor}
          onClose={() => { setShowModal(false); setEditExhibitor(null) }}
          onSave={async d => {
            if (editExhibitor) await updateExhibitor.mutateAsync({ exhibitorId: editExhibitor.id, ...d })
            else await createExhibitor.mutateAsync(d)
            setShowModal(false); setEditExhibitor(null)
          }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-400" /> Exhibitors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{(exhibitors as any[]).length} exhibitors · {halls.length} hall{halls.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="">All Statuses</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Exhibitor
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No exhibitors yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-orange-400 hover:underline">Add first exhibitor</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(filtered as any[]).map((e: any) => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-4 hover:border-orange-500/30 transition-colors">
              <div className="flex items-start gap-3">
                {e.logo_url ? (
                  <img src={e.logo_url} alt={e.company_name} className="w-10 h-10 rounded-lg object-contain bg-white/5 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-sm font-bold text-orange-400 shrink-0">
                    {e.company_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.company_name}</p>
                  {e.category && <p className="text-xs text-muted-foreground">{e.category}</p>}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium mt-1 inline-block', STATUS_COLORS[e.status] ?? '')}>
                    {e.status}
                  </span>
                </div>
                <button onClick={() => setEditExhibitor(e)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                {e.booth_number && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Booth {e.booth_number}</span>}
                {e.hall && <span>{e.hall}</span>}
                {e.staff_count && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {e.staff_count} staff</span>}
                {e.power_required && <Zap className="w-3 h-3 text-yellow-400" />}
                {e.internet_required && <Wifi className="w-3 h-3 text-blue-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
