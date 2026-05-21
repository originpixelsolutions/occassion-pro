'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSession } from '@/lib/auth/useSession';
import { getSocket, disconnectSocket, subscribeToEvent } from './socket';
import { RealtimeEventType, RealtimePayload, PresenceUser } from './types';

interface UseRealtimeEventOptions {
  eventId: string;
  onTaskUpdate?: (payload: RealtimePayload) => void;
  onRunsheetUpdate?: (payload: RealtimePayload) => void;
  onVendorAlert?: (payload: RealtimePayload) => void;
  onGuestCheckIn?: (payload: RealtimePayload) => void;
  onCrowdMetrics?: (payload: RealtimePayload) => void;
  onBroadcast?: (payload: RealtimePayload) => void;
  onEmergencyAlert?: (payload: RealtimePayload) => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
}

export function useRealtimeEvent(options: UseRealtimeEventOptions) {
  const { eventId, ...handlers } = options;
  const { session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  const cleanup = useCallback(() => {
    unsubscribersRef.current.forEach((fn) => fn());
    unsubscribersRef.current = [];
  }, []);

  useEffect(() => {
    if (!session?.access_token || !eventId) return;

    const sock = getSocket(session.access_token);
    socketRef.current = sock;

    const handleConnect = async () => {
      setConnected(true);
      // Join the event room
      sock.emit('join:event', { eventId }, (response: { success: boolean; presentUsers: PresenceUser[] }) => {
        if (response?.presentUsers) {
          setPresenceUsers(response.presentUsers);
        }
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);

    if (sock.connected) {
      handleConnect();
    }

    // Subscribe to all event types
    const unsubs: Array<() => void> = [];

    if (handlers.onTaskUpdate) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.TASK_UPDATED, handlers.onTaskUpdate));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.TASK_CREATED, handlers.onTaskUpdate));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.TASK_COMPLETED, handlers.onTaskUpdate));
    }

    if (handlers.onRunsheetUpdate) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.RUNSHEET_ITEM_STARTED, handlers.onRunsheetUpdate));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.RUNSHEET_ITEM_COMPLETED, handlers.onRunsheetUpdate));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.RUNSHEET_ITEM_DELAYED, handlers.onRunsheetUpdate));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.RUNSHEET_UPDATED, handlers.onRunsheetUpdate));
    }

    if (handlers.onVendorAlert) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.VENDOR_ARRIVED, handlers.onVendorAlert));
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.VENDOR_ALERT, handlers.onVendorAlert));
    }

    if (handlers.onGuestCheckIn) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.GUEST_CHECKED_IN, handlers.onGuestCheckIn));
    }

    if (handlers.onCrowdMetrics) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.CROWD_METRICS, handlers.onCrowdMetrics));
    }

    if (handlers.onBroadcast) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.BROADCAST, handlers.onBroadcast));
    }

    if (handlers.onEmergencyAlert) {
      unsubs.push(subscribeToEvent(sock, RealtimeEventType.EMERGENCY_ALERT, handlers.onEmergencyAlert));
    }

    // Presence updates
    unsubs.push(
      subscribeToEvent(sock, RealtimeEventType.PRESENCE_LIST, (payload: any) => {
        if (payload.users) {
          setPresenceUsers(payload.users);
          handlers.onPresenceUpdate?.(payload.users);
        }
      }),
    );

    unsubs.push(
      subscribeToEvent(sock, RealtimeEventType.USER_JOINED, (payload: any) => {
        setPresenceUsers((prev) => {
          if (prev.find((u) => u.userId === payload.userId)) return prev;
          return [...prev, { ...payload, currentEventId: eventId }];
        });
      }),
    );

    unsubs.push(
      subscribeToEvent(sock, RealtimeEventType.USER_LEFT, (payload: any) => {
        setPresenceUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      }),
    );

    unsubscribersRef.current = unsubs;

    return () => {
      sock.off('connect', handleConnect);
      sock.off('disconnect', handleDisconnect);
      sock.emit('leave:event', { eventId });
      cleanup();
    };
  }, [session?.access_token, eventId]);

  const sendBroadcast = useCallback(
    (message: string, priority: 'low' | 'medium' | 'high' | 'critical', opts?: { targetRoles?: string[]; requiresAck?: boolean }) => {
      socketRef.current?.emit('command:broadcast', {
        eventId,
        message,
        priority,
        ...opts,
      });
    },
    [eventId],
  );

  const triggerEmergency = useCallback(
    (data: { alertType: string; message: string; instructions: string[]; contactPerson: string; contactPhone: string }) => {
      socketRef.current?.emit('command:emergency', { eventId, ...data });
    },
    [eventId],
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: string, notes?: string) => {
      socketRef.current?.emit('task:status', { eventId, taskId, status, notes });
    },
    [eventId],
  );

  const advanceRunsheetItem = useCallback(
    (itemId: string, status: string, notes?: string) => {
      socketRef.current?.emit('runsheet:advance', { eventId, itemId, status, notes });
    },
    [eventId],
  );

  const checkInVendor = useCallback(
    (vendorId: string) => {
      socketRef.current?.emit('vendor:checkin', { eventId, vendorId });
    },
    [eventId],
  );

  return {
    connected,
    presenceUsers,
    sendBroadcast,
    triggerEmergency,
    updateTaskStatus,
    advanceRunsheetItem,
    checkInVendor,
  };
}
