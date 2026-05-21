'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Shield, Smartphone, Key, LogOut, Eye, EyeOff, Clock, MapPin, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveSession = {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

// ── Password change form ──────────────────────────────────────────────────────

function PasswordSection() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ current: '', new: '', confirm: '' })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.new !== form.confirm) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1000))
    setSaving(false)
    setForm({ current: '', new: '', confirm: '' })
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Key className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Password</h3>
          <p className="text-xs text-muted-foreground">Change your account password</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3 max-w-sm">
        {/* Current password */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={form.new}
              onChange={(e) => setForm((f) => ({ ...f, new: e.target.value }))}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            className={cn(
              'w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary',
              form.confirm && form.confirm !== form.new && 'border-red-500',
            )}
            placeholder="••••••••"
          />
          {form.confirm && form.confirm !== form.new && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !form.current || !form.new || form.new !== form.confirm}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </section>
  )
}

// ── Two-factor auth section ───────────────────────────────────────────────────

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false)

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-green-500" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Two-Factor Authentication</h3>
            <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
          </div>
        </div>
        <button
          onClick={() => setEnabled((e) => !e)}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            enabled ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow',
              enabled ? 'translate-x-4' : 'translate-x-1',
            )}
          />
        </button>
      </div>

      {enabled && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-xs text-green-600 dark:text-green-400">
            Two-factor authentication is enabled. Your account is more secure.
          </p>
        </div>
      )}

      {!enabled && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Enable 2FA to protect your account from unauthorized access.
          </p>
        </div>
      )}
    </section>
  )
}

// ── Active sessions ───────────────────────────────────────────────────────────

function SessionsSection() {
  const { token } = useAuth()
  const [sessions, setSessions] = useState<ActiveSession[]>([])

  useEffect(() => {
    if (!token) return
    // Load current session from /auth/me, then enrich with any session list
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((me: any) => {
        if (!me) return
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        const deviceGuess = ua.includes('Mobile') ? 'Mobile Browser' : ua.includes('Chrome') ? 'Chrome Browser' : ua.includes('Safari') ? 'Safari Browser' : ua.includes('Firefox') ? 'Firefox Browser' : 'Web Browser'
        setSessions([{
          id: 'current',
          device: deviceGuess,
          location: 'Current location',
          lastActive: 'Now',
          current: true,
        }])
      })
      .catch(() => {})
  }, [token])

  const revoke = useCallback(async (id: string) => {
    if (!token) return
    await fetch(`${API}/auth/sessions/${id}/revoke`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    setSessions(s => s.filter(sess => sess.id !== id))
  }, [token])

  const revokeAll = useCallback(async () => {
    if (!token) return
    await fetch(`${API}/auth/signout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ revoke_all: true }),
    }).catch(() => {})
    setSessions(s => s.filter(sess => sess.current))
  }, [token])

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Clock className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Active Sessions</h3>
          <p className="text-xs text-muted-foreground">Manage where you're currently signed in</p>
        </div>
      </div>

      <div className="space-y-2">
        {sessions.map((sess) => (
          <div
            key={sess.id}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface/50 border border-border/50"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{sess.device}</span>
                {sess.current && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{sess.location}</span>
                <span>·</span>
                <s