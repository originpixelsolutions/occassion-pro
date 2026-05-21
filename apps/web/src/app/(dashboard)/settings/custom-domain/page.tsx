'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Globe, CheckCircle, XCircle, Loader2, Copy, ExternalLink, Trash2,
  RefreshCw, ShieldCheck, AlertTriangle, Clock, ArrowRight, Terminal,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

// ─── Types ────────────────────────────────────────────────────────────────────

type SslStatus = 'pending' | 'provisioning' | 'active' | 'failed'

interface DomainRecord {
  id:                 string
  domain:             string
  verification_token: string
  is_verified:        boolean
  verified_at:        string | null
  ssl_status:         SslStatus
  ssl_provisioned_at: string | null
  is_active:          boolean
  last_checked_at:    string | null
  check_failures:     number
  dns_instructions: {
    txt_record: { name: string; type: string; value: string; ttl: number }
    cname_record: { name: string; type: string; target: string; ttl: number; note: string }
    help: string
  }
}

// ─── Step computation ─────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5

function computeStep(domain: DomainRecord | null): WizardStep {
  if (!domain)              return 1
  if (!domain.is_verified)  return 2
  if (domain.ssl_status === 'provisioning') return 4
  if (domain.ssl_status === 'active' && domain.is_active) return 5
  if (domain.is_verified)   return 3   // verified but ssl not yet provisioning
  return 2
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DnsRow({ type, name, value, ttl, note }: {
  type: string; name: string; value: string; ttl: number; note?: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-background border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">{type}</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {[['Host / Name', name], ['Value / Points to', value], ['TTL', String(ttl)]].map(([label, val]) => (
        <div key={label} className="flex items-start justify-between gap-4">
          <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <code className="flex-1 text-xs font-mono text-foreground bg-muted px-2 py-1 rounded truncate">{val}</code>
            <button
              onClick={() => copy(val, label)}
              className="flex-shrink-0 p-1 hover:bg-accent rounded transition-colors"
            >
              {copied === label
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StepIndicator({ current, total = 5 }: { current: WizardStep; total?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
            step < current ? 'bg-primary text-primary-foreground' :
            step === current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
            'bg-muted text-muted-foreground'
          }`}>
            {step < current ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          {step < total && (
            <div className={`w-8 h-0.5 mx-1 transition-all ${step < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomDomainPage() {
  const { session } = useAuth()
  const tenantId = (session as any)?.user?.user_metadata?.tenant_id

  const [domain, setDomain] = useState<DomainRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [domainInput, setDomainInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string; check_failures?: number } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const loadStatus = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/custom-domain`, { headers: headers() })
    if (res.status === 404 || res.status === 204) { setDomain(null); setLoading(false); return }
    const data = await res.json()
    setDomain(data ?? null)
    setLoading(false)
  }, [session, tenantId, headers])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Auto-poll when provisioning SSL
  useEffect(() => {
    const step = computeStep(domain)
    if (step === 3 || step === 4) {
      const timer = setInterval(loadStatus, 15000)
      setPollTimer(timer)
      return () => clearInterval(timer)
    } else {
      if (pollTimer) { clearInterval(pollTimer); setPollTimer(null) }
    }
  }, [domain]) // eslint-disable-line

  const addDomain = async () => {
    if (!domainInput.trim()) return
    setAdding(true); setAddError('')
    try {
      const res = await fetch(`${API}/api/v1/tenants/${tenantId}/custom-domain`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ domain: domainInput.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        setAddError(err.message ?? 'Failed to add domain')
        return
      }
      await loadStatus()
    } finally { setAdding(false) }
  }

  const verifyDomain = async () => {
    setVerifying(true); setVerifyResult(null)
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/custom-domain/verify`, {
      method: 'POST', headers: headers(),
    })
    const data = await res.json()
    setVerifyResult(data)
    if (data.verified) await loadStatus()
    setVerifying(false)
  }

  const removeDomain = async () => {
    if (!confirm(`Remove ${domain?.domain}? This will disable the custom domain routing immediately.`)) return
    setRemoving(true)
    await fetch(`${API}/api/v1/tenants/${tenantId}/custom-domain`, {
      method: 'DELETE', headers: headers(),
    })
    setDomain(null); setRemoving(false)
  }

  const step = computeStep(domain)

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Custom Domain</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Serve your guest portal and event pages from your own domain, like <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">events.yourbrand.com</code>
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Enter domain ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Enter Your Domain
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the full domain or subdomain you want to use.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Domain</label>
            <div className="flex gap-2">
              <input
                value={domainInput}
                onChange={e => setDomainInput(e.target.value.toLowerCase())}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                className="flex-1 px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="events.yourbrand.com"
                autoFocus
              />
              <button
                onClick={addDomain}
                disabled={adding || !domainInput.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {adding ? 'Adding…' : 'Add Domain'}
              </button>
            </div>
            {addError && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {addError}
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Before you begin</p>
            <p>• You must own the domain and have access to its DNS settings.</p>
            <p>• Both <code className="font-mono bg-background px-1 rounded">yourdomain.com</code> and subdomains like <code className="font-mono bg-background px-1 rounded">events.yourdomain.com</code> are supported.</p>
            <p>• SSL is provisioned automatically once DNS is verified.</p>
          </div>
        </div>
      )}

      {/* ── Step 2: DNS Instructions ─────────────────────────────────────────── */}
      {step === 2 && domain && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Add DNS Records
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add the following records to your DNS provider for <code className="font-mono text-xs bg-muted px-1 rounded">{domain.domain}</code>. Both records are required.
              </p>
            </div>

            <DnsRow
              type="TXT"
              name={domain.dns_instructions.txt_record.name}
              value={domain.dns_instructions.txt_record.value}
              ttl={domain.dns_instructions.txt_record.ttl}
              note="For domain ownership verification"
            />

            <DnsRow
              type="CNAME"
              name={domain.dns_instructions.cname_record.name}
              value={domain.dns_instructions.cname_record.target}
              ttl={domain.dns_instructions.cname_record.ttl}
              note={domain.dns_instructions.cname_record.note}
            />

            <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{domain.dns_instructions.help}</p>
            </div>
          </div>

          {/* Verify button */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Verify DNS Records</h2>
            <p className="text-sm text-muted-foreground">
              Once you've added both records, click below. You can try multiple times — DNS propagation can take up to 24 hours.
            </p>

            {domain.check_failures > 0 && !verifyResult && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                DNS records not found yet ({domain.check_failures} check{domain.check_failures > 1 ? 's' : ''} failed).
                Ensure the records are saved correctly and allow time for propagation.
              </div>
            )}

            {verifyResult && (
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                verifyResult.verified
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}>
                {verifyResult.verified
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <XCircle className="w-3.5 h-3.5" />
                }
                {verifyResult.message}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={verifyDomain}
                disabled={verifying}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {verifying ? 'Checking…' : "I've Added the Records — Verify Now"}
              </button>
              <button
                onClick={removeDomain}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>

            {domain.last_checked_at && (
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(domain.last_checked_at).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Verified, triggering SSL ─────────────────────────────────── */}
      {step === 3 && domain && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Domain Verified!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{domain.domain}</code> ownership confirmed.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Setting up SSL certificate…
          </div>
          <button onClick={loadStatus} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" /> Check status
          </button>
        </div>
      )}

      {/* ── Step 4: SSL Provisioning ──────────────────────────────────────────── */}
      {step === 4 && domain && (
        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Provisioning SSL Certificate</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Domain verified ✓ — An SSL certificate is being issued for <strong className="text-foreground">{domain.domain}</strong>.
                This typically takes 5–30 minutes.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Domain ownership verified
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              CNAME record pointing to <code className="font-mono">cname.occasionpro.in</code>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              SSL certificate issuance in progress…
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />
              Domain routing activation
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadStatus}
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl text-sm hover:bg-accent transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Check Again
            </button>
            <p className="text-xs text-muted-foreground">
              Checking automatically every 15 seconds
            </p>
          </div>
        </div>
      )}

      {/* ── Step 5: Active ────────────────────────────────────────────────────── */}
      {step === 5 && domain && (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-emerald-500/10 via-card to-card border border-emerald-500/20 rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Globe className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Domain Live</h2>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">Active</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your custom domain is routing traffic to OccasionPro.
                </p>
              </div>
            </div>

            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Custom Domain</p>
                  <p className="font-mono font-semibold text-foreground">{domain.domain}</p>
                </div>
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Test Link
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border text-xs">
                <div>
                  <p className="text-muted-foreground">SSL Status</p>
                  <p className="flex items-center gap-1 text-emerald-400 font-medium mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Active (HTTPS)
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verified</p>
                  <p className="text-foreground mt-0.5">
                    {domain.verified_at ? new Date(domain.verified_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Routes to</p>
                  <p className="font-mono text-foreground mt-0.5">cname.occasionpro.in</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SSL Provisioned</p>
                  <p className="text-foreground mt-0.5">
                    {domain.ssl_provisioned_at ? new Date(domain.ssl_provisioned_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-card border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-1">Remove Custom Domain</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will immediately stop routing traffic from <strong>{domain.domain}</strong> to OccasionPro. The SSL certificate will be revoked.
            </p>
            <button
              onClick={removeDomain}
              disabled={removing}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {removing ? 'Removing…' : 'Remove Domain'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
