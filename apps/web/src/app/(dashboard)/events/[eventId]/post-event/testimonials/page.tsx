'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, Plus, Check, Trash2, Pin, MessageSquare } from 'lucide-react'
import {
  usePostEventTestimonials, useCreateTestimonial,
  useApproveTestimonial, useFeatureTestimonial, useDeleteTestimonial,
} from '@/hooks/use-post-event'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'

const SOURCE_COLORS: Record<string, string> = {
  survey: 'text-blue-400 bg-blue-500/10',
  manual: 'text-violet-400 bg-violet-500/10',
  whatsapp: 'text-green-400 bg-green-500/10',
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i <= value ? 'fill-amber-400 text-amber-400' : 'text-white/10',
          )}
        />
      ))}
    </div>
  )
}

function AddTestimonialModal({ onClose, tenant, eventId }: { onClose: () => void; tenant: string; eventId: string }) {
  const create = useCreateTestimonial(tenant, eventId)
  const [form, setForm] = useState({
    author_name: '', author_role: '', content: '', rating: 5, source: 'manual', media_url: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(
      { ...form, rating: Number(form.rating), media_url: form.media_url || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Testimonial</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Author Name *</label>
              <input
                required
                value={form.author_name}
                onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Author Role</label>
              <input
                value={form.author_role}
                onChange={e => setForm(f => ({ ...f, author_role: e.target.value }))}
                placeholder="Guest, Client…"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Testimonial Content *</label>
            <textarea
              required
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={4}
              className="w-full px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Rating</label>
              <select
                value={form.rating}
                onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none"
              >
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} star{r !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Source</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="manual">Manual</option>
                <option value="survey">Survey</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Media URL</label>
              <input
                value={form.media_url}
                onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
                placeholder="https://…"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:bg-white/[0.05]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {create.isPending ? 'Adding…' : 'Add Testimonial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TestimonialCard({ t, tenant, eventId }: { t: any; tenant: string; eventId: string }) {
  const approve = useApproveTestimonial(tenant, eventId)
  const feature = useFeatureTestimonial(tenant, eventId)
  const del = useDeleteTestimonial(tenant, eventId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const srcColor = SOURCE_COLORS[t.source] ?? SOURCE_COLORS.manual

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-all',
      t.is_featured ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.02]',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{t.author_name}</span>
            {t.author_role && <span className="text-xs text-white/30">{t.author_role}</span>}
            {t.is_featured && <Pin className="w-3 h-3 text-amber-400" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {t.rating && <StarRating value={t.rating} />}
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', srcColor)}>
              {t.source}
            </span>
            {!t.is_approved && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                Pending
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!t.is_approved && (
            <button
              onClick={() => approve.mutate(t.id)}
              disabled={approve.isPending}
              className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400 transition-colors"
              title="Approve"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => feature.mutate({ id: t.id, featured: !t.is_featured })}
            className={cn('p-1.5 rounded-lg transition-colors', t.is_featured ? 'text-amber-400 hover:bg-amber-500/10' : 'text-white/30 hover:text-amber-400 hover:bg-amber-500/10')}
            title={t.is_featured ? 'Unfeature' : 'Feature'}
          >
            <Star className={cn('w-3.5 h-3.5', t.is_featured && 'fill-amber-400')} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-white/60 italic leading-relaxed">"{t.content}"</p>

      {/* Delete confirm inline */}
      {confirmDelete && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
          <span className="text-xs text-red-400 flex-1">Delete this testimonial?</span>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-white/40 hover:text-white/60 px-2">Cancel</button>
          <button
            onClick={() => { del.mutate(t.id); setConfirmDelete(false) }}
            className="text-xs text-red-400 hover:text-red-300 px-2"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function TestimonialsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const tenant = useTenant()
  const { data, isLoading } = usePostEventTestimonials(tenant, eventId)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'featured'>('all')

  const testimonials: any[] = data?.testimonials ?? []

  const filtered = testimonials.filter(t => {
    if (filter === 'pending') return !t.is_approved
    if (filter === 'approved') return t.is_approved && !t.is_featured
    if (filter === 'featured') return t.is_featured
    return true
  })

  const stats = {
    total: testimonials.length,
    pending: testimonials.filter(t => !t.is_approved).length,
    approved: testimonials.filter(t => t.is_approved).length,
    featured: testimonials.filter(t => t.is_featured).length,
    avgRating: testimonials.filter(t => t.rating).length > 0
      ? (testimonials.reduce((s, t) => s + (t.rating ?? 0), 0) / testimonials.filter(t => t.rating).length).toFixed(1)
      : '—',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Testimonials</h1>
            <p className="text-white/40 text-sm mt-0.5">Collect and manage guest testimonials</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm hover:bg-indigo-400"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
            { label: 'Featured', value: stats.featured, color: 'text-amber-400' },
            { label: 'Avg Rating', value: stats.avgRating, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'featured'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs capitalize border transition-all',
                filter === f ? 'bg-white/10 text-white border-white/20' : 'text-white/40 border-white/[0.06] hover:text-white/60',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <MessageSquare className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No testimonials yet.</p>
            <button onClick={() => setAdding(true)} className="mt-4 px-4 py-2 rounded-xl text-sm bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20">
              Add First Testimonial
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => <TestimonialCard key={t.id} t={t} tenant={tenant} eventId={eventId} />)}
          </div>
        )}

      </div>

      {adding && <AddTestimonialModal onClose={() => setAdding(false)} tenant={tenant} eventId={eventId} />}
    </div>
  )
}
