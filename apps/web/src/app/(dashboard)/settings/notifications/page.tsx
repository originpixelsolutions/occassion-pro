'use client'

/**
 * OccasionPro — Notification Settings Page
 * /settings/notifications
 *
 * Full-page notification configuration:
 *   1. Global channel master toggles (in-app, email, SMS, WhatsApp, push)
 *   2. Per-module channel matrix with urgency threshold
 *   3. Quiet hours time picker + day-of-week toggles
 *   4. Digest preference (instant / hourly batch / daily digest)
 *   5. Test notification panel (per channel)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Mail, MessageCircle, Smartphone, BellOff,
  Moon, Sun, Clock, Zap, CheckCircle2, AlertCircle,
  Loader2, Save, ChevronRight, Settings2, Send,
  Calendar, DollarSign, Users, Package, Utensils,
  Map, BarChart2, UserCog, Megaphone, RefreshCw,
  Shield, Volume2, VolumeX, Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

type NotificationModule =
  | 'guests' | 'finance' | 'fnb' | 'floorplan' | 'runsheet'
  | 'vendors' | 'clients' | 'team' | 'conference' | 'post_event' | 'system'

type UrgencyThreshold = 'info' | 'warning' | 'critical'

interface ModulePref {
  module: NotificationModule
  urgency_threshold: UrgencyThreshold
  in_app_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  push_enabled: boolean
}

interface GlobalSettings {
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_from: string     // "HH:MM"
  quiet_to: string       // "HH:MM"
  quiet_days: number[]   // 0=Sun .. 6=Sat
  digest_mode: 'instant' | 'hourly' | 'daily'
  digest_time: string    // "HH:MM" — only used when digest_mode === 'daily'
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MODULES: Array<{ key: NotificationModule; label: string; icon: React.FC<any> }> = [
  { key: 'guests',     label: 'Guest Management', icon: Users },
  { key: 'finance',    label: 'Finance',          icon: DollarSign },
  { key: 'fnb',        label: 'F&B',              icon: Utensils },
  { key: 'floorplan',  label: 'Floor Plan',       icon: Map },
  { key: 'runsheet',   label: 'Runsheet',         icon: Clock },
  { key: 'vendors',    label: 'Vendors',          icon: Package },
  { key: 'clients',    label: 'Clients',          icon: UserCog },
  { key: 'team',       label: 'Team',             icon: Users },
  { key: 'conference', label: 'Conference',       icon: Calendar },
  { key: 'post_event', label: 'Post Event',       icon: BarChart2 },
  { key: 'system',     label: 'System',           icon: Settings2 },
]

const CHANNELS: Array<{ key: keyof ModulePref; label: string; icon: React.FC<any>; globalKey: keyof GlobalSettings }> = [
  { key: 'in_app_enabled',    label: 'In-App',    icon: Bell,           globalKey: 'in_app_enabled' },
  { key: 'email_enabled',     label: 'Email',     icon: Mail,           globalKey: 'email_enabled' },
  { key: 'sms_enabled',       label: 'SMS',       icon: MessageCircle,  globalKey: 'sms_enabled' },
  { key: 'whatsapp_enabled',  label: 'WhatsApp',  icon: MessageCircle,  globalKey: 'whatsapp_enabled' },
  { key: 'push_enabled',      label: 'Push',      icon: Smartphone,     globalKey: 'push_enabled' },
]

const URGENCY_OPTS: Array<{ value: UrgencyThreshold; label: string; color: string }> = [
  { value: 'info',     label: 'All',       color: 'text-blue-400' },
  { value: 'warning',  label: 'Warn+',     color: 'text-amber-400' },
  { value: 'critical', label: 'Critical',  color: 'text-red-400' },
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const DEFAULT_GLOBAL: GlobalSettings = {
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  push_enabled: true,
  in_app_enabled: true,
  quiet_hours_enabled: false,
  quiet_from: '22:00',
  quiet_to: '08:00',
  quiet_days: [0, 6],
  digest_mode: 'instant',
  digest_time: '08:00',
}

const DEFAULT_MODULE_PREF = (module: NotificationModule): ModulePref => ({
  module,
  urgency_threshold: 'info',
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  push_enabled: true,
})

// ─── Primitives ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors shrink-0',
        checked ? 'bg-violet-600' : 'bg-zinc-700',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [global, setGlobal] = useState<GlobalSettings>(DEFAULT_GLOBAL)
  const [prefs, setPrefs] = useState<Record<NotificationModule, ModulePref>>(() => {
    const init: any = {}
    MODULES.forEach(m => { init[m.key] = DEFAULT_MODULE_PREF(m.key) })
    return init
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [testChannel, setTestChannel] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [globRes, prefRes] = await Promise.all([
          fetch('/api/notifications/preferences/global', { credentials: 'include' }),
          fetch('/api/notifications/preferences', { credentials: 'include' }),
        ])
        if (globRes.ok) {
          const g = await globRes.json()
          setGlobal({ ...DEFAULT_GLOBAL, ...g })
        }
        if (prefRes.ok) {
          const data: ModulePref[] = await prefRes.json()
          if (Array.isArray(data)) {
            setPrefs(prev => {
              const next = { ...prev }
              data.forEach(p => { next[p.module] = p })
              return next
            })
          }
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  // ── Setters ───────────────────────────────────────────────────────────────────

  const setModulePref = useCallback((module: NotificationModule, key: keyof ModulePref, value: any) => {
    setPrefs(prev => ({ ...prev, [module]: { ...prev[module], [key]: value } }))
  }, [])

  const toggleDay = (day: number) => {
    setGlobal(prev => ({
      ...prev,
      quiet_days: prev.quiet_days.includes(day)
        ? prev.quiet_days.filter(d => d !== day)
        : [...prev.quiet_days, day],
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveState('idle')
    try {
      await Promise.all([
        fetch('/api/notifications/preferences/global', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(global),
        }),
        fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ recipient_type: 'team', preferences: Object.values(prefs) }),
        }),
      ])
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
    }
    setSaving(false)
  }

  // ── Test ──────────────────────────────────────────────────────────────────────

  const handleTest = async (channel: string) => {
    setTestChannel(channel)
    setTestState('sending')
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel }),
      })
      setTestState(res.ok ? 'sent' : 'error')
    } catch {
      setTestState('error')
    }
    setTimeout(() => { setTestState('idle'); setTestChannel(null) }, 3000)
  }

  // ── UI ────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">Notifications</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {saveState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> Save failed
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl">

        {/* ── 1. Global Channel Toggles ─────────────────────────────────────── */}
        <SectionCard
          title="Delivery Channels"
          description="Master switches for each notification channel. Disabling a channel overrides all per-module settings."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CHANNELS.map(ch => {
              const Icon = ch.icon
              const enabled = global[ch.globalKey] as boolean
              return (
                <div key={ch.key}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      enabled ? 'bg-violet-500/15 text-violet-400' : 'bg-muted/40 text-muted-foreground',
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {enabled ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={enabled}
                    onChange={v => setGlobal(g => ({ ...g, [ch.globalKey]: v }))}
                  />
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* ── 2. Per-Module Matrix ──────────────────────────────────────────── */}
        <SectionCard
          title="Per-Module Preferences"
          description="Fine-tune which channels are active for each platform module, and set the minimum urgency level."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2.5 pr-4 text-xs font-medium text-muted-foreground w-36">Module</th>
                  {CHANNELS.map(ch => {
                    const Icon = ch.icon
                    return (
                      <th key={ch.key} className="text-center py-2.5 px-2 text-xs font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="hidden sm:block">{ch.label}</span>
                        </div>
                      </th>
                    )
                  })}
                  <th className="text-center py-2.5 px-2 text-xs font-medium text-muted-foreground">Min Level</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod, idx) => {
                  const pref = prefs[mod.key]
                  const ModIcon = mod.icon
                  return (
                    <tr key={mod.key} className={cn(
                      'border-b border-border/25 last:border-0',
                      idx % 2 === 0 ? '' : 'bg-muted/10',
                    )}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <ModIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate">{mod.label}</span>
                        </div>
                      </td>
                      {CHANNELS.map(ch => {
                        const globallyDisabled = !(global[ch.globalKey] as boolean)
                        const isOn = pref[ch.key as keyof ModulePref] as boolean
                        return (
                          <td key={ch.key} className="py-3 px-2 text-center">
                            <div className="flex justify-center">
                              <Toggle
                                checked={isOn}
                                onChange={v => setModulePref(mod.key, ch.key as keyof ModulePref, v)}
                                disabled={globallyDisabled}
                              />
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-3 px-2 text-center">
                        <select
                          value={pref.urgency_threshold}
                          onChange={e => setModulePref(mod.key, 'urgency_threshold', e.target.value)}
                          className="text-xs bg-muted/30 border border-border/60 rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                        >
                          {URGENCY_OPTS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── 3. Quiet Hours ────────────────────────────────────────────────── */}
        <SectionCard
          title="Quiet Hours"
          description="Block all non-critical notifications during specified hours. Critical alerts are always delivered."
        >
          <div className="space-y-5">
            {/* Master enable */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <Moon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Quiet Hours</p>
                  <p className="text-xs text-muted-foreground">Pause non-critical notifications</p>
                </div>
              </div>
              <Toggle
                checked={global.quiet_hours_enabled}
                onChange={v => setGlobal(g => ({ ...g, quiet_hours_enabled: v }))}
              />
            </div>

            {global.quiet_hours_enabled && (
              <div className="pl-11 space-y-4 animate-in fade-in slide-in-from-top-1">
                {/* Time range */}
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">From</label>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border border-border/60 rounded-lg">
                      <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="time"
                        value={global.quiet_from}
                        onChange={e => setGlobal(g => ({ ...g, quiet_from: e.target.value }))}
                        className="bg-transparent text-sm text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pt-6">to</div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">To</label>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border border-border/60 rounded-lg">
                      <Sun className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="time"
                        value={global.quiet_to}
                        onChange={e => setGlobal(g => ({ ...g, quiet_to: e.target.value }))}
                        className="bg-transparent text-sm text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Days of week */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">Apply on days</label>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map((label, day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={cn(
                          'w-9 h-9 rounded-lg text-xs font-medium transition-colors',
                          global.quiet_days.includes(day)
                            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                            : 'bg-muted/30 text-muted-foreground border border-border/40 hover:bg-muted/50',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  Critical alerts bypass quiet hours and are always delivered.
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 4. Digest Settings ────────────────────────────────────────────── */}
        <SectionCard
          title="Notification Digest"
          description="Choose how frequently notifications are bundled together."
        >
          <div className="space-y-3">
            {[
              { value: 'instant', label: 'Instant', description: 'Deliver each notification immediately', icon: Zap },
              { value: 'hourly', label: 'Hourly Batch', description: 'Group notifications and deliver once per hour', icon: Clock },
              { value: 'daily', label: 'Daily Digest', description: 'Receive one summary email each day', icon: Inbox },
            ].map(opt => {
              const Icon = opt.icon
              const selected = global.digest_mode === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setGlobal(g => ({ ...g, digest_mode: opt.value as GlobalSettings['digest_mode'] }))}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors',
                    selected
                      ? 'border-violet-500/30 bg-violet-500/8'
                      : 'border-border/40 bg-muted/20 hover:bg-muted/30',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    selected ? 'bg-violet-500/20 text-violet-400' : 'bg-muted/40 text-muted-foreground',
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', selected ? 'text-violet-300' : 'text-foreground')}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 shrink-0',
                    selected ? 'border-violet-500 bg-violet-500' : 'border-border',
                  )} />
                </button>
              )
            })}

            {global.digest_mode === 'daily' && (
              <div className="flex items-center gap-3 pt-1 pl-12 animate-in fade-in">
                <label className="text-xs text-muted-foreground">Deliver at</label>
                <input
                  type="time"
                  value={global.digest_time}
                  onChange={e => setGlobal(g => ({ ...g, digest_time: e.target.value }))}
                  className="px-3 py-1.5 bg-muted/30 border border-border/60 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 5. Test Notifications ─────────────────────────────────────────── */}
        <SectionCard
          title="Test Notifications"
          description="Send a test notification to verify each channel is configured and working."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {CHANNELS.map(ch => {
              const Icon = ch.icon
              const isEnabled = global[ch.globalKey] as boolean
              const isTesting = testChannel === ch.label && testState === 'sending'
              const isSent = testChannel === ch.label && testState === 'sent'
              const isError = testChannel === ch.label && testState === 'error'
              return (
                <button
                  key={ch.key}
                  onClick={() => isEnabled && handleTest(ch.label)}
                  disabled={!isEnabled || testState === 'sending'}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    isSent && 'border-emerald-500/30 bg-emerald-500/8',
                    isError && 'border-red-500/30 bg-red-500/8',
                    !isSent && !isError && isEnabled && 'border-border/40 bg-muted/20 hover:bg-muted/30 hover:border-primary/30',
                    !isEnabled && 'border-border/20 bg-muted/10 opacity-40 cursor-not-allowed',
                  )}
                >
                  {isTesting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : isSent ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isError ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className={cn(
                    'text-xs font-medium',
                    isSent ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-muted-foreground',
                  )}>
                    {isSent ? 'Sent!' : isError ? 'Failed' : ch.label}
                  </span>
                  {isEnabled && !isTesting && !isSent && !isError && (
                    <Send className="w-3 h-3 text-muted-foreground/50" />
                  )}
                </button>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
