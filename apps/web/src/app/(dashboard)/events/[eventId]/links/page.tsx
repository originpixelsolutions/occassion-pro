'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Link2,
  Copy,
  ExternalLink,
  BarChart2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  QrCode,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import LinkAnalyticsPanel from './LinkAnalyticsPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShortLink {
  id: string
  code: string
  short_url: string
  destination_url: string
  link_type: string
  title: string | null
  is_active: boolean
  expires_at: string | null
  total_clicks: number
  unique_clicks: number
  created_at: string
}

interface CreateLinkPayload {
  link_type: string
  destination_url: string
  title?: string
  expires_at?: string
}

const LINK_TYPE_LABELS: Record<string, string> = {
  invitation: 'Invitation',
  guest_portal: 'Guest Portal',
  client_portal: 'Client Portal',
  vendor_portal: 'Vendor Portal',
  rsvp_form: 'RSVP Form',
  payment: 'Payment',
  document: 'Document',
  custom: 'Custom',
}

const LINK_TYPE_COLORS: Record<string, string> = {
  invitation: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  guest_portal: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  client_portal: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  vendor_portal: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  rsvp_form: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  payment: 'bg-green-500/15 text-green-400 border-green-500/30',
  document: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  custom: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventLinksPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  // Create form state
  const [form, setForm] = useState<CreateLinkPayload>({
    link_type: 'invitation',
    destination_url: '',
    title: '',
    expires_at: '',
  })

  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/short-links/event/${eventId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setLinks(data)
      }
    } finally {
      setLoading(false)
    }
  }, [apiBase, eventId])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  // ── Actions ────────────────────────────────────────────────────────────────

  const createLink = async () => {
    if (!form.destination_url) return
    setCreating(true)
    try {
      const res = await fetch(`${apiBase}/short-links`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          link_type: form.link_type,
          destination_url: form.destination_url,
          title: form.title || undefined,
          expires_at: form.expires_at || undefined,
        }),
      })
      if (res.ok) {
        await fetchLinks()
        setShowCreate(false)
        setForm({ link_type: 'invitation', destination_url: '', title: '', expires_at: '' })
      }
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (link: ShortLink) => {
    await fetch(`${apiBase}/short-links/${link.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !link.is_active }),
    })
    setLinks(prev => prev.map(l => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)))
  }

  const deactivateLink = async (linkId: string) => {
    if (!confirm('Deactivate this link? It will no longer redirect visitors.')) return
    await fetch(`${apiBase}/short-links/${linkId}/deactivate`, {
      method: 'POST',
      credentials: 'include',
    })
    await fetchLinks()
  }

  const copyLink = (link: ShortLink) => {
    navigator.clipboard.writeText(link.short_url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openAnalytics = (link: ShortLink) => {
    setSelectedLink(link)
    setAnalyticsOpen(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Short Links</h1>
            <p className="text-sm text-white/40">Trackable links.occasionpro.in URLs for this event</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Link
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Create Short Link
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Link Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Link Type</label>
              <select
                value={form.link_type}
                onChange={e => setForm(f => ({ ...f, link_type: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
              >
                {Object.entries(LINK_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v} className="bg-[#0a0a0f]">{l}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Title (optional)</label>
              <input
                type="text"
                placeholder="e.g. Main Invitation Link"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"
              />
            </div>

            {/* Destination URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-white/50">Destination URL *</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.destination_url}
                onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"
              />
            </div>

            {/* Expiry */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Expires At (optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={createLink}
              disabled={creating || !form.destination_url}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-white/50 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats summary */}
      {links.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Links', value: links.length },
            { label: 'Active', value: links.filter(l => l.is_active).length },
            { label: 'Total Clicks', value: links.reduce((s, l) => s + (l.total_clicks || 0), 0).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-white/40 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Links table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading links…
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/30">
            <Link2 className="w-8 h-8" />
            <p className="text-sm">No short links yet. Create one to start tracking.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {links.map(link => (
              <LinkRow
                key={link.id}
                link={link}
                copied={copiedId === link.id}
                onCopy={() => copyLink(link)}
                onToggle={() => toggleActive(link)}
                onDeactivate={() => deactivateLink(link.id)}
                onAnalytics={() => openAnalytics(link)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Analytics slide-over */}
      {analyticsOpen && selectedLink && (
        <LinkAnalyticsPanel
          link={selectedLink}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}
    </div>
  )
}

// ── Link Row ──────────────────────────────────────────────────────────────────

function LinkRow({
  link,
  copied,
  onCopy,
  onToggle,
  onDeactivate,
  onAnalytics,
}: {
  link: ShortLink
  copied: boolean
  onCopy: () => void
  onToggle: () => void
  onDeactivate: () => void
  onAnalytics: () => void
}) {
  const typeColor = LINK_TYPE_COLORS[link.link_type] || LINK_TYPE_COLORS.custom
  const typeLabel = LINK_TYPE_LABELS[link.link_type] || link.link_type

  const isExpired = link.expires_at && new Date(link.expires_at) < new Date()

  return (
    <div className="px-5 py-4 hover:bg-white/[0.02] transition-colors group">
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status dot */}
            {link.is_active && !isExpired ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
            )}

            {/* Type badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
              {typeLabel}
            </span>

            {/* Title */}
            {link.title && (
              <span className="text-sm text-white font-medium truncate">{link.title}</span>
            )}

            {/* Expired badge */}
            {isExpired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                Expired
              </span>
            )}
          </div>

          {/* Short URL */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-violet-400 font-medium">{link.short_url}</span>
            <button
              onClick={onCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy short URL"
            >
              {copied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/40 hover:text-white" />
              )}
            </button>
            <a
              href={link.short_url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Open link"
            >
              <ExternalLink className="w-3.5 h-3.5 text-white/40 hover:text-white" />
            </a>
          </div>

          {/* Destination (truncated) */}
          <p className="text-xs text-white/30 truncate max-w-xl">{link.destination_url}</p>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>{link.total_clicks?.toLocaleString() ?? 0} clicks</span>
            {link.expires_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(link.expires_at).toLocaleDateString()}
              </span>
            )}
            <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onAnalytics}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="View analytics"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            title={link.is_active ? 'Deactivate' : 'Activate'}
          >
            {link.is_active ? (
              <ToggleRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDeactivate}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete link"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
