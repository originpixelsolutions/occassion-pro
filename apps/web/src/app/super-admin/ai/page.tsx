'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw, Save, Loader2, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (raw) return JSON.parse(raw)?.access_token ?? ''
  } catch {}
  return ''

interface AIConfig {
  ai_enabled: boolean
  default_provider: 'openai' | 'anthropic' | 'google' | 'mistral'
  openai_api_key?: string
  anthropic_api_key?: string
  google_ai_api_key?: string
  mistral_api_key?: string
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

const DEFAULT_CONFIG: AIConfig = {
  ai_enabled: true,
  default_provider: 'anthropic',
  default_model: 'claude-3-5-haiku-20241022',
  max_tokens_per_request: 4096,
  monthly_token_budget: 1000000,
  ai_features: {
    proposal_generation: true,
    budget_optimization: true,
    vendor_recommendations: true,
    risk_prediction: true,
    smart_scheduling: true,
    communication_drafting: true,
    guest_insights: true,
    event_simulation: false,
  },
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic Claude', models: ['claude-opus-4-6','claude-sonnet-4-6','claude-haiku-4-5-20251001'] },
  { id: 'openai',    name: 'OpenAI GPT',        models: ['gpt-4o','gpt-4o-mini','gpt-4-turbo'] },
  { id: 'google',    name: 'Google Gemini',     models: ['gemini-2.0-flash','gemini-1.5-pro','gemini-1.5-flash'] },
  { id: 'mistral',   name: 'Mistral AI',        models: ['mistral-large-latest','mistral-medium-latest','mistral-small-latest'] },
]

const AI_FEATURES = [
  { key: 'proposal_generation',   label: 'AI Proposal Generation',     desc: 'Auto-generate event proposals from client requirements' },
  { key: 'budget_optimization',   label: 'Budget Optimisation',         desc: 'AI suggests cost savings and budget reallocation' },
  { key: 'vendor_recommendations',label: 'Vendor Recommendations',      desc: 'Smart vendor matching based on event type and budget' },
  { key: 'risk_prediction',       label: 'Risk Prediction',             desc: 'Predict and flag potential event risks' },
  { key: 'smart_scheduling',      label: 'Smart Scheduling',            desc: 'AI-optimised runsheet and staff scheduling' },
  { key: 'communication_drafting',label: 'Communication Drafting',      desc: 'Draft emails, WhatsApp messages, and announcements' },
  { key: 'guest_insights',        label: 'Guest Insights',              desc: 'AI-powered guest analytics and seating suggestions' },
  { key: 'event_simulation',      label: 'Event Simulation',            desc: 'Simulate event scenarios before the day (experimental)' },
]

export default function AIConfigPage() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/super-admin/ai-config`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setConfig({ ...DEFAULT_CONFIG, ...await res.json() })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/super-admin/ai-config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const setKey = (k: keyof AIConfig, v: unknown) => setConfig(c => ({ ...c, [k]: v }))
  const setFeature = (k: string, v: boolean) => setConfig(c => ({ ...c, ai_features: { ...c.ai_features, [k]: v } }))

  const selectedProvider = PROVIDERS.find(p => p.id === config.default_provider)

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-foreground">AI & Integrations</h1>
          </div>
          <p className="text-sm text-muted-foreground">Configure AI providers and feature flags for the platform</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-card transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Master toggle */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">AI Platform Toggle</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Disabling this turns off all AI features across all tenants
            </p>
          </div>
          <button onClick={() => setKey('ai_enabled', !config.ai_enabled)} className="text-violet-400">
            {config.ai_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-zinc-600" />}
          </button>
        </div>
      </div>

      {config.ai_enabled && (
        <>
          {/* Provider selection */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
            <p className="text-sm font-semibold text-foreground mb-4">Default AI Provider</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setKey('default_provider', p.id as AIConfig['default_provider'])}
                  className={`p-3 rounded-xl border text-left transition-all ${config.default_provider === p.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-border/30 hover:bg-card'}`}
                >
                  <p className={`text-xs font-semibold ${config.default_provider === p.id ? 'text-violet-300' : 'text-foreground'}`}>{p.name}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 block">Default Model</label>
              <select
                value={config.default_model}
                onChange={e => setKey('default_model', e.target.value)}
                className="w-full text-xs bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {(selectedProvider?.models ?? []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
            <p className="text-sm font-semibold text-foreground mb-4">API Keys</p>
            <div className="space-y-3">
              {[
                { provider: 'anthropic', label: 'Anthropic API Key', field: 'anthropic_api_key' as keyof AIConfig, placeholder: 'sk-ant-...' },
                { provider: 'openai',    label: 'OpenAI API Key',    field: 'openai_api_key' as keyof AIConfig,    placeholder: 'sk-proj-...' },
                { provider: 'google',    label: 'Google AI API Key', field: 'google_ai_api_key' as keyof AIConfig, placeholder: 'AIza...' },
                { provider: 'mistral',   label: 'Mistral API Key',   field: 'mistral_api_key' as keyof AIConfig,   placeholder: '...' },
              ].map(item => (
                <div key={item.provider}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">{item.label}</label>
                  <div className="relative">
                    <input
                      type={showKeys[item.provider] ? 'text' : 'password'}
                      value={(config[item.field] as string) ?? ''}
                      onChange={e => setKey(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                    />
                    <button
                      onClick={() => setShowKeys(prev => ({ ...prev, [item.provider]: !prev[item.provider] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKeys[item.provider] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Limits */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
            <p className="text-sm font-semibold text-foreground mb-4">Usage Limits</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Max Tokens / Request</label>
                <input
                  type="number"
                  value={config.max_tokens_per_request}
                  onChange={e => setKey('max_tokens_per_request', Number(e.target.value))}
                  className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Monthly Token Budget</label>
                <input
                  type="number"
                  value={config.monthly_token_budget}
                  onChange={e => setKey('monthly_token_budget', Number(e.target.value))}
                  className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>

          {/* AI Feature flags */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-5 mb-5">
            <p className="text-sm font-semibold text-foreground mb-4">AI Feature Flags</p>
            <div className="space-y-3">
              {AI_FEATURES.map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                  </div>
                  <button
                    onClick={() => setFeature(f.key, !(config.ai_features as Record<string, boolean>)[f.key])}
                    className="ml-4 flex-shrink-0"
                  >
                    {(config.ai_features as Record<string, boolean>)[f.key]
                      ? <ToggleRight className="w-7 h-7 text-violet-400" />
                      : <ToggleLeft className="w-7 h-7 text-zinc-600" />
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        onClick={save}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Saved' : <><Save className="w-4 h-4" /> Save AI Configuration</>}
      </button>
    </div>
  )
}
