'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRealtimeEvent } from '@/lib/realtime/useRealtimeEvent';
import { RealtimePayload, TaskUpdateData, RunsheetItemData, VendorAlertData, GuestCheckInData, CrowdMetricsData, BroadcastData, EmergencyAlertData, PresenceUser } from '@/lib/realtime/types';
import {
  Radio,
  Zap,
  Users,
  CheckSquare,
  Clock,
  Truck,
  AlertTriangle,
  Megaphone,
  Activity,
  Wifi,
  WifiOff,
  ChevronRight,
  Bell,
  X,
  Send,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface LiveFeedItem {
  id: string;
  type: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  actor?: string;
}

const PRIORITY_COLORS = {
  low: 'text-gray-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  critical: 'text-red-400',
};

const PRIORITY_BG = {
  low: 'bg-gray-900/50',
  medium: 'bg-blue-950/50',
  high: 'bg-amber-950/50',
  critical: 'bg-red-950/60 animate-pulse',
};

export default function CommandCenterPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [crowdMetrics, setCrowdMetrics] = useState<CrowdMetricsData | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyType, setEmergencyType] = useState('general');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/events/${eventId}`, {
        credentials: 'include',
      });
      return res.json();
    },
  });

  const addToFeed = useCallback((item: Omit<LiveFeedItem, 'id'>) => {
    const newItem: LiveFeedItem = { ...item, id: `${Date.now()}-${Math.random()}` };
    setLiveFeed((prev) => [newItem, ...prev].slice(0, 200));
    // Auto-scroll to top
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const {
    connected,
    presenceUsers,
    sendBroadcast,
    triggerEmergency,
    updateTaskStatus,
    advanceRunsheetItem,
    checkInVendor,
  } = useRealtimeEvent({
    eventId,
    onTaskUpdate: useCallback((p: RealtimePayload<TaskUpdateData>) => {
      addToFeed({
        type: 'task',
        message: `Task "${p.data.title}" → ${p.data.status}`,
        priority: p.data.status === 'blocked' ? 'high' : 'low',
        timestamp: p.timestamp,
        actor: p.actor?.name,
      });
    }, [addToFeed]),

    onRunsheetUpdate: useCallback((p: RealtimePayload<RunsheetItemData>) => {
      const isDelayed = p.eventType === 'runsheet:item:delayed';
      addToFeed({
        type: 'runsheet',
        message: `${p.data.title} → ${p.data.status}${isDelayed && p.data.delayMinutes ? ` (+${p.data.delayMinutes}m delay)` : ''}`,
        priority: isDelayed ? 'high' : 'medium',
        timestamp: p.timestamp,
        actor: p.actor?.name,
      });
    }, [addToFeed]),

    onVendorAlert: useCallback((p: RealtimePayload<VendorAlertData>) => {
      addToFeed({
        type: 'vendor',
        message: p.data.message,
        priority: p.data.alertType === 'delay' || p.data.alertType === 'issue' ? 'high' : 'medium',
        timestamp: p.timestamp,
        actor: p.actor?.name,
      });
    }, [addToFeed]),

    onGuestCheckIn: useCallback((p: RealtimePayload<GuestCheckInData>) => {
      addToFeed({
        type: 'guest',
        message: `${p.data.guestName} checked in — ${p.data.totalCheckedIn}/${p.data.totalExpected} guests`,
        priority: 'low',
        timestamp: p.timestamp,
      });
    }, [addToFeed]),

    onCrowdMetrics: useCallback((p: RealtimePayload<CrowdMetricsData>) => {
      setCrowdMetrics(p.data);
    }, []),

    onBroadcast: useCallback((p: RealtimePayload<BroadcastData>) => {
      addToFeed({
        type: 'broadcast',
        message: `📢 ${p.data.message}`,
        priority: p.data.priority,
        timestamp: p.timestamp,
        actor: p.actor?.name,
      });
    }, [addToFeed]),

    onEmergencyAlert: useCallback((p: RealtimePayload<EmergencyAlertData>) => {
      addToFeed({
        type: 'emergency',
        message: `🚨 EMERGENCY [${p.data.alertType.toUpperCase()}]: ${p.data.message}`,
        priority: 'critical',
        timestamp: p.timestamp,
        actor: p.actor?.name,
      });
    }, [addToFeed]),
  });

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    sendBroadcast(broadcastMessage.trim(), broadcastPriority);
    setBroadcastMessage('');
  };

  const handleEmergency = () => {
    triggerEmergency({
      alertType: emergencyType,
      message: emergencyMessage,
      instructions: ['Follow emergency protocols', 'Stay calm and follow staff instructions'],
      contactPerson: 'Event Manager',
      contactPhone: '+91 98765 43210',
    });
    setShowEmergencyModal(false);
    setEmergencyMessage('');
  };

  const occupancyColor =
    !crowdMetrics ? 'text-gray-400'
    : crowdMetrics.occupancyPercent >= 90 ? 'text-red-400'
    : crowdMetrics.occupancyPercent >= 70 ? 'text-amber-400'
    : 'text-green-400';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Command Center</h1>
            <p className="text-xs text-gray-400">{event?.name || 'Loading…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={`flex items-center gap-2 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Live' : 'Disconnected'}
          </div>
          {/* Online users */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {presenceUsers.length} online
            <div className="flex -space-x-1.5 ml-1">
              {presenceUsers.slice(0, 5).map((u) => (
                <div
                  key={u.userId}
                  title={u.name}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 border border-gray-900 flex items-center justify-center text-[10px] font-bold"
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {presenceUsers.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-gray-700 border border-gray-900 flex items-center justify-center text-[10px] font-bold text-gray-300">
                  +{presenceUsers.length - 5}
                </div>
              )}
            </div>
          </div>
          {/* Emergency button */}
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Emergency
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Occupancy</span>
                <Activity className={`w-4 h-4 ${occupancyColor}`} />
              </div>
              <div className={`text-2xl font-bold ${occupancyColor}`}>
                {crowdMetrics ? `${crowdMetrics.occupancyPercent.toFixed(0)}%` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {crowdMetrics ? `${crowdMetrics.currentOccupancy} / ${crowdMetrics.maxCapacity}` : 'Waiting for data'}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Check-ins</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {crowdMetrics?.checkInsTotal ?? '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {crowdMetrics ? `+${crowdMetrics.checkInsLast10Min} last 10m` : 'Waiting for data'}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Online Staff</span>
                <Wifi className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">{presenceUsers.length}</div>
              <div className="text-xs text-gray-500 mt-1">Connected now</div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Feed Events</span>
                <Bell className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{liveFeed.length}</div>
              <div className="text-xs text-gray-500 mt-1">Since you joined</div>
            </div>
          </div>

          {/* Live feed */}
          <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live Activity Feed
              </h2>
              {liveFeed.length > 0 && (
                <button
                  onClick={() => setLiveFeed([])}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div
              ref={feedRef}
              className="flex-1 overflow-y-auto space-y-2 pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
            >
              {liveFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                  <Activity className="w-8 h-8 mb-2" />
                  <p className="text-sm">Waiting for live activity…</p>
                  <p className="text-xs mt-1">Events will appear here in real time</p>
                </div>
              ) : (
                liveFeed.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-transparent hover:border-gray-700 transition-colors ${PRIORITY_BG[item.priority]}`}
                  >
                    <FeedIcon type={item.type} priority={item.priority} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.priority === 'critical' ? 'text-red-300 font-semibold' : 'text-gray-200'}`}>
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.actor && (
                          <span className="text-xs text-gray-500">{item.actor}</span>
                        )}
                        <span className="text-xs text-gray-600">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar — broadcast + presence */}
        <div className="w-80 border-l border-gray-800 flex flex-col">
          {/* Broadcast */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              Broadcast to Team
            </h3>
            <div className="space-y-2">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleSendBroadcast()}
                placeholder="Type a message for all staff…"
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50"
              />
              <div className="flex items-center gap-2">
                <select
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value as any)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  onClick={handleSendBroadcast}
                  disabled={!broadcastMessage.trim() || !connected}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Online staff */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-green-400" />
              Online Staff
              <span className="ml-auto text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded-full">
                {presenceUsers.length}
              </span>
            </h3>
            <div className="space-y-2">
              {presenceUsers.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">No staff online</p>
              ) : (
                presenceUsers.map((user) => (
                  <div key={user.userId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-900/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 ml-auto" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Trigger Emergency Alert</h2>
                <p className="text-xs text-red-400">This will notify ALL staff immediately</p>
              </div>
              <button onClick={() => setShowEmergencyModal(false)} className="ml-auto text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Alert Type</label>
                <select
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                >
                  <option value="general">General Emergency</option>
                  <option value="fire">🔥 Fire</option>
                  <option value="medical">🏥 Medical</option>
                  <option value="security">🔒 Security</option>
                  <option value="weather">⛈ Weather</option>
                  <option value="evacuation">🚪 Evacuation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Message</label>
                <textarea
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  placeholder="Describe the emergency situation…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmergency}
                  disabled={!emergencyMessage.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Send Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedIcon({ type, priority }: { type: string; priority: string }) {
  const cls = `w-4 h-4 mt-0.5 flex-shrink-0 ${PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'text-gray-400'}`;
  switch (type) {
    case 'task': return <CheckSquare className={cls} />;
    case 'runsheet': return <Clock className={cls} />;
    case 'vendor': return <Truck className={cls} />;
    case 'guest': return <Users className={cls} />;
    case 'broadcast': return <Megaphone className={cls} />;
    case 'emergency': return <AlertTriangle className={cls} />;
    default: return <Activity className={cls} />;
  }
}
