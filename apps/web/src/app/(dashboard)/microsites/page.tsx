'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Plus, Search, X, Globe, Eye, Copy, ExternalLink,
  Edit2, Trash2, Loader2, CheckCircle2, Clock, EyeOff,
  Link2, Palette, BarChart2, Calendar, QrCode, Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

type Microsite = {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  event_id?: string
  event_name?: string
  template?: string
  primary_color?: string
  views?: number
  rsvps?: number
  created_at: string
  updated_at: string
  published_at?: string
}

const TEMPLATES = [
  { id: 'elegant', label: 'Elegant', description: 'Clean minimal design for luxury events' },
  { id: 'corporate', label: 'Corporate', description: 'Professional layout for business events' },
  { id: 'festival', label: 'Festival', description: 'Bold colorful design for celebrations' },
  { id: 'wedding', label: 'Wedding', description: 'Romantic floral design' },
  { id: 'modern', label: 'Modern', description: 'Contemporary dark theme' },
]

const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4'
]

function CreateMicrositeModal({ token, onClose, onSaved }: {
  token: string; onClose: () => void; onSaved: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    title: '', slug: '', template: 'elegant',
    primary_color: '#6366f1', event_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.slug.trim()) { setError('URL slug is required'); return }
    setSaving(true)
    try {
      const r = await fetch(`${API}/microsites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) throw new Error('Failed to create')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold">Create Microsite</h2>
            <p className="text-xs text-muted-foreground">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {error && <p className="mx-5 mt-3 text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</p>}

        {step === 1 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Site Title *</label>
              <input value={form.title}
                onChange={e => { set('title', e.target.value); set('slug', generateSlug(e.target.value)) }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="My Wedding Website" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL Slug *</label>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-accent border-r border-border">occasionpro.app/s/</span>
                <input value={form.slug} onChange={e => set('slug', e.target.value)}
                  className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
                  placeholder="my-wedding" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Choose Template</label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => set('template', t.id)}
                    className={cn('p-3 rounded-lg border text-left transition-colors',
                      form.template === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                    <p className="text-xs font-medium">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Brand Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map(color => (
                  <button key={color} onClick={() => set('primary_color', color)}
                    style={{ backgroundColor: color }}
                    className={cn('w-8 h-8 rounded-full transition-all', form.primary_color === color ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : '')}>
                  </button>
                ))}
                <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border-0 p-0" title="Custom color" />
              </div>
            </div>
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium">Site Summary</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Title: <span className="text-foreground">{form.title}</span></p>
                <p>URL: <span className="text-foreground">occasionpro.app/s/{form.slug}</span></p>
                <p>Template: <span className="text-foreground capitalize">{form.template}</span></p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border flex gap-2 justify-between">
          <button onClick={() => step === 1 ? onClose() : setStep(1)}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button onClick={() => step === 1 ? setStep(2) : save()} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {step === 1 ? 'Next' : 'Create Site'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MicrositeCard({ site, token, onUpdate }: {
  site: Microsite; token: string; onUpdate: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(`https://occasionpro.app/s/${site.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePublish = async () => {
    const newStatus = site.status === 'published' ? 'draft' : 'published'
    await fetch(`${API}/microsites/${site.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    onUpdate()
  }

  const deleteSite = async () => {
    if (!confirm('Delete this microsite?')) return
    await fetch(`${API}/microsites/${site.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onUpdate()
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-400' },
    published: { label: 'Live', color: 'bg-emerald-500/10 text-emerald-400' },
    archived: { label: 'Archived', color: 'bg-orange-500/10 text-orange-400' },
  }

  const cfg = statusConfig[site.status] ?? statusConfig.draft

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group hover:border-primary/30 transition-all">
      {/* Preview thumbnail */}
      <div className="h-28 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${site.primary_color ?? '#6366f1'}22, ${site.primary_color ?? '#6366f1'}44)` }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe className="w-8 h-8 opacity-20" style={{ color: site.primary_color ?? '#6366f1' }} />
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', cfg.color)}>{cfg.label}</span>
        </div>
        <div className="absolute bottom-2 left-3">
          <p className="text-xs font-medium">{site.title}</p>
          <p className="text-[10px] text-muted-foreground">/{site.slug}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-border flex gap-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="w-3 h-3" />{site.views ?? 0} views
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3 h-3" />{site.rsvps ?? 0} RSVPs
        </div>
        {site.event_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Calendar className="w-3 h-3 shrink-0" />{site.event_name}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 flex gap-1">
        <button onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <a href={`/s/${site.slug}`} target="_blank" rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          <Eye className="w-3 h-3" /> Preview
        </a>
        <button onClick={togglePublish}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          {site.status === 'published'
            ? <><EyeOff className="w-3 h-3" /> Unpublish</>
            : <><Globe className="w-3 h-3" /> Publish</>
          }
        </button>
        <button onClick={deleteSite}
          className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-accent rounded-lg transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default function MicrositesPage() {
  const { token } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const { data: sitesData, loading, refetch } = useApi<{ data: Microsite[] }>('/microsites', token ?? '')
  const sites: Microsite[] = sitesData?.data ?? []

  const filtered = sites.filter(s => {
    const q = search.toLowerCase()
    return (!q || s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
      && (statusFilter === 'all' || s.status === statusFilter)
  })

  const published = sites.filter(s => s.status === 'published').length
  const totalViews = sites.reduce((sum, s) => sum + (s.views ?? 0), 0)
  const totalRsvps = sites.reduce((sum, s) => sum + (s.rsvps ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
        <div>
          <h1 className="font-semibold text-sm">Microsites</h1>
          <p className="text-[10px] text-muted-foreground">Event websites & RSVP portals</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search sites..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button onClick={() => setShowCreate(true)}
            className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> New Site
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px bg-border border-b border-border shrink-0">
        {[
          { label: 'Total Sites', value: sites.length, icon: Globe },
          { label: 'Live', value: published, icon: CheckCircle2 },
          { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye },
          { label: 'Total RSVPs', value: totalRsvps, icon: BarChart2 },
        ].map(stat => (
          <div key={stat.label} className="bg-card px-4 py-3 flex items-center gap-3">
            <stat.icon className="w-4 h-4 text-primary" />
            <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-sm font-bold">{stat.value}</p></div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(site => (
              <MicrositeCard key={site.id} site={site} token={token ?? ''} onUpdate={refetch} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No microsites yet</p>
            <p className="text-xs text-muted-foreground/70 mb-4">Create beautiful event websites with RSVP forms</p>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-primary text-foreground rounded-lg hover:bg-primary/90">
              Create Your First Site
            </button>
          </div>
        )}
      </div>

      {showCreate && <CreateMicrositeModal token={token ?? ''} onClose={() => setShowCreate(false)} onSaved={refetch} />}
    </div>
  )
}
