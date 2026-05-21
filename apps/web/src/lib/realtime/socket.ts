import { io, Socket } from 'socket.io-client';
import { RealtimeEventType, RealtimePayload } from './types';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${process.env.NEXT_PUBLIC_API_URL}/realtime`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[WS] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[WS] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type RealtimeHandler<T = unknown> = (payload: RealtimePayload<T>) => void;

export function subscribeToEvent<T>(
  sock: Socket,
  eventType: RealtimeEventType,
  handler: RealtimeHandler<T>,
): () => void {
  sock.on(eventType, handler);
  return () => sock.off(eventType, handler);
}
