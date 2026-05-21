'use client'

/**
 * OccasionPro — NotificationPreferencesPanel
 *
 * Per-module notification preferences editor.
 * Controls: in-app toggle, email toggle, WhatsApp toggle, urgency threshold.
 * Slides in from the right over the NotificationDrawer.
 */

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageCircle,
  ChevronDown,
  Save,
  Loader2,
} from 'lucide-react'
import type { NotificationModule, NotificationUrgency } from './useNotifications'
import { MODULE_LABELS } from './useNotifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModulePref {
  module: NotificationModule
  urgency_threshold: NotificationUrgency
  in_app_enabled: boolean
  email_enabled: boolean
  whatsapp_enabled: boolean
}

const DEFAULT_PREF = (module: NotificationModule): ModulePref => ({
  module,
  urgency_threshold: 'info',
  in_app_enabled: true,
  email_enabled: true,
  whatsapp_enabled: false,
})

const ALL_MODULES: NotificationModule[] = [
  'guests', 'finance', 'fnb', 'floorplan', 'runsheet',
  'vendors', 'clients', 'team', 'conference', 'post_event', 'system',
]

const URGENCY_OPTIONS: Array<{ value: NotificationUrgency; label: string; description: string }> = [
  { value: 'info',     label: 'All',       description: 'Info, warnings, and critical' },
  { value: 'warning',  label: 'Warnings+', description: 'Warnings and critical only' },
  { value: 'critical', label: 'Critical',  description: 'Critical alerts only' },
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function NotificationPreferencesPanel({
  recipientId,
  onClose,
}: {
  recipientId: string
  onClose: () => void
}) {
  const [prefs, setPrefs] = useState<Record<NotificationModule, ModulePref>>(() => {
    const initial: any = {}
    ALL_MODULES.forEach(m => { initial[m] = DEFAULT_PREF(m) })
    return initial
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Fetch existing preferences
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
        if (!res.ok) return
        const data: ModulePref[] = await res.json()
        if (Array.isArray(data)) {
          const next: any = { ...prefs }
          data.forEach(p => { next[p.module] = p })
          setPrefs(next)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const setPref = (module: NotificationModule, key: keyof ModulePref, value: any) => {
    setPrefs(prev => ({
      ...prev,
      [module]: { ...prev[module], [key]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipient_type: 'team',
          preferences: Object.values(prefs),
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-60 w-[380px] bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl"
      style={{ animation: 'slideInFromRight 0.18s ease-out' }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center gap-3 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
          <p className="text-xs text-zinc-500">Control how you receive notifications per module</p>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-5 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Bell className="w-3 h-3" /> In-app
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Mail className="w-3 h-3" /> Email
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MessageCircle className="w-3 h-3" /> WhatsApp
        </div>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
          </div>
        ) : (
          ALL_MODULES.map(mod => {
            const pref = prefs[mod]
            return (
              <div key={mod} className="py-3 border-b border-zinc-800/60 last:border-0">
                {/* Module name */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {MODULE_LABELS[mod]}
                  </span>
                  {/* Urgency threshold selector */}
                  <div className="relative">
                    <select
                      value={pref.urgency_threshold}
                      onChange={e => setPref(mod, 'urgency_threshold', e.target.value)}
                      className="text-xs bg-zinc-800 border border-zinc-700 rounded-md pl-2 pr-6 py-1 text-zinc-300 appearance-none focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      {URGENCY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Channel toggles */}
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle
                      checked={pref.in_app_enabled}
                      onChange={v => setPref(mod, 'in_app_enabled', v)}
                    />
                    <Bell className="w-3 h-3 text-zinc-500" />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle
                      checked={pref.email_enabled}
                      onChange={v => setPref(mod, 'email_enabled', v)}
                    />
                    <Mail className="w-3 h-3 text-zinc-500" />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle
                      checked={pref.whatsapp_enabled}
                      onChange={v => setPref(mod, 'whatsapp_enabled', v)}
                    />
                    <MessageCircle className="w-3 h-3 text-zinc-500" />
                  </label>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Save button */}
      <div className="px-4 py-4 border-t border-zinc-800 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Save className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save preferences</>
          )}
        </button>
      </div>
    </div>
  )
}
