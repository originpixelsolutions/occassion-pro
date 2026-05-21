'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  TrendingUp, Users, Target, Zap, Plus, Search,
  MoreHorizontal, ArrowUpRight, Star, Phone, Mail,
  MessageSquare, Calendar, BarChart2, Megaphone,
  Filter, Instagram, Send, Globe, ChevronRight,
  Flame, CheckCircle2, XCircle, Clock, DollarSign,
  Eye, MousePointerClick, RefreshCw, FileText, X,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'leads' | 'campaigns' | 'social' | 'forms'

interface Lead {
  id: string
  full_name: string
  email?: string
  phone: string
  event_type: string
  event_date?: string
  estimated_budget: number
  lead_score: number
  stage: string
  source_type: string
  is_hot: boolean
  created_at: string
}

interface Campaign {
  id: string
  name: string
  type: string
  status: string
  sent_count: number
  opened_count: number
  clicked_count: number
  converted_count: number
  budget: number
  spent: number
  objective: string
}

// ── Social Post type ───────────────────────────────────────────────────────

interface SocialPost {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduled_at?: string
  likes?: number
  impressions?: number
  hashtags?: string[]
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:            { label: 'New', color: 'hsl(var(--muted-foreground))', bg: 'rgba(148,163,184,0.1)' },
  contacted:      { label: 'Contacted', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  qualified:      { label: 'Qualified', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  proposal_sent:  { label: 'Proposal', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  negotiating:    { label: 'Negotiating', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  won:            { label: 'Won', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  lost:           { label: 'Lost', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  nurturing:      { label: 'Nurturing', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
}

const SOURCE_ICON: Record<string, string> = {
  referral: '🤝', organic: '🌱', paid_search: '🔍', paid_social: '📣',
  direct: '📞', email: '✉️', whatsapp: '💬', sms: '📱',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#dc2626'
  const bg = score >= 80 ? 'rgba(16,185,129,0.12)' : score >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.12)'
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: bg }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_CONFIG[stage] || STAGE_CONFIG.new
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function CampaignTypeBadge({ type }: { type: string }) {
  const map: Record<string, { icon: string; color: string }> = {
    email:     { icon: '✉️', color: '#60a5fa' },
    whatsapp:  { icon: '💬', color: '#10b981' },
    sms:       { icon: '📱', color: '#f59e0b' },
    social:    { icon: '📣', color: '#ec4899' },
    paid_ad:   { icon: '🎯', color: '#f59e0b' },
    mixed:     { icon: '⚡', color: '#a78bfa' },
  }
  const m = map[type] || { icon: '📋', color: 'hsl(var(--muted-foreground))' }
  return <span style={{ color: m.color }}>{m.icon} {type}</span>
}

// ── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ leads, campaigns }: { leads: Lead[]; campaigns: Campaign[] }) {
  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.is_hot).length
  const converted = leads.filter(l => l.stage === 'won').length
  const pipeline = leads
    .filter(l => !['won', 'lost'].includes(l.stage))
    .reduce((s, l) => s + l.estimated_budget, 0)
  const avgScore = totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + l.lead_score, 0) / totalLeads) : 0

  const funnelStages = [
    { key: 'new', count: leads.filter(l => l.stage === 'new').length },
    { key: 'contacted', count: leads.filter(l => l.stage === 'contacted').length },
    { key: 'qualified', count: leads.filter(l => l.stage === 'qualified').length },
    { key: 'proposal_sent', count: leads.filter(l => l.stage === 'proposal_sent').length },
    { key: 'negotiating', count: leads.filter(l => l.stage === 'negotiating').length },
    { key: 'won', count: converted },
  ]
  const funnelMax = Math.max(...funnelStages.map(s => s.count), 1)

  const sourceData = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.source_type] = (acc[l.source_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, sub: '+5 this week', color: '#6366f1', icon: Users },
          { label: 'Hot Leads', value: hotLeads, sub: 'needs attention', color: '#dc2626', icon: Flame },
          { label: 'Avg. Score', value: avgScore, sub: 'lead quality', color: '#f59e0b', icon: Star },
          { label: 'Converted', value: converted, sub: `${Math.round((converted / totalLeads) * 100)}% rate`, color: '#10b981', icon: CheckCircle2 },
          { label: 'Pipeline', value: `₹${(pipeline / 100000).toFixed(1)}L`, sub: 'open deals', color: '#ec4899', icon: DollarSign },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-5 border"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg" style={{ background: kpi.color + '18' }}>
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
              {kpi.label === 'Hot Leads' && hotLeads > 0 && (
                <div className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>
                  urgent
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{kpi.value}</div>
            <div className="text-xs text-white/40">{kpi.label}</div>
            <div className="text-xs text-white/30 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="lg:col-span-2 rounded-xl p-5 border"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
          <h3 className="text-sm font-semibold text-white/80 mb-4">Lead Conversion Funnel</h3>
          <div className="space-y-2.5">
            {funnelStages.map(({ key, count }) => {
              const s = STAGE_CONFIG[key]
              const pct = (count / funnelMax) * 100
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-20 text-right">{s.label}</span>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                    <div className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                      style={{ width: `${Math.max(pct, 5)}%`, background: s.bg, borderLeft: `2px solid ${s.color}` }}>
                      <span className="text-xs font-medium" style={{ color: s.color }}>{count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-white/30 w-8">
                    {totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="rounded-xl p-5 border"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
          <h3 className="text-sm font-semibold text-white/80 mb-4">Lead Sources</h3>
          <div className="space-y-3">
            {Object.entries(sourceData).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
              <div key={source} className="flex items-center gap-3">
                <span className="text-base w-6">{SOURCE_ICON[source] || '📋'}</span>
                <span className="text-xs text-white/60 flex-1 capitalize">{source.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full" style={{ width: `${(count / totalLeads) * 80}px`, background: 'hsl(var(--primary))' }} />
                  <span className="text-xs text-white/80 font-medium w-4">{count}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent hot leads */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
            <h4 className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
              <Flame size={11} className="text-red-400" /> Hot Leads
            </h4>
            {leads.filter(l => l.is_hot).map(lead => (
              <div key={lead.id} className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-red-500/30 to-orange-500/30">
                  {lead.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/80 truncate">{lead.full_name}</div>
                  <div className="text-xs text-white/30">{lead.event_type}</div>
                </div>
                <ScoreBadge score={lead.lead_score} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active campaigns summary */}
      <div className="rounded-xl p-5 border"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/80">Active Campaigns</h3>
          <button className="text-xs text-violet-400 flex items-center gap-1">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {campaigns.filter(c => c.status === 'active').map(campaign => (
            <div key={campaign.id} className="rounded-xl p-4 border"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-white/90">{campaign.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    <CampaignTypeBadge type={campaign.type} />
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                  Active
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Sent', value: campaign.sent_count.toLocaleString() },
                  { label: 'Opened', value: campaign.opened_count > 0 ? `${Math.round((campaign.opened_count / campaign.sent_count) * 100)}%` : '—' },
                  { label: 'Clicked', value: campaign.clicked_count > 0 ? `${Math.round((campaign.clicked_count / campaign.sent_count) * 100)}%` : '—' },
                  { label: 'Conv.', value: campaign.converted_count },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-sm font-bold text-white">{s.value}</div>
                    <div className="text-xs text-white/40">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1.5 rounded-full" style={{ background: 'hsl(var(--muted))' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(campaign.spent / campaign.budget) * 100}%`, background: 'hsl(var(--primary))' }} />
              </div>
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>₹{(campaign.spent / 1000).toFixed(0)}K spent</span>
                <span>₹{(campaign.budget / 1000).toFixed(0)}K budget</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Leads Tab ──────────────────────────────────────────────────────────────

function LeadsTab({ leads, onStageChange }: { leads: Lead[]; onStageChange: (id: string, stage: string) => void }) {
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [view, setView] = useState<'list' | 'kanban'>('list')

  const filtered = leads.filter(l => {
    if (filterStage !== 'all' && l.stage !== filterStage) return false
    if (search && !l.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (view === 'kanban') {
    const stages = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'won']
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')} className="text-xs text-violet-400">← List View</button>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white/80 outline-none"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => {
            const s = STAGE_CONFIG[stage]
            const stageLeads = filtered.filter(l => l.stage === stage)
            return (
              <div key={stage} className="min-w-[220px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
                  <span className="text-xs text-white/30 ml-auto">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map(lead => (
                    <div key={lead.id} className="rounded-xl p-3 border cursor-pointer"
                      style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium text-white/90">{lead.full_name}</span>
                        {lead.is_hot && <Flame size={12} className="text-red-400 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-white/40 mb-2">{lead.event_type}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          ₹{(lead.estimated_budget / 100000).toFixed(1)}L
                        </span>
                        <ScoreBadge score={lead.lead_score} />
                      </div>
                    </div>
                  ))}
                  <button className="w-full py-2 rounded-xl border-dashed border text-xs text-white/20 flex items-center justify-center gap-1"
                    style={{ borderColor: 'hsl(var(--border))' }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white/80 outline-none"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }} />
          </div>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="py-2 px-3 rounded-lg text-sm text-white/70 outline-none"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
            <option value="all">All Stages</option>
            {Object.entries(STAGE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={() => setView('kanban')}
            className="px-3 py-2 rounded-lg text-xs text-white/50 flex items-center gap-1.5"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
            <BarChart2 size={12} /> Kanban
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
            <Plus size={14} /> Add Lead
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                {['Lead', 'Event', 'Budget', 'Score', 'Stage', 'Source', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-white/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => (
                <tr key={lead.id}
                  onClick={() => setSelectedLead(lead === selectedLead ? null : lead)}
                  className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: lead.is_hot ? 'rgba(220,38,38,0.25)' : 'rgba(99,102,241,0.2)' }}>
                        {lead.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white/90 font-medium">{lead.full_name}</span>
                          {lead.is_hot && <Flame size={12} className="text-red-400" />}
                        </div>
                        <div className="text-xs text-white/40">{lead.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-white/70">{lead.event_type}</div>
                    {lead.event_date && (
                      <div className="text-xs text-white/30">{new Date(lead.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white/80">
                    ₹{(lead.estimated_budget / 100000).toFixed(1)}L
                  </td>
                  <td className="px-4 py-3"><ScoreBadge score={lead.lead_score} /></td>
                  <td className="px-4 py-3"><StageBadge stage={lead.stage} /></td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{SOURCE_ICON[lead.source_type]}</span>
                    <span className="text-xs text-white/40 ml-1.5 capitalize">{lead.source_type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">
                    {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 rounded hover:bg-white/5">
                      <MoreHorizontal size={14} className="text-white/30" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <div className="w-72 flex-shrink-0 rounded-xl border p-5"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                style={{ background: selectedLead.is_hot ? 'rgba(220,38,38,0.25)' : 'rgba(99,102,241,0.2)' }}>
                {selectedLead.full_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">{selectedLead.full_name}</span>
                  {selectedLead.is_hot && <Flame size={12} className="text-red-400" />}
                </div>
                <StageBadge stage={selectedLead.stage} />
              </div>
            </div>
            <button onClick={() => setSelectedLead(null)} className="p-1 hover:bg-white/5 rounded">
              <X size={14} className="text-white/30" />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Phone size={11} className="text-white/30" /> {selectedLead.phone}
            </div>
            {selectedLead.email && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Mail size={11} className="text-white/30" /> {selectedLead.email}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Calendar size={11} className="text-white/30" />
              {selectedLead.event_type} — {selectedLead.event_date || 'TBD'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-lg p-2.5 text-center" style={{ background: 'hsl(var(--muted))' }}>
              <div className="text-sm font-bold text-white">₹{(selectedLead.estimated_budget / 100000).toFixed(1)}L</div>
              <div className="text-xs text-white/40">Budget</div>
            </div>
            <div className="rounded-lg p-2.5 text-center" style={{ background: 'hsl(var(--muted))' }}>
              <ScoreBadge score={selectedLead.lead_score} />
              <div className="text-xs text-white/40 mt-1">Lead Score</div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-white/40">Quick Actions</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { icon: Phone, label: 'Call' },
                { icon: MessageSquare, label: 'WhatsApp' },
                { icon: Mail, label: 'Email' },
              ].map(action => (
                <button key={action.label}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg text-xs text-white/50 transition-colors hover:bg-white/[0.05]"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <action.icon size={14} className="text-violet-400" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {['contacted', 'qualified', 'proposal_sent', 'won'].map(s => (
              <button key={s}
                onClick={() => { onStageChange(selectedLead.id, s); setSelectedLead({ ...selectedLead, stage: s }) }}
                className="w-full py-2 rounded-lg text-xs font-medium text-left px-3 flex items-center justify-between"
                style={{
                  background: selectedLead.stage === s ? STAGE_CONFIG[s].bg : 'rgba(255,255,255,0.03)',
                  color: selectedLead.stage === s ? STAGE_CONFIG[s].color : 'hsl(var(--muted-foreground))',
                  border: `1px solid ${selectedLead.stage === s ? STAGE_CONFIG[s].color + '40' : 'hsl(var(--border) / 0.4)'}`,
                }}>
                {STAGE_CONFIG[s].label}
                {selectedLead.stage === s && <CheckCircle2 size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Campaigns Tab ──────────────────────────────────────────────────────────

function CampaignsTab({ campaigns, onStatusChange }: { campaigns: Campaign[]; onStatusChange: (id: string, status: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/40">
          {campaigns.filter(c => c.status === 'active').length} active campaigns
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      <div className="grid gap-4">
        {campaigns.map(campaign => {
          const openRate = campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0
          const clickRate = campaign.sent_count > 0 ? Math.round((campaign.clicked_count / campaign.sent_count) * 100) : 0
          const roiPct = campaign.spent > 0 ? Math.round(((campaign.converted_count * 50000 - campaign.spent) / campaign.spent) * 100) : 0

          return (
            <div key={campaign.id} className="rounded-xl p-5 border"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <Megaphone size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white/90">{campaign.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-white/40"><CampaignTypeBadge type={campaign.type} /></span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: campaign.status === 'active' ? 'rgba(16,185,129,0.12)' : campaign.status === 'completed' ? 'rgba(100,116,139,0.12)' : 'rgba(245,158,11,0.12)',
                            color: campaign.status === 'active' ? '#10b981' : campaign.status === 'completed' ? '#94a3b8' : '#f59e0b',
                          }}>
                          {campaign.status}
                        </span>
                      </div>
                    </div>
                    <button className="p-1.5 hover:bg-white/5 rounded">
                      <MoreHorizontal size={14} className="text-white/30" />
                    </button>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-5 gap-4 mt-4">
                    {[
                      { icon: Send, label: 'Sent', value: campaign.sent_count.toLocaleString() },
                      { icon: Eye, label: 'Open Rate', value: `${openRate}%` },
                      { icon: MousePointerClick, label: 'Click Rate', value: `${clickRate}%` },
                      { icon: CheckCircle2, label: 'Converted', value: campaign.converted_count },
                      { icon: TrendingUp, label: 'ROI', value: campaign.spent > 0 ? `${roiPct}%` : '—' },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="text-sm font-bold text-white">{m.value}</div>
                        <div className="text-xs text-white/40">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Budget bar */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'hsl(var(--muted))' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min((campaign.spent / campaign.budget) * 100, 100)}%`, background: 'hsl(var(--primary))' }} />
                    </div>
                    <span className="text-xs text-white/40 flex-shrink-0">
                      ₹{(campaign.spent / 1000).toFixed(0)}K / ₹{(campaign.budget / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Social Tab ─────────────────────────────────────────────────────────────

function SocialTab({ posts }: { posts: SocialPost[] }) {
  const platformIcon: Record<string, string> = {
    instagram: '📸', facebook: '📘', linkedin: '💼', twitter: '🐦', youtube: '▶️',
  }
  const statusStyle = (status: string) => ({
    published: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    scheduled: { bg: 'rgba(99,102,241,0.12)', color: 'hsl(var(--primary))' },
    draft:     { bg: 'rgba(100,116,139,0.12)', color: 'hsl(var(--muted-foreground))' },
  }[status] || { bg: 'rgba(100,116,139,0.12)', color: 'hsl(var(--muted-foreground))' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['All', 'Instagram', 'LinkedIn', 'Facebook'].map(p => (
            <button key={p} className="px-3 py-1.5 rounded-lg text-xs text-white/50 transition-colors"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.4)' }}>
              {p}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
          <Plus size={14} /> Schedule Post
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {posts.map(post => {
          const s = statusStyle(post.status)
          return (
            <div key={post.id} className="rounded-xl p-5 border"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-1.5">
                  {post.platforms.map(p => (
                    <span key={p} className="text-base">{platformIcon[p]}</span>
                  ))}
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs" style={s}>{post.status}</span>
              </div>
              <p className="text-sm text-white/80 mb-3 leading-relaxed">{post.content}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.hashtags.map(h => (
                  <span key={h} className="text-xs text-violet-400">{h}</span>
                ))}
              </div>
              {post.status === 'published' && (
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>❤️ {post.likes.toLocaleString()}</span>
                  <span>👁️ {post.impressions.toLocaleString()}</span>
                </div>
              )}
              {post.scheduled_at && (
                <div className="text-xs text-white/30 mt-2">
                  {post.status === 'published' ? 'Published' : 'Scheduled'}: {new Date(post.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Forms Tab ──────────────────────────────────────────────────────────────

function FormsTab() {
  const forms = [
    { id: 'f1', name: 'Wedding Enquiry Form', slug: 'wedding-enquiry', submission_count: 143, conversion_rate: 32, is_active: true, primary_color: '#6366f1' },
    { id: 'f2', name: 'Corporate Events Quote', slug: 'corporate-quote', submission_count: 67, conversion_rate: 28, is_active: true, primary_color: '#0ea5e9' },
    { id: 'f3', name: 'Birthday Package Request', slug: 'birthday-request', submission_count: 89, conversion_rate: 41, is_active: true, primary_color: '#ec4899' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/40">{forms.length} capture forms</div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
          <Plus size={14} /> New Form
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {forms.map(form => (
          <div key={form.id} className="rounded-xl p-5 border"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.4)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: form.primary_color + '22' }}>
              <FileText size={20} style={{ color: form.primary_color }} />
            </div>
            <div className="text-sm font-semibold text-white/90 mb-1">{form.name}</div>
            <div className="text-xs text-white/40 mb-4">/{form.slug}</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-lg p-2 text-center" style={{ background: 'hsl(var(--muted))' }}>
                <div className="text-lg font-bold text-white">{form.submission_count}</div>
                <div className="text-xs text-white/40">Submissions</div>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: 'hsl(var(--muted))' }}>
                <div className="text-lg font-bold" style={{ color: form.primary_color }}>{form.conversion_rate}%</div>
                <div className="text-xs text-white/40">Conv. Rate</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 rounded-lg text-xs text-white/60 flex items-center justify-center gap-1"
                style={{ background: 'hsl(var(--muted))' }}>
                <Globe size={11} /> Preview
              </button>
              <button className="flex-1 py-1.5 rounded-lg text-xs"
                style={{ background: form.primary_color + '22', color: form.primary_color }}>
                Edit Form
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // Data state
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  // Load all data in parallel on mount
  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [ld, cp, sp] = await Promise.all([
        fetch(`${API}/marketing/leads?limit=200`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/marketing/campaigns`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/marketing/social-posts`, { headers: h }).then(r => r.ok ? r.json() : []),
      ])
      setLeads(Array.isArray(ld) ? ld : (ld.data ?? []))
      setCampaigns(Array.isArray(cp) ? cp : (cp.data ?? []))
      setPosts(Array.isArray(sp) ? sp : (sp.data ?? []))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleLeadStageChange = useCallback(async (id: string, stage: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/marketing/leads/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage }),
      })
      if (res.ok) setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l))
    } catch { /* silent */ }
  }, [token])

  const handleCampaignStatusChange = useCallback(async (id: string, status: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/marketing/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    } catch { /* silent */ }
  }, [token])

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Overview', icon: TrendingUp },
    { id: 'leads',     label: 'Leads', icon: Target },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'social',    label: 'Social', icon: Instagram },
    { id: 'forms',     label: 'Lead Forms', icon: FileText },
  ]

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: 'hsl(var(--background))' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Marketing & Lead Generation</h1>
          <p className="text-sm text-white/40 mt-1">
            Lead funnel, campaign management, social scheduling & conversion analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border) / 0.5)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'hsl(var(--primary) / 0.2)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="text-xs text-white/30 flex items-center gap-2">
          <RefreshCw size={11} className="animate-spin" /> Loading marketing data…
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.4)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { background: 'hsl(var(--primary) / 0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
              : { color: 'hsl(var(--muted-foreground))', border: '1px solid transparent' }}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && <DashboardTab leads={leads} campaigns={campaigns} />}
        {activeTab === 'leads'     && <LeadsTab leads={leads} onStageChange={handleLeadStageChange} />}
        {activeTab === 'campaigns' && <CampaignsTab campaigns={campaigns} onStatusChange={handleCampaignStatusChange} />}
        {activeTab === 'social'    && <SocialTab posts={posts} />}
        {activeTab === 'forms'     && <FormsTab />}
      </div>
    </div>
  )
}
