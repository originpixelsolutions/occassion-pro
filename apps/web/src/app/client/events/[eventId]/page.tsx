'use client'
/**
 * Client Portal — Per-Event View
 * 9 sections: Overview, Approvals, Budget, Payments, Documents, Timeline, Messages, Gallery, Reports
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

type Section = 'overview' | 'approvals' | 'budget' | 'payments' | 'documents' | 'timeline' | 'messages' | 'gallery' | 'reports'

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'approvals', label: 'Approvals', icon: '✅' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'timeline', label: 'Timeline', icon: '📍' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'gallery', label: 'Gallery', icon: '🖼️' },
  { id: 'reports', label: 'Reports', icon: '📊' },
]

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/5 border border-white/10 rounded-2xl p-6 ${className}`}>{children}</div>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-4">{children}</p>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    changes_requested: 'bg-red-500/20 text-red-400 border-red-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    submitted: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  }
  const labels: Record<string, string> = {
    pending: 'Pending Review', approved: 'Approved', changes_requested: 'Changes Requested',
    rejected: 'Rejected', paid: 'Paid', overdue: 'Overdue', submitted: 'Submitted',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${colors[status] || 'bg-white/10 text-white/50 border-white/20'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function ClientEventPortal() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const [section, setSection] = useState<Section>('overview')
  const [portal, setPortal] = useState<any>(null)
  const [sectionData, setSectionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  useEffect(() => {
    fetch(`${API}/client-portal/events/${eventId}`, { credentials: 'include' })
      .then(async r => {
        if (r.status === 401) { router.push('/client/login'); return null }
        return r.json()
      })
      .then(d => { if (d) { setPortal(d); setLoading(false) } })
      .catch(() => router.push('/client/login'))
  }, [eventId, router])

  const loadSection = useCallback(async (s: Section) => {
    if (s === 'overview') return
    setSectionLoading(true)
    try {
      const endpointMap: Partial<Record<Section, string>> = {
        approvals: `events/${eventId}/approvals`,
        documents: `events/${eventId}/documents`,
        messages: `events/${eventId}/messages`,
      }
      const endpoint = endpointMap[s]
      if (!endpoint) { setSectionData(null); setSectionLoading(false); return }
      const res = await fetch(`${API}/client-portal/${endpoint}`, { credentials: 'include' })
      if (res.ok) setSectionData(await res.json())
    } finally { setSectionLoading(false) }
  }, [eventId])

  useEffect(() => { loadSection(section) }, [section, loadSection])

  async function sendMessage() {
    if (!message.trim() || sendingMsg) return
    setSendingMsg(true)
    try {
      await fetch(`${API}/client-portal/events/${eventId}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      setMessage('')
      loadSection('messages')
    } finally { setSendingMsg(false) }
  }

  async function submitApproval(approvalId: string, status: 'approved' | 'changes_requested', comment?: string) {
    await fetch(`${API}/client-portal/events/${eventId}/approvals/${approvalId}/review`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment }),
    })
    loadSection('approvals')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!portal) return null

  const { event, access_level, settings, attention_count } = portal
  const visibleSections = SECTIONS.filter(s => settings?.[`section_${s.id}`] !== false)

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0f1a]/95 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => router.push('/client/dashboard')} className="text-white/40 hover:text-white/70 text-sm transition-colors">
            ← All Events
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold text-sm truncate">{event?.title}</h1>
          </div>
          {attention_count > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              ⚠️ {attention_count} need{attention_count === 1 ? 's' : ''} attention
            </span>
          )}
          <span className="text-xs text-white/30">{access_level?.replace('_', ' ')}</span>
        </div>
      </header>

      <div className="flex flex-1 max-w-5xl mx-auto w-full px-4 py-6 gap-6">
        {/* Sidebar nav */}
        <aside className="w-48 flex-none">
          <nav className="space-y-1 sticky top-20">
            {visibleSections.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  section === s.id
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}>
                <span>{s.icon}</span>
                {s.label}
                {s.id === 'approvals' && attention_count > 0 && (
                  <span className="ml-auto text-xs bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {attention_count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-4">

          {/* OVERVIEW */}
          {section === 'overview' && (
            <>
              <Card>
                <SectionLabel>Event Details</SectionLabel>
                <h2 className="text-white text-xl font-bold mb-4">{event?.title}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/40 text-xs">Date</p>
                    <p className="text-white text-sm">{new Date(event?.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {event?.venue_name && (
                    <div>
                      <p className="text-white/40 text-xs">Venue</p>
                      <p className="text-white text-sm">{event.venue_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 text-xs">Status</p>
                    <p className="text-white text-sm capitalize">{event?.status}</p>
                  </div>
                </div>
              </Card>
              {attention_count > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="text-amber-400 font-semibold">{attention_count} item{attention_count !== 1 ? 's' : ''} need your attention</p>
                      <p className="text-amber-400/60 text-sm">Review pending approvals and overdue payments.</p>
                    </div>
                    <button onClick={() => setSection('approvals')}
                      className="ml-auto px-4 py-2 text-sm rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors">
                      Review
                    </button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* APPROVALS */}
          {section === 'approvals' && (
            <Card>
              <SectionLabel>Pending Approvals</SectionLabel>
              {sectionLoading ? <Spinner /> : (sectionData?.approvals?.length === 0 ? (
                <EmptyState icon="✅" text="No pending approvals" sub="All items are up to date." />
              ) : (
                <div className="space-y-4">
                  {sectionData?.approvals?.map((a: any) => (
                    <div key={a.id} className="border border-white/10 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-white font-medium">{a.title}</h3>
                          {a.description && <p className="text-white/50 text-sm mt-1">{a.description}</p>}
                          {a.deadline && (
                            <p className={`text-xs mt-1 ${new Date(a.deadline) < new Date() ? 'text-red-400' : 'text-white/40'}`}>
                              Due: {new Date(a.deadline).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.file_url && (
                        <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-violet-400 text-xs hover:text-violet-300 flex items-center gap-1 mb-3">
                          📎 View Document
                        </a>
                      )}
                      {a.status === 'pending' && access_level !== 'view_only' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => submitApproval(a.id, 'approved')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors">
                            ✓ Approve
                          </button>
                          <button onClick={() => submitApproval(a.id, 'changes_requested', 'Changes requested.')}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-colors">
                            ✗ Request Changes
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          )}

          {/* BUDGET */}
          {section === 'budget' && (
            <Card>
              <SectionLabel>Budget Overview</SectionLabel>
              <EmptyState icon="💰" text="Budget details" sub="Your event budget summary will appear here once shared by the event team." />
            </Card>
          )}

          {/* PAYMENTS */}
          {section === 'payments' && (
            <Card>
              <SectionLabel>Payments & Invoices</SectionLabel>
              <EmptyState icon="💳" text="No invoices yet" sub="Payment history and pending invoices will appear here." />
            </Card>
          )}

          {/* DOCUMENTS */}
          {section === 'documents' && (
            <Card>
              <SectionLabel>Documents</SectionLabel>
              {sectionLoading ? <Spinner /> : (sectionData?.documents?.length === 0 ? (
                <EmptyState icon="📄" text="No documents shared yet" sub="The event team will share files here when ready." />
              ) : (
                <div className="space-y-3">
                  {sectionData?.documents?.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <span className="text-xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{d.name || d.title}</p>
                        <p className="text-white/40 text-xs">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-violet-400 text-xs hover:text-violet-300 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          )}

          {/* TIMELINE */}
          {section === 'timeline' && (
            <Card>
              <SectionLabel>Event Timeline</SectionLabel>
              <EmptyState icon="📍" text="Timeline coming soon" sub="Your event milestones and progress will appear here." />
            </Card>
          )}

          {/* MESSAGES */}
          {section === 'messages' && (
            <Card>
              <SectionLabel>Messages</SectionLabel>
              {sectionLoading ? <Spinner /> : (
                <div className="space-y-4">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {!sectionData?.messages?.length && (
                      <p className="text-white/30 text-sm text-center py-6">No messages yet. Start a conversation.</p>
                    )}
                    {sectionData?.messages?.map((m: any) => (
                      <div key={m.id} className={`flex ${m.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                          m.sender_type === 'client'
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-white/10 text-white/80 rounded-bl-sm'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <input value={message} onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Type a message…"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500" />
                    <button onClick={sendMessage} disabled={!message.trim() || sendingMsg}
                      className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* GALLERY */}
          {section === 'gallery' && (
            <Card>
              <SectionLabel>Gallery & References</SectionLabel>
              <EmptyState icon="🖼️" text="No gallery items yet" sub="Mood boards and reference images will appear here when shared." />
            </Card>
          )}

          {/* REPORTS */}
          {section === 'reports' && (
            <Card>
              <SectionLabel>Event Reports</SectionLabel>
              {access_level === 'view_only' ? (
                <EmptyState icon="🔒" text="Reports require Full Access" sub="Contact your event manager to upgrade your access level." />
              ) : (
                <EmptyState icon="📊" text="Reports coming soon" sub="Event performance reports will be available after the event." />
              )}
            </Card>
          )}

        </main>
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}
function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div className="text-center py-10">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-white/60 font-medium">{text}</p>
      <p className="text-white/30 text-sm mt-1">{sub}</p>
    </div>
  )
}
