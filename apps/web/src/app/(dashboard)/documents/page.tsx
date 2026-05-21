'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Search, Filter, Download, Send, Eye, CheckCircle2,
  Clock, AlertTriangle, XCircle, Pen, Archive, MoreVertical,
  Loader2, X, Check, ChevronRight, Star, Copy, Trash2,
  DollarSign, CalendarDays, Users, Building2, RefreshCw,
  FileSignature, Receipt, ClipboardList, BookOpen, Briefcase,
  ArrowUpRight, BarChart3, TrendingUp, Shield,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  name: string
  document_type: string
  status: string
  version: number
  event_id: string | null
  client_id: string | null
  total_amount: number | null
  currency: string
  due_date: string | null
  requires_signature: boolean
  signed_at: string | null
  sent_at: string | null
  viewed_at: string | null
  view_count: number
  created_at: string
  updated_at: string
  events?: { name: string; event_date: string }
  crm_contacts?: { first_name: string; last_name: string; email: string }
}

interface Template {
  id: string
  name: string
  document_type: string
  description: string | null
  is_system: boolean
  variables: any[]
}

interface Stats {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  totalInvoiced: number
  pendingSignature: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  proposal:         { label: 'Proposal',         icon: Briefcase,       color: '#6366f1' },
  contract:         { label: 'Contract',          icon: FileSignature,   color: '#0ea5e9' },
  invoice:          { label: 'Invoice',           icon: Receipt,         color: '#10b981' },
  beo:              { label: 'BEO',               icon: ClipboardList,   color: '#f59e0b' },
  run_of_show:      { label: 'Run of Show',       icon: Clock,           color: '#8b5cf6' },
  vendor_agreement: { label: 'Vendor Agreement',  icon: Building2,       color: '#ec4899' },
  letter:           { label: 'Letter',            icon: FileText,        color: 'hsl(var(--muted-foreground))' },
  quote:            { label: 'Quote',             icon: DollarSign,      color: '#14b8a6' },
  nda:              { label: 'NDA',               icon: Shield,          color: '#ef4444' },
  custom:           { label: 'Custom',            icon: BookOpen,        color: '#78716c' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'text-slate-400',  bg: 'bg-slate-500/10',  icon: FileText },
  review:   { label: 'Review',   color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock },
  sent:     { label: 'Sent',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: Send },
  viewed:   { label: 'Viewed',   color: 'text-violet-400', bg: 'bg-violet-500/10', icon: Eye },
  signed:   { label: 'Signed',   color: 'text-green-400',  bg: 'bg-green-500/10',  icon: CheckCircle2 },
  approved: { label: 'Approved', color: 'text-emerald-400',bg: 'bg-emerald-500/10',icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-400',   bg: 'bg-red-500/10',    icon: XCircle },
  expired:  { label: 'Expired',  color: 'text-orange-400', bg: 'bg-orange-500/10', icon: AlertTriangle },
  archived: { label: 'Archived', color: 'text-slate-500',  bg: 'bg-slate-500/10',  icon: Archive },
}

const DOC_TYPES = ['All', 'Proposal', 'Contract', 'Invoice', 'BEO', 'Run of Show', 'Vendor Agreement', 'Quote', 'NDA']
const STATUSES  = ['All', 'Draft', 'Sent', 'Viewed', 'Signed', 'Approved', 'Rejected', 'Archived']

function formatCurrency(amount: number | null, currency = 'INR') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreated: (d: Document) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [step, setStep] = useState<'type' | 'template' | 'details'>('type')
  const [selectedType, setSelectedType] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [form, setForm] = useState({ name: '', event_id: '', client_id: '', requires_signature: false })
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/documents/templates').then(r => setTemplates(r.data?.templates ?? [])),
      api.get('/events?limit=50').then(r => setEvents(r.data?.events ?? r.data?.data ?? [])),
    ]).catch(() => {})
  }, [])

  const filteredTemplates = selectedType
    ? templates.filter(t => t.document_type === selectedType)
    : templates

  async function handleCreate() {
    if (!form.name.trim()) { setError('Document name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/documents', {
        name: form.name,
        document_type: selectedType,
        template_id: selectedTemplate?.id,
        event_id: form.event_id || null,
        client_id: form.client_id || null,
        requires_signature: form.requires_signature,
      })
      onCreated(res.data)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create document')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-sm">New Document</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'type' ? 'Choose document type' : step === 'template' ? 'Select a template' : 'Fill in details'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Type */}
          {step === 'type' && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setSelectedType(key); setStep('template') }}
                  className="flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary/40 hover:bg-accent transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}22` }}>
                    <cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-sm font-medium">{cfg.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Template */}
          {step === 'template' && (
            <div className="space-y-2">
              <button
                onClick={() => { setSelectedTemplate(null); setStep('details') }}
                className="w-full flex items-center gap-3 p-3 border border-dashed border-border rounded-xl hover:border-primary/40 hover:bg-accent transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Blank document</p>
                  <p className="text-xs text-muted-foreground">Start from scratch</p>
                </div>
              </button>
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t)
                    setForm(f => ({ ...f, name: t.name }))
                    setStep('details')
                  }}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary/40 hover:bg-accent transition-all text-left"
                >
                  {t.is_system && <Star className="w-3 h-3 text-violet-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.variables.length} vars</span>
                </button>
              ))}
              <button onClick={() => setStep('type')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Document Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Proposal for Sharma Wedding 2025"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Linked Event</label>
                <select
                  value={form.event_id}
                  onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, requires_signature: !f.requires_signature }))}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                    form.requires_signature ? 'bg-primary border-primary' : 'border-border bg-background'
                  }`}
                >
                  {form.requires_signature && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-sm text-muted-foreground">Requires e-signature</span>
              </label>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep('template')} className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Creating…' : 'Create Document'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Send Modal ────────────────────────────────────────────────────────────────

function SendModal({ doc, onClose, onSent }: { doc: Document; onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState(doc.crm_contacts?.email ?? '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  async function handleSend() {
    setSending(true)
    try {
      const res = await api.post(`/documents/${doc.id}/send`, { recipient_email: email, message })
      setShareUrl(res.data.shareUrl ?? '')
      setSent(true)
      onSent()
    } catch (e: any) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-sm">Send Document</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <p className="font-medium text-sm mb-1">Document sent!</p>
              {shareUrl && (
                <div className="mt-3 bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground break-all">
                  {shareUrl}
                </div>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Copy share link
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5">Recipient Email</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="client@example.com"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Message (optional)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Add a personal note…"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </>
          )}
        </div>

        {!sent && (
          <div className="flex gap-2 p-5 pt-0">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send & Generate Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onSelect, selected, onSend, onDelete }: {
  doc: Document
  onSelect: () => void
  selected: boolean
  onSend: () => void
  onDelete: () => void
}) {
  const typeCfg = DOC_TYPE_CONFIG[doc.document_type] ?? DOC_TYPE_CONFIG.custom
  const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft
  const TypeIcon = typeCfg.icon
  const StatusIcon = statusCfg.icon

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-accent/40 ${
        selected ? 'bg-primary/5' : ''
      }`}
    >
      {/* Type icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${typeCfg.color}22` }}
      >
        <TypeIcon className="w-4 h-4" style={{ color: typeCfg.color }} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{doc.name}</p>
          {doc.requires_signature && !doc.signed_at && (
            <Pen className="w-3 h-3 text-amber-400 shrink-0" title="Signature required" />
          )}
          {doc.signed_at && (
            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" title="Signed" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span className="capitalize">{typeCfg.label}</span>
          {doc.events && <span>· {doc.events.name}</span>}
          {doc.crm_contacts && (
            <span>· {doc.crm_contacts.first_name} {doc.crm_contacts.last_name}</span>
          )}
          <span>· v{doc.version}</span>
        </div>
      </div>

      {/* Amount */}
      {doc.total_amount != null && (
        <div className="text-right shrink-0 hidden md:block">
          <p className="text-sm font-semibold">{formatCurrency(doc.total_amount, doc.currency)}</p>
          {doc.due_date && (
            <p className="text-[10px] text-muted-foreground">due {new Date(doc.due_date).toLocaleDateString()}</p>
          )}
        </div>
      )}

      {/* Status */}
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusCfg.color} ${statusCfg.bg}`}>
        <StatusIcon className="w-2.5 h-2.5" />
        {statusCfg.label}
      </div>

      {/* Time */}
      <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:block">
        {timeAgo(doc.updated_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {doc.status === 'draft' && (
          <button
            onClick={e => { e.stopPropagation(); onSend() }}
            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
            title="Send"
          >
            <Send className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ id, onClose, onSend, onRefresh }: {
  id: string
  onClose: () => void
  onSend: () => void
  onRefresh: () => void
}) {
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/documents/${id}`).then(r => setDoc(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const typeCfg = doc ? (DOC_TYPE_CONFIG[doc.document_type] ?? DOC_TYPE_CONFIG.custom) : null
  const statusCfg = doc ? (STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft) : null

  async function handleGeneratePdf() {
    setGeneratingPdf(true)
    try {
      await api.post(`/documents/${id}/generate-pdf`)
      onRefresh()
    } catch {}
    finally { setGeneratingPdf(false) }
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await api.post(`/documents/${id}/approve`)
      setDoc((d: any) => d ? { ...d, status: 'approved' } : d)
      onRefresh()
    } catch {}
    finally { setApproving(false) }
  }

  if (loading) return (
    <div className="w-[380px] shrink-0 border-l border-border bg-card flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (!doc) return (
    <div className="w-[380px] shrink-0 border-l border-border bg-card flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  )

  const TypeIcon = typeCfg!.icon
  const StatusIcon = statusCfg!.icon

  return (
    <div className="w-[380px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${typeCfg!.color}22` }}
          >
            <TypeIcon className="w-5 h-5" style={{ color: typeCfg!.color }} />
          </div>
          <div className="flex items-center gap-1">
            {doc.status === 'draft' && (
              <button
                onClick={onSend}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            )}
            {doc.status === 'sent' || doc.status === 'viewed' ? (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
            ) : null}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h2 className="font-semibold text-base leading-tight mb-1.5">{doc.name}</h2>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${statusCfg!.color} ${statusCfg!.bg}`}>
            <StatusIcon className="w-2.5 h-2.5" /> {statusCfg!.label}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground capitalize">
            {typeCfg!.label}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
            v{doc.version}
          </span>
        </div>

        {/* Key info */}
        <div className="space-y-1.5 text-xs">
          {doc.events && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3 h-3 shrink-0" />
              <span>{doc.events.name}</span>
            </div>
          )}
          {doc.crm_contacts && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-3 h-3 shrink-0" />
              <span>{doc.crm_contacts.first_name} {doc.crm_contacts.last_name} · {doc.crm_contacts.email}</span>
            </div>
          )}
          {doc.total_amount != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-3 h-3 shrink-0" />
              <span className="font-semibold text-foreground">{formatCurrency(doc.total_amount, doc.currency)}</span>
              {doc.due_date && <span>· due {new Date(doc.due_date).toLocaleDateString()}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {(doc.view_count > 0 || doc.sent_at || doc.signed_at) && (
        <div className="grid grid-cols-3 border-b border-border divide-x divide-border">
          <div className="flex flex-col items-center py-3 text-center">
            <p className="text-base font-bold">{doc.view_count}</p>
            <p className="text-[10px] text-muted-foreground">Views</p>
          </div>
          <div className="flex flex-col items-center py-3 text-center">
            <p className="text-xs font-medium">{doc.sent_at ? timeAgo(doc.sent_at) : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          <div className="flex flex-col items-center py-3 text-center">
            <p className="text-xs font-medium">{doc.signed_at ? timeAgo(doc.signed_at) : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Signed</p>
          </div>
        </div>
      )}

      {/* Line items */}
      {doc.lineItems?.length > 0 && (
        <div className="p-4 border-b border-border">
          <p className="text-xs font-medium mb-2">Line Items</p>
          <div className="space-y-1.5">
            {doc.lineItems.map((li: any) => (
              <div key={li.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate flex-1">{li.description}</span>
                <span className="font-medium shrink-0">₹{li.line_total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs font-semibold">
            <span>Total</span>
            <span>{formatCurrency(doc.total_amount, doc.currency)}</span>
          </div>
        </div>
      )}

      {/* Signature */}
      {doc.requires_signature && (
        <div className="p-4 border-b border-border">
          <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
            <Pen className="w-3 h-3" /> Signature
          </p>
          {doc.signed_at ? (
            <div className="text-xs space-y-0.5">
              <p className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Signed by {doc.signed_by_name}</p>
              <p className="text-muted-foreground">{new Date(doc.signed_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Awaiting signature
            </p>
          )}
        </div>
      )}

      {/* Activity */}
      {doc.activities?.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-medium mb-3">Activity</p>
          <div className="space-y-2">
            {doc.activities.slice(0, 10).map((act: any) => (
              <div key={act.id} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs capitalize text-muted-foreground">
                    {act.action.replace('_', ' ')}
                    {act.actor_name && ` · ${act.actor_name}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{timeAgo(act.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF action */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleGeneratePdf}
          disabled={generatingPdf}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-60"
        >
          {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {generatingPdf ? 'Generating PDF…' : 'Generate PDF'}
        </button>
      </div>
    </div>
  )
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-border bg-card/50 shrink-0">
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">Total Documents</p>
        <p className="text-xl font-bold">{stats.total}</p>
      </div>
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">Total Invoiced</p>
        <p className="text-xl font-bold text-green-400">{formatCurrency(stats.totalInvoiced)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">Pending Signature</p>
        <p className="text-xl font-bold text-amber-400">{stats.pendingSignature}</p>
      </div>
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">Signed / Approved</p>
        <p className="text-xl font-bold text-emerald-400">
          {(stats.byStatus['signed'] ?? 0) + (stats.byStatus['approved'] ?? 0)}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sendTarget, setSendTarget] = useState<Document | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (typeFilter !== 'All') params.document_type = typeFilter.toLowerCase().replace(/ /g, '_')
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase()
      const qs = new URLSearchParams(params).toString()

      const [docsRes, statsRes] = await Promise.all([
        api.get(`/documents${qs ? `?${qs}` : ''}`),
        api.get('/documents/stats'),
      ])

      setDocuments(docsRes.data?.documents ?? [])
      setStats(statsRes.data)
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    try {
      await api.delete(`/documents/${id}`)
      setDocuments(prev => prev.filter(d => d.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch {}
  }

  function handleCreated(doc: Document) {
    setDocuments(prev => [doc, ...prev])
    setSelectedId(doc.id)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-sm">Documents</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
            {documents.length} documents
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Document
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="px-4 pt-3 pb-2 border-b border-border space-y-2 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Type filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {DOC_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap shrink-0 transition-colors ${
                    typeFilter === t ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === s
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 bg-muted/30">
            <div className="w-8 shrink-0" />
            <div className="flex-1">Document</div>
            <div className="w-28 shrink-0 text-right hidden md:block">Amount</div>
            <div className="w-20 shrink-0 text-center">Status</div>
            <div className="w-16 shrink-0 text-right hidden lg:block">Updated</div>
            <div className="w-16 shrink-0" />
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No documents found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search ? 'Try a different search' : 'Create your first document to get started'}
                </p>
                {!search && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Document
                  </button>
                )}
              </div>
            ) : (
              documents.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  selected={selectedId === doc.id}
                  onSelect={() => setSelectedId(prev => prev === doc.id ? null : doc.id)}
                  onSend={() => setSendTarget(doc)}
                  onDelete={() => handleDelete(doc.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedId && (
          <DetailPanel
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onSend={() => {
              const doc = documents.find(d => d.id === selectedId)
              if (doc) setSendTarget(doc)
            }}
            onRefresh={load}
          />
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {sendTarget && (
        <SendModal
          doc={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => { load(); setSendTarget(null) }}
        />
      )}
    </div>
  )
}
