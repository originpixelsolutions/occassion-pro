'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useParams } from 'next/navigation';
import {
  Calendar,
  FileText,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Send,
  Lock,
  Loader2,
  Download,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { getGreeting, getGreetingEmoji } from '@/lib/greeting';
import { format } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL;

type Section = 'timeline' | 'documents' | 'messages' | 'rsvp';

interface PortalSession {
  portal_id: string;
  event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    description?: string;
    banner_url?: string;
    venue_id?: string;
  };
  client_name: string;
  allowed_sections: Section[];
  access_token: string;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  sort_order: number;
}

interface PortalDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  description?: string;
  requires_approval: boolean;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  from_client: boolean;
  sender_name?: string;
  created_at: string;
  attachment_urls?: string[];
}

const MILESTONE_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  in_progress: 'bg-blue-500',
  upcoming: 'bg-gray-600',
  overdue: 'bg-red-500',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  proposal: '📋',
  contract: '📜',
  invoice: '💰',
  timeline: '🗓',
  floor_plan: '🏛',
  mood_board: '🎨',
  vendor_list: '🤝',
  seating_chart: '💺',
  menu: '🍽',
  runsheet: '📝',
  other: '📄',
};

export default function ClientPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('timeline');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [rsvpPlusOnes, setRsvpPlusOnes] = useState(0);
  const [rsvpDietary, setRsvpDietary] = useState('');
  const [rsvpMessage, setRsvpMessage] = useState('');
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const res = await fetch(`${API}/api/v1/portal/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, access_code: accessCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAuthError(err.message ?? 'Invalid access code');
        return;
      }
      const data: PortalSession = await res.json();
      setSession(data);
      localStorage.setItem(`portal_session_${slug}`, JSON.stringify(data));
      loadSection(data.allowed_sections[0] ?? 'timeline', data);
    } catch {
      setAuthError('Unable to connect. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function loadSection(section: Section, sess?: PortalSession) {
    const s = sess ?? session;
    if (!s) return;
    setActiveSection(section);

    if (section === 'timeline' && milestones.length === 0) {
      const res = await fetch(`${API}/api/v1/portal/${s.event.id}/timeline`);
      if (res.ok) setMilestones(await res.json());
    }
    if (section === 'documents' && documents.length === 0) {
      const res = await fetch(`${API}/api/v1/portal/${s.event.id}/documents`);
      if (res.ok) setDocuments(await res.json());
    }
    if (section === 'messages') {
      const res = await fetch(`${API}/api/v1/portal/${s.portal_id}/messages`);
      if (res.ok) setMessages(await res.json());
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !newMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`${API}/api/v1/portal/${session.portal_id}/messages/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        const msg: Message = await res.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage('');
      }
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function submitRsvp(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !rsvpStatus) return;
    const res = await fetch(`${API}/api/v1/portal/${session.portal_id}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: rsvpStatus,
        plus_ones: rsvpPlusOnes,
        dietary_requirements: rsvpDietary,
        message: rsvpMessage,
      }),
    });
    if (res.ok) setRsvpSubmitted(true);
  }

  async function submitApproval(itemId: string, itemType: string, status: 'approved' | 'rejected') {
    if (!session) return;
    await fetch(`${API}/api/v1/portal/${session.portal_id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, item_type: itemType, status }),
    });
    // Refresh docs
    const res = await fetch(`${API}/api/v1/portal/${session.event.id}/documents`);
    if (res.ok) setDocuments(await res.json());
  }

  // Restore session from storage
  useEffect(() => {
    const stored = localStorage.getItem(`portal_session_${slug}`);
    if (stored) {
      try {
        const s: PortalSession = JSON.parse(stored);
        setSession(s);
        loadSection('timeline', s);
      } catch {}
    }
  }, [slug]);

  // ─── Login Screen ──────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Client Portal</h1>
            <p className="text-gray-400 text-sm">Enter your access code to view your event</p>
          </div>

          <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Access Code</label>
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                <Lock className="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. A1B2C3D4)"
                  className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none text-sm tracking-widest font-mono"
                  maxLength={8}
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={!accessCode || isAuthenticating}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Access Portal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { event, client_name, allowed_sections } = session;
  const firstName = client_name.split(' ')[0];
  const daysUntilEvent = Math.ceil((new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const pendingApprovals = documents.filter(d => d.requires_approval).length;

  const SECTION_CONFIG: Record<Section, { label: string; icon: any }> = {
    timeline: { label: 'Timeline', icon: Calendar },
    documents: { label: 'Documents', icon: FileText },
    messages: { label: 'Messages', icon: MessageSquare },
    rsvp: { label: 'RSVP', icon: Users },
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-white text-lg">{event.name}</h1>
            <p className="text-xs text-gray-400">
              {format(new Date(event.start_date), 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-gray-300">{client_name}</p>
              <button
                onClick={() => {
                  localStorage.removeItem(`portal_session_${slug}`);
                  setSession(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                Sign out
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-3xl mx-auto px-4 pb-0">
          <div className="flex border-b border-gray-800">
            {allowed_sections.map((s) => {
              const { label, icon: Icon } = SECTION_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => loadSection(s)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                    activeSection === s
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Welcome */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-5 py-4">
          <h1 className="text-2xl font-semibold text-white">
            {getGreeting()}, {firstName} {getGreetingEmoji()}
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            {daysUntilEvent > 0 ? (
              <>Your event is in{' '}
                <span className="font-medium text-white">{daysUntilEvent} day{daysUntilEvent !== 1 ? 's' : ''}</span>
                {pendingApprovals > 0 && (
                  <>{' · '}<span className="font-medium text-purple-400">{pendingApprovals} item{pendingApprovals !== 1 ? 's' : ''} pending your approval</span></>
                )}
              </>
            ) : daysUntilEvent === 0 ? (
              <span className="font-medium text-purple-400">Your event is today! 🎉</span>
            ) : (
              <span className="text-gray-500">Your event was on {format(new Date(event.start_date), 'MMMM d, yyyy')}</span>
            )}
          </p>
        </div>

        {/* ─── Timeline ─────────────────────────────────────────────────────── */}
        {activeSection === 'timeline' && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Event Milestones
            </h2>
            {milestones.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-600">
                <Calendar className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No milestones added yet</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800" />
                <div className="space-y-4 pl-10">
                  {milestones.map((m) => (
                    <div key={m.id} className="relative">
                      {/* Dot */}
                      <div
                        className={`absolute -left-7 top-3 w-3 h-3 rounded-full ${MILESTONE_COLORS[m.status]}`}
                      />
                      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white text-sm">{m.title}</p>
                            {m.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500">
                              {format(new Date(m.due_date), 'MMM d, yyyy')}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block capitalize ${
                                m.status === 'completed'
                                  ? 'bg-green-900/40 text-green-400'
                                  : m.status === 'in_progress'
                                  ? 'bg-blue-900/40 text-blue-400'
                                  : m.status === 'overdue'
                                  ? 'bg-red-900/40 text-red-400'
                                  : 'bg-gray-800 text-gray-500'
                              }`}
                            >
                              {m.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Documents ────────────────────────────────────────────────────── */}
        {activeSection === 'documents' && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Shared Documents
            </h2>
            {documents.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-600">
                <FileText className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No documents shared yet</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{DOC_TYPE_ICONS[doc.document_type] ?? '📄'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{doc.document_name}</p>
                      {doc.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-1 capitalize">
                        {doc.document_type.replace('_', ' ')} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.requires_approval && (
                        <>
                          <button
                            onClick={() => submitApproval(doc.id, 'document', 'approved')}
                            className="p-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 transition-colors"
                            title="Approve"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => submitApproval(doc.id, 'document', 'rejected')}
                            className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
                            title="Request revision"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Messages ─────────────────────────────────────────────────────── */}
        {activeSection === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Messages
            </h2>
            <div className="space-y-3 min-h-[300px]">
              {messages.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-600">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No messages yet. Send one below.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from_client ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.from_client
                          ? 'bg-purple-600 text-white rounded-br-sm'
                          : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                      }`}
                    >
                      {!msg.from_client && (
                        <p className="text-xs font-medium text-purple-400 mb-1">Event Team</p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.from_client ? 'text-purple-300' : 'text-gray-500'}`}>
                        {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSendingMessage}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl transition-colors"
              >
                {isSendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        )}

        {/* ─── RSVP ─────────────────────────────────────────────────────────── */}
        {activeSection === 'rsvp' && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Your RSVP
            </h2>

            {rsvpSubmitted ? (
              <div className="bg-green-900/20 border border-green-800 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold">RSVP Submitted!</p>
                <p className="text-gray-400 text-sm mt-1">
                  {rsvpStatus === 'confirmed'
                    ? "We're excited to see you!"
                    : "We've recorded your response."}
                </p>
              </div>
            ) : (
              <form onSubmit={submitRsvp} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
                <div>
                  <label className="block text-sm text-gray-400 mb-3">Will you attend?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'confirmed', label: '✅ Yes', color: 'border-green-600 bg-green-900/30 text-green-400' },
                      { value: 'declined', label: '❌ No', color: 'border-red-600 bg-red-900/30 text-red-400' },
                      { value: 'maybe', label: '🤔 Maybe', color: 'border-amber-600 bg-amber-900/30 text-amber-400' },
                    ].map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRsvpStatus(value)}
                        className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                          rsvpStatus === value ? color : 'border-gray-700 text-gray-500 hover:border-gray-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {rsvpStatus === 'confirmed' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        Number of guests (excluding yourself)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={rsvpPlusOnes}
                        onChange={(e) => setRsvpPlusOnes(Number(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        Dietary requirements
                      </label>
                      <input
                        type="text"
                        value={rsvpDietary}
                        onChange={(e) => setRsvpDietary(e.target.value)}
                        placeholder="Vegetarian, gluten-free, allergies…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Message (optional)</label>
                  <textarea
                    rows={3}
                    value={rsvpMessage}
                    onChange={(e) => setRsvpMessage(e.target.value)}
                    placeholder="Any notes for the event team…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!rsvpStatus}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium rounded-xl transition-colors"
                >
                  Submit RSVP
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
