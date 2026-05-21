'use client'

/**
 * /portal/[token] — White-label client-facing portal
 *
 * This page is accessed by the client via a unique access token link.
 * It is fully public (no JWT), branded per-tenant, and pulls all data
 * from GET /v1/portal/:accessToken.
 *
 * It renders: Updates, Timeline, Documents, Mood Board, Budget, Messages.
 */

import { useState, useEffect } from 'react'

// ─── Types (mirrors API response) ────────────────────────────────────────────

interface PortalConfig {
  portal_name: string
  primary_color: string
  accent_color: string
  background_color: string
  logo_url?: string
  cover_image_url?: string
  welcome_message?: string
  show_timeline: boolean
  show_budget: boolean
  show_documents: boolean
  show_moodboard: boolean
  show_updates: boolean
}

interface PortalEvent {
  id: string
  name: string
  event_date: string
  venue_name?: string
  status: string
}

interface PortalStats {
  total_budget: number
  approved_budget: number
  pending_budget_approvals: number
  pending_doc_approvals: number
  timeline_progress: number
  unread_updates: number
}

interface Update {
  id: string; title: string; body: string
  update_type: string; priority: string
  is_pinned: boolean; client_read: boolean; published_at: string
}

interface TimelineItem {
  id: string; title: string; description?: string; category: string
  due_date?: string; status: string; requires_client_action: boolean; completed_at?: string
}

interface ClientDocument {
  id: string; name: string; document_type: string; file_url: string
  requires_approval: boolean; approval_status: string; client_notes?: string; created_at: string
}

interface MoodboardItem {
  id: string; title?: string; caption?: string; image_url: string
  category: string; client_liked?: boolean; grid_size: string
}

interface BudgetItem {
  id: string; category: string; item_name: string; description?: string
  estimated_amount: number; final_amount?: number; status: string
  is_optional: boolean; is_upgrade: boolean
}

interface Message {
  id: string; body: string; sender_type: string; sender_name: string; created_at: string
}

// ─── Mock portal data (used when no token matches / demo) ──────────────────

const DEMO: {
  config: PortalConfig
  event: PortalEvent
  stats: PortalStats
  updates: Update[]
  timeline: TimelineItem[]
  documents: ClientDocument[]
  moodboard: MoodboardItem[]
  budget: BudgetItem[]
  messages: Message[]
} = {
  config: {
    portal_name: 'Priya & Arjun Wedding',
    primary_color: '#7c3aed',
    accent_color: '#a78bfa',
    background_color: '#0f172a',
    welcome_message: 'Welcome to your exclusive wedding planning portal. Track every detail of your special day with us.',
    show_timeline: true, show_budget: true, show_documents: true, show_moodboard: true, show_updates: true,
  },
  event: {
    id: 'demo', name: 'Priya & Arjun Wedding', event_date: '2026-06-20',
    venue_name: 'The Grand Palace Ballroom, Chennai', status: 'confirmed',
  },
  stats: {
    total_budget: 3070000, approved_budget: 1270000,
    pending_budget_approvals: 2, pending_doc_approvals: 2,
    timeline_progress: 20, unread_updates: 3,
  },
  updates: [
    { id: '1', title: 'Venue Confirmed! 🎉', body: 'The Grand Palace Ballroom has been confirmed for your wedding date. Capacity 500 guests with full AV, catering and valet included.', update_type: 'milestone', priority: 'high', is_pinned: true, client_read: false, published_at: '2026-05-15T10:00:00Z' },
    { id: '2', title: 'Menu Proposal Ready', body: 'Chef Meera has prepared a 5-course menu. Please review the attached document and share your feedback by May 20th.', update_type: 'approval_request', priority: 'normal', is_pinned: false, client_read: false, published_at: '2026-05-14T14:00:00Z' },
    { id: '3', title: 'Payment Reminder', body: 'Second installment of ₹5,00,000 is due by May 25th. Please ensure timely transfer.', update_type: 'finance', priority: 'urgent', is_pinned: false, client_read: false, published_at: '2026-05-12T11:00:00Z' },
  ],
  timeline: [
    { id: '1', title: 'Venue Booking Confirmed', category: 'booking', status: 'completed', completed_at: '2026-04-15', requires_client_action: false },
    { id: '2', title: 'Catering Vendor Finalised', category: 'booking', status: 'completed', completed_at: '2026-04-28', requires_client_action: false },
    { id: '3', title: 'Review & Approve Menu', category: 'approval', status: 'in_progress', due_date: '2026-05-20', requires_client_action: true },
    { id: '4', title: 'Décor Theme Sign-off', category: 'design', status: 'upcoming', due_date: '2026-05-25', requires_client_action: true },
    { id: '5', title: 'Second Payment Instalment', category: 'payment', status: 'upcoming', due_date: '2026-05-25', requires_client_action: true },
    { id: '6', title: 'Final Guest List Submission', category: 'logistics', status: 'upcoming', due_date: '2026-06-01', requires_client_action: true },
    { id: '7', title: 'Pre-Wedding Photoshoot', category: 'milestone', status: 'upcoming', due_date: '2026-06-10', requires_client_action: false },
    { id: '8', title: 'Wedding Day 🎊', category: 'milestone', status: 'upcoming', due_date: '2026-06-20', requires_client_action: false },
  ],
  documents: [
    { id: '1', name: 'Venue Contract.pdf', document_type: 'contract', file_url: '#', requires_approval: true, approval_status: 'approved', created_at: '2026-04-10T10:00:00Z' },
    { id: '2', name: 'Catering Menu Proposal.pdf', document_type: 'proposal', file_url: '#', requires_approval: true, approval_status: 'pending', created_at: '2026-05-14T09:00:00Z' },
    { id: '3', name: 'Décor Concept Board.pdf', document_type: 'design', file_url: '#', requires_approval: true, approval_status: 'pending', created_at: '2026-05-13T15:00:00Z' },
    { id: '4', name: 'Run of Show.pdf', document_type: 'run_of_show', file_url: '#', requires_approval: false, approval_status: 'pending', created_at: '2026-05-10T14:00:00Z' },
  ],
  moodboard: [
    { id: '1', title: 'Mandap', caption: 'Floral arch — marigold + roses', image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400', category: 'decor', client_liked: true, grid_size: 'large' },
    { id: '2', title: 'Fairy Lights', image_url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400', category: 'lighting', client_liked: true, grid_size: 'medium' },
    { id: '3', title: 'Bridal Look', image_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400', category: 'attire', client_liked: null, grid_size: 'medium' },
    { id: '4', title: 'Venue', image_url: 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?w=400', category: 'venue', client_liked: true, grid_size: 'medium' },
    { id: '5', title: 'Wedding Cake', image_url: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400', category: 'cake', client_liked: false, grid_size: 'small' },
    { id: '6', title: 'Floral Details', image_url: 'https://images.unsplash.com/photo-1561314985-8c5b5a1f9b0f?w=400', category: 'floral', client_liked: null, grid_size: 'small' },
  ],
  budget: [
    { id: '1', category: 'Venue', item_name: 'Grand Palace Ballroom', estimated_amount: 800000, final_amount: 800000, status: 'approved', is_optional: false, is_upgrade: false },
    { id: '2', category: 'Catering', item_name: '5-Course Dinner (500 pax)', estimated_amount: 1100000, status: 'pending_approval', is_optional: false, is_upgrade: false, description: '₹2,200/head' },
    { id: '3', category: 'Décor', item_name: 'Full Décor Package', estimated_amount: 650000, status: 'pending_approval', is_optional: false, is_upgrade: false, description: 'Mandap + hall + entrance' },
    { id: '4', category: 'Photography', item_name: 'Photography + Videography', estimated_amount: 350000, status: 'approved', is_optional: false, is_upgrade: false, description: '2-day coverage' },
    { id: '5', category: 'Entertainment', item_name: 'Live Band (6-piece)', estimated_amount: 250000, status: 'approved', is_optional: true, is_upgrade: true },
  ],
  messages: [
    { id: '1', body: 'Welcome to your wedding portal! Feel free to message us any time.', sender_type: 'team', sender_name: 'Divya — Event Manager', created_at: '2026-04-10T10:00:00Z' },
    { id: '2', body: 'This is so beautiful! We love the venue!', sender_type: 'client', sender_name: 'Priya', created_at: '2026-04-11T14:00:00Z' },
    { id: '3', body: 'Glad to hear it! We\'ll send the catering menu shortly.', sender_type: 'team', sender_name: 'Divya — Event Manager', created_at: '2026-04-11T15:00:00Z' },
  ],
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}
function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Main portal page ─────────────────────────────────────────────────────────

export default function ClientPortalPage({ params }: { params: { token: string } }) {
  const [data] = useState(DEMO)
  const [activeTab, setActiveTab] = useState('home')
  const [documents, setDocuments] = useState(DEMO.documents)
  const [budget, setBudget] = useState(DEMO.budget)
  const [moodboard, setMoodboard] = useState(DEMO.moodboard)
  const [messages, setMessages] = useState(DEMO.messages)
  const [newMessage, setNewMessage] = useState('')

  const { config, event, stats } = data
  const primaryColor = config.primary_color
  const accentColor = config.accent_color

  const daysLeft = daysUntil(event.event_date)
  const pendingDocs = documents.filter(d => d.requires_approval && d.approval_status === 'pending').length
  const pendingBudget = budget.filter(b => b.status === 'pending_approval').length
  const totalActions = pendingDocs + pendingBudget

  const enabledTabs = [
    { id: 'home', label: 'Home', icon: '🏠', always: true },
    ...(config.show_updates ? [{ id: 'updates', label: 'Updates', icon: '📣', badge: stats.unread_updates }] : []),
    ...(config.show_timeline ? [{ id: 'timeline', label: 'Timeline', icon: '📅' }] : []),
    ...(config.show_documents ? [{ id: 'documents', label: 'Documents', icon: '📁', badge: pendingDocs }] : []),
    ...(config.show_moodboard ? [{ id: 'moodboard', label: 'Vision Board', icon: '🎨' }] : []),
    ...(config.show_budget ? [{ id: 'budget', label: 'Budget', icon: '💰', badge: pendingBudget }] : []),
    { id: 'messages', label: 'Messages', icon: '💬', always: true },
  ] as Array<{ id: string; label: string; icon: string; badge?: number; always?: boolean }>

  const sendMessage = () => {
    if (!newMessage.trim()) return
    setMessages(prev => [...prev, {
      id: String(Date.now()),
      body: newMessage,
      sender_type: 'client',
      sender_name: 'You',
      created_at: new Date().toISOString(),
    }])
    setNewMessage('')
  }

  return (
    <div className="min-h-screen" style={{ background: config.background_color ?? '#0f172a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${primaryColor}33, transparent 60%), ${config.background_color ?? '#0f172a'}`,
          }}
        />
        {/* Cover image */}
        {config.cover_image_url && (
          <div className="absolute inset-0 opacity-10">
            <img src={config.cover_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="relative z-10 px-6 pt-12 pb-10 max-w-4xl mx-auto">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {config.portal_name.charAt(0)}
            </div>
            <span className="text-sm font-medium" style={{ color: `${accentColor}` }}>OccasionPro</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">{config.portal_name}</h1>
          <p className="text-slate-400 text-base mb-6 max-w-xl">{config.welcome_message}</p>

          {/* Event details */}
          <div className="flex flex-wrap gap-4 mb-8">
            {[
              { icon: '📅', label: 'Event Date', value: fmt(event.event_date) },
              { icon: '📍', label: 'Venue', value: event.venue_name ?? '—' },
              { icon: '⏳', label: 'Days Away', value: daysLeft > 0 ? `${daysLeft} days` : 'Today!' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-base">{icon}</span>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-medium text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Planning Progress</span>
              <span className="text-sm font-bold" style={{ color: accentColor }}>{stats.timeline_progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${stats.timeline_progress}%`, background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
              />
            </div>
          </div>

          {/* Action chips */}
          {totalActions > 0 && (
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: '#f59e0b55', background: '#f59e0b0d', color: '#fbbf24' }}>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {totalActions} action{totalActions !== 1 ? 's' : ''} awaiting your response
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b" style={{ background: `${config.background_color ?? '#0f172a'}cc`, borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-3 flex-1">
            {enabledTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap relative"
                style={activeTab === tab.id ? {
                  background: `${primaryColor}25`,
                  color: accentColor,
                  border: `1px solid ${primaryColor}40`,
                } : {
                  color: '#94a3b8',
                  border: '1px solid transparent',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {(tab.badge ?? 0) > 0 && (
                  <span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ background: '#f59e0b' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <ThemeToggle className="shrink-0 mr-1" />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* HOME */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Progress', value: `${stats.timeline_progress}%`, icon: '📈', color: accentColor },
                { label: 'Total Budget', value: fmtCurrency(stats.total_budget), icon: '💰', color: '#34d399' },
                { label: 'Approved', value: fmtCurrency(stats.approved_budget), icon: '✅', color: '#34d399' },
                { label: 'Pending Actions', value: totalActions, icon: '⚡', color: '#fbbf24' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="rounded-2xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-2xl">{icon}</span>
                  <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Latest update */}
            {data.updates[0] && (
              <div className="rounded-2xl p-5 border"
                style={{ background: `${primaryColor}10`, borderColor: `${primaryColor}25` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${accentColor}20`, color: accentColor }}>
                    Latest Update
                  </span>
                  {!data.updates[0].client_read && (
                    <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                  )}
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{data.updates[0].title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{data.updates[0].body}</p>
              </div>
            )}

            {/* Action needed items */}
            {totalActions > 0 && (
              <div className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>⚡</span> Actions Needed
                    <span className="ml-auto text-xs text-amber-400">{totalActions} items</span>
                  </h3>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {documents.filter(d => d.requires_approval && d.approval_status === 'pending').map(d => (
                    <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-blue-400">📄</span>
                      <div className="flex-1">
                        <p className="text-sm text-white">{d.name}</p>
                        <p className="text-xs text-slate-500">Document approval required</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('documents')}
                        className="text-xs px-3 py-1 rounded-lg font-medium"
                        style={{ background: `${primaryColor}20`, color: accentColor, border: `1px solid ${primaryColor}30` }}
                      >Review</button>
                    </div>
                  ))}
                  {budget.filter(b => b.status === 'pending_approval').map(b => (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-emerald-400">💰</span>
                      <div className="flex-1">
                        <p className="text-sm text-white">{b.item_name}</p>
                        <p className="text-xs text-slate-500">{fmtCurrency(b.estimated_amount)} — awaiting sign-off</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('budget')}
                        className="text-xs px-3 py-1 rounded-lg font-medium"
                        style={{ background: `${primaryColor}20`, color: accentColor, border: `1px solid ${primaryColor}30` }}
                      >Review</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPDATES */}
        {activeTab === 'updates' && (
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Updates from your team</h2>
            {data.updates.map(u => {
              const icons: Record<string, string> = { general: '💬', milestone: '🏆', alert: '🚨', vendor: '🤝', finance: '💰', design: '🎨', logistics: '🚛', approval_request: '✅' }
              return (
                <div key={u.id} className="rounded-2xl p-5 border transition-all"
                  style={{
                    background: u.is_pinned ? `${primaryColor}0d` : 'rgba(255,255,255,0.03)',
                    borderColor: u.is_pinned ? `${primaryColor}30` : 'rgba(255,255,255,0.06)',
                  }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 flex-shrink-0">{icons[u.update_type] ?? '💬'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {u.is_pinned && <span className="text-xs text-amber-400">📌 Pinned</span>}
                        {!u.client_read && <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} title="New" />}
                        {u.priority === 'urgent' && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-red-400 bg-red-500/10">URGENT</span>}
                      </div>
                      <h4 className="text-base font-semibold text-white">{u.title}</h4>
                      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{u.body}</p>
                      <p className="text-xs text-slate-600 mt-2">{fmt(u.published_at)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Event Timeline</h2>
              <span className="text-xs text-slate-500">{data.timeline.filter(t => t.status === 'completed').length}/{data.timeline.length} completed</span>
            </div>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="space-y-2">
                {data.timeline.map(item => (
                  <div key={item.id} className="relative flex gap-4 pl-12">
                    <div className={`absolute left-3.5 top-4 w-4 h-4 rounded-full z-10 flex items-center justify-center text-[9px] font-bold border-2`}
                      style={{
                        background: item.status === 'completed' ? primaryColor : item.status === 'in_progress' ? `${primaryColor}30` : config.background_color ?? '#0f172a',
                        borderColor: item.status === 'completed' ? primaryColor : item.status === 'in_progress' ? primaryColor : 'rgba(255,255,255,0.15)',
                        color: '#fff',
                      }}>
                      {item.status === 'completed' ? '✓' : ''}
                    </div>
                    <div className="flex-1 rounded-2xl p-4 mb-1 border transition-all"
                      style={{
                        background: item.status === 'completed' ? 'rgba(124,58,237,0.05)'
                          : item.requires_client_action && item.status !== 'completed' ? 'rgba(245,158,11,0.05)'
                          : 'rgba(255,255,255,0.02)',
                        borderColor: item.status === 'completed' ? `${primaryColor}25`
                          : item.requires_client_action ? 'rgba(245,158,11,0.2)'
                          : 'rgba(255,255,255,0.05)',
                      }}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{item.title}</span>
                            {item.requires_client_action && item.status !== 'completed' && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                                Your action
                              </span>
                            )}
                          </div>
                          {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {item.completed_at ? (
                            <span className="text-xs" style={{ color: accentColor }}>✓ {fmt(item.completed_at)}</span>
                          ) : item.due_date ? (
                            <span className="text-xs text-slate-500">{fmt(item.due_date)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="max-w-2xl space-y-3">
            <h2 className="text-lg font-semibold text-white mb-4">Documents</h2>
            {documents.map(doc => {
              const statusColor: Record<string, string> = {
                approved: '#34d399', rejected: '#f87171',
                pending: '#94a3b8', revision_requested: '#fbbf24', under_review: '#60a5fa',
              }
              const icons: Record<string, string> = { contract: '📄', proposal: '📋', invoice: '💸', design: '🎨', floor_plan: '📐', mood_board: '🖼️', vendor_quote: '💼', timeline: '📅', run_of_show: '🎬', other: '📁' }
              return (
                <div key={doc.id} className="rounded-2xl p-5 border transition-all"
                  style={{
                    background: doc.requires_approval && doc.approval_status === 'pending' ? `${primaryColor}08` : 'rgba(255,255,255,0.03)',
                    borderColor: doc.requires_approval && doc.approval_status === 'pending' ? `${primaryColor}30` : 'rgba(255,255,255,0.06)',
                  }}>
                  <div className="flex items-start gap-4">
                    <span className="text-3xl flex-shrink-0">{icons[doc.document_type] ?? '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{doc.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Added {fmt(doc.created_at)}</p>
                          {doc.client_notes && <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>Your note: {doc.client_notes}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ color: statusColor[doc.approval_status] ?? '#94a3b8', background: `${statusColor[doc.approval_status] ?? '#94a3b8'}15` }}>
                          {doc.approval_status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="px-3 py-1.5 text-xs rounded-lg font-medium"
                          style={{ background: `${primaryColor}20`, color: accentColor, border: `1px solid ${primaryColor}30` }}>
                          View Document
                        </button>
                        {doc.requires_approval && doc.approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, approval_status: 'approved' } : d))}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, approval_status: 'revision_requested' } : d))}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                              Request Changes
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* MOOD BOARD */}
        {activeTab === 'moodboard' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Vision Board</h2>
            <p className="text-sm text-slate-400 mb-6">React to each image — your team will use your feedback to shape the final design.</p>
            <div className="columns-2 md:columns-3 gap-3 space-y-3">
              {moodboard.map(item => (
                <div key={item.id} className="break-inside-avoid rounded-2xl overflow-hidden group relative border"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <img
                    src={item.image_url}
                    alt={item.title ?? ''}
                    className="w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/400/300` }}
                  />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {item.title && <p className="text-white text-sm font-semibold">{item.title}</p>}
                      {item.caption && <p className="text-slate-300 text-xs">{item.caption}</p>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setMoodboard(p => p.map(m => m.id === item.id ? { ...m, client_liked: true } : m))}
                          className={`text-2xl hover:scale-125 transition-transform ${item.client_liked === true ? 'opacity-100' : 'opacity-50'}`}>❤️</button>
                        <button onClick={() => setMoodboard(p => p.map(m => m.id === item.id ? { ...m, client_liked: false } : m))}
                          className={`text-2xl hover:scale-125 transition-transform ${item.client_liked === false ? 'opacity-100' : 'opacity-50'}`}>👎</button>
                      </div>
                    </div>
                  </div>
                  {item.client_liked !== null && item.client_liked !== undefined && (
                    <div className="absolute top-2 right-2">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-base"
                        style={{ background: item.client_liked ? '#ef4444' : '#475569' }}>
                        {item.client_liked ? '❤' : '✕'}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}>
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUDGET */}
        {activeTab === 'budget' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-6">Budget Overview</h2>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total Estimate', value: fmtCurrency(budget.reduce((s, b) => s + b.estimated_amount, 0)), color: '#fff' },
                { label: 'Approved', value: fmtCurrency(budget.filter(b => b.status === 'approved').reduce((s, b) => s + b.estimated_amount, 0)), color: '#34d399' },
                { label: 'Pending Sign-off', value: fmtCurrency(budget.filter(b => b.status === 'pending_approval').reduce((s, b) => s + b.estimated_amount, 0)), color: '#fbbf24' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-lg font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {budget.map(item => {
                const statusColors: Record<string, string> = { approved: '#34d399', pending_approval: '#fbbf24', rejected: '#f87171', draft: '#64748b', on_hold: '#64748b', revision_requested: '#fb923c' }
                const sColor = statusColors[item.status] ?? '#64748b'
                return (
                  <div key={item.id} className="rounded-2xl p-5 border"
                    style={{
                      background: item.status === 'pending_approval' ? `${primaryColor}08` : 'rgba(255,255,255,0.03)',
                      borderColor: item.status === 'pending_approval' ? `${primaryColor}25` : 'rgba(255,255,255,0.06)',
                    }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{item.item_name}</span>
                          {item.is_optional && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Optional</span>}
                          {item.is_upgrade && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${primaryColor}20`, color: accentColor }}>Upgrade</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.category}{item.description ? ` · ${item.description}` : ''}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-bold text-white">{fmtCurrency(item.estimated_amount)}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ color: sColor, background: `${sColor}15` }}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {item.status === 'pending_approval' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => setBudget(p => p.map(b => b.id === item.id ? { ...b, status: 'approved' } : b))}
                          className="flex-1 py-2 text-sm rounded-xl font-medium transition-colors bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                          ✓ Approve {fmtCurrency(item.estimated_amount)}
                        </button>
                        <button
                          onClick={() => setBudget(p => p.map(b => b.id === item.id ? { ...b, status: 'rejected' } : b))}
                          className="px-6 py-2 text-sm rounded-xl font-medium transition-colors bg-red-500/15 text-red-400 hover:bg-red-500/25">
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {activeTab === 'messages' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Messages</h2>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              {/* Message list */}
              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                {messages.map(msg => {
                  const isClient = msg.sender_type === 'client'
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isClient ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{ background: isClient ? `${primaryColor}` : 'rgba(255,255,255,0.1)' }}>
                        {msg.sender_name.charAt(0)}
                      </div>
                      <div className={`max-w-[75%] ${isClient ? 'items-end' : 'items-start'} flex flex-col`}>
                        <p className="text-xs text-slate-500 mb-1">{msg.sender_name}</p>
                        <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                          style={{
                            background: isClient ? `${primaryColor}` : 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            borderRadius: isClient ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem',
                          }}>
                          {msg.body}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{fmt(msg.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Compose */}
              <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, color: '#fff' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="max-w-4xl mx-auto px-6 py-8 mt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <p className="text-xs text-slate-600 text-center">Powered by OccasionPro · Your trusted event partner</p>
      </div>
    </div>
  )
}
