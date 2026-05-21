'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Users,
  IndianRupee,
  MapPin,
  Clock,
  Plus,
  FileText,
  CheckCircle2,
  Circle,
  Edit,
  Send,
  Sparkles,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

async function apiCall(path: string, opts?: RequestInit) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  whatsapp: Phone,
  site_visit: MapPin,
  proposal_sent: FileText,
  follow_up: Clock,
  note: Edit,
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-800 text-gray-300',
  contacted: 'bg-blue-900/50 text-blue-300',
  qualified: 'bg-indigo-900/50 text-indigo-300',
  proposal_sent: 'bg-purple-900/50 text-purple-300',
  negotiation: 'bg-amber-900/50 text-amber-300',
  won: 'bg-green-900/50 text-green-300',
  lost: 'bg-red-900/50 text-red-300',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activityType, setActivityType] = useState('note');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [showLogActivity, setShowLogActivity] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => apiCall(`/crm/leads/${id}`),
  });

  const { data: activities } = useQuery({
    queryKey: ['lead-activities', id],
    queryFn: () => apiCall(`/crm/leads/${id}/activities`),
  });

  const logActivityMutation = useMutation({
    mutationFn: (data: any) => apiCall('/crm/activities', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', id] });
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setActivitySubject('');
      setActivityNotes('');
      setShowLogActivity(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      apiCall(`/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const generateProposalMutation = useMutation({
    mutationFn: () =>
      apiCall('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          feature: 'proposal_generation',
          context: { leadId: id, clientName: lead?.client_name, eventType: lead?.event_type, budget: lead?.budget_max, guestCount: lead?.guest_count },
        }),
      }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) return null;

  const formatCurrency = (n: number) => {
    if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    return `₹${n.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{lead.client_name}</h1>
          {lead.company_name && <p className="text-sm text-gray-400">{lead.company_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[lead.status] || 'bg-gray-800 text-gray-300'}`}>
            {lead.status?.replace('_', ' ')}
          </span>
          <div className="flex items-center gap-1">
            {['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won'].map((s) => (
              <button
                key={s}
                onClick={() => updateStatusMutation.mutate(s)}
                title={s.replace('_', ' ')}
                className={`w-2.5 h-2.5 rounded-full transition-all ${lead.status === s ? 'scale-125 bg-purple-400' : 'bg-gray-700 hover:bg-gray-500'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-6 p-6 max-w-6xl mx-auto">
        {/* Left — details */}
        <div className="flex-1 space-y-5">
          {/* Contact info */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Mail, label: 'Email', value: lead.client_email },
                { icon: Phone, label: 'Phone', value: lead.client_phone || '—' },
                { icon: Calendar, label: 'Event Date', value: lead.event_date ? format(new Date(lead.event_date), 'PPP') : '—' },
                { icon: Users, label: 'Guest Count', value: lead.guest_count ? `${lead.guest_count} guests` : '—' },
                { icon: IndianRupee, label: 'Budget Range', value: lead.budget_min || lead.budget_max ? `${lead.budget_min ? formatCurrency(lead.budget_min) : '?'} – ${lead.budget_max ? formatCurrency(lead.budget_max) : '?'}` : '—' },
                { icon: MapPin, label: 'Venue Pref.', value: lead.venue_preference || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className="text-sm text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deal info */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Deal Info</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Deal Value</p>
                <p className="text-lg font-bold text-green-400">{lead.deal_value ? formatCurrency(lead.deal_value) : '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Probability</p>
                <p className="text-lg font-bold text-blue-400">{lead.probability ? `${lead.probability}%` : '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Lead Score</p>
                <p className="text-lg font-bold text-purple-400">{lead.score ?? '—'}</p>
              </div>
            </div>
            {lead.notes && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-300">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* AI Proposal */}
          <div className="bg-gradient-to-br from-purple-950/50 to-gray-900 rounded-2xl border border-purple-800/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                AI Proposal Generator
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Generate a professional proposal instantly based on lead details using AI.</p>
            <div className="flex gap-3">
              <button
                onClick={() => generateProposalMutation.mutate()}
                disabled={generateProposalMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {generateProposalMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Proposal
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm rounded-xl transition-colors">
                <FileText className="w-4 h-4" />
                View Proposals ({lead.proposals?.length ?? 0})
              </button>
            </div>
            {generateProposalMutation.data && (
              <div className="mt-4 p-4 bg-gray-900/70 rounded-xl text-sm text-gray-300 whitespace-pre-wrap font-mono text-xs">
                {generateProposalMutation.data.result}
              </div>
            )}
          </div>
        </div>

        {/* Right — activity timeline */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">Activity Timeline</h2>
              <button
                onClick={() => setShowLogActivity(!showLogActivity)}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Log
              </button>
            </div>

            {/* Log activity form */}
            {showLogActivity && (
              <div className="mb-4 p-3 bg-gray-800/50 rounded-xl space-y-2">
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {['call', 'email', 'meeting', 'whatsapp', 'site_visit', 'proposal_sent', 'follow_up', 'note'].map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
                <input
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <textarea
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="Notes…"
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 resize-none focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => logActivityMutation.mutate({ lead_id: id, type: activityType, subject: activitySubject, description: activityNotes, is_completed: true })}
                    disabled={!activitySubject.trim()}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setShowLogActivity(false)} className="px-3 py-1.5 text-gray-400 hover:text-gray-300 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {!activities?.length ? (
                <p className="text-xs text-gray-600 text-center py-6">No activities yet</p>
              ) : (
                activities.map((activity: any, i: number) => {
                  const Icon = ACTIVITY_ICONS[activity.type] || Edit;
                  return (
                    <div key={activity.id} className="flex gap-3 relative">
                      {i < activities.length - 1 && (
                        <div className="absolute left-3.5 top-7 bottom-0 w-px bg-gray-800" />
                      )}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${activity.is_completed ? 'bg-green-900/40 border border-green-700/30' : 'bg-gray-800 border border-gray-700'}`}>
                        <Icon className={`w-3.5 h-3.5 ${activity.is_completed ? 'text-green-400' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <p className="text-xs font-medium text-white truncate">{activity.subject}</p>
                        {activity.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-600">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                          {activity.team_members?.users?.full_name && (
                            <span className="text-[10px] text-gray-600">· {activity.team_members.users.full_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
