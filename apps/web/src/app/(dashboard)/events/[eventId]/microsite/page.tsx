'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Globe, Plus, Trash2, Settings, Eye, EyeOff, Save,
  Loader2, X, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, Users, Calendar, HelpCircle, Building2,
  Star, Trophy, Award, Zap, ExternalLink, Copy,
  ImageIcon, Link, Mic, Clock, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MicrositeSettings {
  theme: string
  accent_color: string
  hero_image_url?: string
  logo_url?: string
  show_speakers: boolean
  show_schedule: boolean
  show_sponsors: boolean
  show_faq: boolean
  show_map: boolean
  registration_enabled: boolean
  registration_fee_paise: number
  max_registrations?: number
  registration_deadline?: string
  custom_domain?: string
  slug_override?: string
  meta_title?: string
  meta_description?: string
  og_image_url?: string
  countdown_enabled: boolean
  hero_cta_label: string
  hero_cta_url?: string
  is_published: boolean
  ga4_measurement_id?: string
  fb_pixel_id?: string
}

interface Speaker {
  id: string
  name: string
  title?: string
  company?: string
  bio?: string
  photo_url?: string
  linkedin_url?: string
  twitter_url?: string
  is_keynote: boolean
  display_order: number
}

interface Session {
  id: string
  title: string
  description?: string
  session_type: string
  stage?: string
  session_date: string
  start_time: string
  end_time: string
  speaker_id?: string
  tags?: string[]
  display_order: number
}

interface Sponsor {
  id: string
  name: string
  logo_url?: string
  website_url?: string
  tier: string
  tagline?: string
  display_order: number
}

interface Faq {
  id: string
  question: string
  answer: string
  display_order: number
}

interface Registration {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  status: string
  amount_paise: number
  created_at: string
  checked_in_at?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  platinum: { label: 'Platinum', icon: Trophy, color: 'text-cyan-300' },
  gold:     { label: 'Gold',     icon: Star,   color: 'text-amber-400' },
  silver:   { label: 'Silver',   icon: Award,  color: 'text-zinc-400' },
  bronze:   { label: 'Bronze',   icon: Zap,    color: 'text-orange-400' },
  community:{ label: 'Community',icon: Users,  color: 'text-emerald-400' },
  media:    { label: 'Media',    icon: Globe,  color: 'text-blue-400' },
}

const SESSION_TYPES = ['keynote', 'talk', 'workshop', 'panel', 'break', 'networking']

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 3600) return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/3 hover:bg-white/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Icon className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-sm font-semibold flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 border-t border-border/50">{children}</div>}
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50', className)}
    />
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0', value ? 'bg-violet-500' : 'bg-white/10')}
      >
        <div className={cn('w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all', value ? 'left-[18px]' : 'left-0.5')} />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </label>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MicrositePage() {
  const params = useParams<{ eventId: string }>()
  const eventId = params?.eventId ?? ''

  const [activeTab, setActiveTab] = useState<'settings' | 'speakers' | 'schedule' | 'sponsors' | 'faq' | 'registrations'>('settings')

  // Data
  const [settings, setSettings] = useState<Partial<MicrositeSettings>>({
    theme: 'dark', accent_color: '#8B5CF6', show_speakers: true,
    show_schedule: true, show_sponsors: true, show_faq: true, show_map: true,
    registration_enabled: false, registration_fee_paise: 0,
    countdown_enabled: true, hero_cta_label: 'Register Now', is_published: false,
  })
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form states
  const [speakerForm, setSpeakerForm] = useState<Partial<Speaker> | null>(null)
  const [sessionForm, setSessionForm] = useState<Partial<Session> | null>(null)
  const [sponsorForm, setSponsorForm] = useState<Partial<Sponsor> | null>(null)
  const [faqForm, setFaqForm] = useState<Partial<Faq> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, sp, se, sn, f, r] = await Promise.allSettled([
        apiFetch(`/events/${eventId}/microsite/settings`),
        apiFetch(`/events/${eventId}/microsite/speakers`),
        apiFetch(`/events/${eventId}/microsite/sessions`),
        apiFetch(`/events/${eventId}/microsite/sponsors`),
        apiFetch(`/events/${eventId}/microsite/faqs`),
        apiFetch(`/events/${eventId}/microsite/registrations`),
      ])
      if (s.status === 'fulfilled' && s.value) setSettings(s.value)
      if (sp.status === 'fulfilled') setSpeakers(sp.value ?? [])
      if (se.status === 'fulfilled') setSessions(se.value ?? [])
      if (sn.status === 'fulfilled') setSponsors(sn.value ?? [])
      if (f.status === 'fulfilled') setFaqs(f.value ?? [])
      if (r.status === 'fulfilled') setRegistrations(r.value ?? [])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function saveSettings() {
    setSaving(true)
    try {
      const data = await apiFetch(`/events/${eventId}/microsite/settings`, {
        method: 'PUT', body: JSON.stringify(settings),
      })
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  // ── Speaker CRUD ────────────────────────────────────────────────────────────

  async function saveSpeaker() {
    if (!speakerForm) return
    if (speakerForm.id) {
      const data = await apiFetch(`/events/${eventId}/microsite/speakers/${speakerForm.id}`, {
        method: 'PUT', body: JSON.stringify(speakerForm),
      })
      setSpeakers(prev => prev.map(s => s.id === data.id ? data : s))
    } else {
      const data = await apiFetch(`/events/${eventId}/microsite/speakers`, {
        method: 'POST', body: JSON.stringify(speakerForm),
      })
      setSpeakers(prev => [...prev, data])
    }
    setSpeakerForm(null)
  }

  async function deleteSpeaker(id: string) {
    if (!confirm('Delete speaker?')) return
    await apiFetch(`/events/${eventId}/microsite/speakers/${id}`, { method: 'DELETE' })
    setSpeakers(prev => prev.filter(s => s.id !== id))
  }

  // ── Session CRUD ────────────────────────────────────────────────────────────

  async function saveSession() {
    if (!sessionForm) return
    if (sessionForm.id) {
      const data = await apiFetch(`/events/${eventId}/microsite/sessions/${sessionForm.id}`, {
        method: 'PUT', body: JSON.stringify(sessionForm),
      })
      setSessions(prev => prev.map(s => s.id === data.id ? data : s))
    } else {
      const data = await apiFetch(`/events/${eventId}/microsite/sessions`, {
        method: 'POST', body: JSON.stringify(sessionForm),
      })
      setSessions(prev => [...prev, data])
    }
    setSessionForm(null)
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete session?')) return
    await apiFetch(`/events/${eventId}/microsite/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // ── Sponsor CRUD ────────────────────────────────────────────────────────────

  async function saveSponsor() {
    if (!sponsorForm) return
    if (sponsorForm.id) {
      const data = await apiFetch(`/events/${eventId}/microsite/sponsors/${sponsorForm.id}`, {
        method: 'PUT', body: JSON.stringify(sponsorForm),
      })
      setSponsors(prev => prev.map(s => s.id === data.id ? data : s))
    } else {
      const data = await apiFetch(`/events/${eventId}/microsite/sponsors`, {
        method: 'POST', body: JSON.stringify(sponsorForm),
      })
      setSponsors(prev => [...prev, data])
    }
    setSponsorForm(null)
  }

  async function deleteSponsor(id: string) {
    if (!confirm('Delete sponsor?')) return
    await apiFetch(`/events/${eventId}/microsite/sponsors/${id}`, { method: 'DELETE' })
    setSponsors(prev => prev.filter(s => s.id !== id))
  }

  // ── FAQ CRUD ────────────────────────────────────────────────────────────────

  async function saveFaq() {
    if (!faqForm) return
    if (faqForm.id) {
      const data = await apiFetch(`/events/${eventId}/microsite/faqs/${faqForm.id}`, {
        method: 'PUT', body: JSON.stringify(faqForm),
      })
      setFaqs(prev => prev.map(f => f.id === data.id ? data : f))
    } else {
      const data = await apiFetch(`/events/${eventId}/microsite/faqs`, {
        method: 'POST', body: JSON.stringify(faqForm),
      })
      setFaqs(prev => [...prev, data])
    }
    setFaqForm(null)
  }

  async function deleteFaq(id: string) {
    if (!confirm('Delete FAQ?')) return
    await apiFetch(`/events/${eventId}/microsite/faqs/${id}`, { method: 'DELETE' })
    setFaqs(prev => prev.filter(f => f.id !== id))
  }

  const micrositeUrl = settings.custom_domain
    ? `https://${settings.custom_domain}`
    : settings.slug_override
      ? `https://event.occasionpro.in/${settings.slug_override}`
      : `https://event.occasionpro.in/${eventId}`

  const TABS = [
    { id: 'settings',      label: 'Settings',       icon: Settings, badge: null },
    { id: 'speakers',      label: 'Speakers',        icon: Mic,      badge: speakers.length },
    { id: 'schedule',      label: 'Schedule',        icon: Clock,    badge: sessions.length },
    { id: 'sponsors',      label: 'Sponsors',        icon: Building2, badge: sponsors.length },
    { id: 'faq',           label: 'FAQ',             icon: HelpCircle, badge: faqs.length },
    { id: 'registrations', label: 'Registrations',   icon: Users,    badge: registrations.length },
  ] as const

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-violet-400" />
            Public Microsite
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Speaker profiles, schedule, sponsors, registration & more
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Published status + link */}
          {settings.is_published ? (
            <a
              href={micrositeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Published
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-xs">
              <EyeOff className="w-3.5 h-3.5" />
              Draft
            </span>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(micrositeUrl)}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
            title="Copy URL"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              activeTab === t.id ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.badge !== null && t.badge > 0 && (
              <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading microsite data…
        </div>
      )}

      {/* ── Settings Tab ── */}
      {!loading && activeTab === 'settings' && (
        <div className="space-y-4">
          <Section title="Appearance" icon={ImageIcon}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Theme">
                <select
                  value={settings.theme ?? 'dark'}
                  onChange={e => setSettings(s => ({ ...s, theme: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  {['dark', 'light', 'brand'].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Accent Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.accent_color ?? '#8B5CF6'}
                    onChange={e => setSettings(s => ({ ...s, accent_color: e.target.value }))}
                    className="w-10 h-9 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <Input
                    value={settings.accent_color ?? '#8B5CF6'}
                    onChange={v => setSettings(s => ({ ...s, accent_color: v }))}
                    className="flex-1"
                  />
                </div>
              </Field>
              <Field label="Hero Image URL">
                <Input value={settings.hero_image_url ?? ''} onChange={v => setSettings(s => ({ ...s, hero_image_url: v }))} placeholder="https://…" />
              </Field>
              <Field label="Logo URL">
                <Input value={settings.logo_url ?? ''} onChange={v => setSettings(s => ({ ...s, logo_url: v }))} placeholder="https://…" />
              </Field>
            </div>
          </Section>

          <Section title="Sections" icon={Eye}>
            <div className="grid grid-cols-2 gap-3">
              <Toggle value={!!settings.show_speakers}  onChange={v => setSettings(s => ({ ...s, show_speakers: v }))}  label="Show Speakers" />
              <Toggle value={!!settings.show_schedule}  onChange={v => setSettings(s => ({ ...s, show_schedule: v }))}  label="Show Schedule" />
              <Toggle value={!!settings.show_sponsors}  onChange={v => setSettings(s => ({ ...s, show_sponsors: v }))}  label="Show Sponsors" />
              <Toggle value={!!settings.show_faq}       onChange={v => setSettings(s => ({ ...s, show_faq: v }))}       label="Show FAQ" />
              <Toggle value={!!settings.show_map}       onChange={v => setSettings(s => ({ ...s, show_map: v }))}       label="Show Map" />
              <Toggle value={!!settings.countdown_enabled} onChange={v => setSettings(s => ({ ...s, countdown_enabled: v }))} label="Countdown Timer" />
            </div>
          </Section>

          <Section title="Registration" icon={Users}>
            <div className="space-y-4">
              <Toggle value={!!settings.registration_enabled} onChange={v => setSettings(s => ({ ...s, registration_enabled: v }))} label="Enable Registration" />
              {settings.registration_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Ticket Price (₹ — 0 for free)">
                    <input
                      type="number"
                      value={(settings.registration_fee_paise ?? 0) / 100}
                      onChange={e => setSettings(s => ({ ...s, registration_fee_paise: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                      min={0}
                      className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </Field>
                  <Field label="Max Registrations">
                    <Input
                      type="number"
                      value={String(settings.max_registrations ?? '')}
                      onChange={v => setSettings(s => ({ ...s, max_registrations: v ? parseInt(v) : undefined }))}
                      placeholder="Unlimited"
                    />
                  </Field>
                  <Field label="Registration Deadline">
                    <Input
                      type="datetime-local"
                      value={settings.registration_deadline?.slice(0, 16) ?? ''}
                      onChange={v => setSettings(s => ({ ...s, registration_deadline: v || undefined }))}
                    />
                  </Field>
                  <Field label="Hero CTA Label">
                    <Input value={settings.hero_cta_label ?? 'Register Now'} onChange={v => setSettings(s => ({ ...s, hero_cta_label: v }))} />
                  </Field>
                </div>
              )}
            </div>
          </Section>

          <Section title="Custom Domain & SEO" icon={Link} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Custom Domain">
                <Input value={settings.custom_domain ?? ''} onChange={v => setSettings(s => ({ ...s, custom_domain: v || undefined }))} placeholder="event.yourcompany.com" />
              </Field>
              <Field label="Slug Override">
                <Input value={settings.slug_override ?? ''} onChange={v => setSettings(s => ({ ...s, slug_override: v || undefined }))} placeholder="my-event-2026" />
              </Field>
              <Field label="Meta Title">
                <Input value={settings.meta_title ?? ''} onChange={v => setSettings(s => ({ ...s, meta_title: v }))} />
              </Field>
              <Field label="Meta Description">
                <Input value={settings.meta_description ?? ''} onChange={v => setSettings(s => ({ ...s, meta_description: v }))} />
              </Field>
              <Field label="OG Image URL">
                <Input value={settings.og_image_url ?? ''} onChange={v => setSettings(s => ({ ...s, og_image_url: v }))} placeholder="https://…" />
              </Field>
              <Field label="GA4 Measurement ID">
                <Input value={settings.ga4_measurement_id ?? ''} onChange={v => setSettings(s => ({ ...s, ga4_measurement_id: v }))} placeholder="G-XXXXXXXXXX" />
              </Field>
            </div>
          </Section>

          <Section title="Publish" icon={Globe}>
            <div className="space-y-3">
              <Toggle value={!!settings.is_published} onChange={v => setSettings(s => ({ ...s, is_published: v }))} label="Published (visible to the public)" />
              {settings.is_published && (
                <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400">Your microsite is live at:</p>
                  <a href={micrositeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:underline break-all">
                    {micrositeUrl}
                  </a>
                </div>
              )}
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Speakers Tab ── */}
      {!loading && activeTab === 'speakers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{speakers.length} speaker{speakers.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setSpeakerForm({ is_keynote: false, display_order: speakers.length })}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Speaker
            </button>
          </div>

          {speakers.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
              No speakers yet — add your first speaker
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {speakers.map(s => (
              <div key={s.id} className="border border-border rounded-xl p-4 flex items-start gap-3 bg-surface/30">
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-lg font-semibold">
                    {s.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{s.name}</p>
                    {s.is_keynote && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Keynote</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{[s.title, s.company].filter(Boolean).join(' · ')}</p>
                  {s.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.bio}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setSpeakerForm(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSpeaker(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Speaker form modal */}
          {speakerForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#0f0f0f] border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold">{speakerForm.id ? 'Edit Speaker' : 'Add Speaker'}</h3>
                  <button onClick={() => setSpeakerForm(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name *">
                      <Input value={speakerForm.name ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, name: v }))} />
                    </Field>
                    <Field label="Title">
                      <Input value={speakerForm.title ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, title: v }))} placeholder="CEO at Acme" />
                    </Field>
                    <Field label="Company">
                      <Input value={speakerForm.company ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, company: v }))} />
                    </Field>
                    <Field label="Photo URL">
                      <Input value={speakerForm.photo_url ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, photo_url: v }))} placeholder="https://…" />
                    </Field>
                    <Field label="LinkedIn">
                      <Input value={speakerForm.linkedin_url ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, linkedin_url: v }))} />
                    </Field>
                    <Field label="Twitter">
                      <Input value={speakerForm.twitter_url ?? ''} onChange={v => setSpeakerForm(s => ({ ...s!, twitter_url: v }))} />
                    </Field>
                  </div>
                  <Field label="Bio">
                    <textarea
                      rows={3}
                      value={speakerForm.bio ?? ''}
                      onChange={e => setSpeakerForm(s => ({ ...s!, bio: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                    />
                  </Field>
                  <Toggle value={!!speakerForm.is_keynote} onChange={v => setSpeakerForm(s => ({ ...s!, is_keynote: v }))} label="Keynote speaker" />
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                  <button onClick={() => setSpeakerForm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">Cancel</button>
                  <button onClick={saveSpeaker} className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium">
                    {speakerForm.id ? 'Update' : 'Add'} Speaker
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Schedule Tab ── */}
      {!loading && activeTab === 'schedule' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setSessionForm({ session_type: 'talk', display_order: sessions.length })}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Session
            </button>
          </div>

          {sessions.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
              No sessions yet
            </div>
          )}

          {/* Group by date */}
          {Object.entries(
            sessions.reduce((acc, s) => {
              const k = s.session_date
              if (!acc[k]) acc[k] = []
              acc[k].push(s)
              return acc
            }, {} as Record<string, Session[]>)
          ).sort(([a], [b]) => a.localeCompare(b)).map(([date, ss]) => (
            <div key={date} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {ss.map(s => {
                const spk = speakers.find(sp => sp.id === s.speaker_id)
                return (
                  <div key={s.id} className="border border-border rounded-xl p-3.5 flex items-center gap-3 bg-surface/20">
                    <div className="text-right w-16 shrink-0">
                      <p className="text-xs font-mono text-muted-foreground">{s.start_time}</p>
                      <p className="text-[10px] text-muted-foreground/60">{s.end_time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{s.title}</p>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full capitalize">{s.session_type}</span>
                      </div>
                      {(s.stage || spk) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[s.stage, spk?.name].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setSessionForm(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteSession(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Session form modal */}
          {sessionForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#0f0f0f] border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold">{sessionForm.id ? 'Edit Session' : 'Add Session'}</h3>
                  <button onClick={() => setSessionForm(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <Field label="Title *">
                    <Input value={sessionForm.title ?? ''} onChange={v => setSessionForm(s => ({ ...s!, title: v }))} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type">
                      <select value={sessionForm.session_type ?? 'talk'} onChange={e => setSessionForm(s => ({ ...s!, session_type: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                        {SESSION_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </Field>
                    <Field label="Stage">
                      <Input value={sessionForm.stage ?? ''} onChange={v => setSessionForm(s => ({ ...s!, stage: v }))} placeholder="Main Stage" />
                    </Field>
                    <Field label="Date *">
                      <Input type="date" value={sessionForm.session_date ?? ''} onChange={v => setSessionForm(s => ({ ...s!, session_date: v }))} />
                    </Field>
                    <Field label="Speaker">
                      <select value={sessionForm.speaker_id ?? ''} onChange={e => setSessionForm(s => ({ ...s!, speaker_id: e.target.value || undefined }))}
                        className="w-full bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                        <option value="">No speaker</option>
                        {speakers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Start Time *">
                      <Input type="time" value={sessionForm.start_time ?? ''} onChange={v => setSessionForm(s => ({ ...s!, start_time: v }))} />
                    </Field>
                    <Field label="End Time *">
                      <Input type="time" value={sessionForm.end_time ?? ''} onChange={v => setSessionForm(s => ({ ...s!, end_time: v }))} />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea rows={2} value={sessionForm.description ?? ''} onChange={e => setSessionForm(s => ({ ...s!, description: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none" />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                  <button onClick={() => setSessionForm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">Cancel</button>
                  <button onClick={saveSession} className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium">
                    {sessionForm.id ? 'Update' : 'Add'} Session
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sponsors Tab ── */}
      {!loading && activeTab === 'sponsors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setSponsorForm({ tier: 'silver', display_order: sponsors.length })}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Sponsor
            </button>
          </div>

          {sponsors.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
              No sponsors yet
            </div>
          )}

          {Object.entries(['platinum', 'gold', 'silver', 'bronze', 'community', 'media'].reduce((acc, tier) => {
            const group = sponsors.filter(s => s.tier === tier)
            if (group.length) acc[tier] = group
            return acc
          }, {} as Record<string, Sponsor[]>)).map(([tier, ss]) => {
            const cfg = TIER_CONFIG[tier] ?? { label: tier, icon: Star, color: 'text-zinc-400' }
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-2">
                  <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ss.map(s => (
                    <div key={s.id} className="border border-border rounded-xl p-3 flex items-center gap-3 bg-surface/20">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="w-10 h-10 object-contain shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {s.tagline && <p className="text-xs text-muted-foreground truncate">{s.tagline}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setSponsorForm(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground">
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSponsor(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Sponsor form modal */}
          {sponsorForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#0f0f0f] border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold">{sponsorForm.id ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
                  <button onClick={() => setSponsorForm(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name *">
                      <Input value={sponsorForm.name ?? ''} onChange={v => setSponsorForm(s => ({ ...s!, name: v }))} />
                    </Field>
                    <Field label="Tier">
                      <select value={sponsorForm.tier ?? 'silver'} onChange={e => setSponsorForm(s => ({ ...s!, tier: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                        {Object.keys(TIER_CONFIG).map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </Field>
                    <Field label="Logo URL">
                      <Input value={sponsorForm.logo_url ?? ''} onChange={v => setSponsorForm(s => ({ ...s!, logo_url: v }))} placeholder="https://…" />
                    </Field>
                    <Field label="Website URL">
                      <Input value={sponsorForm.website_url ?? ''} onChange={v => setSponsorForm(s => ({ ...s!, website_url: v }))} placeholder="https://…" />
                    </Field>
                    <Field label="Tagline" className="col-span-2">
                      <Input value={sponsorForm.tagline ?? ''} onChange={v => setSponsorForm(s => ({ ...s!, tagline: v }))} />
                    </Field>
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                  <button onClick={() => setSponsorForm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">Cancel</button>
                  <button onClick={saveSponsor} className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium">
                    {sponsorForm.id ? 'Update' : 'Add'} Sponsor
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FAQ Tab ── */}
      {!loading && activeTab === 'faq' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setFaqForm({ display_order: faqs.length })}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add FAQ
            </button>
          </div>

          {faqs.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
              No FAQs yet
            </div>
          )}

          {faqs.map((f, i) => (
            <div key={f.id} className="border border-border rounded-xl p-4 space-y-1.5 bg-surface/20">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400 flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                <p className="text-sm font-medium flex-1">{f.question}</p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setFaqForm(f)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteFaq(f.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pl-7">{f.answer}</p>
            </div>
          ))}

          {/* FAQ form modal */}
          {faqForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#0f0f0f] border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold">{faqForm.id ? 'Edit FAQ' : 'Add FAQ'}</h3>
                  <button onClick={() => setFaqForm(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <Field label="Question *">
                    <Input value={faqForm.question ?? ''} onChange={v => setFaqForm(f => ({ ...f!, question: v }))} />
                  </Field>
                  <Field label="Answer *">
                    <textarea rows={4} value={faqForm.answer ?? ''} onChange={e => setFaqForm(f => ({ ...f!, answer: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none" />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                  <button onClick={() => setFaqForm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">Cancel</button>
                  <button onClick={saveFaq} className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium">
                    {faqForm.id ? 'Update' : 'Add'} FAQ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Registrations Tab ── */}
      {!loading && activeTab === 'registrations' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: registrations.length, color: 'text-foreground' },
              { label: 'Confirmed', value: registrations.filter(r => r.status === 'confirmed').length, color: 'text-emerald-400' },
              { label: 'Revenue', value: `₹${(registrations.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + (r.amount_paise ?? 0), 0) / 100).toLocaleString('en-IN')}`, color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="border border-border rounded-xl px-4 py-3 bg-surface/30">
                <p className={cn('text-xl font-semibold', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-white/3">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {registrations.map(r => (
                  <tr key={r.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                        r.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        r.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      )}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.amount_paise ? `₹${(r.amount_paise / 100).toLocaleString('en-IN')}` : 'Free'}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
                {registrations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No registrations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
