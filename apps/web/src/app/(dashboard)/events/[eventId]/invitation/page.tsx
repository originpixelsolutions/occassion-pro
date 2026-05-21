'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette, Type, Sparkles, Music, Image, Send, Eye, Globe,
  Users, Link2, ChevronLeft, Save, Zap, Check, X,
  MessageSquare, Phone, Mail, Filter, RefreshCw, BarChart3,
  Play, Pause, Loader2, Copy, ExternalLink, Settings
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvitationTemplate {
  id: string
  name: string
  theme_slug: string
  thumbnail_url?: string
  config: ThemeConfig
}

interface ThemeConfig {
  background: { type: 'gradient' | 'solid' | 'image'; value: string }
  primaryColor: string
  accentColor: string
  textColor: string
  fontHeading: string
  fontBody: string
  animationStyle: 'elegant' | 'playful' | 'minimal' | 'vibrant'
  animationSpeed: 'slow' | 'medium' | 'fast'
  decorativeElements: string[]
  musicEnabled: boolean
  musicUrl?: string
}

interface CustomConfig {
  eventTitleOverride?: string
  hostNames?: string
  rsvpDeadline?: string
  customMessageTemplate?: string
  coverImageUrl?: string
  primaryColor?: string
  accentColor?: string
  textColor?: string
  backgroundOverride?: string
  fontHeadingOverride?: string
  animationSpeedOverride?: string
  musicEnabled?: boolean
  musicUrl?: string
}

interface DeliveryStats {
  total_sent: number
  delivered: number
  opened: number
  rsvp_responded: number
  delivery_rate: number
  open_rate: number
  rsvp_rate: number
}

// ─── Theme visuals for the selector ─────────────────────────────────────────

const THEME_VISUALS: Record<string, { bg: string; name: string; emoji: string }> = {
  'royal-gold': { bg: 'linear-gradient(135deg,#1a0a00,#2d1400,#1a0a00)', name: 'Royal Gold', emoji: '👑' },
  'minimal-white': { bg: 'linear-gradient(135deg,#fafafa,#f0f0f0)', name: 'Minimal White', emoji: '🤍' },
  'floral-pink': { bg: 'linear-gradient(160deg,#fce4ec,#f8bbd0,#f48fb1)', name: 'Floral Pink', emoji: '🌸' },
  'dark-luxury': { bg: 'linear-gradient(180deg,#0a0a0a,#1a1a2e,#0a0a0a)', name: 'Dark Luxury', emoji: '💎' },
  'pastel-dream': { bg: 'linear-gradient(135deg,#e0f7fa,#fce4ec,#f3e5f5)', name: 'Pastel Dream', emoji: '🌈' },
  'vibrant-festival': { bg: 'linear-gradient(135deg,#ff6b35,#f7c59f,#004e89)', name: 'Vibrant Festival', emoji: '🎉' },
  'corporate-blue': { bg: 'linear-gradient(160deg,#0d1b2a,#1b2838,#162032)', name: 'Corporate Blue', emoji: '💼' },
  'rustic-wood': { bg: 'linear-gradient(180deg,#3e1c00,#6d3a1f,#4e2400)', name: 'Rustic Wood', emoji: '🪵' },
  'starry-night': { bg: 'linear-gradient(180deg,#0a0520,#1a0845,#0a0520)', name: 'Starry Night', emoji: '✨' },
  'neon-party': { bg: 'linear-gradient(135deg,#0d0d0d,#1a0030,#0d0d0d)', name: 'Neon Party', emoji: '🎆' },
}

const TABS = [
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'content', label: 'Content', icon: Type },
  { id: 'design', label: 'Design', icon: Image },
  { id: 'animation', label: 'Animate', icon: Sparkles },
  { id: 'music', label: 'Music', icon: Music },
] as const

type TabId = typeof TABS[number]['id']

// ─── Field helper ────────────────────────────────────────────────────────────

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/60 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', ...rest }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
      {...rest}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors resize-none"
    />
  )
}

// ─── Send Modal ──────────────────────────────────────────────────────────────

function SendModal({
  eventId,
  onClose,
}: {
  eventId: string
  onClose: () => void
}) {
  const [channels, setChannels] = useState({ whatsapp: true, sms: false, email: true })
  const [guestFilter, setGuestFilter] = useState<'all' | 'not_sent'>('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const toggleChannel = (ch: keyof typeof channels) =>
    setChannels(prev => ({ ...prev, [ch]: !prev[ch] }))

  async function handleSend() {
    setSending(true)
    try {
      const selectedChannels = Object.entries(channels)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'}/invitations/events/${eventId}/invitation/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guestFilter, channels: selectedChannels }),
        }
      )
      const data = await res.json()
      setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 })
    } catch {
      setResult({ sent: 0, failed: 1 })
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold text-white mb-1">Send Invitations</h2>
        <p className="text-sm text-white/50 mb-6">Choose channels and guest scope</p>

        {!result ? (
          <>
            {/* Channels */}
            <div className="space-y-3 mb-6">
              <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Channels</p>
              {[
                { key: 'whatsapp', icon: MessageSquare, label: 'WhatsApp', color: 'text-green-400' },
                { key: 'sms', icon: Phone, label: 'SMS', color: 'text-blue-400' },
                { key: 'email', icon: Mail, label: 'Email', color: 'text-purple-400' },
              ].map(({ key, icon: Icon, label, color }) => (
                <button
                  key={key}
                  onClick={() => toggleChannel(key as keyof typeof channels)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    channels[key as keyof typeof channels]
                      ? 'border-white/30 bg-white/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <Icon size={16} className={channels[key as keyof typeof channels] ? color : 'text-white/30'} />
                  <span className={`text-sm flex-1 text-left ${channels[key as keyof typeof channels] ? 'text-white' : 'text-white/40'}`}>
                    {label}
                  </span>
                  {channels[key as keyof typeof channels] && (
                    <Check size={14} className="text-white/60" />
                  )}
                </button>
              ))}
            </div>

            {/* Guest filter */}
            <div className="space-y-2 mb-6">
              <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Guest Scope</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All Guests' },
                  { value: 'not_sent', label: 'Not Yet Sent' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGuestFilter(opt.value as 'all' | 'not_sent')}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                      guestFilter === opt.value
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !Object.values(channels).some(Boolean)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending...' : 'Send Now'}
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-400" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">
              {result.sent} Invitations Sent!
            </p>
            {result.failed > 0 && (
              <p className="text-red-400 text-sm">{result.failed} failed</p>
            )}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export default function InvitationBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabId>('theme')
  const [templates, setTemplates] = useState<InvitationTemplate[]>([])
  const [selectedTheme, setSelectedTheme] = useState('royal-gold')
  const [customConfig, setCustomConfig] = useState<CustomConfig>({})
  const [invitationId, setInvitationId] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [stats, setStats] = useState<DeliveryStats | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generatingLinks, setGeneratingLinks] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)

  const previewRef = useRef<HTMLIFrameElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

  // ── Load existing invitation ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [templRes, invRes, statsRes] = await Promise.all([
          fetch(`${API}/invitations/templates`, { credentials: 'include' }),
          fetch(`${API}/invitations/events/${eventId}/invitation`, { credentials: 'include' }),
          fetch(`${API}/invitations/events/${eventId}/invitation/stats`, { credentials: 'include' }),
        ])
        if (templRes.ok) setTemplates(await templRes.json())
        if (invRes.ok) {
          const inv = await invRes.json()
          if (inv) {
            setInvitationId(inv.id)
            setSelectedTheme(inv.template?.theme_slug ?? 'royal-gold')
            setCustomConfig(inv.custom_config ?? {})
            setIsPublished(inv.is_published ?? false)
            if (inv.short_link?.code) {
              setPublicUrl(`${window.location.origin}/i/${inv.short_link.code}`)
            }
          }
        }
        if (statsRes.ok) setStats(await statsRes.json())
      } catch {}
    }
    load()
  }, [eventId])

  // ── Debounced preview update ──────────────────────────────────────────────
  const updatePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!previewRef.current) return
      const configStr = encodeURIComponent(JSON.stringify(customConfig))
      previewRef.current.src = `/i/preview?theme=${selectedTheme}&config=${configStr}&guest=Preview+Guest`
    }, 400)
  }, [selectedTheme, customConfig])

  useEffect(() => { updatePreview() }, [updatePreview])

  // ── Patch config ──────────────────────────────────────────────────────────
  const patch = (updates: Partial<CustomConfig>) =>
    setCustomConfig(prev => ({ ...prev, ...updates }))

  // ── Save draft ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`${API}/invitations/events/${eventId}/invitation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ themeSlug: selectedTheme, customConfig }),
      })
      if (res.ok) {
        const data = await res.json()
        setInvitationId(data.id)
        setSavedAt(new Date())
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!invitationId) { await handleSave() }
    setPublishing(true)
    try {
      const res = await fetch(`${API}/invitations/events/${eventId}/invitation/publish`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setIsPublished(true)
        if (data.short_link?.code) {
          setPublicUrl(`${window.location.origin}/i/${data.short_link.code}`)
        }
      }
    } finally {
      setPublishing(false)
    }
  }

  // ── Generate guest links ──────────────────────────────────────────────────
  async function handleGenerateLinks() {
    setGeneratingLinks(true)
    try {
      await fetch(`${API}/invitations/events/${eventId}/invitation/generate-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guestIds: 'all' }),
      })
    } finally {
      setGeneratingLinks(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const pctFmt = (n?: number) => n != null ? `${Math.round(n)}%` : '—'

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/8 bg-[#0d0d0d] shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">Invitation Builder</h1>
          {savedAt && (
            <p className="text-[11px] text-white/30">
              Saved {savedAt.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <BarChart3 size={13} className="text-white/40" />
              <span className="text-white/40">Delivery</span>
              <span className="text-white font-medium">{pctFmt(stats.delivery_rate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-white/40" />
              <span className="text-white/40">Opens</span>
              <span className="text-white font-medium">{pctFmt(stats.open_rate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-white/40" />
              <span className="text-white/40">RSVPs</span>
              <span className="text-white font-medium">{pctFmt(stats.rsvp_rate)}</span>
            </div>
          </div>
        )}

        {/* Published badge / public URL */}
        {isPublished && publicUrl && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
              <Globe size={11} />
              Live
            </span>
            <button
              onClick={() => { navigator.clipboard?.writeText(publicUrl) }}
              className="text-white/40 hover:text-white transition-colors"
              title="Copy link"
            >
              <Copy size={14} />
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors">
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ── */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-white/8 bg-[#0d0d0d]">

          {/* Tabs */}
          <div className="flex border-b border-white/8 shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors border-b-2 ${
                    active
                      ? 'border-white text-white'
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >

                {/* ── THEME TAB ── */}
                {activeTab === 'theme' && (
                  <div>
                    <p className="text-xs text-white/40 mb-3">Choose a base theme for your invitation</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(THEME_VISUALS).map(([slug, vis]) => (
                        <button
                          key={slug}
                          onClick={() => setSelectedTheme(slug)}
                          className={`relative rounded-xl overflow-hidden h-24 border-2 transition-all ${
                            selectedTheme === slug
                              ? 'border-white shadow-lg shadow-white/10'
                              : 'border-transparent hover:border-white/30'
                          }`}
                          style={{ background: vis.bg }}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <span className="text-xl">{vis.emoji}</span>
                            <span className="text-[11px] font-medium text-white drop-shadow-md">
                              {vis.name}
                            </span>
                          </div>
                          {selectedTheme === slug && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                              <Check size={10} className="text-black" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CONTENT TAB ── */}
                {activeTab === 'content' && (
                  <div className="space-y-4">
                    <Field label="Event Title Override" hint="Leave blank to use the event's original title">
                      <Input
                        value={customConfig.eventTitleOverride ?? ''}
                        onChange={v => patch({ eventTitleOverride: v })}
                        placeholder="e.g. Rohan & Priya's Wedding"
                      />
                    </Field>
                    <Field label="Host Names">
                      <Input
                        value={customConfig.hostNames ?? ''}
                        onChange={v => patch({ hostNames: v })}
                        placeholder="e.g. Mr. & Mrs. Sharma"
                      />
                    </Field>
                    <Field label="RSVP Deadline">
                      <Input
                        type="date"
                        value={customConfig.rsvpDeadline ?? ''}
                        onChange={v => patch({ rsvpDeadline: v })}
                      />
                    </Field>
                    <Field label="Personal Message" hint="This appears as a warm message on the invitation">
                      <Textarea
                        value={customConfig.customMessageTemplate ?? ''}
                        onChange={v => patch({ customMessageTemplate: v })}
                        placeholder="e.g. Your presence would mean the world to us..."
                        rows={3}
                      />
                    </Field>
                    <Field label="Cover Image URL" hint="Optional: a photo of the couple, event, or venue">
                      <Input
                        value={customConfig.coverImageUrl ?? ''}
                        onChange={v => patch({ coverImageUrl: v })}
                        placeholder="https://..."
                      />
                    </Field>
                  </div>
                )}

                {/* ── DESIGN TAB ── */}
                {activeTab === 'design' && (
                  <div className="space-y-4">
                    <Field label="Primary Color">
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={customConfig.primaryColor ?? '#c9a84c'}
                          onChange={e => patch({ primaryColor: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                        <Input
                          value={customConfig.primaryColor ?? ''}
                          onChange={v => patch({ primaryColor: v })}
                          placeholder="#c9a84c"
                        />
                      </div>
                    </Field>
                    <Field label="Accent Color">
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={customConfig.accentColor ?? '#f5d88a'}
                          onChange={e => patch({ accentColor: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                        <Input
                          value={customConfig.accentColor ?? ''}
                          onChange={v => patch({ accentColor: v })}
                          placeholder="#f5d88a"
                        />
                      </div>
                    </Field>
                    <Field label="Text Color">
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={customConfig.textColor ?? '#f5e6c8'}
                          onChange={e => patch({ textColor: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                        <Input
                          value={customConfig.textColor ?? ''}
                          onChange={v => patch({ textColor: v })}
                          placeholder="#f5e6c8"
                        />
                      </div>
                    </Field>
                    <Field label="Background Override" hint="Gradient CSS or hex colour; leave blank for theme default">
                      <Textarea
                        value={customConfig.backgroundOverride ?? ''}
                        onChange={v => patch({ backgroundOverride: v })}
                        placeholder="linear-gradient(135deg,#000,#111)"
                        rows={2}
                      />
                    </Field>
                    <Field label="Heading Font">
                      <select
                        value={customConfig.fontHeadingOverride ?? ''}
                        onChange={e => patch({ fontHeadingOverride: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                      >
                        <option value="">Theme default</option>
                        {[
                          'Cormorant Garamond','Cinzel','Playfair Display','Dancing Script',
                          'Great Vibes','Pacifico','Righteous','Orbitron','Abril Fatface','Montserrat'
                        ].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}

                {/* ── ANIMATION TAB ── */}
                {activeTab === 'animation' && (
                  <div className="space-y-5">
                    <Field label="Animation Style">
                      <div className="grid grid-cols-2 gap-2">
                        {(['elegant', 'playful', 'minimal', 'vibrant'] as const).map(style => (
                          <button
                            key={style}
                            className="py-2.5 rounded-lg text-sm border transition-all border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/30 capitalize"
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Animation Speed">
                      <div className="flex gap-2">
                        {(['slow', 'medium', 'fast'] as const).map(speed => (
                          <button
                            key={speed}
                            onClick={() => patch({ animationSpeedOverride: speed })}
                            className={`flex-1 py-2 rounded-lg text-sm border transition-all capitalize ${
                              customConfig.animationSpeedOverride === speed
                                ? 'border-white/40 bg-white/10 text-white'
                                : 'border-white/10 bg-white/5 text-white/40 hover:text-white/70'
                            }`}
                          >
                            {speed}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50">
                      <Sparkles size={14} className="inline mr-2 text-purple-400" />
                      Preview animations update live in the phone mockup →
                    </div>
                  </div>
                )}

                {/* ── MUSIC TAB ── */}
                {activeTab === 'music' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="text-sm text-white font-medium">Background Music</p>
                        <p className="text-xs text-white/40 mt-0.5">Plays when the invitation opens</p>
                      </div>
                      <button
                        onClick={() => patch({ musicEnabled: !customConfig.musicEnabled })}
                        className={`w-11 h-6 rounded-full transition-all relative ${
                          customConfig.musicEnabled ? 'bg-white' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${
                            customConfig.musicEnabled ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {customConfig.musicEnabled && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <Field label="Audio File URL" hint="MP3 or OGG, hosted publicly">
                          <Input
                            value={customConfig.musicUrl ?? ''}
                            onChange={v => patch({ musicUrl: v })}
                            placeholder="https://... .mp3"
                          />
                        </Field>
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                          Note: Most browsers require user interaction before playing audio.
                          A soft ♪ button will appear on the invitation.
                        </div>
                      </motion.div>
                    )}

                    {!customConfig.musicEnabled && (
                      <p className="text-sm text-white/30 text-center pt-4">
                        Enable music to add a background audio track.
                      </p>
                    )}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Bottom action bar ── */}
          <div className="border-t border-white/8 p-4 flex flex-col gap-2 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 text-sm text-white/80 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                  isPublished
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {publishing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isPublished ? (
                  <Globe size={14} />
                ) : (
                  <Zap size={14} />
                )}
                {isPublished ? 'Published' : 'Publish'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateLinks}
                disabled={generatingLinks || !isPublished}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingLinks ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Gen Links
              </button>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={!isPublished}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel: phone preview ── */}
        <div className="flex-1 flex items-center justify-center bg-[#080808] relative overflow-hidden">

          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />

          {/* Phone mockup */}
          <motion.div
            className="relative"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Phone shell */}
            <div
              className="relative rounded-[44px] overflow-hidden shadow-2xl shadow-black/60"
              style={{
                width: 390,
                height: 760,
                background: '#111',
                border: '10px solid #1a1a1a',
                boxShadow: '0 0 0 2px #2a2a2a, 0 60px 120px rgba(0,0,0,0.9)',
              }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-8 bg-[#111] rounded-b-2xl z-10 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1a1a1a]" />
                <div className="w-10 h-2 rounded-full bg-[#1a1a1a]" />
              </div>

              {/* iframe preview */}
              <iframe
                ref={previewRef}
                src={`/i/preview?theme=${selectedTheme}&guest=Preview+Guest`}
                className="w-full h-full border-0"
                title="Invitation Preview"
                style={{ borderRadius: 34 }}
              />
            </div>

            {/* Phone side buttons */}
            <div className="absolute -right-[12px] top-[120px] w-[3px] h-[60px] bg-[#1a1a1a] rounded-r-full" />
            <div className="absolute -left-[12px] top-[100px] w-[3px] h-[40px] bg-[#1a1a1a] rounded-l-full" />
            <div className="absolute -left-[12px] top-[155px] w-[3px] h-[70px] bg-[#1a1a1a] rounded-l-full" />
            <div className="absolute -left-[12px] top-[235px] w-[3px] h-[70px] bg-[#1a1a1a] rounded-l-full" />
          </motion.div>

          {/* Preview label */}
          <div className="absolute bottom-6 text-xs text-white/20 flex items-center gap-2">
            <Eye size={12} />
            Live Preview · {THEME_VISUALS[selectedTheme]?.name ?? selectedTheme}
          </div>
        </div>
      </div>

      {/* ── Send modal ── */}
      <AnimatePresence>
        {showSendModal && (
          <SendModal eventId={eventId} onClose={() => setShowSendModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
