'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Globe,
  Plus,
  Eye,
  EyeOff,
  Settings,
  Trash2,
  GripVertical,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Image,
  AlignLeft,
  Calendar,
  Users,
  Star,
  HelpCircle,
  MapPin,
  Timer,
  UserPlus,
  Code,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionType =
  | 'hero' | 'about' | 'schedule' | 'speakers' | 'sponsors'
  | 'faq' | 'gallery' | 'map' | 'countdown' | 'registration' | 'custom_html'

interface WebsiteSection {
  id: string
  section_type: SectionType
  title: string
  is_visible: boolean
  sort_order: number
  content: Record<string, any>
}

interface EventWebsite {
  id: string
  slug: string
  title: string | null
  description: string | null
  custom_domain: string | null
  is_published: boolean
  published_at: string | null
  ga_tracking_id: string | null
  fb_pixel_id: string | null
  primary_color: string
  font_family: string
  dark_mode: boolean
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  event_website_sections: WebsiteSection[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_TYPES: { type: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'hero',         label: 'Hero Banner',    icon: <Image className="w-4 h-4" />,     description: 'Full-width hero with headline and CTA' },
  { type: 'about',        label: 'About',          icon: <AlignLeft className="w-4 h-4" />, description: 'Event description with image' },
  { type: 'schedule',     label: 'Schedule',       icon: <Calendar className="w-4 h-4" />,  description: 'Day-by-day agenda' },
  { type: 'speakers',     label: 'Speakers',       icon: <Users className="w-4 h-4" />,     description: 'Speaker cards with bios' },
  { type: 'sponsors',     label: 'Sponsors',       icon: <Star className="w-4 h-4" />,      description: 'Sponsor logos by tier' },
  { type: 'faq',          label: 'FAQ',            icon: <HelpCircle className="w-4 h-4" />,description: 'Accordion Q&A' },
  { type: 'gallery',      label: 'Gallery',        icon: <Image className="w-4 h-4" />,     description: 'Photo grid or carousel' },
  { type: 'map',          label: 'Map / Venue',    icon: <MapPin className="w-4 h-4" />,    description: 'Embedded map with address' },
  { type: 'countdown',    label: 'Countdown',      icon: <Timer className="w-4 h-4" />,     description: 'Live countdown timer' },
  { type: 'registration', label: 'Registration',   icon: <UserPlus className="w-4 h-4" />,  description: 'Registration CTA button' },
  { type: 'custom_html',  label: 'Custom HTML',    icon: <Code className="w-4 h-4" />,      description: 'Paste raw HTML + CSS' },
]

const SECTION_COLOR: Record<SectionType, string> = {
  hero: 'from-violet-500/20 to-violet-500/5',
  about: 'from-blue-500/20 to-blue-500/5',
  schedule: 'from-emerald-500/20 to-emerald-500/5',
  speakers: 'from-amber-500/20 to-amber-500/5',
  sponsors: 'from-yellow-500/20 to-yellow-500/5',
  faq: 'from-cyan-500/20 to-cyan-500/5',
  gallery: 'from-pink-500/20 to-pink-500/5',
  map: 'from-teal-500/20 to-teal-500/5',
  countdown: 'from-orange-500/20 to-orange-500/5',
  registration: 'from-green-500/20 to-green-500/5',
  custom_html: 'from-zinc-500/20 to-zinc-500/5',
}

// ─── Section content editors ──────────────────────────────────────────────────

function HeroEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Headline">
        <input type="text" value={content.headline ?? ''} onChange={e => onChange({ ...content, headline: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
      <Field label="Sub-headline">
        <input type="text" value={content.subheadline ?? ''} onChange={e => onChange({ ...content, subheadline: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
      <Field label="Background Image URL">
        <input type="url" value={content.background_image_url ?? ''} onChange={e => onChange({ ...content, background_image_url: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="https://..." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA Button Label">
          <input type="text" value={content.cta_label ?? ''} onChange={e => onChange({ ...content, cta_label: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
        </Field>
        <Field label="CTA URL">
          <input type="url" value={content.cta_url ?? ''} onChange={e => onChange({ ...content, cta_url: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="https://..." />
        </Field>
      </div>
      <Field label={`Overlay Opacity: ${Math.round((content.overlay_opacity ?? 0.5) * 100)}%`}>
        <input type="range" min="0" max="1" step="0.05" value={content.overlay_opacity ?? 0.5}
          onChange={e => onChange({ ...content, overlay_opacity: parseFloat(e.target.value) })}
          className="w-full accent-violet-500" />
      </Field>
    </div>
  )
}

function AboutEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Body (HTML allowed)">
        <textarea rows={6} value={content.body_html ?? ''} onChange={e => onChange({ ...content, body_html: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono resize-none" />
      </Field>
      <Field label="Image URL">
        <input type="url" value={content.image_url ?? ''} onChange={e => onChange({ ...content, image_url: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="https://..." />
      </Field>
      <Field label="Layout">
        <select value={content.layout ?? 'centered'} onChange={e => onChange({ ...content, layout: e.target.value })}
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm">
          <option value="centered">Centered</option>
          <option value="text_left">Text Left</option>
          <option value="text_right">Text Right</option>
        </select>
      </Field>
    </div>
  )
}

function FaqEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const items: { question: string; answer: string }[] = content.items ?? []

  function update(i: number, field: 'question' | 'answer', val: string) {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: val } : item)
    onChange({ ...content, items: next })
  }
  function add() { onChange({ ...content, items: [...items, { question: '', answer: '' }] }) }
  function remove(i: number) { onChange({ ...content, items: items.filter((_, idx) => idx !== i) }) }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Question {i + 1}</span>
            <button onClick={() => remove(i)} className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500"><X className="w-3.5 h-3.5" /></button>
          </div>
          <input type="text" value={item.question} onChange={e => update(i, 'question', e.target.value)} placeholder="Question"
            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-sm" />
          <textarea rows={2} value={item.answer} onChange={e => update(i, 'answer', e.target.value)} placeholder="Answer"
            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-sm resize-none" />
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
        <Plus className="w-3.5 h-3.5" />Add FAQ
      </button>
    </div>
  )
}

function CountdownEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Target Date & Time">
        <input type="datetime-local" value={content.target_date ?? ''} onChange={e => onChange({ ...content, target_date: e.target.value })}
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
      <Field label="Message Before Event">
        <input type="text" value={content.message_before ?? ''} onChange={e => onChange({ ...content, message_before: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
      <Field label="Message After Event">
        <input type="text" value={content.message_after ?? ''} onChange={e => onChange({ ...content, message_after: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={content.show_seconds ?? true} onChange={e => onChange({ ...content, show_seconds: e.target.checked })}
          className="rounded accent-violet-500" />
        Show seconds
      </label>
    </div>
  )
}

function MapEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Venue Address">
        <input type="text" value={content.address ?? ''} onChange={e => onChange({ ...content, address: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" placeholder="123 Event St, City" />
      </Field>
      <Field label="Google Maps Embed URL">
        <input type="url" value={content.embed_url ?? ''} onChange={e => onChange({ ...content, embed_url: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="https://maps.google.com/maps?..." />
      </Field>
      <Field label="Map Height (px)">
        <input type="number" min={200} max={800} value={content.iframe_height ?? 400} onChange={e => onChange({ ...content, iframe_height: parseInt(e.target.value) })}
          className="w-32 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
      </Field>
    </div>
  )
}

function CustomHtmlEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <Field label="HTML">
        <textarea rows={8} value={content.html ?? ''} onChange={e => onChange({ ...content, html: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-400 text-xs font-mono resize-none" placeholder="<div>Your HTML here</div>" />
      </Field>
      <Field label="Custom CSS">
        <textarea rows={4} value={content.css ?? ''} onChange={e => onChange({ ...content, css: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-blue-400 text-xs font-mono resize-none" placeholder=".my-class { color: red; }" />
      </Field>
    </div>
  )
}

function GenericJsonEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const [raw, setRaw] = useState(JSON.stringify(content, null, 2))
  const [jsonErr, setJsonErr] = useState('')

  function handleChange(val: string) {
    setRaw(val)
    try {
      const parsed = JSON.parse(val)
      setJsonErr('')
      onChange(parsed)
    } catch {
      setJsonErr('Invalid JSON')
    }
  }

  return (
    <div>
      {jsonErr && <p className="text-xs text-red-400 mb-1">{jsonErr}</p>}
      <textarea rows={10} value={raw} onChange={e => handleChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono resize-y" />
    </div>
  )
}

function SectionContentEditor({ section, onChange }: { section: WebsiteSection; onChange: (c: any) => void }) {
  switch (section.section_type) {
    case 'hero':        return <HeroEditor content={section.content} onChange={onChange} />
    case 'about':       return <AboutEditor content={section.content} onChange={onChange} />
    case 'faq':         return <FaqEditor content={section.content} onChange={onChange} />
    case 'countdown':   return <CountdownEditor content={section.content} onChange={onChange} />
    case 'map':         return <MapEditor content={section.content} onChange={onChange} />
    case 'custom_html': return <CustomHtmlEditor content={section.content} onChange={onChange} />
    default:            return <GenericJsonEditor content={section.content} onChange={onChange} />
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
}: {
  section: WebsiteSection
  index: number
  total: number
  onUpdate: (id: string, content: any) => void
  onDelete: (id: string) => void
  onMoveUp: (i: number) => void
  onMoveDown: (i: number) => void
  onToggleVisible: (id: string, visible: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const typeInfo = SECTION_TYPES.find(s => s.type === section.section_type)

  return (
    <div className={`rounded-xl border border-zinc-800 overflow-hidden transition-all ${!section.is_visible ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${SECTION_COLOR[section.section_type]} cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); onMoveUp(index) }}
            disabled={index === 0}
            className="p-0.5 rounded hover:bg-white/10 text-zinc-400 disabled:opacity-20 transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMoveDown(index) }}
            disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-white/10 text-zinc-400 disabled:opacity-20 transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="text-zinc-400">{typeInfo?.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{section.title || typeInfo?.label}</p>
          <p className="text-xs text-zinc-500">{typeInfo?.description}</p>
        </div>

        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleVisible(section.id, !section.is_visible)}
            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${section.is_visible ? 'text-zinc-300' : 'text-zinc-600'}`}
            title={section.is_visible ? 'Hide section' : 'Show section'}
          >
            {section.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(section.id)}
            className="p-1.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded hover:bg-white/10 text-zinc-400 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Editor */}
      {expanded && (
        <div className="p-4 bg-zinc-900 border-t border-zinc-800">
          <SectionContentEditor
            section={section}
            onChange={content => onUpdate(section.id, content)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Add Section Picker ───────────────────────────────────────────────────────

function AddSectionPicker({ onAdd }: { onAdd: (type: SectionType) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-zinc-700 hover:border-violet-500/50 text-zinc-500 hover:text-violet-400 text-sm font-medium transition-all justify-center"
      >
        <Plus className="w-4 h-4" />
        Add Section
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-2 left-0 right-0 p-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl grid grid-cols-2 gap-1.5">
            {SECTION_TYPES.map(s => (
              <button
                key={s.type}
                onClick={() => { onAdd(s.type); setOpen(false) }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors group"
              >
                <div className="text-zinc-500 group-hover:text-violet-400 transition-colors">{s.icon}</div>
                <div>
                  <p className="text-xs font-medium text-white">{s.label}</p>
                  <p className="text-xs text-zinc-600">{s.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  website,
  onSave,
}: {
  website: EventWebsite
  onSave: (updates: Partial<EventWebsite>) => void
}) {
  const [form, setForm] = useState({
    slug: website.slug,
    title: website.title ?? '',
    description: website.description ?? '',
    primary_color: website.primary_color,
    font_family: website.font_family,
    dark_mode: website.dark_mode,
    seo_title: website.seo_title ?? '',
    seo_description: website.seo_description ?? '',
    og_image_url: website.og_image_url ?? '',
    ga_tracking_id: website.ga_tracking_id ?? '',
    fb_pixel_id: website.fb_pixel_id ?? '',
    custom_domain: website.custom_domain ?? '',
  })

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">URL & Domain</h3>
        <Field label="Slug (event.occasionpro.in/{slug})">
          <input type="text" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" />
        </Field>
        <Field label="Custom Domain (optional)">
          <input type="text" value={form.custom_domain} onChange={e => setForm(p => ({ ...p, custom_domain: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="events.yourdomain.com" />
        </Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Appearance</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary Color">
            <div className="flex items-center gap-2">
              <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                className="w-10 h-9 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer" />
              <input type="text" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" />
            </div>
          </Field>
          <Field label="Font">
            <select value={form.font_family} onChange={e => setForm(p => ({ ...p, font_family: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm">
              {['Inter', 'Playfair Display', 'Roboto', 'Poppins', 'Lato', 'Montserrat'].map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={form.dark_mode} onChange={e => setForm(p => ({ ...p, dark_mode: e.target.checked }))}
            className="rounded accent-violet-500" />
          Dark mode
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">SEO</h3>
        <Field label="Page Title">
          <input type="text" value={form.seo_title} onChange={e => setForm(p => ({ ...p, seo_title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm" />
        </Field>
        <Field label="Meta Description">
          <textarea rows={2} value={form.seo_description} onChange={e => setForm(p => ({ ...p, seo_description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm resize-none" />
        </Field>
        <Field label="OG Image URL">
          <input type="url" value={form.og_image_url} onChange={e => setForm(p => ({ ...p, og_image_url: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="https://..." />
        </Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Integrations</h3>
        <Field label="Google Analytics 4 Measurement ID">
          <input type="text" value={form.ga_tracking_id} onChange={e => setForm(p => ({ ...p, ga_tracking_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" placeholder="G-XXXXXXXXXX" />
        </Field>
        <Field label="Facebook Pixel ID">
          <input type="text" value={form.fb_pixel_id} onChange={e => setForm(p => ({ ...p, fb_pixel_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono" />
        </Field>
      </div>

      <button
        onClick={() => onSave(form)}
        className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        Save Settings
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PanelMode = 'sections' | 'settings'

export default function WebsiteBuilderPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const api = useApi()

  const [website, setWebsite] = useState<EventWebsite | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<PanelMode>('sections')
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/v1/website-builder/events/${eventId}`)
      setWebsite(data)
    } catch {
      setWebsite(null)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  // Auto-suggest slug from eventId when creating
  useEffect(() => {
    if (showCreateForm && !newSlug) {
      setNewSlug(`event-${eventId.slice(0, 8)}`)
    }
  }, [showCreateForm])

  async function createWebsite() {
    if (!newSlug.trim()) return
    setCreating(true)
    setError('')
    try {
      const w = await api.post(`/api/v1/website-builder/events/${eventId}`, { slug: newSlug.trim() })
      setWebsite(w)
      setShowCreateForm(false)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create website')
    } finally {
      setCreating(false)
    }
  }

  async function handleAddSection(type: SectionType) {
    if (!website) return
    try {
      const section = await api.post(`/api/v1/website-builder/websites/${website.id}/sections`, {
        section_type: type,
      })
      setWebsite(w => w ? { ...w, event_website_sections: [...w.event_website_sections, section] } : w)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add section')
    }
  }

  function scheduleAutoSave(sectionId: string, content: any) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await api.patch(`/api/v1/website-builder/sections/${sectionId}`, { content })
        setSavedMsg('Saved')
        setTimeout(() => setSavedMsg(''), 2000)
      } catch {
        setSavedMsg('Save failed')
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  function handleUpdateSection(id: string, content: any) {
    setWebsite(w => {
      if (!w) return w
      return {
        ...w,
        event_website_sections: w.event_website_sections.map(s =>
          s.id === id ? { ...s, content } : s
        ),
      }
    })
    scheduleAutoSave(id, content)
  }

  async function handleDeleteSection(id: string) {
    if (!confirm('Remove this section?')) return
    await api.delete(`/api/v1/website-builder/sections/${id}`)
    setWebsite(w => w ? { ...w, event_website_sections: w.event_website_sections.filter(s => s.id !== id) } : w)
  }

  async function handleToggleVisible(id: string, visible: boolean) {
    await api.patch(`/api/v1/website-builder/sections/${id}`, { is_visible: visible })
    setWebsite(w => w ? {
      ...w,
      event_website_sections: w.event_website_sections.map(s => s.id === id ? { ...s, is_visible: visible } : s),
    } : w)
  }

  async function handleMove(index: number, dir: 'up' | 'down') {
    if (!website) return
    const sections = [...website.event_website_sections]
    const swapIdx = dir === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return
    ;[sections[index], sections[swapIdx]] = [sections[swapIdx], sections[index]]
    setWebsite(w => w ? { ...w, event_website_sections: sections } : w)
    // Persist reorder
    await api.post(`/api/v1/website-builder/websites/${website.id}/sections/reorder`, {
      section_ids: sections.map(s => s.id),
    })
  }

  async function handlePublish() {
    if (!website) return
    setPublishing(true)
    try {
      const updated = website.is_published
        ? await api.post(`/api/v1/website-builder/websites/${website.id}/unpublish`, {})
        : await api.post(`/api/v1/website-builder/websites/${website.id}/publish`, {})
      setWebsite(w => w ? { ...w, is_published: updated.is_published } : w)
    } catch (e: any) {
      setError(e?.message ?? 'Failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleSaveSettings(updates: any) {
    if (!website) return
    setSaving(true)
    try {
      const updated = await api.patch(`/api/v1/website-builder/websites/${website.id}`, updates)
      setWebsite(w => w ? { ...w, ...updated } : w)
      setSavedMsg('Settings saved')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (e: any) {
      setError(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = website ? `https://event.occasionpro.in/${website.slug}` : ''
  const sections = website?.event_website_sections ?? []

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    )
  }

  // No website yet — create prompt
  if (!website) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Globe className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Create your event website</h2>
          <p className="text-sm text-zinc-500 mb-6">Build a custom landing page for your event with drag-drop sections, published to a shareable URL.</p>

          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Website
            </button>
          ) : (
            <div className="text-left space-y-3">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <Field label="Website Slug">
                <div className="flex items-center rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
                  <span className="px-3 py-2.5 text-xs text-zinc-500 bg-zinc-800/60 border-r border-zinc-700 shrink-0">event.occasionpro.in/</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-event"
                    className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm font-mono outline-none"
                  />
                </div>
              </Field>
              <div className="flex gap-2">
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors">
                  Cancel
                </button>
                <button
                  onClick={createWebsite}
                  disabled={creating || !newSlug.trim()}
                  className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create Website'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-400" />
          <span className="font-medium text-sm text-white">Website Builder</span>
        </div>

        {/* URL display */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 flex-1 max-w-sm">
          <span className="text-xs text-zinc-400 font-mono truncate">{publicUrl}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(publicUrl) }}
            className="shrink-0 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {(saving || savedMsg) && (
            <span className={`text-xs ${savedMsg === 'Save failed' ? 'text-red-400' : 'text-emerald-400'} flex items-center gap-1`}>
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              {saving ? 'Saving…' : savedMsg}
            </span>
          )}

          {/* Tab switcher */}
          <div className="flex items-center rounded-lg bg-zinc-800 border border-zinc-700 p-0.5">
            {([
              { id: 'sections', icon: <Layers className="w-3.5 h-3.5" />, label: 'Sections' },
              { id: 'settings', icon: <Settings className="w-3.5 h-3.5" />, label: 'Settings' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setPanel(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  panel === t.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              website.is_published
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {website.is_published ? (
              <><Check className="w-3.5 h-3.5" />Published</>
            ) : (
              <><Globe className="w-3.5 h-3.5" />Publish</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        {panel === 'sections' ? (
          <div className="space-y-3">
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                <Layers className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm mb-2">No sections yet</p>
                <p className="text-xs text-zinc-700">Add your first section below</p>
              </div>
            ) : (
              sections.map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  total={sections.length}
                  onUpdate={handleUpdateSection}
                  onDelete={handleDeleteSection}
                  onMoveUp={(idx) => handleMove(idx, 'up')}
                  onMoveDown={(idx) => handleMove(idx, 'down')}
                  onToggleVisible={handleToggleVisible}
                />
              ))
            )}
            <AddSectionPicker onAdd={handleAddSection} />
          </div>
        ) : (
          <SettingsPanel website={website} onSave={handleSaveSettings} />
        )}
      </div>
    </div>
  )
}
