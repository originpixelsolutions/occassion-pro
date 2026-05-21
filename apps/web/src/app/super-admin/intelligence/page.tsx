'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Eye, EyeOff, Loader2, RefreshCw, Save, CheckCircle2,
  Zap, AlertTriangle, ToggleLeft, ToggleRight, Sparkles, Activity,
  Server, TestTube2,
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

type AIProvider = 'none' | 'openai' | 'anthropic' | 'ollama' | 'litellm'

interface AIConfig {
  ai_enabled: boolean
  default_provider: AIProvider
  openai_api_key?: string
  anthropic_api_key?: string
  ollama_base_url?: string
  litellm_base_url?: string
  litellm_api_key?: string
  default_model: string
  max_tokens_per_request: number
  monthly_token_budget: number
  ai_features: {
    proposal_generation: boolean
    budget_optimization: boolean
    vendor_recommendations: boolean
    risk_prediction: boolean
    smart_scheduling: boolean
    communication_drafting: boolean
    guest_insights: boolean
    event_simulation: boolean
  }
}

interface UsageStats {
  tokens_used_today: number
  tokens_used_month: number
  requests_today: number
  requests_month: number
  avg_latency_ms: number
  error_rate_pct: number
}

const PROVIDERS: { id: AIProvider; name: string; desc: string; color: string }[] = [
  { id: 'none',      name: 'Disabled',        desc: 'AI features turned off platform-wide', color: 'text-zinc-400' },
  { id: 'anthropic', name: 'Anthropic Claude', desc: 'claude-opus-4-6 / sonnet / haiku',       color: 'text-orange-400' },
  { id: 'openai',    name: 'OpenAI GPT',        desc: 'gpt-4o / gpt-4o-mini / gpt-4-turbo',    color: 'text-emerald-400' },
  { id: 'ollama',    name: 'Ollama (local)',    desc: 'Self-hosted, privacy-first',             color: 'text-blue-400' },
  { id: 'litellm',   name: 'LiteLLM proxy',    desc: 'Unified API gateway for all providers',  color: 'text-violet-400' },
]

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  none:      [],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ollama:    ['llama3.3', 'mistral', 'mixtral', 'gemma2', 'phi4', 'qwen2.5'],
  litellm:   ['gpt-4o', 'claude-opus-4-6', 'mistral-large', 'custom'],
}

const AI_FEATURES: { key: keyof AIConfig['ai_features']; label: string; desc: string }[] = [
  { key: 'proposal_generation',    label: 'Proposal Generation',    desc: 'Auto-draft event proposals from templates' },
  { key: 'budget_optimization',    label: 'Budget Optimization',    desc: 'Smart budget allocation & cost reduction' },
  { key: 'vendor_recommendations', label: 'Vendor Recommendations', desc: 'Match vendors based on event profile' },
  { key: 'risk_prediction',        label: 'Risk Prediction',        desc: 'Flag potential event execution risks' },
  { key: 'smart_scheduling',       label: 'Smart Scheduling',       desc: 'Auto-optimize runsheet & team schedules' },
  { key: 'communication_drafting', label: 'Communication Drafting', desc: 'Draft emails, messages, and updates' },
  { key: 'guest_insights',         label: 'Guest Insights',         desc: 'RSVP trend analysis & seating suggestions' },
  { key: 'event_simulation',       label: 'Event Simulation',       desc: 'Run pre-event scenarios & what-ifs' },
]

const DEFAULT_CONFIG: AIConfig = {
  ai_enabled: false,
  default_provider: 'none',
  default_model: '',
  max_tokens_per_request: 4096,
  monthly_token_budget: 1000000,
  ai_features: {
    proposal_generation: true, budget_optimization: true,
    vendor_recommendations: true, risk_prediction: true,
    smart_scheduling: true, communication_drafting: true,
    guest_insights: true, event_simulation: false,
  },
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showKeys, setShowKeys] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, stats] = await Promise.allSettled([
        apiFetch('/super-admin/ai-config'),
        apiFetch('/super-admin/ai-usage'),
      ])
      if (cfg.status === 'fulfilled') setConfig({ ...DEFAULT_CONFIG, ...cfg.value })
      if (stats.status === 'fulfilled') setUsage(stats.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await apiFetch('/super-admin/ai-config', {
        method: 'POST',
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch('/super-admin/ai-config/test', { method: 'POST' })
      setTestResult({ ok: true, message: res.message ?? 'Connection successful' })
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  const setF = (key: keyof AIConfig['ai_features'], val: boolean) =>
    setConfig(c => ({ ...c, ai_features: { ...c.ai_features, [key]: val } }))

  const models = PROVIDER_MODELS[config.default_provider] ?? []

  const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n)

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">AI / Intelligence</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Master AI toggle, provider configuration, feature flags</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 border border-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Master Toggle */}
      <div className={`rounded-xl border p-5 mb-5 flex items-center justify-between transition-colors ${
        config.ai_enabled ? 'bg-violet-600/10 border-violet-500/30' : 'bg-[#111118] border-white/[0.06]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.ai_enabled ? 'bg-violet-600/20' : 'bg-white/5'}`}>
            <Brain className={`w-5 h-5 ${config.ai_enabled ? 'text-violet-400' : 'text-zinc-500'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Platform Master Switch</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {config.ai_enabled
                ? 'AI features are ENABLED across all tenants'
                : 'AI features are DISABLED platform-wide'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfig(c => ({ ...c, ai_enabled: !c.ai_enabled }))}
          className="transition-all"
        >
          {config.ai_enabled
            ? <ToggleRight className="w-10 h-6 text-violet-400" />
            : <ToggleLeft className="w-10 h-6 text-zinc-600" />}
        </button>
      </div>

      {config.ai_enabled && (
        <>
          {/* Provider Selection */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-zinc-300 mb-3">AI Provider</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {PROVIDERS.filter(p => p.id !== 'none').map(p => (
                <label
                  key={p.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.default_provider === p.id
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <input
                    type="radio" name="provider" value={p.id}
                    checked={config.default_provider === p.id}
                    onChange={() => setConfig(c => ({ ...c, default_provider: p.id, default_model: PROVIDER_MODELS[p.id][0] ?? '' }))}
                    className="sr-only"
                  />
                  <div className="mt-0.5 w-2 h-2 rounded-full border flex-shrink-0 mt-1.5" style={{
                    borderColor: config.default_provider === p.id ? '#7c3aed' : '#3f3f46',
                    backgroundColor: config.default_provider === p.id ? '#7c3aed' : 'transparent',
                  }} />
                  <div>
                    <p className={`text-xs font-semibold ${p.color}`}>{p.name}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* API Key / URL inputs */}
            <div className="space-y-3">
              {config.default_provider === 'anthropic' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-zinc-500">Anthropic API Key</label>
                    <button onClick={() => setShowKeys(s => !s)} className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
                      {showKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showKeys ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={config.anthropic_api_key ?? ''}
                    onChange={e => setConfig(c => ({ ...c, anthropic_api_key: e.target.value }))}
                    placeholder="sk-ant-…"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              )}
              {config.default_provider === 'openai' && (
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">OpenAI API Key</label>
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={config.openai_api_key ?? ''}
                    onChange={e => setConfig(c => ({ ...c, openai_api_key: e.target.value }))}
                    placeholder="sk-…"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              )}
              {config.default_provider === 'ollama' && (
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Ollama Base URL</label>
                  <input
                    value={config.ollama_base_url ?? ''}
                    onChange={e => setConfig(c => ({ ...c, ollama_base_url: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              )}
              {config.default_provider === 'litellm' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">LiteLLM Base URL</label>
                    <input
                      value={config.litellm_base_url ?? ''}
                      onChange={e => setConfig(c => ({ ...c, litellm_base_url: e.target.value }))}
                      placeholder="http://litellm-proxy:4000"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">LiteLLM API Key</label>
                    <input
                      type={showKeys ? 'text' : 'password'}
                      value={config.litellm_api_key ?? ''}
                      onChange={e => setConfig(c => ({ ...c, litellm_api_key: e.target.value }))}
                      placeholder="sk-…"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Model selection */}
              {models.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Default Model</label>
                    <select
                      value={config.default_model}
                      onChange={e => setConfig(c => ({ ...c, default_model: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                    >
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Max Tokens / Request</label>
                    <input
                      type="number"
                      value={config.max_tokens_per_request}
                      onChange={e => setConfig(c => ({ ...c, max_tokens_per_request: Number(e.target.value) }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Monthly Token Budget</label>
                <input
                  type="number"
                  value={config.monthly_token_budget}
                  onChange={e => setConfig(c => ({ ...c, monthly_token_budget: Number(e.target.value) }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Set 0 for unlimited. Prevents runaway API costs.</p>
              </div>

              {/* Test connection */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={testConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                  Test Connection
                </button>
                {testResult && (
                  <span className={`flex items-center gap-1 text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-zinc-300 mb-3">AI Feature Flags</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_FEATURES.map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setF(key, !config.ai_features[key])}
                      className="transition-all"
                    >
                      {config.ai_features[key]
                        ? <ToggleRight className="w-8 h-5 text-violet-400" />
                        : <ToggleLeft className="w-8 h-5 text-zinc-600" />}
                    </button>
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${config.ai_features[key] ? 'text-zinc-200' : 'text-zinc-500'}`}>{label}</p>
                    <p className="text-[10px] text-zinc-600">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Usage Stats */}
          {usage && (
            <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-zinc-500" />
                <p className="text-xs font-semibold text-zinc-300">Usage Statistics</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Tokens Today</p>
                  <p className="text-lg font-bold text-white">{fmt(usage.tokens_used_today)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Tokens This Month</p>
                  <p className="text-lg font-bold text-white">{fmt(usage.tokens_used_month)}</p>
                  {config.monthly_token_budget > 0 && (
                    <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden w-24">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${Math.min(100, (usage.tokens_used_month / config.monthly_token_budget) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Requests Today</p>
                  <p className="text-lg font-bold text-white">{fmt(usage.requests_today)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Avg Latency</p>
                  <p className="text-lg font-bold text-white">{usage.avg_latency_ms}ms</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Error Rate</p>
                  <p className={`text-lg font-bold ${usage.error_rate_pct > 5 ? 'text-red-400' : 'text-white'}`}>
                    {usage.error_rate_pct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Requests / Month</p>
                  <p className="text-lg font-bold text-white">{fmt(usage.requests_month)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
