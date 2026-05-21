'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  FileText, Plus, Search, Upload, Link2, FolderOpen, Eye, Download,
  CheckCircle2, Clock, AlertCircle, XCircle, MoreHorizontal, Trash2,
  Shield, RefreshCw, ChevronRight, Tag, X, Sparkles, Brain, Folder,
  FileCheck, ExternalLink, History, Lock, Globe, Users,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ── Smart doc-type detector from filename ─────────────────────────────────────
function detectDocType(filename: string): string {
  const f = filename.toLowerCase()
  if (f.includes('contract') || f.includes('agreement')) return 'contract'
  if (f.includes('proposal') || f.includes('quote')) return 'proposal'
  if (f.includes('invoice') || f.includes('bill')) return 'invoice'
  if (f.includes('permit') || f.includes('license') || f.includes('noc')) return 'permit'
  if (f.includes('timeline') || f.includes('schedule') || f.includes('runsheet')) return 'timeline'
  if (f.includes('floor') || f.includes('layout') || f.includes('plan')) return 'floor_plan'
  if (f.includes('mood') || f.includes('inspiration') || f.includes('reference')) return 'mood_board'
  if (f.includes('vendor') || f.includes('supplier')) return 'vendor_list'
  if (f.includes('menu') || f.includes('fnb') || f.includes('food')) return 'menu'
  if (f.includes('seating') || f.includes('seat')) return 'seating_chart'
  if (f.includes('brief') || f.includes('requirement')) return 'brief'
  if (f.includes('report') || f.includes('summary')) return 'report'
  return 'other'
}

// ── Smart approval requirement detector ──────────────────────────────────────
function requiresApproval(type: string): boolean {
  return ['contract', 'invoice', 'permit', 'proposal'].includes(type)
}

// ── Smart visibility detector ─────────────────────────────────────────────────
function suggestVisibility(type: string): string {
  if (['contract', 'invoice', 'proposal'].includes(type)) return 'client'
  if (['permit'].includes(type)) return 'team'
  if (['timeline', 'runsheet'].includes(type)) return 'client'
  return 'team'
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Doc {
  id: string
  folder_path: string
  document_name: string
  document_type: string
  storage_type: 'upload' | 'link'
  file_url: string
  file_name?: string
  file_size?: number
  version: number
  is_latest: boolean
  visibility: string
  requires_approval: boolean
  approval_status: string
  description?: string
  tags: string[]
  created_at: string
  uploaded_by_profile?: { full_name: string; avatar_url?: string }
}

interface Stats {
  total: number
  pending_approval: number
  uploads: number
  links: number
}

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  contract:     { label: 'Contract',     icon: '📜', color: 'text-blue-400   bg-blue-500/10   border-blue-500/20' },
  proposal:     { label: 'Proposal',     icon: '📋', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  invoice:      { label: 'Invoice',      icon: '💰', color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
  timeline:     { label: 'Timeline',     icon: '🗓',  color: 'text-cyan-400   bg-cyan-500/10   border-cyan-500/20' },
  floor_plan:   { label: 'Floor Plan',   icon: '🏛',  color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  mood_board:   { label: 'Mood Board',   icon: '🎨', color: 'text-pink-400   bg-pink-500/10   border-pink-500/20' },
  vendor_list:  { label: 'Vendor List',  icon: '🤝', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  seating_chart:{ label: 'Seating',      icon: '💺', color: 'text-teal-400   bg-teal-500/10   border-teal-500/20' },
  menu:         { label: 'Menu',         icon: '🍽', color: 'text-orange-400  bg-orange-500/10  border-orange-500/20' },
  runsheet:     { label: 'Runsheet',     icon: '📝', color: 'text-lime-400   bg-lime-500/10   border-lime-500/20' },
  permit:       { label: 'Permit',       icon: '🏛',  color: 'text-red-400    bg-red-500/10    border-red-500/20' },
  brief:        { label: 'Brief',        icon: '📌', color: 'text-yellow-400  bg-yellow-500/10  border-yellow-500/20' },
  report:       { label: 'Report',       icon: '📊', color: 'text-purple-400  bg-purple-500/10  border-purple-500/20' },
  other:        { label: 'Other',        icon: '📄', color: 'text-zinc-400    bg-zinc-500/10    border-zinc-500/20' },
}

const APPROVAL_CONFIG = {
  pending:      { label: 'Pending',      color: 'text-amber-400  bg-amber-500/10  border-amber-500/20', icon: Clock },
  approved:     { label: 'Approved',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     color: 'text-red-400    bg-red-500/10    border-red-500/20', icon: XCircle },
  not_required: { label: 'No approval',  color: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20', icon: Shield },
}

function fmtSize(bytes?: number) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Today'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { token, tenantId, profile } = useAuth()

  const [docs, setDocs] = useState<Doc[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterFolder, setFilterFolder] = useState('all')
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'upload' | 'link'>('upload')

  const hdrs = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId ?? '',
  }), [token, tenantId])

  const load = useCallback(async () => {
    if (!token || !tenantId) return
    setLoading(true)
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch(`${API}/v1/documents/events/${eventId}`, { headers: hdrs() }),
        fetch(`${API}/v1/documents/events/${eventId}/stats`, { headers: hdrs() }),
      ])
      if (docsRes.ok) setDocs(await docsRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } finally { setLoading(false) }
  }, [token, tenantId, eventId, hdrs])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    await fetch(`${API}/v1/documents/${id}`, { method: 'DELETE', headers: hdrs() })
    setSelectedDoc(null)
    load()
  }

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    await fetch(`${API}/v1/documents/${id}/approve`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ status, approved_by: profile?.id }),
    })
    load()
    if (selectedDoc?.id === id) setSelectedDoc(prev => prev ? { ...prev, approval_status: status } : null)
  }

  // Smart: derive unique folders from docs
  const folders = ['/', ...new Set(docs.filter(d => d.folder_path !== '/').map(d => d.folder_path))].sort()

  const filtered = docs.filter(d => {
    const ms = !search || d.document_name.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase())
    const mt = filterType === 'all' || d.document_type === filterType
    const mf = filterFolder === 'all' || d.folder_path === filterFolder
    return ms && mt && mf
  })

  // Smart: group by folder
  const grouped = filtered.reduce<Record<string, Doc[]>>((acc, d) => {
    const f = d.folder_path ?? '/'
    acc[f] = acc[f] ?? []
    acc[f].push(d)
    return acc
  }, {})

  // Smart alerts
  const pendingApprovals = docs.filter(d => d.requires_approval && d.approval_status === 'pending')
  const smartAlerts: string[] = []
  if (pendingApprovals.length > 0) smartAlerts.push(`${pendingApprovals.length} document${pendingApprovals.length > 1 ? 's' : ''} awaiting approval`)
  const contractCount = docs.filter(d => d.document_type === 'contract').length
  if (contractCount === 0) smartAlerts.push('No signed contract yet — consider uploading one')
  const permitCount = docs.filter(d => d.document_type === 'permit').length
  if (permitCount === 0) smartAlerts.push('No permits uploaded — check if venue permits are needed')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="w-6 h-6 text-violet-400" /> Document Vault
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">All event documents with version control &amp; approval workflow</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAddMode('link'); setShowAddModal(true) }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
            >
              <Link2 className="w-4 h-4" /> Add Link
            </button>
            <button
              onClick={() => { setAddMode('upload'); setShowAddModal(true) }}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium"
            >
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
        </div>

        {/* Smart alerts */}
        {smartAlerts.length > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Smart Alerts</span>
            </div>
            {smartAlerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-300/80">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {alert}
              </div>
            ))}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Documents', value: stats?.total ?? 0, icon: FileText, color: 'text-violet-400' },
            { label: 'Pending Approval', value: stats?.pending_approval ?? 0, icon: Clock, color: 'text-amber-400' },
            { label: 'Uploaded Files', value: stats?.uploads ?? 0, icon: Upload, color: 'text-blue-400' },
            { label: 'External Links', value: stats?.links ?? 0, icon: Link2, color: 'text-emerald-400' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card/60 border border-border/60 rounded-2xl p-4">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/50 border border-border/40 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
              className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-muted/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
            <option value="all">All Types</option>
            {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          {folders.length > 1 && (
            <select value={filterFolder} onChange={e => setFilterFolder(e.target.value)}
              className="bg-muted/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
              <option value="all">All Folders</option>
              {folders.map(f => <option key={f} value={f}>{f === '/' ? 'Root' : f.replace(/\//g, '')}</option>)}
            </select>
          )}
        </div>

        {/* Document list grouped by folder */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No documents yet</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-violet-400 hover:text-violet-300">Upload the first document</button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([folder, folderDocs]) => (
              <div key={folder}>
                <div className="flex items-center gap-2 mb-3">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">{folder === '/' ? 'Root' : folder.replace(/\//g, ' / ')}</h3>
                  <span className="text-xs text-muted-foreground/60">({folderDocs.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {folderDocs.map(doc => {
                    const tc = DOC_TYPE_CONFIG[doc.document_type] ?? DOC_TYPE_CONFIG.other
                    const ac = APPROVAL_CONFIG[doc.approval_status as keyof typeof APPROVAL_CONFIG] ?? APPROVAL_CONFIG.not_required
                    const ApprovalIcon = ac.icon
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`bg-card/60 border rounded-xl p-4 cursor-pointer transition-all hover:border-violet-500/30 hover:bg-card/80 ${
                          selectedDoc?.id === doc.id ? 'border-violet-500/40 bg-violet-500/5' : 'border-border/60'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl flex-shrink-0">{tc.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                              {doc.version > 1 && (
                                <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
                                  <History className="w-3 h-3" />v{doc.version}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${tc.color}`}>{tc.label}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 ${ac.color}`}>
                                <ApprovalIcon className="w-3 h-3" />{ac.label}
                              </span>
                              {doc.storage_type === 'link' ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="w-3 h-3" />Link</span>
                              ) : (
                                fmtSize(doc.file_size) && <span className="text-xs text-muted-foreground">{fmtSize(doc.file_size)}</span>
                              )}
                              <span className="text-xs text-muted-foreground">{timeAgo(doc.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {doc.approval_status === 'pending' && (
                              <>
                                <button onClick={e => { e.stopPropagation(); handleApprove(doc.id, 'approved') }}
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Approve">
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleApprove(doc.id, 'rejected') }}
                                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Reject">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                              {doc.storage_type === 'link' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                            </a>
                            <button onClick={e => { e.stopPropagation(); handleDelete(doc.id) }}
                              className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add document modal */}
      {showAddModal && (
        <AddDocumentModal
          eventId={eventId}
          mode={addMode}
          hdrs={hdrs()}
          profileId={profile?.id}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Add Document Modal ───────────────────────────────────────────────────────

function AddDocumentModal({ eventId, mode, hdrs, profileId, onClose, onCreated }: {
  eventId: string; mode: 'upload' | 'link'; hdrs: Record<string, string>
  profileId?: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    document_name: '',
    document_type: 'other',
    storage_type: mode,
    file_url: '',
    file_name: '',
    folder_path: '/',
    visibility: 'team',
    requires_approval: false,
    description: '',
    version_notes: '',
  })
  const [saving, setSaving] = useState(false)
  // Smart: AI suggestions banner
  const [smartSuggestion, setSmartSuggestion] = useState<string | null>(null)

  const handleNameChange = (name: string) => {
    const detectedType = detectDocType(name)
    const suggestedVisibility = suggestVisibility(detectedType)
    const suggestedApproval = requiresApproval(detectedType)

    setForm(f => ({
      ...f,
      document_name: name,
      document_type: detectedType !== 'other' ? detectedType : f.document_type,
      visibility: suggestedVisibility,
      requires_approval: suggestedApproval,
    }))

    if (detectedType !== 'other') {
      setSmartSuggestion(`Detected: ${DOC_TYPE_CONFIG[detectedType]?.label}${suggestedApproval ? ' · Approval required recommended' : ''}`)
    } else {
      setSmartSuggestion(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.file_url.trim() || !form.document_name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/v1/documents`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ ...form, event_id: eventId, uploaded_by: profileId }),
      })
      if (res.ok) onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/60 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            {mode === 'upload' ? <Upload className="w-4 h-4 text-violet-400" /> : <Link2 className="w-4 h-4 text-blue-400" />}
            <h2 className="font-semibold">{mode === 'upload' ? 'Upload Document' : 'Add Link'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Smart suggestion banner */}
          {smartSuggestion && (
            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="text-xs text-violet-300">{smartSuggestion}</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Document Name</label>
            <input value={form.document_name} onChange={e => handleNameChange(e.target.value)} required
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground"
              placeholder="e.g. Catering Contract v2.pdf" />
            <p className="text-xs text-muted-foreground/60 mt-1">💡 Smart type detection from filename</p>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              {mode === 'link' ? 'External URL' : 'File URL (from R2 storage)'}
            </label>
            <input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} required
              type="url"
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground"
              placeholder={mode === 'link' ? 'https://drive.google.com/...' : 'https://cdn.occasionpro.com/...'} />
            {mode === 'link' && (
              <p className="text-xs text-muted-foreground/60 mt-1">Supports Google Drive, Dropbox, OneDrive, WeTransfer, direct URLs</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Document Type</label>
              <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}
                className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Visibility</label>
              <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                <option value="team">Team only</option>
                <option value="client">Client visible</option>
                <option value="vendor">Vendor visible</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Folder</label>
            <input value={form.folder_path} onChange={e => setForm(f => ({ ...f, folder_path: e.target.value }))}
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground"
              placeholder="/ (root) or /contracts/" />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Description (optional)</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 text-foreground resize-none"
              placeholder="Brief description…" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Requires Approval</p>
              <p className="text-xs text-muted-foreground">Client must approve before finalising</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, requires_approval: !f.requires_approval }))}
              className={`w-11 h-6 rounded-full transition-colors ${form.requires_approval ? 'bg-violet-600' : 'bg-muted border border-border'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${form.requires_approval ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-border/60 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.file_url.trim() || !form.document_name.trim()}
              className="flex-1 py-2.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg transition-colors font-medium">
              {saving ? 'Saving…' : mode === 'link' ? 'Add Link' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
