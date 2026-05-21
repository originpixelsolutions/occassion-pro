'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Save, Link2, Copy, Check, Plus, X,
  Eye, Monitor, Smartphone, Settings2, ArrowLeft, Users, Clock,
  Lock, MessageSquare, Palette, ToggleLeft, ToggleRight, GripVertical,
  Sparkles, Globe, ListChecks, AlertCircle, Trash2, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RsvpForm {
  id: string
  name: string
  event_id: string
  public_slug: string
  is_active: boolean
  deadline?: string
  max_responses?: number
  password_protected: boolean
  moderation_enabled: boolean
  // Sections
  show_attendance: boolean
  show_plus_one: boolean
  show_meal_preference: boolean
  show_dietary: boolean
  show_accommodation: boolean
  show_transport: boolean
  show_tshirt_size: boolean
  show_emergency_contact: boolean
  show_message_to_host: boolean
  // Design
  layout_template: 'elegant' | 'modern' | 'minimal' | 'festive' | 'corporate'
  base_theme: 'light' | 'dark'
  primary_color: string
  background_color: string
  text_color: string
  button_color: string
  button_text_color: string
  font_family: string
  logo_url?: string
  logo_placement: string
  border_radius: 'sharp' | 'default' | 'rounded' | 'pill'
  // Thank-you
  thankyou_message: string
  thankyou_redirect_url?: string
}

interface CustomQuestion {
  id: string
  form_id?: string
  question_text: string
  question_type: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'number'
  options: string[]
  is_required: boolean
  sort_order: number
}

interface EventInfo {
  id: string; name: string
  start_date?: string; end_date?: string
  venue?: { name: string; city?: string }
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: Partial<RsvpForm> = {
  show_attendance: true,
  show_plus_one: true,
  show_meal_preference: true,
  show_dietary: true,
  show_accommodation: false,
  show_transport: false,
  show_tshirt_size: false,
  show_emergency_contact: false,
  show_message_to_host: false,
  layout_template: 'modern',
  base_theme: 'light',
  primary_color: '#6366f1',
  background_color: '#ffffff',
  text_color: '#0f172a',
  button_color: '#6366f1',
  button_text_color: '#ffffff',
  font_family: 'Inter',
  logo_placement: 'top-center',
  border_radius: 'default',
  thankyou_message: 'Thank you for your RSVP! We look forward to seeing you.',
  is_active: true,
  moderation_enabled: false,
  password_protected: false,
}

const FONTS = ['Inter', 'Georgia', 'Playfair Display', 'Montserrat', 'Lato', 'Open Sans', 'Roboto', 'Raleway']
const Q_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelSection({
  title, icon: Icon, children, defaultOpen = false,
}: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 space-y-3 bg-card/50">{children}</div>}
    </div>
  )
}

function ToggleRow({
  label, desc, value, onChange, disabled = false,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5', disabled && 'opacity-50 pointer-events-none')}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors shrink-0',
          value ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
          value ? 'left-5' : 'left-0.5',
        )} />
      </button>
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-muted-foreground w-28 shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-border p-0.5 bg-transparent shrink-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-1 text-xs font-mono" />
      </div>
    </div>
  )
}

// ─── RSVP Preview ─────────────────────────────────────────────────────────────

function RsvpPreview({ form, event, questions }: { form: Partial<RsvpForm>; event?: EventInfo; questions: CustomQuestion[] }) {
  const bg = form.background_color ?? '#ffffff'
  const txt = form.text_color ?? '#0f172a'
  const primary = form.primary_color ?? '#6366f1'
  const btn = form.button_color ?? '#6366f1'
  const btnTxt = form.button_text_color ?? '#ffffff'
  const font = form.font_family ?? 'Inter'
  const br = { sharp: '0', default: '8px', rounded: '12px', pill: '24px' }[form.border_radius ?? 'default']

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '8px 12px',
    border: `1px solid ${primary}40`, borderRadius: br,
    backgroundColor: bg, color: txt, fontFamily: font, fontSize: '13px',
    outline: 'none', marginTop: '4px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: txt, fontFamily: font, marginBottom: '2px',
  }

  return (
    <div style={{ backgroundColor: bg, fontFamily: font, minHeight: '100%', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-block', width: '48px', height: '48px',
          borderRadius: '50%', backgroundColor: `${primary}20`,
          marginBottom: '12px',
        }} />
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: '0 0 6px', fontFamily: font }}>
          {event?.name ?? 'Event Name'}
        </h2>
        {event?.start_date && (
          <p style={{ fontSize: '12px', color: `${txt}90`, margin: 0, fontFamily: font }}>
            {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
        {event?.venue?.name && (
          <p style={{ fontSize: '12px', color: `${txt}90`, margin: '2px 0 0', fontFamily: font }}>
            📍 {event.venue.name}{event.venue.city ? `, ${event.venue.city}` : ''}
          </p>
        )}
      </div>

      {/* Card */}
      <div style={{ backgroundColor: bg, border: `1px solid ${primary}25`, borderRadius: br, padding: '20px', maxWidth: '440px', margin: '0 auto' }}>

        {/* Attendance — always shown */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Will you attend? *</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {['Yes', 'Maybe', 'No'].map(opt => (
              <div key={opt} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px',
                border: `2px solid ${opt === 'Yes' ? primary : `${primary}30`}`,
                borderRadius: br, cursor: 'pointer', fontSize: '13px',
                fontWeight: opt === 'Yes' ? 700 : 400,
                color: opt === 'Yes' ? primary : txt, fontFamily: font,
                backgroundColor: opt === 'Yes' ? `${primary}12` : 'transparent',
              }}>{opt}</div>
            ))}
          </div>
        </div>

        {form.show_plus_one && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Plus One</label>
            <input style={inputStyle} placeholder="Guest name (optional)" readOnly />
          </div>
        )}

        {form.show_meal_preference && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Meal Preference</label>
            <select style={inputStyle}>
              <option>Vegetarian</option>
              <option>Non-Vegetarian</option>
              <option>Vegan</option>
            </select>
          </div>
        )}

        {form.show_dietary && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Dietary Requirements</label>
            <input style={inputStyle} placeholder="Any allergies or dietary needs?" readOnly />
          </div>
        )}

        {form.show_accommodation && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Accommodation</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{ width: '16px', height: '16px', border: `2px solid ${primary}`, borderRadius: '4px' }} />
              <span style={{ fontSize: '13px', color: txt, fontFamily: font }}>I need accommodation</span>
            </div>
          </div>
        )}

        {form.show_transport && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Transport</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{ width: '16px', height: '16px', border: `2px solid ${primary}`, borderRadius: '4px' }} />
              <span style={{ fontSize: '13px', color: txt, fontFamily: font }}>I need transport</span>
            </div>
          </div>
        )}

        {form.show_tshirt_size && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>T-Shirt Size</label>
            <select style={inputStyle}>
              <option>S</option><option>M</option><option>L</option><option>XL</option>
            </select>
          </div>
        )}

        {form.show_emergency_contact && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Emergency Contact</label>
            <input style={inputStyle} placeholder="Name" readOnly />
            <input style={{ ...inputStyle, marginTop: '6px' }} placeholder="Phone" readOnly />
          </div>
        )}

        {form.show_message_to_host && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Message to Host</label>
            <textarea style={{ ...inputStyle, minHeight: '72px', resize: 'none' }} placeholder="Write a message..." readOnly />
          </div>
        )}

        {/* Custom questions preview */}
        {questions.map(q => (
          <div key={q.id} style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>{q.question_text}{q.is_required ? ' *' : ''}</label>
            {q.question_type === 'textarea' ? (
              <textarea style={{ ...inputStyle, minHeight: '64px', resize: 'none' }} readOnly />
            ) : q.question_type === 'dropdown' ? (
              <select style={inputStyle}>
                <option>Select an option</option>
                {q.options.map(o => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input type={q.question_type} style={inputStyle} readOnly />
            )}
          </div>
        ))}

        {/* Submit */}
        <button style={{
          width: '100%', padding: '12px', backgroundColor: btn, color: btnTxt,
          border: 'none', borderRadius: br, fontWeight: 700, fontSize: '14px',
          cursor: 'pointer', fontFamily: font, marginTop: '4px',
        }}>
          Submit RSVP
        </button>
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: '11px', color: `${txt}50`, marginTop: '20px', fontFamily: font }}>
        Powered by OccasionPro
      </p>
    </div>
  )
}

// ─── Custom Questions Editor ──────────────────────────────────────────────────

function QuestionEditor({
  questions, onChange,
}: { questions: CustomQuestion[]; onChange: (q: CustomQuestion[]) => void }) {
  const addQuestion = () => {
    const newQ: CustomQuestion = {
      id: `temp-${Date.now()}`,
      question_text: 'New Question',
      question_type: 'text',
      options: [],
      is_required: false,
      sort_order: questions.length,
    }
    onChange([...questions, newQ])
  }

  const updateQ = (idx: number, patch: Partial<CustomQuestion>) => {
    onChange(questions.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }

  const removeQ = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx))
  }

  const moveQ = (idx: number, dir: -1 | 1) => {
    const arr = [...questions]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    onChange(arr.map((q, i) => ({ ...q, sort_order: i })))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
          No custom questions yet. Add one below.
        </p>
      )}
      {questions.map((q, idx) => (
        <div key={q.id} className="border border-border rounded-xl p-3 space-y-2 bg-background">
          <div className="flex items-center gap-2">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
            <input
              value={q.question_text}
              onChange={e => updateQ(idx, { question_text: e.target.value })}
              className="flex-1 bg-transparent border border-border rounded-lg px-2 py-1 text-sm"
              placeholder="Question text"
            />
            <div className="flex gap-1 shrink-0">
              <button onClick={() => moveQ(idx, -1)} disabled={idx === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveQ(idx, 1)} disabled={idx === questions.length - 1}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronDown className="w-3 h-3" />
              </button>
              <button onClick={() => removeQ(idx)}
                className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={q.question_type}
              onChange={e => updateQ(idx, { question_type: e.target.value as CustomQuestion['question_type'] })}
              className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-xs"
            >
              {Q_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
              <input type="checkbox" checked={q.is_required}
                onChange={e => updateQ(idx, { is_required: e.target.checked })}
                className="accent-primary" />
              Required
            </label>
          </div>
          {(q.question_type === 'dropdown' || q.question_type === 'checkbox') && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Options (one per line):</p>
              <textarea
                value={q.options.join('\n')}
                onChange={e => updateQ(idx, { options: e.target.value.split('\n').filter(Boolean) })}
                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono resize-none min-h-[60px]"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addQuestion}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-primary/40 text-primary rounded-xl text-xs hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Custom Question
      </button>
    </div>
  )
}

// ─── Share Link Panel ─────────────────────────────────────────────────────────

function SharePanel({ form, onClose }: { form: Partial<RsvpForm>; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const slug = form.public_slug ?? '...'
  const rsvpUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/rsvp/${slug}`

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Share RSVP Link
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
          form.is_active
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
        )}>
          <div className={cn('w-2 h-2 rounded-full', form.is_active ? 'bg-green-400' : 'bg-yellow-400')} />
          {form.is_active ? 'Form is live and accepting responses' : 'Form is paused — responses disabled'}
        </div>

        {/* Public URL */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Public RSVP URL</p>
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2">
            <p className="flex-1 text-xs font-mono truncate text-foreground">{rsvpUrl}</p>
            <button onClick={() => copy(rsvpUrl, 'url')}
              className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors text-primary">
              {copied === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* WhatsApp share */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: 'Share on WhatsApp',
              href: `https://wa.me/?text=${encodeURIComponent(`You're invited! RSVP here: ${rsvpUrl}`)}`,
              color: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
            },
            {
              label: 'Copy Link',
              href: null,
              onClick: () => copy(rsvpUrl, 'link2'),
              color: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
            },
          ].map(({ label, href, onClick, color }) =>
            href ? (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className={cn('flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-colors', color)}>
                <Link2 className="w-3.5 h-3.5" /> {label}
              </a>
            ) : (
              <button key={label} onClick={onClick}
                className={cn('flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-colors', color)}>
                {copied === 'link2' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'link2' ? 'Copied!' : label}
              </button>
            )
          )}
        </div>

        {form.deadline && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background border border-border rounded-xl px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            Deadline: {new Date(form.deadline).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RsvpBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { token, tenantId } = useAuth()

  const [form, setForm] = useState<Partial<RsvpForm>>(DEFAULT_FORM)
  const [formId, setFormId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<CustomQuestion[]>([])
  const [event, setEvent] = useState<EventInfo | undefined>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [showShare, setShowShare] = useState(false)
  const [activeTab, setActiveTab] = useState<'builder' | 'responses'>('builder')

  const patch = useCallback((partial: Partial<RsvpForm>) => {
    setForm(prev => ({ ...prev, ...partial }))
    setSaved(false)
  }, [])

  // Load RSVP form + event
  useEffect(() => {
    if (!token || !eventId) return
    const h = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId ?? '' }

    // Load event info
    fetch(`${API}/events/${eventId}`, { headers: h })
      .then(r => r.json()).then(d => setEvent(d)).catch(() => {})

    // Load RSVP forms — get the first one, or create a default
    fetch(`${API}/events/${eventId}/rsvp-forms`, { headers: h })
      .then(r => r.json())
      .then(async (list: any[]) => {
        if (Array.isArray(list) && list.length > 0) {
          const d = list[0]
          const { custom_questions, ...rest } = d
          setForm(prev => ({ ...DEFAULT_FORM, ...rest }))
          setFormId(d.id)
          if (Array.isArray(custom_questions)) setQuestions(custom_questions)
        } else {
          // Auto-create default form
          const res = await fetch(`${API}/events/${eventId}/rsvp-forms`, {
            method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...DEFAULT_FORM, name: 'RSVP Form', event_id: eventId }),
          })
          const d = await res.json()
          if (d?.id) {
            setForm(prev => ({ ...DEFAULT_FORM, ...d }))
            setFormId(d.id)
          }
        }
      })
      .catch(() => {})
  }, [token, tenantId, eventId])

  const save = async () => {
    if (!token) return
    setSaving(true)
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId ?? '' }
    try {
      const url = formId
        ? `${API}/events/${eventId}/rsvp-forms/${formId}`
        : `${API}/events/${eventId}/rsvp-forms`
      const method = formId ? 'PATCH' : 'POST'
      // Send custom_questions inline so the service handles them in one call
      const res = await fetch(url, {
        method, headers: h,
        body: JSON.stringify({
          ...form, event_id: eventId,
          custom_questions: questions.map((q, i) => ({ ...q, sort_order: i })),
        }),
      })
      const data = await res.json()
      if (data?.id) {
        setFormId(data.id)
        setForm(prev => ({ ...prev, public_slug: data.public_slug }))
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Link href={`/events/${eventId}`}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">RSVP Form Builder</h1>
          <p className="text-xs text-muted-foreground truncate">{event?.name ?? '...'}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-background border border-border rounded-xl p-0.5 gap-0.5">
          {(['builder', 'responses'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                activeTab === tab ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground',
              )}>
              {tab}
            </button>
          ))}
        </div>

        {/* Preview toggle */}
        <div className="flex items-center bg-background border border-border rounded-xl p-0.5">
          {([{ m: 'desktop', I: Monitor }, { m: 'mobile', I: Smartphone }] as const).map(({ m, I }) => (
            <button key={m} onClick={() => setPreviewMode(m)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                previewMode === m ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground',
              )}>
              <I className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Active toggle */}
        <button
          onClick={() => patch({ is_active: !form.is_active })}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
            form.is_active
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-muted text-muted-foreground border-border',
          )}
        >
          <div className={cn('w-1.5 h-1.5 rounded-full', form.is_active ? 'bg-green-400' : 'bg-muted-foreground')} />
          {form.is_active ? 'Live' : 'Paused'}
        </button>

        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-xs hover:bg-accent transition-colors">
          <Link2 className="w-3.5 h-3.5" /> Share
        </button>

        <button onClick={save} disabled={saving}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all',
            saved ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-primary text-white hover:bg-primary/90',
          )}>
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <><Check className="w-3.5 h-3.5" /> Saved</>
          ) : (
            <><Save className="w-3.5 h-3.5" /> Save</>
          )}
        </button>
      </div>

      {activeTab === 'responses' ? (
        /* Responses view */
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <ListChecks className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-bold text-lg mb-2">Response Analytics</h2>
              <p className="text-sm text-muted-foreground mb-6">
                View and manage all RSVP submissions for this event.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Total RSVPs', value: '—', color: 'text-primary' },
                  { label: 'Attending', value: '—', color: 'text-green-400' },
                  { label: 'Declined', value: '—', color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-background border border-border rounded-xl p-4">
                    <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Save and share your form to start collecting responses. They'll appear here.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Builder */
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar — controls */}
          <div className="w-80 shrink-0 border-r border-border overflow-y-auto">
            <div className="p-3 space-y-2.5">

              {/* Settings */}
              <PanelSection title="Form Settings" icon={Settings2} defaultOpen>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Form Name</label>
                  <input
                    value={form.name ?? 'RSVP Form'}
                    onChange={e => patch({ name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Deadline</label>
                  <input
                    type="datetime-local"
                    value={form.deadline ? form.deadline.slice(0, 16) : ''}
                    onChange={e => patch({ deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Max Responses</label>
                  <input
                    type="number" min={1}
                    value={form.max_responses ?? ''}
                    onChange={e => patch({ max_responses: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <ToggleRow
                  label="Require Moderation"
                  desc="All RSVPs need admin approval"
                  value={form.moderation_enabled ?? false}
                  onChange={v => patch({ moderation_enabled: v })}
                />
                <ToggleRow
                  label="Password Protected"
                  desc="Guests need a password to access"
                  value={form.password_protected ?? false}
                  onChange={v => patch({ password_protected: v })}
                />
              </PanelSection>

              {/* Sections */}
              <PanelSection title="Form Sections" icon={ToggleLeft} defaultOpen>
                <ToggleRow label="Attendance" desc="Required — always shown" value={true} onChange={() => {}} disabled />
                <ToggleRow label="Plus One" value={form.show_plus_one ?? true} onChange={v => patch({ show_plus_one: v })} />
                <ToggleRow label="Meal Preference" value={form.show_meal_preference ?? true} onChange={v => patch({ show_meal_preference: v })} />
                <ToggleRow label="Dietary Requirements" value={form.show_dietary ?? true} onChange={v => patch({ show_dietary: v })} />
                <ToggleRow label="Accommodation Request" value={form.show_accommodation ?? false} onChange={v => patch({ show_accommodation: v })} />
                <ToggleRow label="Transport Request" value={form.show_transport ?? false} onChange={v => patch({ show_transport: v })} />
                <ToggleRow label="T-Shirt Size" value={form.show_tshirt_size ?? false} onChange={v => patch({ show_tshirt_size: v })} />
                <ToggleRow label="Emergency Contact" value={form.show_emergency_contact ?? false} onChange={v => patch({ show_emergency_contact: v })} />
                <ToggleRow label="Message to Host" value={form.show_message_to_host ?? false} onChange={v => patch({ show_message_to_host: v })} />
              </PanelSection>

              {/* Custom Questions */}
              <PanelSection title="Custom Questions" icon={MessageSquare}>
                <QuestionEditor questions={questions} onChange={setQuestions} />
              </PanelSection>

              {/* Design */}
              <PanelSection title="Design" icon={Palette}>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Layout</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['elegant', 'modern', 'minimal', 'festive', 'corporate'] as const).map(l => (
                      <button key={l} onClick={() => patch({ layout_template: l })}
                        className={cn(
                          'py-1.5 rounded-lg text-xs capitalize transition-colors border',
                          form.layout_template === l
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
                        )}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Theme</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['light', 'dark'] as const).map(t => (
                      <button key={t} onClick={() => patch({ base_theme: t, background_color: t === 'dark' ? '#0f172a' : '#ffffff', text_color: t === 'dark' ? '#f8fafc' : '#0f172a' })}
                        className={cn(
                          'py-1.5 rounded-lg text-xs capitalize transition-colors border',
                          form.base_theme === t
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}>
                        {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorRow label="Primary Color" value={form.primary_color ?? '#6366f1'} onChange={v => patch({ primary_color: v })} />
                <ColorRow label="Background" value={form.background_color ?? '#ffffff'} onChange={v => patch({ background_color: v })} />
                <ColorRow label="Text Color" value={form.text_color ?? '#0f172a'} onChange={v => patch({ text_color: v })} />
                <ColorRow label="Button Color" value={form.button_color ?? '#6366f1'} onChange={v => patch({ button_color: v })} />
                <ColorRow label="Button Text" value={form.button_text_color ?? '#ffffff'} onChange={v => patch({ button_text_color: v })} />

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Font</label>
                  <select value={form.font_family ?? 'Inter'} onChange={e => patch({ font_family: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs">
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Border Radius</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['sharp', 'default', 'rounded', 'pill'] as const).map(r => (
                      <button key={r} onClick={() => patch({ border_radius: r })}
                        className={cn(
                          'py-1 text-xs capitalize border transition-colors',
                          r === 'sharp' ? 'rounded-sm' : r === 'default' ? 'rounded' : r === 'rounded' ? 'rounded-lg' : 'rounded-full',
                          form.border_radius === r
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}>
                        {r === 'default' ? 'Def.' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </PanelSection>

              {/* Thank-you page */}
              <PanelSection title="Thank-You Page" icon={Sparkles}>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Success Message</label>
                  <textarea
                    value={form.thankyou_message ?? ''}
                    onChange={e => patch({ thankyou_message: e.target.value })}
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
                    placeholder="Thank you for your RSVP!"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Redirect URL (optional)</label>
                  <input
                    value={form.thankyou_redirect_url ?? ''}
                    onChange={e => patch({ thankyou_redirect_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </PanelSection>

            </div>
          </div>

          {/* Right — preview */}
          <div className="flex-1 overflow-auto bg-[#0a0a0f] flex flex-col items-center py-8 px-4">
            <div className="text-xs text-zinc-500 mb-4 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Live Preview — {previewMode === 'desktop' ? '600px' : '375px'} wide
            </div>
            <div
              className="shadow-2xl shadow-black/60 rounded-2xl overflow-hidden"
              style={{ width: previewMode === 'desktop' ? 600 : 375, minHeight: 500 }}
            >
              <RsvpPreview form={form} event={event} questions={questions} />
            </div>
          </div>
        </div>
      )}

      {showShare && <SharePanel form={form} onClose={() => setShowShare(false)} />}
    </div>
  )
}
