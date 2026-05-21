'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, ChevronDown, Loader2, Monitor, Moon, Paintbrush,
  RefreshCw, RotateCcw, Save, Sun, Type, Upload, Zap, Globe,
  Layers, Sliders, Eye, Palette, Image as ImageIcon, AlertCircle,
} from 'lucide-react'
import { BrandingTokenSet, DEFAULT_BRANDING, applyBrandingToDOM, invalidateBrandingCache, RADIUS_MAP } from '@/lib/branding'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ─── HSL helpers ─────────────────────────────────────────────────────────────

function hslToHex(hsl: string): string {
  try {
    const [h, s, l] = hsl.split(' ').map((v, i) => i === 0 ? parseFloat(v) : parseFloat(v) / 100)
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  } catch { return '#7c3aed' }
}

function hexToHsl(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
  } catch { return '263 72% 58%' }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantOption { id: string; name: string }

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorSwatch({ label, hsl, onChange }: { label: string; hsl: string; onChange: (h: string) => void }) {
  const hex = hslToHex(hsl)
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={hex}
            onChange={e => onChange(hexToHsl(e.target.value))}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
          />
        </div>
        <input
          type="text"
          value={hsl}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          placeholder="H S% L%"
        />
        <div className="w-8 h-8 rounded-lg border border-border/50 flex-shrink-0" style={{ background: `hsl(${hsl})` }} />
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.FC<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({ tokens, previewTheme }: { tokens: BrandingTokenSet; previewTheme: 'light' | 'dark' }) {
  const bg = previewTheme === 'dark' ? `hsl(${tokens.background_dark_hsl})` : `hsl(${tokens.background_light_hsl})`
  const card = previewTheme === 'dark' ? `hsl(${tokens.card_dark_hsl})` : `hsl(${tokens.card_light_hsl})`
  const border = previewTheme === 'dark' ? `hsl(${tokens.border_dark_hsl})` : `hsl(${tokens.border_light_hsl})`
  const textPrimary = previewTheme === 'dark' ? '#f1f5f9' : '#0f172a'
  const textMuted = previewTheme === 'dark' ? '#94a3b8' : '#64748b'
  const primary = `hsl(${tokens.primary_hsl})`
  const secondary = `hsl(${tokens.secondary_hsl})`
  const accent = `hsl(${tokens.accent_hsl})`
  const success = `hsl(${tokens.success_hsl})`
  const danger = `hsl(${tokens.danger_hsl})`
  const radius = RADIUS_MAP[tokens.border_radius] ?? RADIUS_MAP.default
  const font = tokens.font_family

  return (
    <div
      className="rounded-2xl overflow-hidden border select-none"
      style={{ background: bg, borderColor: border, fontFamily: `'${font}', sans-serif`, fontSize: 11 }}
    >
      {/* Mini Sidebar */}
      <div className="flex h-72">
        <div className="w-14 flex flex-col items-center py-3 gap-2 border-r" style={{ background: card, borderColor: border }}>
          {/* Logo */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          {/* Nav dots */}
          {[primary, 'transparent', 'transparent', 'transparent', 'transparent'].map((c, i) => (
            <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: c === 'transparent' ? 'transparent' : `${primary}1a` }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: i === 0 ? primary : textMuted, opacity: i === 0 ? 1 : 0.4 }} />
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 p-3 space-y-2 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 11 }}>Dashboard</div>
            <div className="flex gap-1.5">
              <div className="px-2 py-0.5 rounded-full text-white text-[9px] font-medium"
                style={{ background: primary, borderRadius: '9999px' }}>New Event</div>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Events', val: '24', grad: `${primary}, ${accent}` },
              { label: 'Revenue', val: '₹4.2M', grad: `${secondary}, ${accent}` },
              { label: 'Guests', val: '1.8K', grad: `${success}, hsl(160 84% 55%)` },
            ].map(({ label, val, grad }) => (
              <div key={label} className="rounded-lg p-2 border" style={{ background: card, borderColor: border }}>
                <div className="w-4 h-4 rounded-md mb-1" style={{ background: `linear-gradient(135deg, ${grad})` }} />
                <div style={{ color: textPrimary, fontWeight: 700, fontSize: 11 }}>{val}</div>
                <div style={{ color: textMuted, fontSize: 9 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Table preview */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: border, background: card }}>
            <div className="px-2 py-1.5 border-b flex gap-3" style={{ borderColor: border }}>
              {['Event Name', 'Status', 'Date'].map(h => (
                <div key={h} style={{ color: textMuted, fontSize: 9, fontWeight: 600, flex: 1 }}>{h}</div>
              ))}
            </div>
            {[
              { name: 'Royal Wedding', status: 'Active', statusColor: success },
              { name: 'Tech Summit', status: 'Planning', statusColor: primary },
            ].map(row => (
              <div key={row.name} className="px-2 py-1 flex gap-3 items-center border-b last:border-0" style={{ borderColor: border }}>
                <div style={{ color: textPrimary, fontSize: 9, flex: 1 }}>{row.name}</div>
                <div style={{ flex: 1 }}>
                  <span className="px-1.5 py-0.5 rounded-full text-white" style={{ background: row.statusColor, fontSize: 8 }}>
                    {row.status}
                  </span>
                </div>
                <div style={{ color: textMuted, fontSize: 9, flex: 1 }}>Jan 2025</div>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { label: 'Primary', bg: primary },
              { label: 'Gold', bg: secondary },
              { label: 'Success', bg: success },
              { label: 'Danger', bg: danger },
            ].map(b => (
              <span key={b.label} className="px-1.5 py-0.5 text-white rounded-full text-[8px]" style={{ background: b.bg, borderRadius: radius }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const GOOGLE_FONTS = [
  { name: 'Inter', url: '' },
  { name: 'Geist', url: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap' },
  { name: 'Manrope', url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap' },
  { name: 'DM Sans', url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap' },
  { name: 'Plus Jakarta Sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap' },
  { name: 'Outfit', url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap' },
  { name: 'Space Grotesk', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap' },
  { name: 'IBM Plex Sans', url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' },
]

function getToken(): string {
  try { return JSON.parse(localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`) ?? '{}')?.access_token ?? '' } catch { return '' }
}

export default function BrandingPage() {
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [selectedTenant, setSelectedTenant] = useState<string>('default')
  const [tokens, setTokens] = useState<BrandingTokenSet>({ ...DEFAULT_BRANDING })
  const [savedTokens, setSavedTokens] = useState<BrandingTokenSet>({ ...DEFAULT_BRANDING })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('dark')
  const [activeTab, setActiveTab] = useState<'palette' | 'surfaces' | 'typography' | 'shape' | 'assets'>('palette')
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadTenants()
  }, [])

  useEffect(() => {
    loadBranding(selectedTenant)
  }, [selectedTenant])

  useEffect(() => {
    // Live preview: apply to DOM as user changes values
    applyBrandingToDOM(tokens)
    setHasChanges(JSON.stringify(tokens) !== JSON.stringify(savedTokens))
  }, [tokens, savedTokens])

  async function loadTenants() {
    try {
      const tok = getToken()
      const res = await fetch(`${API}/super-admin/overview`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) {
        const data = await res.json()
        setTenants((data.tenants ?? []).map((t: any) => ({ id: t.id, name: t.name })))
      }
    } catch {}
  }

  async function loadBranding(tenantId: string) {
    setLoading(true)
    try {
      const tok = getToken()
      const res = await fetch(`${API}/admin/branding/${tenantId}`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) {
        const data: BrandingTokenSet = await res.json()
        setTokens({ ...data })
        setSavedTokens({ ...data })
        setHasChanges(false)
      }
    } catch {
      setTokens({ ...DEFAULT_BRANDING })
      setSavedTokens({ ...DEFAULT_BRANDING })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const tok = getToken()
      const res = await fetch(`${API}/admin/branding/${selectedTenant}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      setSavedTokens({ ...updated })
      setTokens({ ...updated })
      setHasChanges(false)
      invalidateBrandingCache(selectedTenant === 'default' ? null : selectedTenant)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('Failed to save branding. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('Reset this tenant to platform defaults? This cannot be undone.')) return
    const tok = getToken()
    await fetch(`${API}/admin/branding/${selectedTenant}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    })
    loadBranding(selectedTenant)
  }

  async function handleAssetUpload(type: 'logo' | 'favicon', file: File) {
    setUploading(type)
    try {
      const tok = getToken()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await fetch(`${API}/storage/upload`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      update(type === 'logo' ? 'logo_url' : 'favicon_url', url)
    } catch { alert('Upload failed') }
    finally { setUploading(null) }
  }

  const update = <K extends keyof BrandingTokenSet>(key: K, value: BrandingTokenSet[K]) => {
    setTokens(prev => ({ ...prev, [key]: value }))
  }

  const TABS = [
    { id: 'palette', label: 'Palette', icon: Palette },
    { id: 'surfaces', label: 'Surfaces', icon: Layers },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'shape', label: 'Shape', icon: Sliders },
    { id: 'assets', label: 'Assets', icon: ImageIcon },
  ] as const

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/super-admin" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Super Admin</p>
              <h1 className="text-sm font-bold text-foreground">Theme Customization</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-500 font-medium px-2 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 animate-pulse">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={selectedTenant === 'default'}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 bg-muted/50 rounded-lg border border-border/50 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 text-xs px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">

          {/* ── Left: Editor ── */}
          <div className="space-y-6">

            {/* Tenant selector */}
            <div className="bg-card/60 border border-border/60 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Select Tenant</h3>
              </div>
              <select
                value={selectedTenant}
                onChange={e => setSelectedTenant(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
              >
                <option value="default">🌐 Platform Defaults (all tenants)</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedTenant === 'default'
                  ? 'Changes here apply to all tenants that have not set custom branding.'
                  : 'Changes here override platform defaults for this tenant only.'}
              </p>
            </div>

            {/* Editor tabs */}
            <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-border/60 bg-muted/20 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
                      activeTab === tab.id
                        ? 'border-primary text-primary bg-background/50'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* ── Palette Tab ── */}
                {activeTab === 'palette' && (
                  <div className="space-y-6">
                    <SectionHeader icon={Palette} title="Brand Colors" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ColorSwatch label="Primary (CTAs, active states)" hsl={tokens.primary_hsl} onChange={v => update('primary_hsl', v)} />
                      <ColorSwatch label="Secondary (gold, highlights)" hsl={tokens.secondary_hsl} onChange={v => update('secondary_hsl', v)} />
                      <ColorSwatch label="Accent (gradients, hover)" hsl={tokens.accent_hsl} onChange={v => update('accent_hsl', v)} />
                      <ColorSwatch label="Danger / Destructive" hsl={tokens.danger_hsl} onChange={v => update('danger_hsl', v)} />
                      <ColorSwatch label="Success / Positive" hsl={tokens.success_hsl} onChange={v => update('success_hsl', v)} />
                      <ColorSwatch label="Info / Informational" hsl={tokens.info_hsl} onChange={v => update('info_hsl', v)} />
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs text-muted-foreground mb-3">Preview swatches</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Primary', hsl: tokens.primary_hsl },
                          { name: 'Secondary', hsl: tokens.secondary_hsl },
                          { name: 'Accent', hsl: tokens.accent_hsl },
                          { name: 'Danger', hsl: tokens.danger_hsl },
                          { name: 'Success', hsl: tokens.success_hsl },
                          { name: 'Info', hsl: tokens.info_hsl },
                        ].map(c => (
                          <div key={c.name} className="text-center">
                            <div className="w-12 h-12 rounded-xl shadow-sm" style={{ background: `hsl(${c.hsl})` }} />
                            <p className="text-[10px] text-muted-foreground mt-1">{c.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Surfaces Tab ── */}
                {activeTab === 'surfaces' && (
                  <div className="space-y-6">
                    <div>
                      <SectionHeader icon={Sun} title="Light Mode Surfaces" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ColorSwatch label="Background" hsl={tokens.background_light_hsl} onChange={v => update('background_light_hsl', v)} />
                        <ColorSwatch label="Card / Panel" hsl={tokens.card_light_hsl} onChange={v => update('card_light_hsl', v)} />
                        <ColorSwatch label="Border / Muted" hsl={tokens.border_light_hsl} onChange={v => update('border_light_hsl', v)} />
                      </div>
                    </div>
                    <div className="border-t border-border/40 pt-6">
                      <SectionHeader icon={Moon} title="Dark Mode Surfaces" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ColorSwatch label="Background" hsl={tokens.background_dark_hsl} onChange={v => update('background_dark_hsl', v)} />
                        <ColorSwatch label="Card / Panel" hsl={tokens.card_dark_hsl} onChange={v => update('card_dark_hsl', v)} />
                        <ColorSwatch label="Border / Muted" hsl={tokens.border_dark_hsl} onChange={v => update('border_dark_hsl', v)} />
                      </div>
                    </div>
                    <div className="border-t border-border/40 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          className={`relative w-10 h-5 rounded-full transition-colors ${tokens.dark_mode_default ? 'bg-primary' : 'bg-muted'}`}
                          onClick={() => update('dark_mode_default', !tokens.dark_mode_default)}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tokens.dark_mode_default ? 'translate-x-5' : ''}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Default to dark mode</p>
                          <p className="text-xs text-muted-foreground">New users see dark theme by default</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* ── Typography Tab ── */}
                {activeTab === 'typography' && (
                  <div className="space-y-5">
                    <SectionHeader icon={Type} title="Font Family" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GOOGLE_FONTS.map(font => (
                        <button
                          key={font.name}
                          onClick={() => { update('font_family', font.name); update('font_url', font.url || null) }}
                          className={`p-3 rounded-xl border text-sm transition-all text-left ${
                            tokens.font_family === font.name
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground'
                          }`}
                          style={{ fontFamily: `'${font.name}', sans-serif` }}
                        >
                          <p className="font-semibold text-xs">{font.name}</p>
                          <p className="text-[10px] mt-0.5 opacity-60">Ag Bq</p>
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Custom Google Fonts URL (optional)</label>
                      <input
                        type="url"
                        value={tokens.font_url ?? ''}
                        onChange={e => update('font_url', e.target.value || null)}
                        placeholder="https://fonts.googleapis.com/css2?family=..."
                        className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
                      <p className="text-xs text-muted-foreground mb-2">Preview</p>
                      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: `'${tokens.font_family}', sans-serif` }}>
                        OccasionPro
                      </p>
                      <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: `'${tokens.font_family}', sans-serif` }}>
                        AI-powered enterprise event operating system
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Shape Tab ── */}
                {activeTab === 'shape' && (
                  <div className="space-y-5">
                    <SectionHeader icon={Sliders} title="Border Radius" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['sharp', 'default', 'rounded', 'pill'] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => update('border_radius', r)}
                          className={`flex flex-col items-center gap-2 p-4 border rounded-xl transition-all ${
                            tokens.border_radius === r
                              ? 'border-primary bg-primary/10'
                              : 'border-border/50 bg-muted/20 hover:border-border'
                          }`}
                        >
                          <div
                            className="w-10 h-10 bg-primary/80"
                            style={{ borderRadius: RADIUS_MAP[r] }}
                          />
                          <span className={`text-xs font-medium capitalize ${tokens.border_radius === r ? 'text-primary' : 'text-muted-foreground'}`}>
                            {r}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">{RADIUS_MAP[r]}</span>
                        </button>
                      ))}
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/40 space-y-3">
                      <p className="text-xs text-muted-foreground">Preview with selected radius</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          className="px-4 py-2 bg-primary text-white text-sm font-medium"
                          style={{ borderRadius: RADIUS_MAP[tokens.border_radius] }}
                        >
                          Button
                        </button>
                        <div className="px-3 py-1 bg-primary/10 text-primary text-xs border border-primary/20"
                          style={{ borderRadius: tokens.border_radius === 'pill' ? '9999px' : RADIUS_MAP[tokens.border_radius] }}>
                          Badge
                        </div>
                        <div className="w-12 h-12 bg-muted border border-border" style={{ borderRadius: RADIUS_MAP[tokens.border_radius] }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Assets Tab ── */}
                {activeTab === 'assets' && (
                  <div className="space-y-6">
                    <SectionHeader icon={ImageIcon} title="Brand Assets" />
                    {/* Logo upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Logo</label>
                      <div className="flex items-center gap-3">
                        {tokens.logo_url ? (
                          <img src={tokens.logo_url} alt="Logo" className="h-12 rounded-lg border border-border object-contain" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="url"
                            value={tokens.logo_url ?? ''}
                            onChange={e => update('logo_url', e.target.value || null)}
                            placeholder="https://cdn.example.com/logo.svg"
                            className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploading === 'logo'}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-muted border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {uploading === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Upload
                        </button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && handleAssetUpload('logo', e.target.files[0])} />
                      </div>
                    </div>
                    {/* Favicon upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Favicon (32×32 ICO or PNG)</label>
                      <div className="flex items-center gap-3">
                        {tokens.favicon_url ? (
                          <img src={tokens.favicon_url} alt="Favicon" className="w-8 h-8 rounded border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="url"
                            value={tokens.favicon_url ?? ''}
                            onChange={e => update('favicon_url', e.target.value || null)}
                            placeholder="https://cdn.example.com/favicon.ico"
                            className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <button
                          onClick={() => faviconInputRef.current?.click()}
                          disabled={uploading === 'favicon'}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-muted border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {uploading === 'favicon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Upload
                        </button>
                        <input ref={faviconInputRef} type="file" accept="image/*,.ico" className="hidden"
                          onChange={e => e.target.files?.[0] && handleAssetUpload('favicon', e.target.files[0])} />
                      </div>
                    </div>
                    <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Logo and favicon changes take effect immediately for all users of this tenant after saving.
                        Cached browsers may take up to 5 minutes to reflect changes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Live Preview ── */}
          <div className="space-y-4 lg:sticky lg:top-24 self-start">
            <div className="bg-card/60 border border-border/60 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
                </div>
                {/* Theme toggle for preview */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
                  <button
                    onClick={() => setPreviewTheme('light')}
                    className={`p-1.5 rounded-md transition-all ${previewTheme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewTheme('dark')}
                    className={`p-1.5 rounded-md transition-all ${previewTheme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <LivePreview tokens={tokens} previewTheme={previewTheme} />
            </div>

            {/* Token summary */}
            <div className="bg-card/60 border border-border/60 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active Tokens</h3>
              <div className="space-y-2">
                {[
                  { label: '--primary', hsl: tokens.primary_hsl },
                  { label: '--secondary', hsl: tokens.secondary_hsl },
                  { label: '--accent', hsl: tokens.accent_hsl },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex-shrink-0" style={{ background: `hsl(${t.hsl})` }} />
                    <code className="text-xs text-muted-foreground font-mono">{t.label}</code>
                    <code className="text-xs text-foreground/60 font-mono ml-auto">{t.hsl}</code>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Font</span>
                  <span className="text-foreground font-medium">{tokens.font_family}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Radius</span>
                  <span className="text-foreground font-medium capitalize">{tokens.border_radius} ({RADIUS_MAP[tokens.border_radius]})</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Dark default</span>
                  <span className="text-foreground font-medium">{tokens.dark_mode_default ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
