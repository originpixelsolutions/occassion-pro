'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Save, Upload, CheckCircle, RefreshCw, Palette, Type, Building2, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandSettings {
  primary_color:       string
  secondary_color:     string
  logo_url:            string
  company_name:        string
  footer_text:         string
  font_family:         string
  report_header_html:  string
}

const FONT_OPTIONS = [
  { value: 'Inter',       label: 'Inter — Modern & clean' },
  { value: 'Geist',       label: 'Geist — Minimal & tech' },
  { value: 'Playfair Display', label: 'Playfair — Elegant & serif' },
  { value: 'Montserrat', label: 'Montserrat — Geometric & bold' },
  { value: 'Lato',        label: 'Lato — Friendly & rounded' },
]

const DEFAULTS: BrandSettings = {
  primary_color:      '#6366F1',
  secondary_color:    '#8B5CF6',
  logo_url:           '',
  company_name:       '',
  footer_text:        'Powered by OccasionPro',
  font_family:        'Inter',
  report_header_html: '',
}

// ─── Mini color picker ────────────────────────────────────────────────────────

function ColorSwatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded-lg border-2 border-border shadow-sm flex-shrink-0 transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="sr-only"
        />
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v)
          }}
          className="w-28 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="#6366F1"
          maxLength={7}
        />
        <div className="flex gap-1">
          {['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#111827'].map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              title={preset}
              className="w-5 h-5 rounded-full border border-border/50 flex-shrink-0 hover:scale-110 transition-transform"
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function ReportPreview({ settings }: { settings: BrandSettings }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-border shadow-lg" style={{ fontFamily: settings.font_family }}>
      {/* Report header band */}
      <div className="px-6 py-4" style={{ backgroundColor: settings.primary_color }}>
        <div className="flex items-center justify-between">
          <div>
            {settings.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="h-8 object-contain mb-1" />
            )}
            <p className="text-white font-bold text-lg leading-tight">
              {settings.company_name || 'Your Company'}
            </p>
            <p className="text-white/70 text-xs">Guest List · Tech Summit 2026</p>
          </div>
          <p className="text-white/60 text-xs">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Table header */}
      <div className="px-4 py-2 grid grid-cols-5 gap-2 text-xs font-bold text-white text-center"
        style={{ backgroundColor: settings.secondary_color }}>
        {['Name', 'Email', 'Phone', 'RSVP', 'Check-in'].map(h => (
          <span key={h}>{h}</span>
        ))}
      </div>

      {/* Sample rows */}
      {[
        ['Priya Sharma',  'priya@example.com', '+91 98765 43210', 'Confirmed', '✓'],
        ['Arjun Mehta',   'arjun@example.com', '+91 87654 32109', 'Confirmed', '—'],
        ['Nisha Patel',   'nisha@example.com', '+91 76543 21098', 'Pending',   '—'],
      ].map((row, i) => (
        <div key={i} className={`px-4 py-1.5 grid grid-cols-5 gap-2 text-xs ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
          {row.map((cell, j) => (
            <span key={j} className="text-gray-700 truncate">{cell}</span>
          ))}
        </div>
      ))}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">{settings.footer_text}</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrandingSettingsPage() {
  const { session } = useAuth()
  const [settings, setSettings] = useState<BrandSettings>({ ...DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tenantId = (session as any)?.user?.user_metadata?.tenant_id

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const res = await fetch(`${API}/api/v1/tenants/${tenantId}/brand-settings`, { headers: headers() })
    if (res.ok) {
      const data = await res.json()
      if (data) setSettings({ ...DEFAULTS, ...data })
    }
    setLoading(false)
  }, [session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    await fetch(`${API}/api/v1/tenants/${tenantId}/brand-settings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify(settings),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const S = (k: keyof BrandSettings, v: string) => setSettings(s => ({ ...s, [k]: v }))

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/api/v1/storage/upload?bucket=branding&path=${tenantId}/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: formData,
    })
    const data = await res.json()
    if (data.url) S('logo_url', data.url)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
  )

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Brand Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your brand identity. These settings are applied to all exported reports, PDFs and badges.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* ── Left: Settings ──────────────────────────────────────────────────── */}
        <div className="space-y-7">

          {/* Logo */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Company Identity</h2>
            </div>

            {/* Logo upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Company Logo</label>
              <div className="flex items-center gap-4">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-12 w-24 object-contain rounded-lg border border-border bg-background p-1" />
                ) : (
                  <div className="h-12 w-24 rounded-lg border border-dashed border-border bg-background flex items-center justify-center text-xs text-muted-foreground">
                    No logo
                  </div>
                )}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-xs hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                  <p className="text-xs text-muted-foreground">PNG or SVG, max 1 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Company name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Company Name</label>
              <input
                value={settings.company_name}
                onChange={e => S('company_name', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your Company Name"
              />
            </div>
          </div>

          {/* Colors */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Brand Colors</h2>
            </div>
            <ColorSwatch value={settings.primary_color} onChange={v => S('primary_color', v)} label="Primary Color" />
            <ColorSwatch value={settings.secondary_color} onChange={v => S('secondary_color', v)} label="Secondary Color (table headers)" />
          </div>

          {/* Typography */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Type className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Typography</h2>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Report Font</label>
              <div className="grid grid-cols-1 gap-2">
                {FONT_OPTIONS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => S('font_family', f.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                      settings.font_family === f.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground" style={{ fontFamily: f.value }}>{f.label.split(' — ')[0]}</span>
                    <span className="text-xs text-muted-foreground">{f.label.split(' — ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Report text */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Report Text</h2>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Footer Text</label>
              <input
                value={settings.footer_text}
                onChange={e => S('footer_text', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Powered by OccasionPro"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Custom Report Header HTML <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={settings.report_header_html}
                onChange={e => S('report_header_html', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                placeholder='<div>Custom HTML injected into PDF headers</div>'
              />
              <p className="text-xs text-muted-foreground mt-1">Inlined in report headers. Keep it simple — inline styles only.</p>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saved ? <CheckCircle className="w-4 h-4" /> : saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Brand Settings'}
            </button>
          </div>
        </div>

        {/* ── Right: Preview ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Live Preview</h2>
            <p className="text-xs text-muted-foreground">Shows how your brand appears in generated reports.</p>
          </div>

          <ReportPreview settings={settings} />

          {/* Color preview badge */}
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: settings.primary_color }}>
              Primary
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: settings.secondary_color }}>
              Secondary
            </div>
          </div>

          {/* Font preview */}
          <div className="bg-card border border-border rounded-xl p-5" style={{ fontFamily: settings.font_family }}>
            <p className="text-xs text-muted-foreground mb-2">Font preview — {settings.font_family}</p>
            <p className="text-2xl font-bold text-foreground">Event Report 2026</p>
            <p className="text-sm text-muted-foreground mt-1">Guest list, seating chart, run sheet, and more.</p>
            <p className="text-xs text-muted-foreground mt-2">{settings.footer_text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
