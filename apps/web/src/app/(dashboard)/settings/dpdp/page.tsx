'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'
import {
  ShieldCheck, Download, Trash2, Eye, FileText,
  AlertTriangle, CheckCircle, Clock, Users, Database,
  Lock, Globe, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ConsentItem = {
  id: string
  label: string
  description: string
  required: boolean
  enabled: boolean
}

type DataRequest = {
  id: string
  type: 'export' | 'deletion' | 'correction'
  subject: string
  email: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  submittedAt: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_CONSENTS: ConsentItem[] = [
  {
    id: 'essential',
    label: 'Essential Processing',
    description: 'Processing necessary to provide the service (event management, authentication, billing).',
    required: true,
    enabled: true,
  },
  {
    id: 'analytics',
    label: 'Analytics & Insights',
    description: 'Aggregate usage analytics to improve platform performance and features.',
    required: false,
    enabled: true,
  },
  {
    id: 'marketing',
    label: 'Marketing Communications',
    description: 'Receive product updates, feature announcements, and promotional emails.',
    required: false,
    enabled: false,
  },
  {
    id: 'thirdparty',
    label: 'Third-Party Integrations',
    description: 'Share data with connected services (CRM, payment gateways, vendors) as needed for event operations.',
    required: false,
    enabled: true,
  },
  {
    id: 'ai',
    label: 'AI Processing',
    description: 'Allow AI models to process event data for smart recommendations and automated summaries.',
    required: false,
    enabled: true,
  },
]

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed:  'bg-green-500/10 text-green-600 dark:text-green-400',
  rejected:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  export:    'Data Export',
  deletion:  'Erasure',
  correction:'Correction',
}

// ── Consent toggle section ────────────────────────────────────────────────────

function ConsentSection() {
  const [consents, setConsents] = useState<ConsentItem[]>(INITIAL_CONSENTS)

  const toggle = (id: string) => {
    setConsents((prev) =>
      prev.map((c) => (c.id === id && !c.required ? { ...c, enabled: !c.enabled } : c)),
    )
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Lock className="w-4 h-4 text-green-500" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Consent Management</h3>
          <p className="text-xs text-muted-foreground">Control how your workspace data is processed</p>
        </div>
      </div>

      <div className="space-y-3">
        {consents.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4 py-3 px-3 rounded-lg bg-surface/40 border border-border/50"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                {item.required && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                    Required
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
            <button
              onClick={() => toggle(item.id)}
              disabled={item.required}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5',
                item.enabled ? 'bg-primary' : 'bg-border',
                item.required && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow',
                  item.enabled ? 'translate-x-4' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Data requests section ─────────────────────────────────────────────────────

function DataRequestsSection({ requests, onProcess }: { requests: DataRequest[]; onProcess: (id: string) => void }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Data Subject Requests</h3>
            <p className="text-xs text-muted-foreground">
              Manage access, export, correction, and deletion requests from guests and contacts
            </p>
          </div>
        </div>
        <span className="text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
          {requests.filter((r) => r.status === 'pending').length} pending
        </span>
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface/50 border border-border/50"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{req.subject}</span>
                <span className="text-xs text-muted-foreground">{req.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{REQUEST_TYPE_LABEL[req.type]}</span>
                <span>·</span>
                <Clock className="w-3 h-3" />
                <span>{req.submittedAt}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', REQUEST_STATUS_STYLES[req.status])}>
                {req.status}
              </span>
              {req.status === 'pending' && (
                <button
                  onClick={() => onProcess(req.id)}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Process
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Under India's DPDP Act 2023, data subjects have the right to access, correct, and erase their personal data.
        Requests must be processed within <strong>30 days</strong>.
      </p>
    </section>
  )
}

// ── Workspace data export ─────────────────────────────────────────────────────

function WorkspaceDataSection() {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Database className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workspace Data</h3>
          <p className="text-xs text-muted-foreground">Export or request deletion of your workspace data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group">
          <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-foreground">Export All Data</p>
            <p className="text-xs text-muted-foreground">Download events, guests, vendors, and financials as JSON + CSV</p>
          </div>
        </button>

        <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-red-500/40 hover:bg-red-500/5 transition-all text-left group">
          <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-500 transition-colors" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-foreground">Request Deletion</p>
            <p className="text-xs text-muted-foreground">Permanently delete all workspace data after 30-day hold period</p>
          </div>
        </button>
      </div>
    </section>
  )
}

// ── Compliance status ─────────────────────────────────────────────────────────

function ComplianceStatus() {
  const checks = [
    { label: 'Privacy Policy linked',          ok: true  },
    { label: 'Consent records maintained',      ok: true  },
    { label: 'Data retention policy set',       ok: false },
    { label: 'DPO contact configured',          ok: false },
    { label: 'Cross-border transfer basis',     ok: true  },
    { label: 'Breach notification procedure',   ok: true  },
  ]

  const score = checks.filter((c) => c.ok).length

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">DPDP Compliance Checklist</h3>
            <p className="text-xs text-muted-foreground">India Digital Personal Data Protection Act 2023</p>
          </div>
        </div>
        <span className={cn(
          'text-sm font-bold',
          score >= 5 ? 'text-green-500' : score >= 3 ? 'text-amber-500' : 'text-red-500',
        )}>
          {score}/{checks.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs">
            {check.ok
              ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            }
            <span className={check.ok ? 'text-foreground' : 'text-muted-foreground'}>{check.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
        <Globe className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          OccasionPro stores personal data of Indian residents on servers located within India,
          in compliance with DPDP Act localisation requirements. Cross-border transfers require
          explicit consent or a contractual necessity basis.
        </p>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DpdpPage() {
  const { token } = useAuth()
  const [requests, setRequests] = useState<DataRequest[]>([])

  const loadRequests = useCallback(async () => {
    if (!token) return
    try {
      const data = await fetch(`${API}/compliance/dpdp/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : [])
      setRequests(Array.isArray(data) ? data : (data.data ?? []))
    } catch { /* silent */ }
  }, [token])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleProcess = useCallback(async (id: string) => {
    if (!token) return
    const res = await fetch(`${API}/compliance/dpdp/requests/${id}/process`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'processing' }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'processing' as const } : r))
    }
  }, [token])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Data Privacy (DPDP)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage data processing consent, subject requests, and compliance with the
          Digital Personal Data Protection Act 2023.
        </p>
      </div>

      <ComplianceStatus />
      <ConsentSection />
      <DataRequestsSection requests={requests} onProcess={handleProcess} />
      <WorkspaceDataSection />
    </div>
  )
}
