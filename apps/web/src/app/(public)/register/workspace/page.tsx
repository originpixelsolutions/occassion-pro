/**
 * OccasionPro — Workspace Setup Wizard
 * Route: /register/workspace
 * Step 2: company name, slug, timezone, logo
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, Upload, Check, Globe, Building2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) — UTC+5:30' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) — UTC+4' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT) — UTC+8' },
  { value: 'America/New_York', label: 'Eastern Time (ET) — UTC-5' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — UTC-8' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT) — UTC+0' },
  { value: 'Europe/Paris', label: 'Central European Time (CET) — UTC+1' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET) — UTC+10' },
]

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
}

export default function WorkspaceSetupPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const slugTimer = useRef<NodeJS.Timeout>()

  // Auto-generate slug from company name
  useEffect(() => {
    if (!slugManuallyEdited && companyName) {
      setSlug(slugify(companyName))
    }
  }, [companyName, slugManuallyEdited])

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug) { setSlugAvail(null); return }
    clearTimeout(slugTimer.current)
    setCheckingSlug(true)
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/v1/auth/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        setSlugAvail(data.available)
      } catch {
        setSlugAvail(null)
      } finally {
        setCheckingSlug(false)
      }
    }, 500)
    return () => clearTimeout(slugTimer.current)
  }, [slug])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 1_000_000) { setError('Logo must be under 1 MB'); return }
    setLogoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (slugAvail === false) { setError('That workspace URL is already taken'); return }
    setError(null)
    setLoading(true)
    try {
      const token = localStorage.getItem('op_reg_token')
      if (!token) { router.push('/register'); return }

      const formData = new FormData()
      formData.append('company_name', companyName)
      formData.append('slug', slug)
      formData.append('timezone', timezone)
      if (logoFile) formData.append('logo', logoFile)

      const res = await fetch(`${API}/v1/auth/setup-workspace`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Setup failed')

      // Backend returns a NEW token with step:'workspace' + tenant_id — must save it
      localStorage.setItem('op_reg_token', data.token)
      router.push('/register/plan')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg">OccasionPro</span>
      </div>

      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {['Account', 'Workspace', 'Plan'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                i === 0
                  ? 'bg-violet-600/40 border-violet-600/40 text-violet-300'
                  : i === 1
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'border-white/20 text-zinc-500'
              }`}>
                {i === 0 ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-sm ${i === 1 ? 'text-white font-medium' : 'text-zinc-500'}`}>{step}</span>
              {i < 2 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white mb-1">Set up your workspace</h1>
            <p className="text-zinc-400 text-sm">This is how your team and clients will find you.</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company name */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Company name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Stellar Events Studio"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/70 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Workspace URL / slug */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Workspace URL
              </label>
              <div className="flex rounded-xl border border-white/12 bg-white/5 overflow-hidden focus-within:border-violet-500/70 transition-all">
                <div className="flex items-center px-3 border-r border-white/10 bg-white/5">
                  <span className="text-zinc-500 text-sm">app.occasionpro.in/</span>
                </div>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={e => {
                    setSlug(slugify(e.target.value))
                    setSlugManuallyEdited(true)
                  }}
                  placeholder="stellar-events"
                  className="flex-1 px-3 py-3 text-sm text-white placeholder-zinc-600 bg-transparent focus:outline-none"
                />
                <div className="flex items-center px-3">
                  {checkingSlug && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-violet-400 rounded-full animate-spin" />
                  )}
                  {!checkingSlug && slugAvail === true && slug && (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {!checkingSlug && slugAvail === false && (
                    <span className="text-red-400 text-xs">Taken</span>
                  )}
                </div>
              </div>
              {slug && slugAvail === true && (
                <p className="text-xs text-emerald-400/80 mt-1.5">✓ This URL is available</p>
              )}
              <p className="text-xs text-zinc-600 mt-1.5">Only lowercase letters, numbers, and hyphens. Max 30 characters.</p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-white/12 bg-zinc-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/70 transition-all"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Logo upload */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Company logo <span className="text-zinc-600">(optional)</span></label>
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white/10 p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
                <div>
                  <div className="text-sm text-zinc-300">{logoPreview ? 'Change logo' : 'Upload company logo'}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">PNG, JPG or SVG · Max 1 MB</div>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>

            <button
              type="submit"
              disabled={loading || slugAvail === false || !companyName || !slug}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Continue to plan selection
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
