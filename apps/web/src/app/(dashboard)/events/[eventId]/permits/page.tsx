'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  ShieldCheck, AlertTriangle, Clock, Plus, FileText, Link2,
  CheckCircle2, XCircle, AlertCircle, Loader2, Brain, Sparkles,
  Calendar, Building2, Hash, DollarSign, Pencil, Trash2,
  ChevronDown, Info, Scale, RefreshCw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type PermitStatus =
  | 'not_started' | 'applied' | 'under_review' | 'approved'
  | 'rejected' | 'expired' | 'renewal_required' | 'not_required'

type PermitType =
  | 'noise_permit' | 'fire_safety' | 'police_permission' | 'food_license'
  | 'liquor_license' | 'temporary_structure' | 'road_closure'
  | 'drone_permit' | 'pyrotechnics' | 'signage' | 'health_safety'
  | 'copyright_music' | 'venue_usage' | 'insurance_certificate' | 'other'

interface Permit {
  id: string
  permit_name: string
  permit_type: PermitType
  permit_number?: string
  issuing_authority?: string
  jurisdiction?: string
  applied_date?: string
  issued_date?: string
  expiry_date?: string
  status: PermitStatus
  rejection_reason?: string
  storage_type: 'upload' | 'link'
  document_url?: string
  file_name?: string
  is_critical: boolean
  cost?: number
  currency: string
  notes?: string
  assigned_to_profile?: { id: string; full_name: string; avatar_url?: string }
}

interface LegalDoc {
  id: string
  doc_type: string
  doc_name: string
  parties?: string[]
  storage_type: 'upload' | 'link'
  document_url?: string
  signature_status: 'pending' | 'partially_signed' | 'fully_signed' | 'voided'
  signed_date?: string
  expiry_date?: string
  is_critical: boolean
  notes?: string
}

interface PermitStats {
  total: number
  approved: number
  pending: number
  expired: number
  rejected: number
  critical_missing: number
  expiring_soon: number
  expiring_critical: number
  health_score: number
  alerts: Array<{ type: string; severity: string; message: string }>
}

// ── Config ─────────────────────────────────────────────────────────────────────

const PERMIT_TYPE_CONFIG: Record<PermitType, { label: string; icon: string }> = {
  noise_permit:          { label: 'Noise Permit',           icon: '🔊' },
  fire_safety:           { label: 'Fire Safety',            icon: '🔥' },
  police_permission:     { label: 'Police Permission',      icon: '👮' },
  food_license:          { label: 'Food License',           icon: '🍽️' },
  liquor_license:        { label: 'Liquor License',         icon: '🍾' },
  temporary_structure:   { label: 'Temporary Structure',    icon: '🏗️' },
  road_closure:          { label: 'Road Closure',           icon: '🚧' },
  drone_permit:          { label: 'Drone Permit',           icon: '🚁' },
  pyrotechnics:          { label: 'Pyrotechnics',           icon: '🎆' },
  signage:               { label: 'Signage',                icon: '🪧' },
  health_safety:         { label: 'Health & Safety',        icon: '🏥' },
  copyright_music:       { label: 'Music Copyright',        icon: '🎵' },
  venue_usage:           { label: 'Venue Usage',            icon: '🏛️' },
  insurance_certificate: { label: 'Insurance Certificate',  icon: '📋' },
  other:                 { label: 'Other',                  icon: '📄' },
}

const STATUS_CONFIG: Record<PermitStatus, { label: string; color: string; icon: React.ReactNode }> = {
  not_started:      { label: 'Not Started',      color: 'text-gray-400 bg-gray-400/10',                   icon: <Clock className="w-3 h-3" /> },
  applied:          { label: 'Applied',          color: 'text-blue-400 bg-blue-400/10',                   icon: <RefreshCw className="w-3 h-3" /> },
  under_review:     { label: 'Under Review',     color: 'text-amber-400 bg-amber-400/10',                 icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  approved:         { label: 'Approved',         color: 'text-emerald-400 bg-emerald-400/10',             icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:         { label: 'Rejected',         color: 'text-red-400 bg-red-400/10',                     icon: <XCircle className="w-3 h-3" /> },
  expired:          { label: 'Expired',          color: 'text-red-500 bg-red-500/10',                     icon: <AlertTriangle className="w-3 h-3" /> },
  renewal_required: { label: 'Renewal Required', color: 'text-orange-400 bg-orange-400/10',               icon: <AlertCircle className="w-3 h-3" /> },
  not_required:     { label: 'Not Required',     color: 'text-gray-500 bg-gray-500/10',                   icon: <Info className="w-3 h-3" /> },
}

const SIG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:           { label: 'Pending Signature',   color: 'text-amber-400 bg-amber-400/10' },
  partially_signed:  { label: 'Partially Signed',    color: 'text-blue-400 bg-blue-400/10' },
  fully_signed:      { label: 'Fully Signed',        color: 'text-emerald-400 bg-emerald-400/10' },
  voided:            { label: 'Voided',              color: 'text-red-400 bg-red-400/10' },
}

// ── Smart helpers ──────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function expiryUrgency(dateStr: string | undefined): 'expired' | 'critical' | 'warning' | 'ok' | null {
  const d = daysUntil(dateStr)
  if (d === null) return null
  if (d < 0) return 'expired'
  if (d <= 7) return 'critical'
  if (d <= 30) return 'warning'
  return 'ok'
}

// ── Health Score Ring ─────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1f2937" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[9px] text-gray-500 uppercase tracking-wide">health</div>
      </div>
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function AddPermitModal({
  onClose, onSave, eventId
}: { onClose: () => void; onSave: (p: Partial<Permit>) => void; eventId: string }) {
  const [form, setForm] = useState<Partial<Permit> & { event_id: string }>({
    event_id: eventId,
    permit_type: 'other',
    status: 'not_started',
    storage_type: 'link',
    is_critical: false,
    currency: 'INR',
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // Smart: auto-suggest is_critical based on type
  const criticalTypes = ['fire_safety', 'police_permission', 'food_license', 'liquor_license', 'insurance_certificate']
  useEffect(() => {
    if (criticalTypes.includes(form.permit_type as string)) {
      set('is_critical', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.permit_type])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Add Permit / License</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Smart suggestion */}
          {criticalTypes.includes(form.permit_type as string) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>This permit type is typically critical — marked as critical automatically.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Permit Name *</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Outdoor Event Noise Permit"
                value={form.permit_name ?? ''}
                onChange={e => set('permit_name', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Permit Type *</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.permit_type}
                onChange={e => set('permit_type', e.target.value)}
              >
                {Object.entries(PERMIT_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Permit Number</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="Official reference number"
                value={form.permit_number ?? ''}
                onChange={e => set('permit_number', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Issuing Authority</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Municipal Corporation"
                value={form.issuing_authority ?? ''}
                onChange={e => set('issuing_authority', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Applied Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.applied_date ?? ''}
                onChange={e => set('applied_date', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Expiry Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.expiry_date ?? ''}
                onChange={e => set('expiry_date', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Cost</label>
              <div className="flex gap-2">
                <select
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-violet-500 w-20"
                  value={form.currency ?? 'INR'}
                  onChange={e => set('currency', e.target.value)}
                >
                  {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="0"
                  value={form.cost ?? ''}
                  onChange={e => set('cost', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <input
                type="checkbox"
                id="is_critical"
                checked={form.is_critical ?? false}
                onChange={e => set('is_critical', e.target.checked)}
                className="accent-red-500"
              />
              <label htmlFor="is_critical" className="text-sm text-gray-300">
                Mark as Critical <span className="text-xs text-gray-500">(blocks event if missing)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Document Link (optional)</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="https://drive.google.com/..."
              value={form.document_url ?? ''}
              onChange={e => set('document_url', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Any additional details..."
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={() => { if (form.permit_name) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
          >
            Add Permit
          </button>
        </div>
      </div>
    </div>
  )
}

function AddLegalDocModal({
  onClose, onSave, eventId
}: { onClose: () => void; onSave: (d: Partial<LegalDoc>) => void; eventId: string }) {
  const [form, setForm] = useState<Partial<LegalDoc> & { event_id: string }>({
    event_id: eventId,
    doc_type: 'contract',
    signature_status: 'pending',
    storage_type: 'link',
    is_critical: false,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Add Legal Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Document Name *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="e.g. Venue Rental Agreement 2026"
              value={form.doc_name ?? ''}
              onChange={e => set('doc_name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.doc_type}
                onChange={e => set('doc_type', e.target.value)}
              >
                {['contract','nda','mou','vendor_agreement','client_agreement','insurance_policy','indemnity','other'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Signature Status</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.signature_status}
                onChange={e => set('signature_status', e.target.value)}
              >
                {Object.entries(SIG_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Signed Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.signed_date ?? ''}
                onChange={e => set('signed_date', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Expiry Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.expiry_date ?? ''}
                onChange={e => set('expiry_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Document Link</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              placeholder="https://drive.google.com/..."
              value={form.document_url ?? ''}
              onChange={e => set('document_url', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="legal_critical"
              checked={form.is_critical ?? false}
              onChange={e => set('is_critical', e.target.checked)}
              className="accent-red-500"
            />
            <label htmlFor="legal_critical" className="text-sm text-gray-300">
              Critical document
            </label>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800">Cancel</button>
          <button
            onClick={() => { if (form.doc_name) { onSave(form); onClose() } }}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
          >
            Add Document
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PermitsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [activeTab, setActiveTab] = useState<'permits' | 'legal'>('permits')
  const [permits, setPermits] = useState<Permit[]>([])
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([])
  const [stats, setStats] = useState<PermitStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddPermit, setShowAddPermit] = useState(false)
  const [showAddLegal, setShowAddLegal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [criticalOnly, setCriticalOnly] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined'
      ? document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1] ?? ''
      : ''
    const tenantId = typeof window !== 'undefined'
      ? localStorage.getItem('tenantId') ?? ''
      : ''
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const h = getHeaders()
      const qs = new URLSearchParams()
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (criticalOnly) qs.set('critical_only', 'true')

      const [pRes, sRes, lRes] = await Promise.all([
        fetch(`${API}/permits/events/${eventId}?${qs}`, { headers: h }),
        fetch(`${API}/permits/events/${eventId}/stats`, { headers: h }),
        fetch(`${API}/permits/events/${eventId}/legal`, { headers: h }),
      ])

      if (pRes.ok) setPermits(await pRes.json())
      if (sRes.ok) setStats(await sRes.json())
      if (lRes.ok) setLegalDocs(await lRes.json())
    } catch {}
    setLoading(false)
  }, [eventId, statusFilter, criticalOnly, getHeaders, API])

  useEffect(() => { loadData() }, [loadData])

  const handleAddPermit = async (body: Partial<Permit>) => {
    try {
      const res = await fetch(`${API}/permits`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      })
      if (res.ok) loadData()
    } catch {}
  }

  const handleAddLegalDoc = async (body: Partial<LegalDoc>) => {
    try {
      const res = await fetch(`${API}/permits/legal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      })
      if (res.ok) loadData()
    } catch {}
  }

  const handleUpdateStatus = async (id: string, status: PermitStatus) => {
    try {
      const res = await fetch(`${API}/permits/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      })
      if (res.ok) loadData()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this permit?')) return
    try {
      await fetch(`${API}/permits/${id}`, { method: 'DELETE', headers: getHeaders() })
      loadData()
    } catch {}
  }

  // ── Expiry badge ──────────────────────────────────────────────────────────
  function ExpiryBadge({ dateStr }: { dateStr: string | undefined }) {
    const urgency = expiryUrgency(dateStr)
    const days = daysUntil(dateStr)
    if (!urgency || urgency === 'ok') return null

    const cfg: Record<string, string> = {
      expired: 'text-red-500 bg-red-500/10',
      critical: 'text-red-400 bg-red-400/10',
      warning: 'text-amber-400 bg-amber-400/10',
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${cfg[urgency]}`}>
        <Clock className="w-3 h-3" />
        {days !== null && days < 0
          ? `Expired ${Math.abs(days)}d ago`
          : `${days}d left`}
      </span>
    )
  }

  const smartAlerts = stats?.alerts ?? []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-violet-400" />
            Legal & Permits
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage permits, licenses, and legal agreements</p>
        </div>
        <button
          onClick={() => activeTab === 'permits' ? setShowAddPermit(true) : setShowAddLegal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add {activeTab === 'permits' ? 'Permit' : 'Legal Doc'}
        </button>
      </div>

      {/* Smart Alerts Banner */}
      {smartAlerts.length > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Smart Compliance Alerts</span>
          </div>
          <div className="space-y-2">
            {smartAlerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs ${a.severity === 'high' ? 'text-red-300' : 'text-amber-300'}`}>
                {a.severity === 'high'
                  ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                  : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />}
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center col-span-2 md:col-span-1">
            <HealthRing score={stats.health_score} />
            <div className="text-xs text-gray-500 mt-1 text-center">Compliance Score</div>
          </div>
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
            { label: 'Expiring Soon', value: stats.expiring_soon, color: 'text-orange-400' },
            { label: 'Critical Missing', value: stats.critical_missing, color: 'text-red-400' },
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
        {(['permits', 'legal'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-violet-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'permits' ? '🏛️ Permits & Licenses' : '⚖️ Legal Documents'}
          </button>
        ))}
      </div>

      {/* Filters (permits tab only) */}
      {activeTab === 'permits' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {['all', 'approved', 'pending', 'under_review', 'applied', 'expired', 'rejected'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  statusFilter === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s === 'all' ? 'All Statuses' : STATUS_CONFIG[s as PermitStatus]?.label ?? s}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 ml-auto text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={e => setCriticalOnly(e.target.checked)}
              className="accent-red-500"
            />
            Critical only
          </label>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : activeTab === 'permits' ? (
        permits.length === 0 ? (
          <div className="text-center py-20">
            <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No permits added yet</p>
            <button
              onClick={() => setShowAddPermit(true)}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm"
            >
              Add First Permit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {permits.map(permit => {
              const typeConf = PERMIT_TYPE_CONFIG[permit.permit_type]
              const statusConf = STATUS_CONFIG[permit.status]
              return (
                <div
                  key={permit.id}
                  className={`bg-gray-900/60 border rounded-xl p-5 transition-colors ${
                    permit.is_critical ? 'border-red-500/30 hover:border-red-500/50' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-xl shrink-0">
                      {typeConf?.icon ?? '📄'}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium text-sm">{permit.permit_name}</h3>
                        {permit.is_critical && (
                          <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] font-medium rounded uppercase tracking-wide">
                            Critical
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusConf.color}`}>
                          {statusConf.icon} {statusConf.label}
                        </span>
                        <ExpiryBadge dateStr={permit.expiry_date} />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {typeConf?.label}
                        </span>
                        {permit.issuing_authority && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {permit.issuing_authority}
                          </span>
                        )}
                        {permit.permit_number && (
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            #{permit.permit_number}
                          </span>
                        )}
                        {permit.expiry_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires {formatDate(permit.expiry_date)}
                          </span>
                        )}
                        {permit.cost && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {permit.currency} {permit.cost.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {permit.rejection_reason && (
                        <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {permit.rejection_reason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {permit.document_url && (
                        <a
                          href={permit.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                          title="View document"
                        >
                          <Link2 className="w-4 h-4" />
                        </a>
                      )}
                      {/* Quick status update dropdown */}
                      <div className="relative group">
                        <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <button
                              key={k}
                              onClick={() => handleUpdateStatus(permit.id, k as PermitStatus)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl"
                            >
                              {v.icon} {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(permit.id)}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                      >
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
        /* Legal Documents Tab */
        legalDocs.length === 0 ? (
          <div className="text-center py-20">
            <Scale className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No legal documents added yet</p>
            <button
              onClick={() => setShowAddLegal(true)}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm"
            >
              Add Legal Document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {legalDocs.map(doc => {
              const sigConf = SIG_STATUS_CONFIG[doc.signature_status]
              return (
                <div
                  key={doc.id}
                  className={`bg-gray-900/60 border rounded-xl p-5 ${
                    doc.is_critical ? 'border-red-500/30' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                      <Scale className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium text-sm">{doc.doc_name}</h3>
                        {doc.is_critical && (
                          <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] font-medium rounded uppercase tracking-wide">Critical</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${sigConf?.color}`}>
                          {sigConf?.label}
                        </span>
                        <ExpiryBadge dateStr={doc.expiry_date} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="capitalize">{doc.doc_type.replace(/_/g, ' ')}</span>
                        {doc.signed_date && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Signed {formatDate(doc.signed_date)}
                          </span>
                        )}
                        {doc.parties?.map((p, i) => (
                          <span key={i} className="text-gray-600">{p}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.document_url && (
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white">
                          <Link2 className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Modals */}
      {showAddPermit && (
        <AddPermitModal
          eventId={eventId}
          onClose={() => setShowAddPermit(false)}
          onSave={handleAddPermit}
        />
      )}
      {showAddLegal && (
        <AddLegalDocModal
          eventId={eventId}
          onClose={() => setShowAddLegal(false)}
          onSave={handleAddLegalDoc}
        />
      )}
    </div>
  )
}
