'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail, MessageSquare, Phone, RefreshCw, Save, Loader2, CheckCircle2,
  AlertTriangle, Eye, EyeOff, Send, Wifi, WifiOff, QrCode, RotateCcw,
  TestTube2,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken() {
  if (typeof window === 'undefined') return ''
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('supabase') && k.includes('auth')) {
        const p = JSON.parse(localStorage.getItem(k) ?? '{}')
        return p?.access_token ?? p?.access_token ?? ''
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'smtp'
  api_key?: string
  from_address: string
  from_name: string
  reply_to?: string
}

interface SmsConfig {
  provider: 'fast2sms' | 'twilio' | 'msg91'
  api_key?: string
  sender_id: string
  auth_token?: string
  account_sid?: string
}

interface WhatsAppConfig {
  provider: 'baileys' | 'meta'
  meta_api_token?: string
  meta_phone_number_id?: string
  baileys_session_status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending'
  baileys_qr_code?: string
  phone_number?: string
}

interface CommsConfig {
  email: EmailConfig
  sms: SmsConfig
  whatsapp: WhatsAppConfig
}

const DEFAULT: CommsConfig = {
  email: { provider: 'resend', from_address: 'noreply@occasionpro.app', from_name: 'OccasionPro' },
  sms: { provider: 'fast2sms', sender_id: 'OCPRO' },
  whatsapp: { provider: 'baileys', baileys_session_status: 'disconnected' },
}

// ─── Panel wrapper ──────────────────────────────────────────────────────────

function Panel({
  icon: Icon,
  title,
  description,
  children,
  accent = 'violet',
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
  accent?: string
}) {
  const accentMap: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-400',
    blue:   'bg-blue-500/10 text-blue-400',
    green:  'bg-emerald-500/10 text-emerald-400',
  }
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[10px] text-zinc-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  )
}

const INPUT = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const [config, setConfig] = useState<CommsConfig>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState<'email' | 'sms' | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [whatsappRefreshing, setWhatsappRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/super-admin/comms-config')
      setConfig({ ...DEFAULT, ...data })
    } catch {
      // fallback to defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await apiFetch('/super-admin/comms-config', { method: 'POST', body: JSON.stringify(config) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (type: 'email' | 'sms') => {
    setTesting(type)
    setTestResult(r => ({ ...r, [type]: undefined! }))
    try {
      const body = type === 'email' ? { email: testEmail } : { phone: testPhone }
      const res = await apiFetch(`/super-admin/comms-config/test/${type}`, { method: 'POST', body: JSON.stringify(body) })
      setTestResult(r => ({ ...r, [type]: { ok: true, msg: res.message ?? 'Sent successfully' } }))
    } catch (err: unknown) {
      setTestResult(r => ({ ...r, [type]: { ok: false, msg: err instanceof Error ? err.message : 'Failed' } }))
    } finally {
      setTesting(null)
    }
  }

  const refreshWhatsapp = async () => {
    setWhatsappRefreshing(true)
    try {
      const res = await apiFetch('/super-admin/comms-config/whatsapp/status')
      setConfig(c => ({ ...c, whatsapp: { ...c.whatsapp, ...res } }))
    } finally {
      setWhatsappRefreshing(false)
    }
  }

  const disconnectWhatsapp = async () => {
    if (!confirm('Disconnect WhatsApp session?')) return
    await apiFetch('/super-admin/comms-config/whatsapp/disconnect', { method: 'POST' })
    setConfig(c => ({ ...c, whatsapp: { ...c.whatsapp, baileys_session_status: 'disconnected', baileys_qr_code: undefined } }))
  }

  const setEmail = (u: Partial<EmailConfig>) => setConfig(c => ({ ...c, email: { ...c.email, ...u } }))
  const setSms   = (u: Partial<SmsConfig>)   => setConfig(c => ({ ...c, sms:   { ...c.sms,   ...u } }))
  const setWa    = (u: Partial<WhatsAppConfig>) => setConfig(c => ({ ...c, whatsapp: { ...c.whatsapp, ...u } }))

  const waStatus = config.whatsapp.baileys_session_status
  const waStatusStyle: Record<string, string> = {
    connected:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    connecting:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
    qr_pending:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
    disconnected:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Communication Providers</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Email, SMS, and WhatsApp delivery configuration</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKeys(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
          >
            {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showKeys ? 'Hide Keys' : 'Show Keys'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* ─── Email ──────────────────────────────────────────────────────────── */}
        <Panel icon={Mail} title="Email" description="Transactional & marketing email delivery" accent="violet">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Field label="Provider">
              <select
                value={config.email.provider}
                onChange={e => setEmail({ provider: e.target.value as EmailConfig['provider'] })}
                className={INPUT}
              >
                <option value="resend">Resend</option>
                <option value="sendgrid">SendGrid</option>
                <option value="smtp">Custom SMTP</option>
              </select>
            </Field>
            <Field label="API Key" hint="Stored encrypted in Supabase Vault">
              <input
                type={showKeys ? 'text' : 'password'}
                value={config.email.api_key ?? ''}
                onChange={e => setEmail({ api_key: e.target.value })}
                placeholder="re_… / SG.…"
                className={`${INPUT} font-mono`}
              />
            </Field>
            <Field label="From Address">
              <input
                value={config.email.from_address}
                onChange={e => setEmail({ from_address: e.target.value })}
                placeholder="noreply@occasionpro.app"
                className={INPUT}
              />
            </Field>
            <Field label="From Name">
              <input
                value={config.email.from_name}
                onChange={e => setEmail({ from_name: e.target.value })}
                placeholder="OccasionPro"
                className={INPUT}
              />
            </Field>
            <Field label="Reply-To (optional)">
              <input
                value={config.email.reply_to ?? ''}
                onChange={e => setEmail({ reply_to: e.target.value })}
                placeholder="support@occasionpro.app"
                className={INPUT}
              />
            </Field>
          </div>
          {/* Test */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
            <input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="Test email address…"
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-400 placeholder-zinc-600 focus:outline-none"
            />
            <button
              onClick={() => sendTest('email')}
              disabled={testing === 'email' || !testEmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium border border-violet-500/20 disabled:opacity-50 transition-colors"
            >
              {testing === 'email' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send Test
            </button>
            {testResult.email && (
              <span className={`flex items-center gap-1 text-xs ${testResult.email.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.email.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {testResult.email.msg}
              </span>
            )}
          </div>
        </Panel>

        {/* ─── SMS ────────────────────────────────────────────────────────────── */}
        <Panel icon={MessageSquare} title="SMS" description="OTP, alerts, and confirmations via SMS" accent="blue">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Field label="Provider">
              <select
                value={config.sms.provider}
                onChange={e => setSms({ provider: e.target.value as SmsConfig['provider'] })}
                className={INPUT}
              >
                <option value="fast2sms">Fast2SMS (India)</option>
                <option value="msg91">MSG91 (India)</option>
                <option value="twilio">Twilio (Global)</option>
              </select>
            </Field>
            <Field label="API Key / Auth Token">
              <input
                type={showKeys ? 'text' : 'password'}
                value={config.sms.api_key ?? ''}
                onChange={e => setSms({ api_key: e.target.value })}
                placeholder="API key…"
                className={`${INPUT} font-mono`}
              />
            </Field>
            <Field label="Sender ID">
              <input
                value={config.sms.sender_id}
                onChange={e => setSms({ sender_id: e.target.value })}
                placeholder="OCPRO"
                maxLength={11}
                className={INPUT}
              />
            </Field>
            {config.sms.provider === 'twilio' && (
              <Field label="Account SID">
                <input
                  value={config.sms.account_sid ?? ''}
                  onChange={e => setSms({ account_sid: e.target.value })}
                  placeholder="AC…"
                  className={`${INPUT} font-mono`}
                />
              </Field>
            )}
          </div>
          {/* Test */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
            <input
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-400 placeholder-zinc-600 focus:outline-none"
            />
            <button
              onClick={() => sendTest('sms')}
              disabled={testing === 'sms' || !testPhone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {testing === 'sms' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send Test
            </button>
            {testResult.sms && (
              <span className={`flex items-center gap-1 text-xs ${testResult.sms.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.sms.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {testResult.sms.msg}
              </span>
            )}
          </div>
        </Panel>

        {/* ─── WhatsApp ───────────────────────────────────────────────────────── */}
        <Panel icon={Phone} title="WhatsApp" description="WhatsApp Business messaging via Baileys or Meta Cloud API" accent="green">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Provider">
              <select
                value={config.whatsapp.provider}
                onChange={e => setWa({ provider: e.target.value as WhatsAppConfig['provider'] })}
                className={INPUT}
              >
                <option value="baileys">Baileys (self-hosted, free)</option>
                <option value="meta">Meta Cloud API (official)</option>
              </select>
            </Field>
            <Field label="Session Status">
              <div className="flex items-center gap-2 py-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${waStatusStyle[waStatus] ?? waStatusStyle.disconnected}`}>
                  {waStatus.replace('_', ' ').toUpperCase()}
                </span>
                {waStatus === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </Field>
          </div>

          {config.whatsapp.provider === 'meta' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Field label="Meta API Token">
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={config.whatsapp.meta_api_token ?? ''}
                  onChange={e => setWa({ meta_api_token: e.target.value })}
                  placeholder="EAAxx…"
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="Phone Number ID">
                <input
                  value={config.whatsapp.meta_phone_number_id ?? ''}
                  onChange={e => setWa({ meta_phone_number_id: e.target.value })}
                  placeholder="1234567890"
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>
          )}

          {config.whatsapp.provider === 'baileys' && (
            <div className="mb-4">
              {waStatus === 'connected' && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Connected</p>
                    {config.whatsapp.phone_number && (
                      <p className="text-[10px] text-emerald-500/70">{config.whatsapp.phone_number}</p>
                    )}
                  </div>
                  <button
                    onClick={disconnectWhatsapp}
                    className="ml-auto text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {(waStatus === 'qr_pending' || waStatus === 'connecting') && config.whatsapp.baileys_qr_code && (
                <div className="flex flex-col items-center p-5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-zinc-400 mb-3">Scan this QR code in WhatsApp → Linked Devices</p>
                  {/* QR code would be rendered as an image from base64 */}
                  <img
                    src={config.whatsapp.baileys_qr_code}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 rounded-lg bg-white p-2"
                  />
                  <p className="text-[10px] text-zinc-600 mt-3">QR code expires in ~60 seconds</p>
                </div>
              )}

              {waStatus === 'disconnected' && (
                <div className="flex items-center justify-center p-5 rounded-lg bg-white/[0.02] border border-white/[0.06] border-dashed">
                  <div className="text-center">
                    <QrCode className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Not connected</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Click "Connect WhatsApp" to generate QR code</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
            {config.whatsapp.provider === 'baileys' && waStatus !== 'connected' && (
              <button
                onClick={refreshWhatsapp}
                disabled={whatsappRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 disabled:opacity-50 transition-colors"
              >
                {whatsappRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                Connect WhatsApp
              </button>
            )}
            <button
              onClick={refreshWhatsapp}
              disabled={whatsappRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 disabled:opacity-50 transition-colors"
            >
              {whatsappRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Refresh Status
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
