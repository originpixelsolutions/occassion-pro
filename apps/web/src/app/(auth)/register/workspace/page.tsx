'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRegisterStore } from '@/store/register.store'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Loader2, Zap, ArrowRight, Building2, Globe, CheckCircle2,
  AlertCircle, Upload, X,
} from 'lucide-react'
import Link from 'next/link'

// ── Step indicator (shared pattern) ────────────────────────────────────────
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: 'Account' }, { n: 2, label: 'Workspace' }, { n: 3, label: 'Plan' }]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              s.n < current ? 'bg-primary text-primary-foreground' :
              s.n === current ? 'bg-primary/20 border-2 border-primary text-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {s.n < current ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[10px] font-medium ${s.n === current ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-px mb-5 mx-1 transition-all ${s.n < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Timezones ────────────────────────────────────────────────────────────────
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) — UTC+5:30' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) — UTC+4' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT) — UTC+8' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (ICT) — UTC+7' },
  { value: 'Asia/Colombo', label: 'Sri Lanka Time (SLST) — UTC+5:30' },
  { value: 'Asia/Karachi', label: 'Pakistan Standard Time (PKT) — UTC+5' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Standard Time (BST) — UTC+6' },
  { value: 'Asia/Kathmandu', label: 'Nepal Time (NPT) — UTC+5:45' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT) — UTC+0' },
  { value: 'Europe/Paris', label: 'Central European Time (CET) — UTC+1' },
  { value: 'America/New_York', label: 'Eastern Time (ET) — UTC-5' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — UTC-8' },
  { value: 'America/Chicago', label: 'Central Time (CT) — UTC-6' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST) — UTC+10' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (NZST) — UTC+12' },
]

export default function WorkspacePage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { setWorkspaceData, setTenantId, setCompletedStep, companyName: savedName, slug: savedSlug, timezone: savedTz } = useRegisterStore()

  const [companyName, setCompanyName] = useState(savedName)
  const [slug, setSlug] = useState(savedSlug)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [timezone, setTimezone] = useState(savedTz)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Verify user is signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error('Please create your account first')
        router.push('/register')
      } else {
        setAuthChecked(true)
      }
    })
  }, [])

  // Auto-derive slug from company name
  useEffect(() => {
    if (!slugManuallyEdited && companyName) {
      setSlug(slugify(companyName))
    }
  }, [companyName, slugManuallyEdited])

  // Debounced slug availability check
  const checkSlug = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>
      return (value: string) => {
        clearTimeout(timer)
        if (!value || value.length < 3) {
          setSlugStatus('idle')
          return
        }
        setSlugStatus('checking')
        timer = setTimeout(async () => {
          try {
            const { data } = await supabase
              .from('tenants')
              .select('id')
              .eq('slug', value)
              .single()
            setSlugStatus(data ? 'taken' : 'available')
          } catch {
            // No row found = available
            setSlugStatus('available')
          }
        }, 500)
      }
    })(),
    [],
  )

  useEffect(() => {
    checkSlug(slug)
  }, [slug])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!companyName.trim()) {
      toast.error('Company name is required')
      return
    }
    if (slug.length < 3) {
      toast.error('Workspace slug must be at least 3 characters')
      return
    }
    if (slugStatus === 'taken') {
      toast.error('That workspace slug is already taken')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Upload logo if provided
      let logoUrl: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `logos/${session.user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('tenant-assets')
          .upload(path, logoFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      // Create tenant via API
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiBase}/api/v1/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: companyName.trim(),
          slug: slug.trim(),
          timezone,
          logo_url: logoUrl,
          owner_id: session.user.id,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `API error ${res.status}`)
      }

      const tenant = await res.json()
      const tenantId = tenant.id ?? tenant.data?.id

      setWorkspaceData({ companyName: companyName.trim(), slug: slug.trim(), timezone, logoUrl })
      if (tenantId) setTenantId(tenantId)
      setCompletedStep(2)

      router.push('/register/plan')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">OccasionPro</span>
          </Link>
          <StepIndicator current={2} />
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/30 space-y-6"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Set up your workspace</h1>
            <p className="text-sm text-muted-foreground">
              This is where your team will manage all your events.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Logo upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {logoPreview ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-background/80 rounded-full flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                    <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </label>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Company logo</p>
                <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG up to 2 MB (optional)</p>
              </div>
            </div>

            {/* Company name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Company name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Stellar Events & Weddings"
                required
                autoFocus
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Workspace slug */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Workspace URL
              </label>
              <div className="flex items-center gap-0">
                <div className="flex-shrink-0 px-3 py-2.5 bg-muted border border-border border-r-0 rounded-l-xl text-sm text-muted-foreground">
                  app.occasionpro.in/
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true)
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }}
                    placeholder="stellar-events"
                    required
                    minLength={3}
                    maxLength={40}
                    className={`w-full px-3 py-2.5 pr-8 bg-background border border-border rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all ${
                      slugStatus === 'taken' ? 'border-red-500 focus:ring-red-500/30' :
                      slugStatus === 'available' ? 'border-green-500 focus:ring-green-500/30' : ''
                    }`}
                  />
                  {/* Status icon */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {slugStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    {slugStatus === 'available' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    {slugStatus === 'taken' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                </div>
              </div>
              {slugStatus === 'taken' && (
                <p className="text-xs text-red-500">This slug is already taken. Try a different one.</p>
              )}
              {slugStatus === 'available' && (
                <p className="text-xs text-green-500">This workspace URL is available!</p>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || slugStatus === 'taken' || slugStatus === 'checking'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-primary/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {loading ? 'Creating workspace…' : 'Continue to plan selection'}
            </button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          You can change these settings later in Workspace Settings.
        </p>
      </div>
    </div>
  )
}
