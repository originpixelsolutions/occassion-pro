'use client'
/**
 * OccasionPro — Invitation Builder
 *
 * Event-scoped page inside the event manager portal.
 * Sections:
 *   1. Template Picker  — choose from 10 system templates
 *   2. Customization    — color / font / animation overrides
 *   3. Preview          — live iframe-style preview panel
 *   4. Publish          — publish / unpublish toggle
 *   5. Guest Links      — generate links, view who has a link
 *   6. Send             — send via WhatsApp / Email / SMS
 *   7. Stats            — delivery & open stats
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Eye, Send, Link2, BarChart3, Palette, Globe,
  GlobeOff, Copy, Check, Loader2, RefreshCw, Users,
  ExternalLink, Mail, MessageSquare, Smartphone, CheckCircle2,
  AlertCircle, ChevronDown, ChevronRight, Zap, Image,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  theme_slug: string
  thumbnail_url: string | null
  config: {
    background?: string
    primaryColor?: string
    accentColor?: string
    animationStyle?: string
    decorativeElements?: string[]
  }
  is_system: boolean
}

interface EventInvitation {
  id: string
  template_id: string
  custom_config: Record<string, unknown>
  is_published: boolean
  published_at: string | null
  template?: Template
}

interface GuestLink {
  id: string
  guest_id: string
  is_opened: boolean
  open_count: number
  guest?: { full_name: string; email?: string; phone?: string }
  short_link?: { code: string; destination_url: string; click_count: number }
}

interface DeliveryStats {
  total_guests: number
  links_generated: number
  opened: number
  rsvp_responded: number
  delivery_rate: number
  open_rate: number
}

// ── Theme slug → colour preview ───────────────────────────────────────────────

const THEME_PREVIEWS: Record<string, { bg: string; primary: string; accent: string; emoji: string }> = {
  'royal-gold':       { bg: '#1a1206', primary: '#d4af37', accent: '#f5d76e', emoji: '👑' },
  'minimal-white':    { bg: '#ffffff', primary: '#1a1a1a', accent: '#6b7280', emoji: '⬜' },
  'floral-pink':      { bg: '#fff5f7', primary: '#d63384', accent: '#f7a8c4', emoji: '🌸' },
  'dark-luxury':      { bg: '#0d0d0d', primary: '#c9a84c', accent: '#e8d5a3', emoji: '🖤' },
  'pastel-dream':     { bg: '#fdf4ff', primary: '#9b59b6', accent: '#c39bd3', emoji: '🌈' },
  'vibrant-festival': { bg: '#0f0f0f', primary: '#ff6b35', accent: '#ffd23f', emoji: '🎉' },
  'corporate-blue':   { bg: '#f0f4f8', primary: '#1e40af', accent: '#3b82f6', emoji: '💼' },
  'rustic-wood':      { bg: '#3e2723', primary: '#d7a86e', accent: '#ffcc80', emoji: '🌿' },
  'starry-night':     { bg: '#0a0e27', primary: '#818cf8', accent: '#c7d2fe', emoji: '🌙' },
  'neon-party':       { bg: '#050505', primary: '#39ff14', accent: '#ff073a', emoji: '🪩' },
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: Template
  selected: boolean
  onClick: () => void
}) {
  const prev = THEME_PREVIEWS[template.theme_slug] ?? { bg: '#1a1a1a', primary: '#fff', accent: '#888', emoji: '✨' }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden border-2 transition-all text-left group w-full',
        selected
          ? 'border-violet-500 shadow-lg shadow-violet-500/20 scale-[1.02]'
          : 'border-white/10 hover:border-white/30 hover:scale-[1.01]',
      )}
    >
      {/* Preview swatch */}
      <div
        className="h-24 flex items-center justify-center text-4xl relative overflow-hidden"
        style={{ background: prev.bg }}
      >
        {template.thumbnail_url ? (
          <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
        ) : (
          <>
            {/* Mini colour orbs */}
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full opacity-60"
              style={{ background: prev.primary, filter: 'blur(4px)' }} />
            <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full opacity-40"
              style={{ background: prev.accent, filter: 'blur(8px)' }} />
            <span>{prev.emoji}</span>
          </>
        )}
      </div>

      {/* Label */}
      <div className="px-3 py-2 bg-zinc-900">
        <p className="text-xs font-medium text-white truncate">{template.name}</p>
        {template.is_system && (
          <p className="text-[10px] text-zinc-500 mt-0.5">System template</p>
        )}
      </div>

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? '#fff' }}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Accordion Section ─────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, defaultOpen = false, badge, children,
}: {
  title: string
  icon: React.FC<{ className?: string }>
  defaultOpen?: boolean
  badge?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-violet-400" />
          <span className="font-medium text-sm text-white">{title}</span>
          {badge && (
            <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Color Picker row ──────────────────────────────────────────────────────────

function ColorField({
  label, value, onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-zinc-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
        />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InvitationsPage() {
  const params  = useParams<{ eventId: string }>()
  const eventId = params?.eventId ?? ''

  // ── State ──────────────────────────────────────────────────────────────────
  const [templates, setTemplates]       = useState<Template[]>([])
  const [invitation, setInvitation]     = useState<EventInvitation | null>(null)
  const [stats, setStats]               = useState<DeliveryStats | null>(null)
  const [guestLinks, setGuestLinks]     = useState<GuestLink[]>([])

  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [publishing, setPublishing]     = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [sending, setSending]           = useState(false)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [customConfig, setCustomConfig] = useState<Record<string, unknown>>({})
  const [sendChannels, setSendChannels] = useState<Array<'whatsapp' | 'sms' | 'email'>>(['whatsapp'])
  const [copiedCode, setCopiedCode]     = useState<string | null>(null)
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [statsOpen, setStatsOpen]       = useState(false)

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tmplData, invData] = await Promise.all([
        api.get<Template[]>('/invitations/templates'),
        api.get<EventInvitation | { exists: false }>(`/invitations/events/${eventId}/invitation`),
      ])
      setTemplates(tmplData ?? [])
      if (invData && 'id' in invData) {
        setInvitation(invData)
        setSelectedTemplateId(invData.template_id)
        setCustomConfig(invData.custom_config ?? {})
      }
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Failed to load invitation data')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get<DeliveryStats>(`/invitations/events/${eventId}/invitation/stats`)
      setStats(data)
    } catch { /* no stats yet */ }
  }, [eventId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Save invitation ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedTemplateId) return showToast('error', 'Please select a template first')
    setSaving(true)
    try {
      const data = await api.put<EventInvitation>(`/invitations/events/${eventId}/invitation`, {
        templateId:   selectedTemplateId,
        customConfig,
      })
      setInvitation(data)
      showToast('success', 'Invitation saved!')
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!invitation?.id) return showToast('error', 'Save invitation first')
    setPublishing(true)
    try {
      const data = await api.post<EventInvitation>(`/invitations/events/${eventId}/invitation/publish`)
      setInvitation(data)
      showToast('success', 'Invitation published! Guests can now view it.')
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  // ── Generate links ─────────────────────────────────────────────────────────
  const handleGenerateLinks = async () => {
    setGenerating(true)
    try {
      const result = await api.post<{ created: number; links: GuestLink[] }>(
        `/invitations/events/${eventId}/invitation/generate-links`,
        { guestIds: 'all' },
      )
      setGuestLinks(result.links ?? [])
      showToast('success', `Generated ${result.created} new invitation links`)
      loadStats()
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Failed to generate links')
    } finally {
      setGenerating(false)
    }
  }

  // ── Send invitations ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!sendChannels.length) return showToast('error', 'Select at least one channel')
    setSending(true)
    try {
      const result = await api.post<{ sent: number; failed: number }>(
        `/invitations/events/${eventId}/invitation/send`,
        { guestIds: 'all', channels: sendChannels },
      )
      showToast('success', `Sent to ${result.sent} guests!`)
      loadStats()
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  // ── Copy shortcode ─────────────────────────────────────────────────────────
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/i/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const previewUrl = invitation?.id && invitation.is_published
    ? `${appUrl}/i/${selectedTemplate?.theme_slug ?? ''}` : null

  const pColor = (customConfig.primaryColor as string) ?? selectedTemplate?.config.primaryColor ?? '#d4af37'
  const aColor = (customConfig.accentColor  as string) ?? selectedTemplate?.config.accentColor  ?? '#f5d76e'

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl',
              toast.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                       : 'bg-red-500/20 border border-red-500/40 text-red-300',
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${eventId}`}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Digital Invitations</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Design, publish, and track personalized invitations</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Published status */}
            {invitation && (
              <div className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium',
                invitation.is_published
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-white/10',
              )}>
                {invitation.is_published ? <Globe className="w-3 h-3" /> : <GlobeOff className="w-3 h-3" />}
                {invitation.is_published ? 'Published' : 'Draft'}
              </div>
            )}

            {/* Preview link */}
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg transition-colors text-zinc-300"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !selectedTemplateId}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>

            {/* Publish */}
            {invitation && !invitation.is_published && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Publish
              </button>
            )}
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">

          {/* Left: Builder */}
          <div className="flex flex-col gap-5">

            {/* ── 1. Template Picker ── */}
            <Section title="Choose Template" icon={Image} defaultOpen badge={selectedTemplate ? selectedTemplate.name : 'None selected'}>
              {templates.length === 0 ? (
                <p className="text-sm text-zinc-500">No templates available</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 gap-3 mt-1">
                  {templates.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedTemplateId === t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* ── 2. Customization ── */}
            <Section title="Customize Theme" icon={Palette} badge="Optional">
              <div className="flex flex-col gap-4 mt-1">
                <p className="text-xs text-zinc-500">Override the template's default colours and style</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ColorField
                    label="Primary Colour"
                    value={pColor}
                    onChange={v => setCustomConfig(c => ({ ...c, primaryColor: v }))}
                  />
                  <ColorField
                    label="Accent Colour"
                    value={aColor}
                    onChange={v => setCustomConfig(c => ({ ...c, accentColor: v }))}
                  />
                </div>

                {/* Animation speed */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">Animation Speed</label>
                  <div className="flex gap-2">
                    {(['slow', 'medium', 'fast'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setCustomConfig(c => ({ ...c, animationSpeed: s }))}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                          customConfig.animationSpeed === s
                            ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                            : 'bg-zinc-800 border-white/10 text-zinc-400 hover:border-white/20',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover image URL */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">Custom Cover Image URL</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={(customConfig.coverImageUrl as string) ?? ''}
                    onChange={e => setCustomConfig(c => ({ ...c, coverImageUrl: e.target.value || undefined }))}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Host names */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">Host Names</label>
                  <input
                    type="text"
                    placeholder="Rahul & Priya"
                    value={(customConfig.hostNames as string) ?? ''}
                    onChange={e => setCustomConfig(c => ({ ...c, hostNames: e.target.value || undefined }))}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* RSVP deadline */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">RSVP Deadline</label>
                  <input
                    type="date"
                    value={(customConfig.rsvpDeadline as string) ?? ''}
                    onChange={e => setCustomConfig(c => ({ ...c, rsvpDeadline: e.target.value || undefined }))}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </Section>

            {/* ── 3. Guest Links ── */}
            <Section title="Guest Invitation Links" icon={Link2}>
              <div className="flex flex-col gap-4 mt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    Generate unique personalised links for each confirmed guest
                  </p>
                  <button
                    onClick={handleGenerateLinks}
                    disabled={generating || !invitation?.id}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                  >
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Generate Links
                  </button>
                </div>

                {guestLinks.length > 0 && (
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-xl">
                    {guestLinks.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-3 bg-zinc-800/60 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {link.guest?.full_name ?? 'Guest'}
                          </p>
                          {link.short_link?.code && (
                            <p className="text-[10px] text-zinc-500 font-mono">/i/{link.short_link.code}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {link.is_opened && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                              Opened
                            </span>
                          )}
                          {link.short_link?.code && (
                            <button
                              onClick={() => copyCode(link.short_link!.code)}
                              className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400"
                            >
                              {copiedCode === link.short_link.code
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {guestLinks.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-6 text-zinc-600">
                    <Users className="w-8 h-8" />
                    <p className="text-xs">No links generated yet. Click &ldquo;Generate Links&rdquo; above.</p>
                  </div>
                )}
              </div>
            </Section>

            {/* ── 4. Send Invitations ── */}
            <Section title="Send Invitations" icon={Send}>
              <div className="flex flex-col gap-4 mt-1">
                <p className="text-xs text-zinc-400">
                  Send personalized invitations to all guests with generated links
                </p>

                {/* Channel selector */}
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">Delivery Channels</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'whatsapp' as const, icon: MessageSquare, label: 'WhatsApp', color: 'emerald' },
                      { id: 'sms'      as const, icon: Smartphone,    label: 'SMS',       color: 'blue' },
                      { id: 'email'    as const, icon: Mail,          label: 'Email',     color: 'violet' },
                    ].map(ch => {
                      const active = sendChannels.includes(ch.id)
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSendChannels(prev =>
                            active ? prev.filter(c => c !== ch.id) : [...prev, ch.id],
                          )}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all',
                            active
                              ? `bg-${ch.color}-500/20 border-${ch.color}-500/50 text-${ch.color}-300`
                              : 'bg-zinc-800 border-white/10 text-zinc-500 hover:border-white/20',
                          )}
                        >
                          <ch.icon className="w-4 h-4" />
                          {ch.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || !invitation?.is_published || !sendChannels.length}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Sending…' : 'Send Now'}
                </button>

                {!invitation?.is_published && (
                  <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Publish the invitation first before sending
                  </p>
                )}
              </div>
            </Section>

          </div>

          {/* Right: Stats + Live Preview ── */}
          <div className="flex flex-col gap-5">

            {/* Stats */}
            <div
              className="bg-zinc-900/60 rounded-2xl border border-white/5 overflow-hidden cursor-pointer"
              onClick={() => { setStatsOpen(v => !v); if (!statsOpen && !stats) loadStats() }}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  <span className="font-medium text-sm text-white">Delivery Stats</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); loadStats() }}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                  <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', statsOpen && 'rotate-180')} />
                </div>
              </div>

              <AnimatePresence>
                {statsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-5 pb-5"
                  >
                    {stats ? (
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Total Guests"     value={stats.total_guests}    color="#a78bfa" />
                        <StatCard label="Links Generated"  value={stats.links_generated} color="#60a5fa" />
                        <StatCard label="Opened"           value={stats.opened}
                          sub={`${stats.open_rate.toFixed(0)}% open rate`}             color="#34d399" />
                        <StatCard label="RSVP'd"           value={stats.rsvp_responded}  color="#f59e0b" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6 text-zinc-600">
                        <BarChart3 className="w-6 h-6" />
                        <p className="text-xs">No stats yet. Generate and send invitations first.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview Card */}
            {invitation && (
              <div className="bg-zinc-900/60 rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-violet-400" />
                    <span className="font-medium text-sm text-white">Live Preview</span>
                  </div>
                </div>

                <div className="p-5">
                  {/* Mini preview swatch */}
                  {selectedTemplate && (() => {
                    const prev = THEME_PREVIEWS[selectedTemplate.theme_slug]
                    if (!prev) return null
                    return (
                      <div
                        className="w-full rounded-xl overflow-hidden mb-4 aspect-[9/16] max-h-64 flex flex-col items-center justify-center relative"
                        style={{ background: prev.bg }}
                      >
                        <div className="absolute top-2 left-2 w-10 h-10 rounded-full opacity-30"
                          style={{ background: pColor, filter: 'blur(8px)' }} />
                        <div className="absolute bottom-2 right-2 w-14 h-14 rounded-full opacity-20"
                          style={{ background: aColor, filter: 'blur(12px)' }} />

                        <div className="text-center z-10 px-4">
                          <div className="text-3xl mb-2">{prev.emoji}</div>
                          <div
                            className="text-xs font-bold tracking-wide"
                            style={{ color: pColor }}
                          >
                            {selectedTemplate.name}
                          </div>
                          <div
                            className="text-[10px] mt-1 opacity-60"
                            style={{ color: aColor }}
                          >
                            Preview
                          </div>
                        </div>

                        {/* Colour dots */}
                        <div className="absolute bottom-3 flex gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ background: pColor }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: aColor }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Open in new tab */}
                  {invitation.is_published && (
                    <a
                      href={`/i/demo-preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Full Preview
                    </a>
                  )}

                  {/* Current theme info */}
                  <div className="mt-4 flex flex-col gap-2 text-xs text-zinc-500">
                    <div className="flex justify-between">
                      <span>Template</span>
                      <span className="text-zinc-300">{selectedTemplate?.name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className={invitation.is_published ? 'text-emerald-400' : 'text-zinc-400'}>
                        {invitation.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {invitation.published_at && (
                      <div className="flex justify-between">
                        <span>Published</span>
                        <span className="text-zinc-300">
                          {new Date(invitation.published_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* No invitation yet */}
            {!invitation && !loading && (
              <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                  <Image className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">No invitation yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Pick a template on the left and click Save to create your invitation.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
