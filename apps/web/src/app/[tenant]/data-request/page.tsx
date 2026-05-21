'use client'

/**
 * OccasionPro — Your Data Rights page
 * Route: /[tenant]/data-request
 *
 * Public page — no auth required.
 * Lets data subjects submit access, correction, erasure, or portability requests
 * under India's Digital Personal Data Protection Act 2023.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Shield, Download, Edit3, Trash2, FileText,
  CheckCircle2, Loader2, AlertCircle, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestType = 'access' | 'correction' | 'erasure' | 'portability'

interface RequestCard {
  type:        RequestType
  icon:        React.ReactNode
  title:       string
  subtitle:    string
  description: string
  timeframe:   string
  color:       string
  iconBg:      string
}

// ─── Request type definitions ─────────────────────────────────────────────────

const REQUEST_CARDS: RequestCard[] = [
  {
    type:        'access',
    icon:        <FileText className="w-5 h-5" />,
    title:       'Access My Data',
    subtitle:    'Right to Access',
    description: 'Request a copy of all personal data we hold about you — including your profile, event participation history, and any data shared with vendors.',
    timeframe:   'Response within 30 days',
    color:       'border-violet-500/30 hover:border-violet-500/60',
    iconBg:      'bg-violet-500/15 text-violet-400',
  },
  {
    type:        'correction',
    icon:        <Edit3 className="w-5 h-5" />,
    title:       'Correct My Data',
    subtitle:    'Right to Correction',
    description: 'Request correction of inaccurate or incomplete personal data. Please describe what needs to be updated and the correct information.',
    timeframe:   'Response within 30 days',
    color:       'border-blue-500/30 hover:border-blue-500/60',
    iconBg:      'bg-blue-500/15 text-blue-400',
  },
  {
    type:        'erasure',
    icon:        <Trash2 className="w-5 h-5" />,
    title:       'Erase My Data',
    subtitle:    'Right to Erasure',
    description: 'Request deletion of your personal data. Note: some data may be retained as required by law (e.g., financial records, legal obligations).',
    timeframe:   'Response within 30 days',
    color:       'border-red-500/30 hover:border-red-500/60',
    iconBg:      'bg-red-500/15 text-red-400',
  },
  {
    type:        'portability',
    icon:        <Download className="w-5 h-5" />,
    title:       'Export My Data',
    subtitle:    'Right to Portability',
    description: 'Request your personal data in a structured, machine-readable format (JSON) that you can transfer to another service.',
    timeframe:   'Response within 30 days',
    color:       'border-emerald-500/30 hover:border-emerald-500/60',
    iconBg:      'bg-emerald-500/15 text-emerald-400',
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DataRequestPage({
  params,
}: {
  params: { tenant: string }
}) {
  const { tenant } = params

  const [selectedType, setSelectedType] = useState<RequestType | null>(null)
  const [email,        setEmail]        = useState('')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [reference,    setReference]    = useState<string | null>(null)

  const selectedCard = REQUEST_CARDS.find(c => c.type === selectedType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !email.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/public/data-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestorEmail: email.trim(),
          requestType:    selectedType,
          tenantId:       tenant,
          notes:          notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Failed to submit request. Please try again.')
      }

      const data = await res.json()
      setReference(data.reference)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (reference) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <Header tenant={tenant} />

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Request Submitted</h1>
              <p className="text-sm text-zinc-400">
                We've received your {selectedCard?.title.toLowerCase()} request and will respond within 30 days.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Reference Number</p>
              <p className="text-xl font-mono font-bold text-violet-400">{reference}</p>
              <p className="text-xs text-zinc-500">
                Save this reference number. You may be asked for it if you follow up on your request.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400 text-left space-y-2">
              <p className="font-medium text-zinc-300">What happens next?</p>
              <ul className="space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">1.</span>
                  You'll receive a confirmation email at <span className="text-zinc-200">{email}</span>.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">2.</span>
                  Our team will review and verify your identity.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">3.</span>
                  We'll respond within 30 days as required by the DPDP Act 2023.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setReference(null)
                  setSelectedType(null)
                  setEmail('')
                  setNotes('')
                }}
                className="flex-1 px-4 py-2.5 text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-xl transition-colors"
              >
                Submit Another Request
              </button>
              <Link
                href={`/${tenant}`}
                className="flex-1 px-4 py-2.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors text-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header tenant={tenant} />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Intro */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              DPDP Act 2023
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">Your Data Rights</h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
            Under India's Digital Personal Data Protection Act 2023, you have the right to access,
            correct, erase, and port your personal data. Submit a request below and we'll respond
            within 30 days.
          </p>
        </div>

        {/* Step 1 — Select request type */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Step 1 — What would you like to do?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REQUEST_CARDS.map(card => (
              <button
                key={card.type}
                onClick={() => setSelectedType(card.type)}
                className={`
                  text-left p-4 rounded-2xl border bg-zinc-900/50 transition-all duration-150 group
                  ${selectedType === card.type
                    ? `${card.color} bg-zinc-900 ring-1 ring-inset ${card.color.replace('hover:', '')}`
                    : `border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900`
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{card.title}</p>
                      {selectedType === card.type && (
                        <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{card.subtitle}</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mt-3">
                  {card.description}
                </p>

                <div className="mt-3 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-zinc-500">{card.timeframe}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 — Form */}
        {selectedType && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Step 2 — Your Details
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected request summary */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border bg-zinc-900 ${selectedCard?.color}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCard?.iconBg}`}>
                  {selectedCard?.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedCard?.title}</p>
                  <p className="text-xs text-zinc-500">{selectedCard?.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Change
                </button>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400" htmlFor="dr-email">
                  Your Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="dr-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                />
                <p className="text-xs text-zinc-600">
                  We'll send the response to this address. This must match the email associated with your data.
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400" htmlFor="dr-notes">
                  Additional Details
                  {selectedType === 'correction' && <span className="text-zinc-500"> (describe what to correct)</span>}
                  {selectedType === 'erasure'    && <span className="text-zinc-500"> (optional reason)</span>}
                </label>
                <textarea
                  id="dr-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder={
                    selectedType === 'correction'
                      ? 'Please describe the incorrect data and what it should be corrected to...'
                      : selectedType === 'erasure'
                      ? 'Optionally describe the specific data you want erased...'
                      : selectedType === 'portability'
                      ? 'Optionally specify which data categories you need exported...'
                      : 'Any additional information that may help us locate your data...'
                  }
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit Request
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-xs text-zinc-600 text-center">
                By submitting, you confirm this request is made on your own behalf or as an authorised
                representative. Requests are processed within 30 days per the DPDP Act 2023.
              </p>
            </form>
          </section>
        )}

        {/* Info footer */}
        <section className="border-t border-zinc-800 pt-8 space-y-3">
          <p className="text-xs font-medium text-zinc-400">About Your Rights</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-500">
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Verification</p>
              <p>We may ask you to verify your identity before processing your request to protect your data.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Response Time</p>
              <p>We'll respond within 30 days. Complex requests may take longer — we'll keep you informed.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Exemptions</p>
              <p>Certain data may be exempt from erasure if required for legal compliance or contractual obligations.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Grievances</p>
              <p>If you're unsatisfied with our response, you can escalate to India's Data Protection Board.</p>
            </div>
          </div>
        </section>

        <p className="text-xs text-zinc-600 text-center pb-6">
          Powered by OccasionPro · Compliant with India's Digital Personal Data Protection Act 2023
        </p>
      </main>
    </div>
  )
}

// ─── Shared header ─────────────────────────────────────────────────────────────

function Header({ tenant }: { tenant: string }) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
        <Link
          href={`/${tenant}/privacy`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Your Data Rights</span>
        </div>
        <Link
          href={`/${tenant}/privacy`}
          className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </header>
  )
}
