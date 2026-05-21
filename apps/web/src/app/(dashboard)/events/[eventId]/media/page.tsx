'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Camera, Video, Plus, Link2, CheckCircle2, Clock, AlertTriangle,
  Loader2, Brain, Sparkles, ExternalLink, Trash2, Pencil,
  CheckSquare, Square, Star, ChevronDown, AlertCircle,
  Play, Image, Film, Package, RefreshCw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ShotCategory =
  | 'pre_event' | 'ceremony' | 'reception' | 'speeches' | 'candid'
  | 'group_photos' | 'detail_shots' | 'venue' | 'guests'
  | 'performances' | 'behind_scenes' | 'other'

type ShotPriority = 'must_have' | 'nice_to_have' | 'optional'

type DeliverableCategory =
  | 'raw_photos' | 'edited_photos' | 'highlight_reel' | 'full_video'
  | 'teaser' | 'same_day_edit' | 'drone_footage' | 'behind_scenes'
  | 'photo_album' | 'slideshow' | 'social_cuts' | 'other'

type LinkType = 'google_drive' | 'dropbox' | 'wetransfer' | 'youtube' | 'vimeo' | 'onedrive' | 'frame_io' | 'smugmug' | 'flickr' | 'other'

type DeliverableStatus = 'pending' | 'uploaded_by_vendor' | 'under_review' | 'approved' | 'revision_requested' | 'delivered_to_client'

interface Shot {
  id: string
  category: ShotCategory
  shot_name: string
  description?: string
  priority: ShotPriority
  people_involved?: string[]
  location?: string
  time_window?: string
  reference_url?: string
  is_completed: boolean
  notes?: string
  sort_order: number
}

interface Deliverable {
  id: string
  media_category: DeliverableCategory
  deliverable_name: string
  description?: string
  link_type: LinkType
  media_url: string
  password_hint?: string
  is_wetransfer: boolean
  wetransfer_expiry?: string
  file_count?: number
  total_size_gb?: number
  duration_mins?: number
  resolution?: string
  status: DeliverableStatus
  revision_notes?: string
  delivery_deadline?: string
  delivered_at?: string
  tags?: string[]
  vendor?: { id: string; name: string }
}

interface MediaStats {
  total_shots: number
  completed_shots: number
  shot_completion_pct: number
  must_have_remaining: number
  total_deliverables: number
  approved: number
  pending: number
  revision_requested: number
  wt_expiring: number
  wt_expired: number
  overdue_deliverables: number
  alerts: Array<{ severity: string; message: string }>
}

// ── Config ─────────────────────────────────────────────────────────────────────

const SHOT_CATEGORY_CONFIG: Record<ShotCategory, { label: string; icon: string }> = {
  pre_event:      { label: 'Pre-Event',        icon: '🌅' },
  ceremony:       { label: 'Ceremony',         icon: '💒' },
  reception:      { label: 'Reception',        icon: '🥂' },
  speeches:       { label: 'Speeches',         icon: '🎤' },
  candid:         { label: 'Candid',           icon: '😄' },
  group_photos:   { label: 'Group Photos',     icon: '👥' },
  detail_shots:   { label: 'Detail Shots',     icon: '🔍' },
  venue:          { label: 'Venue',            icon: '🏛️' },
  guests:         { label: 'Guests',           icon: '🎊' },
  performances:   { label: 'Performances',     icon: '🎭' },
  behind_scenes:  { label: 'Behind Scenes',    icon: '🎬' },
  other:          { label: 'Other',            icon: '📷' },
}

const PRIORITY_CONFIG: Record<ShotPriority, { label: string; color: string }> = {
  must_have:    { label: 'Must Have',     color: 'text-red-400 bg-red-400/10' },
  nice_to_have: { label: 'Nice to Have', color: 'text-amber-400 bg-amber-400/10' },
  optional:     { label: 'Optional',     color: 'text-gray-400 bg-gray-400/10' },
}

const DELIVERABLE_CATEGORY_CONFIG: Record<DeliverableCategory, { label: string; icon: React.ReactNode }> = {
  raw_photos:    { label: 'Raw Photos',        icon: <Image className="w-4 h-4" /> },
  edited_photos: { label: 'Edited Photos',     icon: <Image className="w-4 h-4" /> },
  highlight_reel:{ label: 'Highlight Reel',    icon: <Play className="w-4 h-4" /> },
  full_video:    { label: 'Full Video',         icon: <Film className="w-4 h-4" /> },
  teaser:        { label: 'Teaser',            icon: <Play className="w-4 h-4" /> },
  same_day_edit: { label: 'Same-Day Edit',     icon: <Video className="w-4 h-4" /> },
  drone_footage: { label: 'Drone Footage',     icon: <Video className="w-4 h-4" /> },
  behind_scenes: { label: 'Behind the Scenes', icon: <Camera className="w-4 h-4" /> },
  photo_album:   { label: 'Photo Album',       icon: <Package className="w-4 h-4" /> },
  slideshow:     { label: 'Slideshow',         icon: <Play className="w-4 h-4" /> },
  social_cuts:   { label: 'Social Cuts',       icon: <Video className="w-4 h-4" /> },
  other:         { label: 'Other',             icon: <Camera className="w-4 h-4" /> },
}

const DELIVERABLE_STATUS_CONFIG: Record<DeliverableStatus, { label: string; color: string }> = {
  pending:               { label: 'Pending',            color: 'text-gray-400 bg-gray-400/10' },
  uploaded_by_vendor:    { label: 'Uploaded',           color: 'text-blue-400 bg-blue-400/10' },
  under_review:          { label: 'Under Review',       color: 'text-amber-400 bg-amber-400/10' },
  approved:              { label: 'Approved',           color: 'text-emerald-400 bg-emerald-400/10' },
  revision_requested:    { label: 'Revision Requested', color: 'text-orange-400 bg-orange-400/10' },
  delivered_to_client:   { label: 'Delivered',          color: 'text-violet-400 bg-violet-400/10' },
}

const LINK_TYPE_CONFIG: Record<LinkType, { label: string; color: string }> = {
  google_drive: { label: 'Google Drive', color: 'text-blue-400' },
  dropbox:      { label: 'Dropbox',      color: 'text-blue-500' },
  wetransfer:   { label: 'WeTransfer',   color: 'text-teal-400' },
  youtube:      { label: 'YouTube',      color: 'text-red-400' },
  vimeo:        { label: 'Vimeo',        color: 'text-sky-400' },
  onedrive:     { label: 'OneDrive',     color: 'text-blue-400' },
  frame_io:     { label: 'Frame.io',     color: 'text-violet-400' },
  smugmug:      { label: 'SmugMug',      color: 'text-orange-400' },
  flickr:       { label: 'Flickr',       color: 'text-pink-400' },
  other:        { label: 'Link',         color: 'text-gray-400' },
}

// ── Smart helpers ──────────────────────────────────────────────────────────────

function detectLinkType(url: string): LinkType {
  const u = url.toLowerCase()
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'google_drive'
  if (u.includes('dropbox.com')) return 'dropbox'
  if (u.includes('wetransfer.com') || u.includes('we.tl/')) return 'wetransfer'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('vimeo.com')) return 'vimeo'
  if (u.includes('onedrive.live.com') || u.includes('1drv.ms')) return 'onedrive'
  if (u.includes('frame.io')) return 'frame_io'
  if (u.includes('smugmug.com')) return 'smugmug'
  if (u.includes('flickr.com')) return 'flickr'
  return 'other'
}

function daysUntil(d: string | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function formatDate(d: string | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Progress Ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6b7280'
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function AddShotModal({ onClose, onSave, eventId }: { onClose: () => void; onSave: (s: Record<string, unknown>) => void; eventId: string }) {
  const [form, setForm] = useState<Record<string, unknown>>({ event_id: eventId, category: 'ceremony', priority: 'must_have' })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Add Shot</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Shot Name *</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="e.g. First dance full wide" value={(form.shot_name as string) ?? ''}
              onChange={e => set('shot_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.category as string} onChange={e => set('category', e.target.value)}>
                {Object.entries(SHOT_CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Priority</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.priority as string} onChange={e => set('priority', e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Location</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Mandap stage" value={(form.location as string) ?? ''}
                onChange={e => set('location', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Time Window</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. 7:30 – 8:00 PM" value={(form.time_window as string) ?? ''}
                onChange={e => set('time_window', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Reference Image URL (external link only)</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="https://drive.google.com/..." value={(form.reference_url as string) ?? ''}
              onChange={e => set('reference_url', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Details, framing notes, etc." value={(form.description as string) ?? ''}
              onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
          <button onClick={() => { if (form.shot_name) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Add Shot</button>
        </div>
      </div>
    </div>
  )
}

function AddDeliverableModal({ onClose, onSave, eventId }: { onClose: () => void; onSave: (d: Record<string, unknown>) => void; eventId: string }) {
  const [form, setForm] = useState<Record<string, unknown>>({
    event_id: eventId,
    media_category: 'edited_photos',
    link_type: 'google_drive',
    status: 'pending',
  })
  const [wtWarning, setWtWarning] = useState(false)

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleUrlChange = (url: string) => {
    const detected = detectLinkType(url)
    set('media_url', url)
    set('link_type', detected)
    const isWT = detected === 'wetransfer'
    setWtWarning(isWT)
    if (isWT) set('is_wetransfer', true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-violet-400" />
            Add Media Deliverable
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* External link only notice */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            All media is stored externally. Paste a link from Google Drive, Dropbox, Vimeo, YouTube, etc.
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Deliverable Name *</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="e.g. Wedding Highlight Reel 4K" value={(form.deliverable_name as string) ?? ''}
              onChange={e => set('deliverable_name', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">External Link *</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="https://drive.google.com/..."
              value={(form.media_url as string) ?? ''}
              onChange={e => handleUrlChange(e.target.value)} />
            {/* Smart link type detection */}
            {form.link_type && form.media_url && (
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span className="text-xs text-violet-400">
                  Detected: {LINK_TYPE_CONFIG[form.link_type as LinkType]?.label}
                </span>
              </div>
            )}
          </div>

          {/* WeTransfer warning */}
          {wtWarning && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">⚠️ WeTransfer links expire in 7 days</div>
                <div>Download all files immediately. Set the expiry date below so we can remind you before it expires.</div>
              </div>
            </div>
          )}

          {wtWarning && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">WeTransfer Expiry Date</label>
              <input type="date" className="w-full bg-gray-800 border border-orange-500/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                value={(form.wetransfer_expiry as string) ?? ''}
                onChange={e => set('wetransfer_expiry', e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.media_category as string} onChange={e => set('media_category', e.target.value)}>
                {Object.entries(DELIVERABLE_CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.status as string} onChange={e => set('status', e.target.value)}>
                {Object.entries(DELIVERABLE_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Delivery Deadline</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={(form.delivery_deadline as string) ?? ''} onChange={e => set('delivery_deadline', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Resolution</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={(form.resolution as string) ?? ''} onChange={e => set('resolution', e.target.value)}>
                <option value="">—</option>
                {['RAW', '4K', '1080p', '720p', '480p'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password (if link is protected)</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Password hint or actual password"
              value={(form.password_hint as string) ?? ''} onChange={e => set('password_hint', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
          <button onClick={() => { if (form.deliverable_name && form.media_url) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Add Deliverable</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [activeTab, setActiveTab] = useState<'deliverables' | 'shotlist'>('deliverables')
  const [shots, setShots] = useState<Shot[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddShot, setShowAddShot] = useState(false)
  const [showAddDeliverable, setShowAddDeliverable] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [reviewModal, setReviewModal] = useState<{ id: string; name: string } | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string>('approved')
  const [reviewNotes, setReviewNotes] = useState('')

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined'
      ? document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1] ?? '' : ''
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') ?? '' : ''
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const h = getHeaders()
      const qs = categoryFilter !== 'all' ? `?category=${categoryFilter}` : ''
      const [sRes, dRes, stRes] = await Promise.all([
        fetch(`${API}/media/events/${eventId}/shots`, { headers: h }),
        fetch(`${API}/media/events/${eventId}/deliverables${qs}`, { headers: h }),
        fetch(`${API}/media/events/${eventId}/stats`, { headers: h }),
      ])
      if (sRes.ok) setShots(await sRes.json())
      if (dRes.ok) setDeliverables(await dRes.json())
      if (stRes.ok) setStats(await stRes.json())
    } catch {}
    setLoading(false)
  }, [eventId, categoryFilter, getHeaders, API])

  useEffect(() => { loadData() }, [loadData])

  const handleToggleShot = async (id: string, completed: boolean) => {
    try {
      const res = await fetch(`${API}/media/shots/${id}/toggle`, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ completed }),
      })
      if (res.ok) loadData()
    } catch {}
  }

  const handleAddShot = async (body: Record<string, unknown>) => {
    try { const res = await fetch(`${API}/media/shots`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }); if (res.ok) loadData() } catch {}
  }

  const handleAddDeliverable = async (body: Record<string, unknown>) => {
    try { const res = await fetch(`${API}/media/deliverables`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }); if (res.ok) loadData() } catch {}
  }

  const handleReview = async () => {
    if (!reviewModal) return
    try {
      await fetch(`${API}/media/deliverables/${reviewModal.id}/review`, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ status: reviewStatus, revision_notes: reviewNotes }),
      })
      setReviewModal(null); loadData()
    } catch {}
  }

  const handleDeleteDeliverable = async (id: string) => {
    if (!confirm('Delete this deliverable?')) return
    try { await fetch(`${API}/media/deliverables/${id}`, { method: 'DELETE', headers: getHeaders() }); loadData() } catch {}
  }

  // Group shots by category
  const shotsByCategory = shots.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<ShotCategory, Shot[]>)

  const smartAlerts = stats?.alerts ?? []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Camera className="w-6 h-6 text-violet-400" />
            Photography & Videography
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Shot lists, media deliverables, external links</p>
        </div>
        <button
          onClick={() => activeTab === 'deliverables' ? setShowAddDeliverable(true) : setShowAddShot(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add {activeTab === 'deliverables' ? 'Deliverable' : 'Shot'}
        </button>
      </div>

      {/* Smart Alerts */}
      {smartAlerts.length > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Smart Alerts</span>
          </div>
          <div className="space-y-2">
            {smartAlerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs ${a.severity === 'high' ? 'text-red-300' : a.severity === 'medium' ? 'text-amber-300' : 'text-gray-400'}`}>
                {a.severity === 'high' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />}
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center">
            <ProgressRing pct={stats.shot_completion_pct} />
            <div className="text-xs text-gray-500 mt-1.5 text-center">Shot Completion</div>
          </div>
          {[
            { label: 'Total Shots', value: stats.total_shots, color: 'text-white' },
            { label: 'Must-Have Left', value: stats.must_have_remaining, color: 'text-red-400' },
            { label: 'Deliverables', value: stats.total_deliverables, color: 'text-white' },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
            { label: 'Pending Review', value: stats.pending, color: 'text-amber-400' },
            { label: 'WT Expiring', value: stats.wt_expiring + stats.wt_expired, color: stats.wt_expired > 0 ? 'text-red-400' : 'text-orange-400' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['deliverables', 'shotlist'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}>
            {tab === 'deliverables' ? '🎬 Deliverables' : '📋 Shot List'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : activeTab === 'deliverables' ? (
        /* ── Deliverables ── */
        deliverables.length === 0 ? (
          <div className="text-center py-20">
            <Video className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No deliverables added yet</p>
            <button onClick={() => setShowAddDeliverable(true)} className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm">Add First Deliverable</button>
          </div>
        ) : (
          <div className="space-y-3">
            {deliverables.map(d => {
              const catConf = DELIVERABLE_CATEGORY_CONFIG[d.media_category]
              const statusConf = DELIVERABLE_STATUS_CONFIG[d.status]
              const linkConf = LINK_TYPE_CONFIG[d.link_type]
              const wtDays = daysUntil(d.wetransfer_expiry)
              const isWtExpired = d.is_wetransfer && d.wetransfer_expiry && new Date(d.wetransfer_expiry) < new Date()
              const isWtSoon = d.is_wetransfer && wtDays !== null && wtDays >= 0 && wtDays <= 3

              return (
                <div key={d.id} className={`bg-gray-900/60 border rounded-xl p-5 transition-colors ${
                  isWtExpired ? 'border-red-500/40' : isWtSoon ? 'border-orange-500/30' : 'border-gray-800 hover:border-gray-700'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-violet-400 shrink-0">
                      {catConf?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium text-sm">{d.deliverable_name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                        {d.is_wetransfer && isWtExpired && (
                          <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-[11px] font-medium rounded">
                            WeTransfer Expired
                          </span>
                        )}
                        {d.is_wetransfer && isWtSoon && !isWtExpired && (
                          <span className="px-2 py-0.5 bg-orange-500/15 text-orange-400 text-[11px] font-medium rounded">
                            Expires in {wtDays}d
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className={`font-medium ${linkConf?.color}`}>{linkConf?.label}</span>
                        <span>{catConf?.label}</span>
                        {d.resolution && <span>{d.resolution}</span>}
                        {d.file_count && <span>{d.file_count} files</span>}
                        {d.delivery_deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Due {formatDate(d.delivery_deadline)}
                          </span>
                        )}
                        {d.vendor && <span className="text-gray-600">by {d.vendor.name}</span>}
                      </div>
                      {d.password_hint && (
                        <div className="mt-1 text-xs text-gray-500">🔒 Password: {d.password_hint}</div>
                      )}
                      {d.revision_notes && (
                        <div className="mt-1 text-xs text-orange-400 flex items-start gap-1">
                          <RefreshCw className="w-3 h-3 mt-0.5 shrink-0" />
                          {d.revision_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={d.media_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg text-xs font-medium">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>
                      {(d.status === 'uploaded_by_vendor' || d.status === 'under_review') && (
                        <button onClick={() => { setReviewModal({ id: d.id, name: d.deliverable_name }); setReviewStatus('approved'); setReviewNotes('') }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-medium">
                          Review
                        </button>
                      )}
                      <button onClick={() => handleDeleteDeliverable(d.id)}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* ── Shot List ── */
        shots.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No shots in the list yet</p>
            <button onClick={() => setShowAddShot(true)} className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm">Add First Shot</button>
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.entries(shotsByCategory) as [ShotCategory, Shot[]][]).map(([cat, catShots]) => {
              const catConf = SHOT_CATEGORY_CONFIG[cat]
              const done = catShots.filter(s => s.is_completed).length
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg">{catConf?.icon}</span>
                    <h3 className="font-medium text-sm text-gray-200">{catConf?.label}</h3>
                    <span className="text-xs text-gray-500">{done}/{catShots.length}</span>
                    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${catShots.length > 0 ? (done / catShots.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2 ml-8">
                    {catShots.map(shot => (
                      <div key={shot.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                          shot.is_completed ? 'bg-gray-900/30 border-gray-800/50 opacity-60' : 'bg-gray-900/60 border-gray-800'
                        }`}>
                        <button onClick={() => handleToggleShot(shot.id, !shot.is_completed)}
                          className={`mt-0.5 shrink-0 ${shot.is_completed ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}>
                          {shot.is_completed
                            ? <CheckCircle2 className="w-5 h-5" />
                            : <Square className="w-5 h-5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${shot.is_completed ? 'line-through text-gray-500' : 'font-medium'}`}>
                              {shot.shot_name}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_CONFIG[shot.priority]?.color}`}>
                              {PRIORITY_CONFIG[shot.priority]?.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                            {shot.location && <span>📍 {shot.location}</span>}
                            {shot.time_window && <span>⏰ {shot.time_window}</span>}
                            {shot.people_involved?.length ? <span>👤 {shot.people_involved.join(', ')}</span> : null}
                          </div>
                          {shot.description && (
                            <div className="text-xs text-gray-600 mt-1">{shot.description}</div>
                          )}
                        </div>
                        {shot.reference_url && (
                          <a href={shot.reference_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-violet-400 shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="font-semibold mb-1">Review Deliverable</h3>
              <p className="text-sm text-gray-400 mb-4">{reviewModal.name}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Decision</label>
                  <div className="flex gap-2">
                    {(['approved', 'revision_requested'] as const).map(s => (
                      <button key={s} onClick={() => setReviewStatus(s)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          reviewStatus === s
                            ? s === 'approved' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-orange-600 border-orange-600 text-white'
                            : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                        }`}>
                        {s === 'approved' ? '✓ Approve' : '↩ Request Revision'}
                      </button>
                    ))}
                  </div>
                </div>
                {reviewStatus === 'revision_requested' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Revision Notes</label>
                    <textarea rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                      placeholder="Describe what needs to be changed..." value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-800">
              <button onClick={() => setReviewModal(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
              <button onClick={handleReview} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Submit Review</button>
            </div>
          </div>
        </div>
      )}

      {showAddShot && <AddShotModal eventId={eventId} onClose={() => setShowAddShot(false)} onSave={handleAddShot} />}
      {showAddDeliverable && <AddDeliverableModal eventId={eventId} onClose={() => setShowAddDeliverable(false)} onSave={handleAddDeliverable} />}
    </div>
  )
}
