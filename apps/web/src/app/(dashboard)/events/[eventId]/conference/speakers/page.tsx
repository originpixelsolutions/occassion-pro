'use client'
import { use, useState } from 'react'
import { useConferenceSpeakers, useCreateSpeaker, useUpdateSpeaker, useDeleteSpeaker } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import { Mic2, Plus, Pencil, Trash2, Star, Globe, Twitter, Linkedin, X, Mail, Building2 } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  invited:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  confirmed: 'bg-green-500/10 text-green-400 border-green-500/20',
  declined:  'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function SpeakerModal({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    company: initial?.company ?? '',
    job_title: initial?.job_title ?? '',
    bio: initial?.bio ?? '',
    photo_url: initial?.photo_url ?? '',
    status: initial?.status ?? 'invited',
    is_keynote: initial?.is_keynote ?? false,
    is_featured: initial?.is_featured ?? false,
    linkedin_url: initial?.linkedin_url ?? '',
    twitter_handle: initial?.twitter_handle ?? '',
    website_url: initial?.website_url ?? '',
    topics: initial?.topics?.join(', ') ?? '',
    honorarium: initial?.honorarium ?? '',
    dietary_requirements: initial?.dietary_requirements ?? '',
    travel_required: initial?.travel_required ?? false,
    hotel_required: initial?.hotel_required ?? false,
    notes: initial?.notes ?? '',
  })

  const handleSave = () => {
    onSave({
      ...form,
      topics: form.topics ? form.topics.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      honorarium: form.honorarium ? parseFloat(String(form.honorarium)) : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Edit Speaker' : 'Add Speaker'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'first_name', label: 'First Name', required: true },
            { key: 'last_name', label: 'Last Name', required: true },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Phone' },
            { key: 'company', label: 'Company' },
            { key: 'job_title', label: 'Job Title' },
          ].map(({ key, label, type = 'text', required }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}{required && ' *'}</label>
              <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Bio</label>
          <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
            rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Photo URL</label>
            <input value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {['invited','confirmed','declined','cancelled'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">LinkedIn URL</label>
            <input value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))}
              placeholder="https://linkedin.com/in/..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Twitter Handle</label>
            <input value={form.twitter_handle} onChange={e => setForm(p => ({ ...p, twitter_handle: e.target.value }))}
              placeholder="@handle"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Topics (comma separated)</label>
            <input value={form.topics} onChange={e => setForm(p => ({ ...p, topics: e.target.value }))}
              placeholder="AI, Cloud, Leadership"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Honorarium (₹)</label>
            <input type="number" value={form.honorarium} onChange={e => setForm(p => ({ ...p, honorarium: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          {[
            { key: 'is_keynote', label: 'Keynote Speaker' },
            { key: 'is_featured', label: 'Featured' },
            { key: 'travel_required', label: 'Travel Required' },
            { key: 'hotel_required', label: 'Hotel Required' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg">
            {initial ? 'Update Speaker' : 'Add Speaker'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConferenceSpeakersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: speakersData, isLoading } = useConferenceSpeakers(tenant, eventId)
  const speakers: any[] = speakersData?.speakers ?? speakersData ?? []
  const createSpeaker = useCreateSpeaker(tenant, eventId)
  const updateSpeaker = useUpdateSpeaker(tenant, eventId)
  const deleteSpeaker = useDeleteSpeaker(tenant, eventId)

  const [showModal, setShowModal] = useState(false)
  const [editSpeaker, setEditSpeaker] = useState<any>(null)
  const [filter, setFilter] = useState('')

  const filtered = filter ? speakers.filter((s: any) => s.status === filter) : speakers
  const keynotes = filtered.filter((s: any) => s.is_keynote)
  const regular = filtered.filter((s: any) => !s.is_keynote)

  if (isLoading) return <div className="animate-pulse space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      {(showModal || editSpeaker) && (
        <SpeakerModal
          initial={editSpeaker}
          onClose={() => { setShowModal(false); setEditSpeaker(null) }}
          onSave={async d => {
            if (editSpeaker) await updateSpeaker.mutateAsync({ speakerId: editSpeaker.id, ...d })
            else await createSpeaker.mutateAsync(d)
            setShowModal(false); setEditSpeaker(null)
          }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Mic2 className="w-5 h-5 text-green-400" /> Speakers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{speakers.length} speakers · {speakers.filter((s:any)=>s.status==='confirmed').length} confirmed</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="">All Statuses</option>
            {['invited','confirmed','declined','cancelled'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Speaker
          </button>
        </div>
      </div>

      {keynotes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-yellow-400" /> Keynote Speakers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {keynotes.map((s: any) => <SpeakerCard key={s.id} speaker={s} onEdit={() => setEditSpeaker(s)} onDelete={() => { if (confirm('Delete speaker?')) deleteSpeaker.mutate(s.id) }} />)}
          </div>
        </div>
      )}

      {regular.length > 0 && (
        <div>
          {keynotes.length > 0 && <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Speakers</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {regular.map((s: any) => <SpeakerCard key={s.id} speaker={s} onEdit={() => setEditSpeaker(s)} onDelete={() => { if (confirm('Delete speaker?')) deleteSpeaker.mutate(s.id) }} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Mic2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No speakers added yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-green-400 hover:underline">Add first speaker</button>
        </div>
      )}
    </div>
  )
}

function SpeakerCard({ speaker: s, onEdit, onDelete }: { speaker: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-green-500/30 transition-colors">
      <div className="flex items-start gap-3">
        {s.photo_url ? (
          <img src={s.photo_url} alt={`${s.first_name} ${s.last_name}`} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-base font-bold text-green-400 shrink-0">
            {s.first_name[0]}{s.last_name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{s.first_name} {s.last_name}</p>
            {s.is_keynote && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">{s.job_title}{s.company && ` · ${s.company}`}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', STATUS_COLORS[s.status] ?? '')}>
              {s.status}
            </span>
            {s.is_featured && <span className="text-[10px] text-violet-400">Featured</span>}
          </div>
          {s.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {s.topics.slice(0, 3).map((t: string) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-background rounded text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {s.email && <a href={`mailto:${s.email}`} className="text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" /></a>}
          {s.linkedin_url && <a href={s.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-blue-400"><Linkedin className="w-3.5 h-3.5" /></a>}
          {s.twitter_handle && <a href={`https://twitter.com/${s.twitter_handle.replace('@','')}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-sky-400"><Twitter className="w-3.5 h-3.5" /></a>}
          {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><Globe className="w-3.5 h-3.5" /></a>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 hover:bg-red-500/10 rounded transition-colors text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  )
}
