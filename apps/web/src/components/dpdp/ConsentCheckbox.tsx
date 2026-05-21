'use client'

/**
 * OccasionPro — ConsentCheckbox
 *
 * DPDP Act 2023 compliant consent collection component.
 * - Shows explicit consent text with tenant name
 * - "Privacy Policy" link opens full policy in a modal
 * - Calls POST /api/public/consent when checked
 * - Used at: guest registration, RSVP forms, vendor registration, team invite acceptance
 */

import { useState, useCallback } from 'react'
import { X, Shield, ExternalLink } from 'lucide-react'

export interface ConsentCheckboxProps {
  /** Workspace/tenant name shown in the consent text */
  tenantName:    string
  tenantId:      string
  eventId?:      string
  subjectType:   'guest' | 'team_member' | 'client' | 'vendor'
  subjectEmail?: string
  consentType?:  'data_processing' | 'marketing_comms' | 'photo_sharing' | 'third_party_sharing'
  /** Called when the user checks or unchecks the box */
  onConsentChange: (given: boolean) => void
  /** Override the full consent text shown */
  consentText?: string
  /** Disable interaction (e.g., while submitting the parent form) */
  disabled?: boolean
  className?: string
}

const CONSENT_TEXT_TEMPLATE =
  'I consent to {tenantName} collecting and processing my personal data for event management purposes. ' +
  'I have read and understood the Privacy Policy.'

interface PolicyModalProps {
  tenantId: string
  onClose:  () => void
}

function PolicyModal({ tenantId, onClose }: PolicyModalProps) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [version, setVersion] = useState('')
  const [error,   setError]   = useState(false)

  // Fetch on mount
  const fetchPolicy = useCallback(async () => {
    try {
      const res  = await fetch('/api/public/privacy-policy')
      const data = await res.json()
      setContent(data.content_markdown ?? '')
      setVersion(data.version ?? '1.0')
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // useEffect equivalent via ref callback pattern — avoids hook count issues
  if (loading && !error) {
    fetchPolicy()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full sm:max-w-2xl bg-zinc-950 sm:rounded-2xl border border-zinc-800 shadow-2xl flex flex-col max-h-[90dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
          <Shield className="w-5 h-5 text-violet-400" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white">Privacy Policy</h2>
            {version && <p className="text-xs text-zinc-500 mt-0.5">Version {version}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 prose prose-sm prose-invert max-w-none">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-zinc-400 text-center py-8">
              Unable to load policy. Please visit{' '}
              <a href="/privacy" target="_blank" className="text-violet-400 underline">
                our privacy page
              </a>{' '}
              for full details.
            </p>
          )}
          {!loading && !error && (
            <MarkdownRenderer content={content} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 shrink-0 flex items-center justify-between">
          <a
            href="/privacy"
            target="_blank"
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open full policy
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Minimal Markdown → JSX renderer (avoids react-markdown dep requirement)
function MarkdownRenderer({ content }: { content: string }) {
  const lines  = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# '))        { elements.push(<h1 key={i} className="text-xl font-bold text-white mt-6 mb-3">{line.slice(2)}</h1>); i++; continue }
    if (line.startsWith('## '))       { elements.push(<h2 key={i} className="text-base font-semibold text-white mt-5 mb-2">{line.slice(3)}</h2>); i++; continue }
    if (line.startsWith('### '))      { elements.push(<h3 key={i} className="text-sm font-semibold text-zinc-300 mt-4 mb-1">{line.slice(4)}</h3>); i++; continue }
    if (line.startsWith('---'))       { elements.push(<hr key={i} className="border-zinc-800 my-4" />); i++; continue }
    if (line.startsWith('- '))        { elements.push(<li key={i} className="text-sm text-zinc-400 ml-4 list-disc">{renderInline(line.slice(2))}</li>); i++; continue }
    if (line.trim() === '')           { elements.push(<div key={i} className="h-2" />); i++; continue }
    elements.push(<p key={i} className="text-sm text-zinc-400 leading-relaxed">{renderInline(line)}</p>)
    i++
  }

  return <div>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-zinc-200">{p.slice(2, -2)}</strong>
      : p
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ConsentCheckbox({
  tenantName,
  tenantId,
  eventId,
  subjectType,
  subjectEmail,
  consentType  = 'data_processing',
  onConsentChange,
  consentText,
  disabled     = false,
  className    = '',
}: ConsentCheckboxProps) {
  const [checked,      setChecked]      = useState(false)
  const [showPolicy,   setShowPolicy]   = useState(false)
  const [recording,    setRecording]    = useState(false)

  const resolvedText = consentText
    ?? CONSENT_TEXT_TEMPLATE.replace('{tenantName}', tenantName)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const given = e.target.checked
    setChecked(given)
    onConsentChange(given)

    // Fire-and-forget — do not block UX on consent record API call
    if (subjectEmail && given) {
      setRecording(true)
      try {
        await fetch('/api/public/consent', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            eventId,
            subjectType,
            subjectEmail,
            consentType,
            consentGiven: true,
            consentText:  resolvedText,
          }),
        })
      } catch {}
      setRecording(false)
    }
  }

  return (
    <>
      <label
        className={`flex items-start gap-3 cursor-pointer group ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        {/* Custom checkbox */}
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled || recording}
            className="sr-only"
          />
          <div
            className={`
              w-4 h-4 rounded border transition-all
              ${checked
                ? 'bg-violet-600 border-violet-600'
                : 'bg-transparent border-zinc-600 group-hover:border-zinc-400'
              }
            `}
          >
            {checked && (
              <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Consent text */}
        <p className="text-xs text-zinc-400 leading-relaxed">
          I consent to <span className="text-zinc-200 font-medium">{tenantName}</span> collecting and
          processing my personal data for event management purposes. I have read and understood the{' '}
          <button
            type="button"
            onClick={e => { e.preventDefault(); setShowPolicy(true) }}
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </button>
          .
        </p>
      </label>

      {/* Privacy policy modal */}
      {showPolicy && (
        <PolicyModal
          tenantId={tenantId}
          onClose={() => setShowPolicy(false)}
        />
      )}
    </>
  )
}
