'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateType = 'general' | 'milestone' | 'alert' | 'vendor' | 'finance' | 'design' | 'logistics' | 'approval_request'
type DocApprovalStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'revision_requested'
type BudgetStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'revision_requested' | 'on_hold'
type TimelineStatus = 'upcoming' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
type MoodboardCategory = 'general' | 'decor' | 'floral' | 'lighting' | 'venue' | 'attire' | 'cake' | 'catering' | 'entertainment' | 'photography' | 'color_palette'

interface PortalConfig {
  portal_name: string
  primary_color: string
  accent_color: string
  logo_url?: string
  access_token: string
  is_active: boolean
  show_timeline: boolean
  show_budget: boolean
  show_documents: boolean
  show_moodboard: boolean
  show_updates: boolean
  welcome_message?: string
}

interface ClientUpdate {
  id: string
  title: string
  body: string
  update_type: UpdateType
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_pinned: boolean
  client_read: boolean
  published_at: string
}

interface TimelineItem {
  id: string
  title: string
  description?: string
  category: string
  due_date?: string
  status: TimelineStatus
  requires_client_action: boolean
  completed_at?: string
}

interface ClientDocument {
  id: string
  name: string
  document_type: string
  file_url: string
  requires_approval: boolean
  approval_status: DocApprovalStatus
  client_notes?: string
  created_at: string
}

interface MoodboardItem {
  id: string
  title?: string
  caption?: string
  image_url: string
  category: MoodboardCategory
  client_liked?: boolean
  client_note?: string
  grid_size: 'small' | 'medium' | 'large' | 'full'
}

interface BudgetItem {
  id: string
  category: string
  item_name: string
  description?: string
  estimated_amount: number
  final_amount?: number
  status: BudgetStatus
  is_optional: boolean
  is_upgrade: boolean
  client_notes?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const updateTypeConfig: Record<UpdateType, { label: string; color: string; icon: string }> = {
  general:          { label: 'Update',   color: 'text-muted-foreground bg-slate-500/10',   icon: '💬' },
  milestone:        { label: 'Milestone',color: 'text-violet-400 bg-violet-500/10', icon: '🏆' },
  alert:            { label: 'Alert',    color: 'text-red-400 bg-red-500/10',       icon: '🚨' },
  vendor:           { label: 'Vendor',   color: 'text-blue-400 bg-blue-500/10',     icon: '🤝' },
  finance:          { label: 'Finance',  color: 'text-emerald-400 bg-emerald-500/10',icon: '💰' },
  design:           { label: 'Design',   color: 'text-pink-400 bg-pink-500/10',     icon: '🎨' },
  logistics:        { label: 'Logistics',color: 'text-orange-400 bg-orange-500/10', icon: '🚛' },
  approval_request: { label: 'Action',   color: 'text-amber-400 bg-amber-500/10',   icon: '✅' },
}

const docStatusConfig: Record<DocApprovalStatus, { label: string; color: string }> = {
  pending:            { label: 'Pending',           color: 'text-muted-foreground bg-slate-500/20' },
  under_review:       { label: 'Under Review',      color: 'text-blue-400 bg-blue-500/20' },
  approved:           { label: 'Approved',          color: 'text-emerald-400 bg-emerald-500/20' },
  rejected:           { label: 'Rejected',          color: 'text-red-400 bg-red-500/20' },
  revision_requested: { label: 'Revision Needed',   color: 'text-amber-400 bg-amber-500/20' },
}

const budgetStatusConfig: Record<BudgetStatus, { label: string; color: string }> = {
  draft:              { label: 'Draft',             color: 'text-muted-foreground bg-slate-500/20' },
  pending_approval:   { label: 'Awaiting Approval', color: 'text-amber-400 bg-amber-500/20' },
  approved:           { label: 'Approved',          color: 'text-emerald-400 bg-emerald-500/20' },
  rejected:           { label: 'Rejected',          color: 'text-red-400 bg-red-500/20' },
  revision_requested: { label: 'Revision Needed',   color: 'text-orange-400 bg-orange-500/20' },
  on_hold:            { label: 'On Hold',           color: 'text-muted-foreground bg-slate-500/20' },
}

const timelineStatusConfig: Record<TimelineStatus, { icon: string; color: string }> = {
  upcoming:    { icon: '○', color: 'text-muted-foreground' },
  in_progress: { icon: '◐', color: 'text-blue-400' },
  completed:   { icon: '●', color: 'text-emerald-400' },
  delayed:     { icon: '!', color: 'text-amber-400' },
  cancelled:   { icon: '✕', color: 'text-red-400' },
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-foreground' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-muted/30 p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function UpdateCard({ update }: { update: ClientUpdate }) {
  const cfg = updateTypeConfig[update.update_type]
  const priorityColor = update.priority === 'urgent' ? 'border-red-500/30' : update.priority === 'high' ? 'border-amber-500/20' : 'border-border/30'
  return (
    <div className={`rounded-xl border ${priorityColor} bg-muted/30 p-4 hover:bg-muted/35 transition-colors`}>
      <div className="flex items-start gap-3">
        {update.is_pinned && <span className="text-amber-400 mt-0.5 flex-shrink-0">📌</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
            {!update.client_read && <span className="w-2 h-2 bg-violet-400 rounded-full" title="Unread" />}
            {update.priority === 'urgent' && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-red-400 bg-red-500/10">URGENT</span>}
          </div>
          <h4 className="text-sm font-semibold text-foreground">{update.title}</h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{update.body}</p>
          <p className="text-xs text-slate-600 mt-2">{fmt(update.published_at)}</p>
        </div>
      </div>
    </div>
  )
}

function TimelineView({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-muted/40" />
      <div className="space-y-1">
        {items.map((item, i) => {
          const cfg = timelineStatusConfig[item.status]
          return (
            <div key={item.id} className="relative flex gap-4 pl-10">
              <div className={`absolute left-3 top-4 w-3 h-3 rounded-full border-2 flex items-center justify-center text-[8px] font-bold z-10
                ${item.status === 'completed' ? 'bg-emerald-400 border-emerald-400 text-foreground' :
                  item.status === 'in_progress' ? 'bg-blue-400/20 border-blue-400 text-blue-400' :
                  'bg-[#0f172a] border-border/80'}`}>
                {item.status === 'completed' ? '✓' : ''}
              </div>
              <div className={`flex-1 rounded-xl border p-4 mb-1 transition-colors
                ${item.status === 'completed' ? 'border-emerald-500/10 bg-emerald-500/5' :
                  item.status === 'in_progress' ? 'border-blue-500/20 bg-blue-500/5' :
                  item.requires_client_action ? 'border-amber-500/20 bg-amber-500/5' :
                  'border-border/30 bg-muted/20'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      {item.requires_client_action && item.status !== 'completed' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">Your action</span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {item.completed_at ? (
                      <span className="text-xs text-emerald-400">Done {fmt(item.completed_at)}</span>
                    ) : item.due_date ? (
                      <span className="text-xs text-muted-foreground">Due {fmt(item.due_date)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DocumentRow({ doc, onApprove, onReject, onRevision }: {
  doc: ClientDocument
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRevision: (id: string) => void
}) {
  const cfg = docStatusConfig[doc.approval_status]
  const docIcons: Record<string, string> = {
    contract: '📄', proposal: '📋', invoice: '💸', design: '🎨',
    floor_plan: '📐', mood_board: '🖼️', vendor_quote: '💼', timeline: '📅', run_of_show: '🎬', other: '📁',
  }
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/25 transition-colors">
      <span className="text-2xl flex-shrink-0">{docIcons[doc.document_type] ?? '📁'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
          {doc.requires_approval && <span className="text-xs text-amber-400/70">Requires approval</span>}
        </div>
        {doc.client_notes && <p className="text-xs text-amber-400 mt-0.5">Client note: {doc.client_notes}</p>}
        <p className="text-xs text-slate-600 mt-0.5">Uploaded {fmt(doc.created_at)}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      {doc.requires_approval && doc.approval_status === 'pending' && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onApprove(doc.id)} className="px-3 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium">Approve</button>
          <button onClick={() => onRevision(doc.id)} className="px-3 py-1 text-xs rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium">Revise</button>
          <button onClick={() => onReject(doc.id)} className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium">Reject</button>
        </div>
      )}
    </div>
  )
}

function MoodboardGrid({ items, onReact }: { items: MoodboardItem[]; onReact: (id: string, liked: boolean) => void }) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
      {items.map(item => (
        <div
          key={item.id}
          className={`break-inside-avoid rounded-xl overflow-hidden border border-border/60 group relative
            ${item.grid_size === 'large' ? 'row-span-2' : ''}`}
        >
          <img
            src={item.image_url}
            alt={item.title ?? item.category}
            className="w-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/400/300` }}
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              {item.title && <p className="text-foreground text-xs font-medium">{item.title}</p>}
              {item.caption && <p className="text-muted-foreground text-xs">{item.caption}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onReact(item.id, true)}
                  className={`text-xl hover:scale-110 transition-transform ${item.client_liked === true ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                >❤️</button>
                <button
                  onClick={() => onReact(item.id, false)}
                  className={`text-xl hover:scale-110 transition-transform ${item.client_liked === false ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                >👎</button>
              </div>
            </div>
          </div>
          {/* Reaction badge */}
          {item.client_liked !== null && item.client_liked !== undefined && (
            <div className="absolute top-2 right-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${item.client_liked ? 'bg-red-500' : 'bg-slate-700'}`}>
                {item.client_liked ? '❤' : '✕'}
              </span>
            </div>
          )}
          {/* Category badge */}
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full text-xs bg-black/50 text-foreground/80 capitalize">{item.category.replace('_', ' ')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BudgetTable({ items, onApprove, onReject }: {
  items: BudgetItem[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const total = items.reduce((s, b) => s + b.estimated_amount, 0)
  const approved = items.filter(b => b.status === 'approved').reduce((s, b) => s + b.estimated_amount, 0)
  const pending = items.filter(b => b.status === 'pending_approval').reduce((s, b) => s + b.estimated_amount, 0)

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, BudgetItem[]>)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/30 bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Estimate</p>
          <p className="text-xl font-bold text-foreground">{fmtCurrency(total)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Approved</p>
          <p className="text-xl font-bold text-emerald-400">{fmtCurrency(approved)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pending Approval</p>
          <p className="text-xl font-bold text-amber-400">{fmtCurrency(pending)}</p>
        </div>
      </div>

      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="rounded-xl border border-border/30 overflow-hidden">
          <div className="px-4 py-3 bg-muted/25 border-b border-border/30">
            <span className="text-sm font-semibold text-foreground">{category}</span>
            <span className="text-xs text-muted-foreground ml-2">{fmtCurrency(catItems.reduce((s, b) => s + b.estimated_amount, 0))}</span>
          </div>
          {catItems.map(item => {
            const cfg = budgetStatusConfig[item.status]
            return (
              <div key={item.id} className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{item.item_name}</span>
                    {item.is_optional && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-muted-foreground">Optional</span>}
                    {item.is_upgrade && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">Upgrade</span>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                  {item.client_notes && <p className="text-xs text-amber-400 mt-0.5">Note: {item.client_notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-foreground">{fmtCurrency(item.estimated_amount)}</p>
                  {item.final_amount && item.final_amount !== item.estimated_amount && (
                    <p className="text-xs text-muted-foreground">Final: {fmtCurrency(item.final_amount)}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                {item.status === 'pending_approval' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => onApprove(item.id)} className="px-3 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Approve</button>
                    <button onClick={() => onReject(item.id)} className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Reject</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function PortalConfigPanel({ config }: { config: PortalConfig }) {
  const [copied, setCopied] = useState(false)
  const portalUrl = `https://portal.occasionpro.com/${config.access_token}`

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Portal Link */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Client Portal Link</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${config.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {config.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={portalUrl}
            className="flex-1 rounded-lg bg-black/30 border border-border/60 px-3 py-2 text-xs text-foreground/80 font-mono"
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-xs font-medium"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Share this link with your client — no login required</p>
      </div>

      {/* Branding preview */}
      <div className="rounded-xl border border-border/30 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Branding</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Portal Name</p>
            <p className="text-sm text-foreground font-medium">{config.portal_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Colors</p>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full border border-border/80" style={{ background: config.primary_color }} title="Primary" />
              <div className="w-6 h-6 rounded-full border border-border/80" style={{ background: config.accent_color }} title="Accent" />
            </div>
          </div>
        </div>
        {config.welcome_message && (
          <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Welcome Message</p>
            <p className="text-sm text-foreground/80 italic">"{config.welcome_message}"</p>
          </div>
        )}
      </div>

      {/* Feature flags */}
      <div className="rounded-xl border border-border/30 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Visible Sections</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'show_updates', label: 'Updates Feed' },
            { key: 'show_timeline', label: 'Event Timeline' },
            { key: 'show_documents', label: 'Documents' },
            { key: 'show_moodboard', label: 'Mood Board' },
            { key: 'show_budget', label: 'Budget Overview' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
              <span className="text-sm text-foreground/80">{label}</span>
              <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${config[key as keyof PortalConfig] ? 'bg-violet-500' : 'bg-slate-700'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${config[key as keyof PortalConfig] ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'updates', label: 'Updates', icon: '📣' },
  { id: 'timeline', label: 'Timeline', icon: '📅' },
  { id: 'documents', label: 'Documents', icon: '📁' },
  { id: 'moodboard', label: 'Mood Board', icon: '🎨' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function ClientPortalPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  // ── Event selector ─────────────────────────────────────────────────────────
  const [events, setEvents] = useState<{ id: string; name: string; date?: string }[]>([])
  const [eventId, setEventId] = useState('')
  const [eventsLoading, setEventsLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    const h = { Authorization: `Bearer ${token}` }
    fetch(`${API}/events?limit=100`, { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data.data ?? [])
        setEvents(list)
        if (list.length > 0) setEventId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false))
  }, [token])

  // ── Portal data ────────────────────────────────────────────────────────────
  const [updates, setUpdates] = useState<ClientUpdate[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [moodboard, setMoodboard] = useState<MoodboardItem[]>([])
  const [budget, setBudget] = useState<BudgetItem[]>([])
  const [config, setConfig] = useState<PortalConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    if (!token || !eventId) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    const base = `${API}/client-portal/events/${eventId}`
    try {
      const [cfg, upd, tl, docs, mb, bud] = await Promise.all([
        fetch(`${base}/config`, { headers: h }).then(r => r.ok ? r.json() : null),
        fetch(`${base}/updates`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/timeline`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/documents`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/moodboard`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/budget`, { headers: h }).then(r => r.ok ? r.json() : []),
      ])
      setConfig(cfg)
      setUpdates(Array.isArray(upd) ? upd : (upd.data ?? []))
      setTimeline(Array.isArray(tl) ? tl : (tl.data ?? []))
      setDocuments(Array.isArray(docs) ? docs : (docs.data ?? []))
      setMoodboard(Array.isArray(mb) ? mb : (mb.data ?? []))
      setBudget(Array.isArray(bud) ? bud : (bud.data ?? []))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token, eventId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Computed stats ─────────────────────────────────────────────────────────
  const unreadUpdates = updates.filter(u => !u.client_read).length
  const pendingDocs = documents.filter(d => d.requires_approval && d.approval_status === 'pending').length
  const completedTimeline = timeline.filter(t => t.status === 'completed').length
  const timelineProgress = timeline.length > 0 ? Math.round((completedTimeline / timeline.length) * 100) : 0
  const totalBudget = budget.reduce((s, b) => s + b.estimated_amount, 0)
  const approvedBudget = budget.filter(b => b.status === 'approved').reduce((s, b) => s + b.estimated_amount, 0)
  const likedItems = moodboard.filter(m => m.client_liked === true).length
  const clientActionsRequired = timeline.filter(t => t.requires_client_action && t.status !== 'completed').length
    + pendingDocs
    + budget.filter(b => b.status === 'pending_approval').length

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleDocApprove = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/documents/${id}/approve`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDocuments(prev => prev.map(d => d.id === id ? { ...d, approval_status: 'approved' as DocApprovalStatus } : d))
  }, [token])

  const handleDocReject = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/documents/${id}/reject`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDocuments(prev => prev.map(d => d.id === id ? { ...d, approval_status: 'rejected' as DocApprovalStatus } : d))
  }, [token])

  const handleDocRevision = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/documents/${id}/request-revision`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDocuments(prev => prev.map(d => d.id === id ? { ...d, approval_status: 'revision_requested' as DocApprovalStatus } : d))
  }, [token])

  const handleBudgetApprove = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/budget/${id}/approve`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setBudget(prev => prev.map(b => b.id === id ? { ...b, status: 'approved' as BudgetStatus } : b))
  }, [token])

  const handleBudgetReject = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/budget/${id}/reject`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setBudget(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' as BudgetStatus } : b))
  }, [token])

  const handleMoodReact = useCallback(async (id: string, liked: boolean) => {
    if (!token) return
    const res = await fetch(`${API}/client-portal/moodboard/${id}/react`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ liked }),
    })
    if (res.ok) setMoodboard(prev => prev.map(m => m.id === id ? { ...m, client_liked: liked } : m))
  }, [token])

  // Fallback config for display when API config isn't loaded yet
  const displayConfig: PortalConfig = config ?? {
    portal_name: events.find(e => e.id === eventId)?.name ?? 'Client Portal',
    primary_color: '#7c3aed', accent_color: '#a78bfa',
    access_token: '', is_active: false,
    show_timeline: true, show_budget: true, show_documents: true,
    show_moodboard: true, show_updates: true,
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-foreground">
      {/* ── Header ── */}
      <div className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground font-bold text-sm"
                style={{ background: `linear-gradient(135deg, ${displayConfig.primary_color}, ${displayConfig.accent_color})` }}
              >
                {displayConfig.portal_name.charAt(0)}
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">{displayConfig.portal_name}</h1>
                <p className="text-xs text-muted-foreground">Client Collaboration Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Event selector */}
              {!eventsLoading && events.length > 0 && (
                <select
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  className="bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground/80 outline-none focus:border-violet-500/50 max-w-[200px]"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              )}
              {clientActionsRequired > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-xs text-amber-400 font-medium">{clientActionsRequired} action{clientActionsRequired !== 1 ? 's' : ''} needed</span>
                </div>
              )}
              <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                Preview Portal →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            let badge = 0
            if (tab.id === 'updates') badge = unreadUpdates
            if (tab.id === 'documents') badge = pendingDocs
            if (tab.id === 'budget') badge = budget.filter(b => b.status === 'pending_approval').length
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-foreground text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Timeline Progress" value={`${timelineProgress}%`}
                sub={`${completedTimeline}/${timeline.length} milestones`} color="text-violet-400" />
              <StatCard label="Total Budget" value={fmtCurrency(totalBudget)}
                sub={`${fmtCurrency(approvedBudget)} approved`} />
              <StatCard label="Unread Updates" value={unreadUpdates}
                sub="from your team" color={unreadUpdates > 0 ? 'text-amber-400' : 'text-foreground'} />
              <StatCard label="Mood Board Likes" value={likedItems}
                sub={`${moodboard.length} items total`} color="text-pink-400" />
            </div>

            {/* Timeline progress bar */}
            <div className="rounded-xl border border-border/30 bg-muted/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Overall Progress</h3>
                <span className="text-sm font-bold text-violet-400">{timelineProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${timelineProgress}%`, background: `linear-gradient(90deg, ${displayConfig.primary_color}, ${displayConfig.accent_color})` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Booking Phase</span>
                <span>Planning Phase</span>
                <span>Event Day</span>
              </div>
            </div>

            {/* 2-col layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latest updates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Latest Updates</h3>
                  <button onClick={() => setActiveTab('updates')} className="text-xs text-violet-400 hover:text-violet-300">View all</button>
                </div>
                <div className="space-y-2">
                  {updates.slice(0, 3).map(u => <UpdateCard key={u.id} update={u} />)}
                </div>
              </div>

              {/* Client action items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Action Required</h3>
                  {clientActionsRequired > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{clientActionsRequired} pending</span>
                  )}
                </div>
                <div className="space-y-2">
                  {timeline.filter(t => t.requires_client_action && t.status !== 'completed').slice(0, 2).map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <span className="text-amber-400">⚡</span>
                      <div>
                        <p className="text-sm text-foreground font-medium">{t.title}</p>
                        {t.due_date && <p className="text-xs text-muted-foreground">Due {fmt(t.due_date)}</p>}
                      </div>
                    </div>
                  ))}
                  {documents.filter(d => d.requires_approval && d.approval_status === 'pending').slice(0, 2).map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <span className="text-blue-400">📄</span>
                      <div>
                        <p className="text-sm text-foreground font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">Awaiting your approval</p>
                      </div>
                    </div>
                  ))}
                  {budget.filter(b => b.status === 'pending_approval').slice(0, 2).map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <span className="text-emerald-400">💰</span>
                      <div>
                        <p className="text-sm text-foreground font-medium">{b.item_name}</p>
                        <p className="text-xs text-muted-foreground">{fmtCurrency(b.estimated_amount)} — awaiting sign-off</p>
                      </div>
                    </div>
                  ))}
                  {clientActionsRequired === 0 && (
                    <div className="p-8 text-center rounded-xl border border-border/30 bg-muted/20">
                      <p className="text-2xl mb-2">🎉</p>
                      <p className="text-sm text-muted-foreground">All caught up! No pending actions.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Updates ── */}
        {activeTab === 'updates' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Client Updates</h2>
              <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                + New Update
              </button>
            </div>
            <div className="space-y-3">
              {updates.map(u => <UpdateCard key={u.id} update={u} />)}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        {activeTab === 'timeline' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Event Timeline</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{completedTimeline} of {timeline.length} milestones completed</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                + Add Milestone
              </button>
            </div>
            <TimelineView items={timeline} />
          </div>
        )}

        {/* ── Documents ── */}
        {activeTab === 'documents' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Documents</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{pendingDocs} awaiting approval</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                + Upload Document
              </button>
            </div>
            <div className="space-y-2">
              {documents.map(d => (
                <DocumentRow key={d.id} doc={d}
                  onApprove={handleDocApprove}
                  onReject={handleDocReject}
                  onRevision={handleDocRevision}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Mood Board ── */}
        {activeTab === 'moodboard' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Mood Board</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{likedItems} items liked · hover to react</p>
              </div>
              <div className="flex gap-2">
                <select className="px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-foreground/80 text-sm">
                  <option value="">All Categories</option>
                  <option value="decor">Décor</option>
                  <option value="floral">Floral</option>
                  <option value="lighting">Lighting</option>
                  <option value="venue">Venue</option>
                  <option value="attire">Attire</option>
                </select>
                <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                  + Add Image
                </button>
              </div>
            </div>
            <MoodboardGrid items={moodboard} onReact={handleMoodReact} />
          </div>
        )}

        {/* ── Budget ── */}
        {activeTab === 'budget' && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Budget Approvals</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{budget.filter(b => b.status === 'pending_approval').length} items awaiting client sign-off</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium border border-violet-500/20">
                + Add Budget Item
              </button>
            </div>
            <BudgetTable items={budget} onApprove={handleBudgetApprove} onReject={handleBudgetReject} />
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <h2 className="text-base font-semibold text-foreground mb-4">Portal Settings</h2>
            <PortalConfigPanel config={displayConfig} />
          </div>
        )}
      </div>
    </div>
  )
}
